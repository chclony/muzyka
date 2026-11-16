// Biblioteka i ustawienia – zapis lokalny (localStorage) + zdarzenia dla synchronizacji (sync.js).
import { uid } from './util.js';

const KEY = 'muzyka.v1';
const DEF = () => ({
  v: 1, updatedAt: 0,
  settings: { jamendoId: '', autoplay: true },
  favorites: [], playlists: [], history: [], podcasts: [], positions: {}, queue: null,
});

let data;
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
  data = { ...DEF(), ...raw };
  data.settings = { ...DEF().settings, ...raw.settings };
} catch { data = DEF(); }

const subs = new Set();
let timer;
const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* pełna pamięć */ } };
const persist = () => { clearTimeout(timer); timer = setTimeout(flush, 200); };
// touch = zmiana danych użytkownika (podnosi znacznik czasu i uruchamia synchronizację)
const touch = (kind = 'data') => { data.updatedAt = Math.max(Date.now(), data.updatedAt + 1); persist(); subs.forEach(f => f(kind)); };
const slim = t => ({ ...t });

export const store = {
  get settings() { return data.settings; },
  get favorites() { return data.favorites; },
  get playlists() { return data.playlists; },
  get history() { return data.history; },
  get podcasts() { return data.podcasts; },
  get savedQueue() { return data.queue; },
  get updatedAt() { return data.updatedAt; },
  onChange: f => subs.add(f),

  setSetting(k, v) { data.settings[k] = v; touch(); },

  isFav: t => data.favorites.some(f => f.id === t.id),
  toggleFav(t) {
    const i = data.favorites.findIndex(f => f.id === t.id);
    if (i >= 0) data.favorites.splice(i, 1); else data.favorites.unshift(slim(t));
    touch(); return i < 0;
  },

  addHistory(t) {
    if (t.live) return;
    data.history = [slim(t), ...data.history.filter(h => h.id !== t.id)].slice(0, 100);
    touch('history');
  },
  clearHistory() { data.history = []; touch(); },

  createPlaylist(name) { const p = { id: uid(), name, tracks: [] }; data.playlists.push(p); touch(); return p; },
  renamePlaylist(id, name) { const p = data.playlists.find(x => x.id === id); if (p) { p.name = name; touch(); } },
  deletePlaylist(id) { data.playlists = data.playlists.filter(p => p.id !== id); touch(); },
  playlist: id => data.playlists.find(p => p.id === id),
  addToPlaylist(id, t) {
    const p = data.playlists.find(x => x.id === id);
    if (!p || p.tracks.some(x => x.id === t.id)) return false;
    p.tracks.push(slim(t)); touch(); return true;
  },
  removeFromPlaylist(id, trackId) {
    const p = data.playlists.find(x => x.id === id);
    if (p) { p.tracks = p.tracks.filter(t => t.id !== trackId); touch(); }
  },

  // subskrypcje podcastów
  isSub: show => data.podcasts.some(p => p.provider === show.provider && String(p.rawId) === String(show.rawId)),
  toggleSub(show) {
    const i = data.podcasts.findIndex(p => p.provider === show.provider && String(p.rawId) === String(show.rawId));
    if (i >= 0) data.podcasts.splice(i, 1); else data.podcasts.unshift({ type: 'album', provider: show.provider, rawId: show.rawId, title: show.title, subtitle: show.subtitle, cover: show.cover });
    touch(); return i < 0;
  },

  // pozycje odsłuchu odcinków (wznawianie)
  getPos: id => data.positions[id]?.s || 0,
  setPos(id, s) {
    data.positions[id] = { s: Math.floor(s), t: Date.now() };
    const ids = Object.keys(data.positions);
    if (ids.length > 300) ids.sort((a, b) => data.positions[a].t - data.positions[b].t).slice(0, ids.length - 300).forEach(k => delete data.positions[k]);
    touch('pos');
  },
  clearPos(id) { if (data.positions[id]) { delete data.positions[id]; touch('pos'); } },

  // kolejka odtwarzania – tylko lokalnie, bez synchronizacji
  saveQueue(queue, index) { data.queue = { queue: queue.slice(0, 200).map(slim), index }; persist(); },

  snapshot() {
    return { v: 1, updatedAt: data.updatedAt, settings: data.settings, favorites: data.favorites, playlists: data.playlists, history: data.history, podcasts: data.podcasts, positions: data.positions };
  },
  // przyjęcie nowszych danych z chmury (bez ponownego wypychania)
  applyRemote(r) {
    data = {
      ...data, updatedAt: r.updatedAt || 0, settings: { ...data.settings, ...(r.settings || {}) },
      favorites: r.favorites || [], playlists: r.playlists || [], history: r.history || [], podcasts: r.podcasts || [], positions: r.positions || {},
    };
    persist();
  },

  exportJSON() { return JSON.stringify({ ...this.snapshot(), exportedAt: new Date().toISOString() }, null, 2); },
  importJSON(text, mode = 'merge') {
    const d = typeof text === 'string' ? JSON.parse(text) : text;
    if (!d || d.v !== 1) throw new Error('Nieprawidłowy plik kopii');
    if (mode === 'replace') {
      data = { ...DEF(), queue: data.queue, favorites: d.favorites || [], playlists: d.playlists || [], history: d.history || [], podcasts: d.podcasts || [], positions: d.positions || {}, settings: { ...DEF().settings, ...(d.settings || {}) } };
    } else {
      const ids = new Set(data.favorites.map(f => f.id));
      data.favorites.push(...(d.favorites || []).filter(f => !ids.has(f.id)));
      const pids = new Set(data.playlists.map(p => p.id));
      data.playlists.push(...(d.playlists || []).filter(p => !pids.has(p.id)));
      const hids = new Set(data.history.map(h => h.id));
      data.history = [...data.history, ...(d.history || []).filter(h => !hids.has(h.id))].slice(0, 100);
      const subKey = p => p.provider + ':' + p.rawId;
      const sids = new Set(data.podcasts.map(subKey));
      data.podcasts.push(...(d.podcasts || []).filter(p => !sids.has(subKey(p))));
      for (const [k, v] of Object.entries(d.positions || {})) if (!data.positions[k] || data.positions[k].t < v.t) data.positions[k] = v;
      if (!data.settings.jamendoId && d.settings?.jamendoId) data.settings.jamendoId = d.settings.jamendoId;
    }
    touch();
  },
  flush,
};

window.addEventListener('pagehide', flush);
