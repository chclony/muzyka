// Odtwarzacz: kolejka, shuffle/repeat, autoodtwarzanie oraz Media Session (ekran blokady i CarPlay).
import { shuffle } from './util.js';
import { byId } from './providers/index.js';
import { store } from './store.js';

const audio = document.getElementById('audio');
const subs = new Set();
const emit = e => subs.forEach(f => f(e));
let errors = 0, lastPos = 0, lastSave = 0;

export const P = {
  queue: [], index: -1, shuffle: false, repeat: 'off', playing: false, busy: false, rate: 1,
  audio,
  on: f => subs.add(f),
  get current() { return this.queue[this.index]; },
};

const srcFor = t => (byId(t.provider)?.streamUrl?.(t, store.settings)) || t.url;

function setMeta(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist || '', album: t.album || '',
    artwork: t.cover ? [{ src: t.cover, sizes: '300x300' }] : [],
  });
  setSeekHandlers(!!t.episode);
}

function setSeekHandlers(on) {
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* nieobsługiwane */ } };
  h('seekbackward', on ? e => seek(audio.currentTime - (e.seekOffset || 15)) : null);
  h('seekforward', on ? e => seek(audio.currentTime + (e.seekOffset || 30)) : null);
}

// tempo i wznawianie odcinków podcastów
function applyEpisode(t) {
  audio.defaultPlaybackRate = t.episode ? P.rate : 1;
  audio.playbackRate = t.episode ? P.rate : 1;
  if (t.episode) {
    const pos = store.getPos(t.id);
    if (pos > 5) audio.addEventListener('loadedmetadata', () => { if (!(t.duration && pos > t.duration - 15)) audio.currentTime = pos; }, { once: true });
  }
}

function load(i, play = true) {
  const t = P.queue[i];
  if (!t) return;
  P.index = i;
  audio.src = srcFor(t);
  applyEpisode(t);
  setMeta(t);
  if (play) { audio.play().catch(() => {}); store.addHistory(t); }
  store.saveQueue(P.queue, i);
  emit('track');
}

export function playList(tracks, start = 0, { shuffleIt = false } = {}) {
  if (!tracks.length) return;
  errors = 0;
  P.shuffle = shuffleIt;
  if (shuffleIt) {
    const first = tracks[start] ?? tracks[0];
    P.queue = [first, ...shuffle(tracks.filter(t => t !== first))];
    load(0);
  } else {
    P.queue = [...tracks];
    load(start);
  }
  emit('queue');
}

export const enqueue = t => { P.queue.push(t); store.saveQueue(P.queue, P.index); emit('queue'); if (P.index < 0) load(0); };
export const playNext = t => { P.queue.splice(P.index + 1, 0, t); store.saveQueue(P.queue, P.index); emit('queue'); if (P.index < 0) load(0); };
export const jump = i => { errors = 0; load(i); };
export const removeAt = i => {
  if (i === P.index) return;
  P.queue.splice(i, 1);
  if (i < P.index) P.index--;
  store.saveQueue(P.queue, P.index);
  emit('queue');
};

export const skip = d => { audio.currentTime = Math.max(0, audio.currentTime + d); };
export function cycleRate() {
  const r = [1, 1.25, 1.5, 1.75, 2, 0.85];
  P.rate = r[(r.indexOf(P.rate) + 1) % r.length];
  audio.playbackRate = P.rate; audio.defaultPlaybackRate = P.rate;
  emit('state');
}

export const toggle = () => { if (!audio.src) return; audio.paused ? audio.play().catch(() => {}) : audio.pause(); };
export const seek = s => { if (isFinite(s)) audio.currentTime = s; };

export function setShuffle(on) {
  P.shuffle = on;
  if (on && P.index >= 0) {
    const head = P.queue.slice(0, P.index + 1), rest = shuffle(P.queue.slice(P.index + 1));
    P.queue = [...head, ...rest];
    store.saveQueue(P.queue, P.index);
    emit('queue');
  }
  emit('state');
}
export const cycleRepeat = () => { P.repeat = { off: 'all', all: 'one', one: 'off' }[P.repeat]; emit('state'); };

async function more() {
  const t = P.current;
  if (!t || !store.settings.autoplay) return false;
  const p = byId(t.provider);
  if (!p?.related) return false;
  P.busy = true; emit('state');
  try {
    const have = new Set(P.queue.map(x => x.id));
    const r = (await p.related(t, store.settings)).filter(x => !have.has(x.id));
    if (r.length) { P.queue.push(...r); emit('queue'); return true; }
  } catch { /* brak sieci / błąd API */ } finally { P.busy = false; emit('state'); }
  return false;
}

export async function next() {
  if (P.index < P.queue.length - 1) return load(P.index + 1);
  if (P.repeat === 'all' && P.queue.length) return load(0);
  if (await more()) return load(P.index + 1);
  audio.pause();
}
export function prev() {
  if (audio.currentTime > 3 && !P.current?.live) { audio.currentTime = 0; return; }
  load(Math.max(0, P.index - 1));
}

const savePos = () => { const t = P.current; if (t?.episode && audio.currentTime > 5) store.setPos(t.id, audio.currentTime); };
audio.addEventListener('ended', () => {
  if (P.current?.episode) store.clearPos(P.current.id);
  if (P.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  next();
});
audio.addEventListener('play', () => { P.playing = true; errors = 0; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; emit('state'); });
audio.addEventListener('pause', () => { savePos(); P.playing = false; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; emit('state'); });
audio.addEventListener('waiting', () => { P.busy = true; emit('state'); });
audio.addEventListener('playing', () => { P.busy = false; emit('state'); });
audio.addEventListener('error', () => {
  if (!audio.src || P.index < 0) return;
  errors++;
  emit('error');
  if (errors <= 3 && P.index < P.queue.length - 1) setTimeout(next, 800);
  else { P.playing = false; emit('state'); }
});
audio.addEventListener('timeupdate', () => {
  emit('time');
  const now = Date.now();
  if (now - lastSave > 15000) { lastSave = now; savePos(); }
  if (now - lastPos > 1000 && 'mediaSession' in navigator && isFinite(audio.duration) && audio.duration > 0) {
    lastPos = now;
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate }); } catch { /* ignore */ }
  }
});
audio.addEventListener('durationchange', () => emit('time'));

if ('mediaSession' in navigator) {
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* nieobsługiwane */ } };
  h('play', () => audio.play().catch(() => {}));
  h('pause', () => audio.pause());
  h('previoustrack', prev);
  h('nexttrack', next);
  h('seekto', e => seek(e.seekTime));
}

// Przywrócenie ostatniej kolejki po uruchomieniu (bez automatycznego grania)
export function restore() {
  const s = store.savedQueue;
  if (s?.queue?.length) {
    P.queue = s.queue;
    P.index = Math.min(s.index, s.queue.length - 1);
    const t = P.current;
    if (t) { audio.src = srcFor(t); applyEpisode(t); setMeta(t); emit('track'); emit('queue'); }
  }
}
