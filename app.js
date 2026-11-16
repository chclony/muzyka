import { esc, fmt, interleave } from './util.js';
import { providers, byId, active } from './providers/index.js';
import { GENRES } from './providers/jamendo.js';
import { RADIO_TAGS } from './providers/radio.js';
import { store } from './store.js';
import * as pl from './player.js';
import { sync } from './sync.js';

const { P } = pl;
const $ = s => document.querySelector(s);
const view = $('#view');

/* ---------- ikony ---------- */
const svg = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const I = {
  play: svg('M8 5v14l11-7z'),
  pause: svg('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
  next: svg('M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z'),
  prev: svg('M6 6h2v12H6zm3.5 6l8.5 6V6z'),
  shuffle: svg('M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z'),
  repeat: svg('M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z'),
  heart: svg('M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'),
  heartOn: svg('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'),
  more: svg('M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'),
  down: svg('M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z'),
  search: svg('M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'),
  home: svg('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'),
  radio: svg('M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z'),
  library: svg('M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z'),
  back: svg('M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
  add: svg('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
};
const BLANK = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#20202b"/><path d="M5.5 2.5v3.6a1.2 1.2 0 11-.6-1V3.6L3.6 4v2.6" fill="none" stroke="#555" stroke-width=".4"/></svg>');
window.BLANK = BLANK;

/* ---------- rejestry obiektów (dla data-atrybutów) ---------- */
const R = new Map(), L = new Map();
let rid = 0;
const reg = o => { if (R.size > 4000) { R.clear(); L.clear(); } const k = 'k' + ++rid; R.set(k, o); return k; };
const regList = a => { const k = 'l' + ++rid; L.set(k, a); return k; };

const img = (src, cls = '') => `<img class="${cls}" loading="lazy" alt="" src="${esc(src || BLANK)}" onerror="this.onerror=null;this.src=BLANK">`;

function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), ms);
}

/* ---------- budowanie list ---------- */
function trackRows(tracks, { ctx = '' } = {}) {
  if (!tracks.length) return '';
  const lk = regList(tracks);
  return tracks.map((t, i) => `
    <div class="row${P.current?.id === t.id ? ' cur' : ''}" data-act="playAt" data-list="${lk}" data-i="${i}">
      ${img(t.cover)}
      <div class="meta"><b>${esc(t.title)}</b><small>${esc(t.episode ? (t.date ? new Date(t.date).toLocaleDateString('pl-PL') : t.artist) : t.artist)}${t.duration ? ' · ' + fmt(t.duration) : t.live ? ' · NA ŻYWO' : ''}${t.episode && store.getPos(t.id) > 5 ? ' · wznów od ' + fmt(store.getPos(t.id)) : ''}</small></div>
      <button class="ib" data-act="more" data-k="${reg(t)}" data-ctx="${esc(ctx)}" aria-label="Więcej">${I.more}</button>
    </div>`).join('');
}

function cards(items, { round = false } = {}) {
  return items.map(it => `
    <div class="card${round || it.type === 'artist' ? ' round' : ''}" data-act="open" data-k="${reg(it)}">
      ${img(it.cover)}<b>${esc(it.title)}</b><small>${esc(it.subtitle || '')}</small>
    </div>`).join('');
}

function trackCards(tracks) {
  const lk = regList(tracks);
  return tracks.map((t, i) => `
    <div class="card" data-act="playAt" data-list="${lk}" data-i="${i}">
      ${img(t.cover)}<b>${esc(t.title)}</b><small>${esc(t.artist)}</small>
    </div>`).join('');
}

const section = (title, inner) => inner ? `<h2>${esc(title)}</h2>${inner}` : '';
const hs = inner => `<div class="hscroll">${inner}</div>`;
const chips = (items, cur, act) => `<div class="chips">${items.map(([id, label]) => `<button class="chip${id === cur ? ' on' : ''}" data-act="${act}" data-v="${esc(id)}">${esc(label)}</button>`).join('')}</div>`;

function detailHTML(d, { playlistId = '', canEdit = false } = {}) {
  const subBtn = d.show ? `<button class="btn sub-btn${store.isSub(d.show) ? ' on' : ''}" data-act="sub" data-k="${reg(d.show)}">${store.isSub(d.show) ? '✓ Subskrybujesz' : '+ Subskrybuj'}</button>` : '';
  const lk = regList(d.tracks || []);
  return `
    <div class="detail-h">
      ${img(d.cover)}<h3>${esc(d.title)}</h3><small>${esc(d.subtitle || '')}${d.tracks?.length ? ' · ' + d.tracks.length + ' utw.' : ''}</small>
      ${d.tracks?.length ? `<div class="btns"><button class="btn pri" data-act="playAll" data-list="${lk}">▶ Odtwórz</button><button class="btn" data-act="playAll" data-list="${lk}" data-shuffle="1">Losowo</button>${subBtn}</div>` : subBtn ? `<div class="btns">${subBtn}</div>` : ''}
      ${canEdit ? `<div class="btns"><button class="btn" data-act="renamePl" data-id="${playlistId}">Zmień nazwę</button><button class="btn danger" data-act="deletePl" data-id="${playlistId}">Usuń</button></div>` : ''}
    </div>
    ${d.tracks?.length ? trackRows(d.tracks, { ctx: playlistId }) : '<div class="empty">Brak utworów.</div>'}
    ${d.albums?.length ? section('Albumy i playlisty', hs(cards(d.albums))) : ''}`;
}

/* ---------- nawigacja ---------- */
let stack = [{ v: 'home' }];
let token = 0;
const TITLES = { home: 'Muzyka', search: 'Szukaj', radio: 'Radio', library: 'Biblioteka' };
const states = { search: { q: '', html: '' }, radio: { mode: 'country', value: 'PL', q: '' }, lib: 'fav' };

const go = v => { stack.push(v); render(); };
const tab = t => { stack = [{ v: t }]; render(); };
const back = () => { if (stack.length > 1) { stack.pop(); render(); } };

async function render() {
  const top = stack.at(-1), my = ++token, alive = () => my === token;
  $('#title').textContent = top.name || TITLES[top.v] || '';
  $('#back').hidden = stack.length < 2;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === stack[0].v));
  view.scrollTop = 0;
  view.innerHTML = '<div class="skel">Ładowanie…</div>';
  try {
    const r = await views[top.v](top, alive);
    if (!alive()) return;
    if (r.title) $('#title').textContent = r.title;
    view.innerHTML = r.html;
    r.after?.(alive);
  } catch (e) {
    if (alive()) view.innerHTML = `<div class="empty">Nie udało się wczytać.<br><small>${esc(e.message || e)}</small></div>`;
  }
}

const settled = async (promises) => (await Promise.allSettled(promises));

/* ---------- widoki ---------- */
const views = {
  async home(v, alive) {
    const s = store.settings;
    let html = '';
    if (!s.jamendoId) html += `<div class="note">Dodaj darmowy klucz Jamendo (Biblioteka → Ustawienia), aby odblokować największy katalog. Audius, Archive i Radio działają od razu.</div>`;
    html += chips(GENRES.map(g => [g, g]), '', 'genre');
    if (store.history.length) html += section('Ostatnio słuchane', hs(trackCards(store.history.slice(0, 15))));
    html += '<div id="home-sections"></div>';
    return {
      html,
      after: () => {
        const box = $('#home-sections');
        active(s).filter(p => p.home).forEach(p => {
          p.home(s).then(secs => {
            if (!alive()) return;
            box.insertAdjacentHTML('beforeend', secs.map(sec =>
              section(sec.title, hs(sec.tracks ? trackCards(sec.tracks) : cards(sec.albums)))).join(''));
          }).catch(() => {
            if (alive()) box.insertAdjacentHTML('beforeend', `<div class="err">${esc(p.label)}: brak odpowiedzi</div>`);
          });
        });
      },
    };
  },

  async genre(v) {
    const s = store.settings;
    const res = await settled(active(s).filter(p => p.genre).map(p => p.genre(v.tag, s)));
    const tracks = interleave(res.filter(r => r.status === 'fulfilled').map(r => r.value));
    return { html: detailHTML({ title: v.tag, subtitle: 'Gatunek', cover: tracks[0]?.cover, tracks }) };
  },

  async album(v) {
    const d = await byId(v.provider).album(v.id, store.settings);
    return { title: d.title, html: detailHTML(d) };
  },

  async artist(v) {
    const d = await byId(v.provider).artist(v.id, store.settings);
    return { title: d.title, html: detailHTML(d) };
  },

  async playlist(v) {
    const p = store.playlist(v.id);
    if (!p) return { html: '<div class="empty">Playlista nie istnieje.</div>' };
    return { title: p.name, html: detailHTML({ title: p.name, subtitle: 'Twoja playlista', cover: p.tracks[0]?.cover, tracks: p.tracks }, { playlistId: p.id, canEdit: true }) };
  },

  async search() {
    const S = states.search;
    return {
      html: `<div class="search">${I.search}<input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" placeholder="Utwory, albumy, wykonawcy…" value="${esc(S.q)}"></div><div id="res">${S.html || '<div class="empty">Wpisz, czego szukasz.</div>'}</div>`,
      after: () => {
        const q = $('#q');
        let t;
        q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => doSearch(q.value), 500); });
        q.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(t); q.blur(); doSearch(q.value); } });
        if (!S.q) q.focus();
      },
    };
  },

  async radio() {
    const S = states.radio;
    return {
      html: `<div class="search">${I.search}<input id="rq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Szukaj stacji…" value="${esc(S.q)}"></div>
        ${chips([['PL', 'Polska'], ['TOP', 'Top świat'], ...RADIO_TAGS.map(t => ['tag:' + t, t])], S.mode === 'tag' ? 'tag:' + S.value : S.mode === 'q' ? '' : S.value || 'TOP', 'radioMode')}
        <div id="res"><div class="skel">Ładowanie…</div></div>`,
      after: alive => {
        const rq = $('#rq');
        rq.addEventListener('keydown', e => { if (e.key === 'Enter') { rq.blur(); S.mode = 'q'; S.q = rq.value; loadRadio(alive); } });
        loadRadio(alive);
      },
    };
  },

  async library() {
    const tabHTML = (() => {
      switch (states.lib) {
        case 'fav': return store.favorites.length
          ? `<div class="btns" style="margin:0 0 8px"><button class="btn pri" data-act="playAll" data-list="${regList(store.favorites)}">▶ Odtwórz</button><button class="btn" data-act="playAll" data-list="${regList(store.favorites)}" data-shuffle="1">Losowo</button></div>${trackRows(store.favorites)}`
          : '<div class="empty">Nie masz jeszcze ulubionych.<br>Dotknij ⋯ przy utworze i wybierz „Dodaj do ulubionych”.</div>';
        case 'pl': return `<button class="btn pri" data-act="newPl" style="margin-bottom:10px">+ Nowa playlista</button>` +
          (store.playlists.length ? store.playlists.map(p => `<div class="row" data-act="openPl" data-id="${p.id}">${img(p.tracks[0]?.cover)}<div class="meta"><b>${esc(p.name)}</b><small>${p.tracks.length} utw.</small></div></div>`).join('') : '<div class="empty">Brak playlist.</div>');
        case 'pod': return store.podcasts.length
          ? `<div class="grid">${cards(store.podcasts)}</div>`
          : '<div class="empty">Nie subskrybujesz jeszcze żadnych podcastów.<br>Wyszukaj podcast i wybierz „Subskrybuj”.</div>';
        case 'hist': return store.history.length
          ? trackRows(store.history) + `<button class="btn danger" data-act="clearHist" style="margin-top:14px">Wyczyść historię</button>`
          : '<div class="empty">Historia jest pusta.</div>';
        default: return settingsHTML();
      }
    })();
    const segs = [['fav', 'Ulubione'], ['pl', 'Playlisty'], ['pod', 'Podcasty'], ['hist', 'Historia'], ['set', 'Ustawienia']];
    return { html: `<div class="seg">${segs.map(([id, l]) => `<button class="${states.lib === id ? 'on' : ''}" data-act="libTab" data-v="${id}">${l}</button>`).join('')}</div>${tabHTML}`, after: () => showSync() };
  },
};

function settingsHTML() {
  const s = store.settings;
  return `
    <div class="field"><label for="s-jam">Klucz Jamendo (client_id)</label>
      <input type="text" id="s-jam" value="${esc(s.jamendoId)}" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="np. 1a2b3c4d">
      <small>Darmowy, rejestracja na devportal.jamendo.com (utwórz aplikację → skopiuj Client ID). Odblokowuje katalog Jamendo.</small></div>
    <label class="switch"><span>Autoodtwarzanie podobnych, gdy kolejka się skończy</span><input type="checkbox" id="s-auto" ${s.autoplay ? 'checked' : ''}></label>
    <button class="btn pri" data-act="saveSettings">Zapisz ustawienia</button>
    <h2>Synchronizacja (GitHub)</h2>
    <div class="note">Biblioteka (ulubione, playlisty, podcasty, historia, pozycje odcinków) jest zapisywana w Twoim <b>prywatnym</b> repozytorium GitHub – poza przeglądarką, więc nie zginie przy czyszczeniu danych.</div>
    ${sync.enabled ? `<div class="status" id="sync-status"></div>
      <div class="note">Repozytorium: ${esc(sync.cfg.repo)}</div>
      <div class="btns"><button class="btn" data-act="syncNow">Synchronizuj teraz</button><button class="btn danger" data-act="syncOff">Rozłącz</button></div>` :
      `<div class="field"><label for="g-repo">Repozytorium (wlasciciel/nazwa)</label><input type="text" id="g-repo" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="np. jan/muzyka-dane"></div>
       <div class="field"><label for="g-tok">Token dostępu (fine-grained)</label><input type="password" id="g-tok" autocomplete="off" placeholder="github_pat_…"><small>Zakres: tylko to jedno repozytorium, uprawnienie Contents → Read and write.</small></div>
       <div class="status" id="sync-status"></div>
       <button class="btn pri" data-act="syncOn">Połącz i synchronizuj</button>`}
    <h2>Kopia zapasowa (plik)</h2>
    <div class="note">Dodatkowo możesz wyeksportować bibliotekę do pliku.</div>
    <div class="btns"><button class="btn" data-act="export">Eksportuj</button><button class="btn" data-act="import">Importuj</button></div>
    <h2>O aplikacji</h2>
    <div class="note">Źródła: Jamendo (Creative Commons), Audius (muzyka niezależna), Internet Archive (domena publiczna, koncerty), podcasty z katalogu Apple, Radio Browser (stacje radiowe). Szanuj licencje twórców.</div>`;
}

/* ---------- wyszukiwanie ---------- */
let searchSeq = 0;
async function doSearch(q) {
  q = q.trim();
  const S = states.search;
  S.q = q;
  const res = $('#res');
  if (!q) { S.html = ''; res.innerHTML = '<div class="empty">Wpisz, czego szukasz.</div>'; return; }
  const my = ++searchSeq, s = store.settings;
  res.innerHTML = '<div class="skel">Szukam…</div>';
  const provs = active(s).filter(p => p.search);
  const out = await settled(provs.map(p => p.search(q, s)));
  if (my !== searchSeq || !$('#res')) return;
  const ok = out.map((r, i) => r.status === 'fulfilled' ? r.value : null);
  const fails = out.map((r, i) => r.status === 'rejected' ? provs[i].label : null).filter(Boolean);
  const pick = k => ok.filter(Boolean).map(r => r[k] || []);
  const tracks = interleave(pick('tracks')).slice(0, 40);
  const albums = interleave(pick('albums')).slice(0, 24);
  const artists = interleave(pick('artists')).slice(0, 16);
  const stations = interleave(pick('stations')).slice(0, 10);
  let html = section('Utwory', trackRows(tracks)) + section('Albumy i playlisty', albums.length ? hs(cards(albums)) : '') +
    section('Wykonawcy', artists.length ? hs(cards(artists)) : '') + section('Stacje radiowe', trackRows(stations));
  if (!html) html = '<div class="empty">Brak wyników.</div>';
  if (fails.length) html += `<div class="err">Brak odpowiedzi: ${esc(fails.join(', '))}</div>`;
  if (!s.jamendoId) html += `<div class="note">Wyszukujesz bez Jamendo – dodaj klucz w Ustawieniach, by zobaczyć więcej wyników.</div>`;
  S.html = html;
  res.innerHTML = html;
}

async function loadRadio(alive) {
  const S = states.radio, res = $('#res');
  res.innerHTML = '<div class="skel">Ładowanie…</div>';
  const radio = byId('radio');
  const params = S.mode === 'q' ? { name: S.q } : S.mode === 'tag' ? { tag: S.value } : S.mode === 'country' ? { countrycode: S.value } : {};
  try {
    const st = await radio.stations({ ...params, limit: 50 });
    if (!alive() || !$('#res')) return;
    res.innerHTML = st.length ? trackRows(st) : '<div class="empty">Brak stacji (tylko https).</div>';
  } catch (e) {
    if (alive()) res.innerHTML = `<div class="empty">Nie udało się pobrać stacji.<br><small>${esc(e.message || e)}</small></div>`;
  }
}

/* ---------- okna modalne ---------- */
let sheetFns = [];
function sheet(title, items) {
  sheetFns = items.map(i => i.fn);
  $('#modal').innerHTML = `<div class="sheet"><h4>${esc(title)}</h4>${items.map((it, i) => `<button class="item" data-sheet="${i}">${esc(it.label)}</button>`).join('')}</div>`;
  $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; $('#modal').innerHTML = ''; };
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const b = e.target.closest('[data-sheet]');
  if (b) { const f = sheetFns[+b.dataset.sheet]; closeModal(); f?.(); }
});

function askText(title, value = '') {
  return new Promise(resolve => {
    $('#modal').innerHTML = `<div class="sheet"><h4>${esc(title)}</h4><input type="text" id="ask" value="${esc(value)}" autocomplete="off"><button class="btn pri" id="ask-ok" style="width:100%">OK</button></div>`;
    $('#modal').hidden = false;
    const inp = $('#ask'); inp.focus(); inp.select();
    const done = v => { closeModal(); resolve(v); };
    $('#ask-ok').onclick = () => done(inp.value.trim() || null);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim() || null); };
    $('#modal').onclick = e => { if (e.target.id === 'modal') { $('#modal').onclick = null; done(null); } };
  });
}

function trackMenu(t, ctx = '') {
  const p = byId(t.provider);
  const items = [];
  items.push({ label: 'Odtwórz jako następny', fn: () => { pl.playNext(t); toast('Dodano jako następny'); } });
  items.push({ label: 'Dodaj do kolejki', fn: () => { pl.enqueue(t); toast('Dodano do kolejki'); } });
  if (!t.live) items.push({ label: 'Dodaj do playlisty…', fn: () => pickPlaylist(t) });
  items.push({ label: store.isFav(t) ? 'Usuń z ulubionych' : 'Dodaj do ulubionych', fn: () => { toast(store.toggleFav(t) ? 'Dodano do ulubionych' : 'Usunięto z ulubionych'); refreshFav(); if (states.lib === 'fav' && stack.at(-1).v === 'library') render(); } });
  if (t.artistId && p?.artist) items.push({ label: 'Przejdź do wykonawcy', fn: () => nav({ v: 'artist', provider: t.provider, id: t.artistId, name: t.artist }) });
  if (t.albumId && p?.album) items.push({ label: t.episode ? 'Przejdź do podcastu' : 'Przejdź do albumu', fn: () => nav({ v: 'album', provider: t.provider, id: t.albumId, name: t.album }) });
  if (ctx) items.push({ label: 'Usuń z tej playlisty', fn: () => { store.removeFromPlaylist(ctx, t.id); render(); } });
  sheet(t.title, items);
}

function nav(v) { closePlayer(); go(v); }

function pickPlaylist(t) {
  const items = store.playlists.map(p => ({ label: p.name, fn: () => toast(store.addToPlaylist(p.id, t) ? `Dodano do „${p.name}”` : 'Już jest na playliście') }));
  items.push({ label: '+ Nowa playlista…', fn: async () => { const n = await askText('Nazwa playlisty'); if (n) { const p = store.createPlaylist(n); store.addToPlaylist(p.id, t); toast(`Dodano do „${n}”`); } } });
  sheet('Dodaj do playlisty', items);
}

/* ---------- pełny odtwarzacz ---------- */
const openPlayer = () => { if (P.index < 0) return; $('#player').hidden = false; renderQueue(); updateTrack(); };
const closePlayer = () => { $('#player').hidden = true; };

function refreshFav() {
  const t = P.current;
  $('#p-fav').innerHTML = t && store.isFav(t) ? I.heartOn : I.heart;
  $('#p-fav').classList.toggle('on', !!t && store.isFav(t));
}

function updateTrack() {
  const t = P.current;
  $('#mini').hidden = !t;
  if (!t) return;
  $('#mini-cover').src = t.cover || BLANK; $('#mini-title').textContent = t.title; $('#mini-artist').textContent = t.artist;
  $('#p-cover').src = t.cover || BLANK; $('#p-title').textContent = t.title; $('#p-artist').textContent = t.artist;
  $('#p-range').disabled = !!t.live;
  $('#p-skip').hidden = !t.episode;
  refreshFav();
  updateTime();
  if (!$('#player').hidden) renderQueue();
}

function updateState() {
  const icon = P.playing ? I.pause : I.play;
  $('#mini-play').innerHTML = icon; $('#p-play').innerHTML = icon;
  $('#p-shuffle').classList.toggle('on', P.shuffle);
  $('#p-repeat').classList.toggle('on', P.repeat !== 'off');
  $('#p-repeat').innerHTML = I.repeat + (P.repeat === 'one' ? '<span style="position:absolute;font-size:10px;font-weight:700">1</span>' : '');
  $('#p-status').textContent = P.busy ? 'Ładowanie…' : '';
  $('#p-rate').textContent = P.rate + '×';
}

let dragging = false;
function updateTime() {
  const a = P.audio, d = a.duration, t = P.current;
  if (t?.live || !isFinite(d) || d <= 0) {
    $('#p-cur').textContent = t?.live ? 'NA ŻYWO' : fmt(a.currentTime); $('#p-dur').textContent = '';
    $('#mini-prog').style.width = '0';
    return;
  }
  const f = a.currentTime / d;
  $('#mini-prog').style.width = f * 100 + '%';
  if (!dragging) {
    $('#p-range').value = f * 1000; $('#p-range').style.setProperty('--p', f * 100 + '%');
    $('#p-cur').textContent = fmt(a.currentTime);
  }
  $('#p-dur').textContent = fmt(d);
}

function renderQueue() {
  const q = P.queue;
  $('#p-queue').innerHTML = q.map((t, i) => `
    <div class="row${i === P.index ? ' cur' : ''}" data-act="qJump" data-i="${i}">
      ${img(t.cover)}<div class="meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div>
      ${i === P.index ? '' : `<button class="ib" data-act="qRemove" data-i="${i}" aria-label="Usuń z kolejki">×</button>`}
    </div>`).join('');
  $('#p-queue .cur')?.scrollIntoView({ block: 'nearest' });
}

$('#p-range').addEventListener('input', e => {
  dragging = true;
  const d = P.audio.duration;
  if (isFinite(d)) { $('#p-cur').textContent = fmt(e.target.value / 1000 * d); e.target.style.setProperty('--p', e.target.value / 10 + '%'); }
});
$('#p-range').addEventListener('change', e => {
  const d = P.audio.duration;
  if (isFinite(d)) pl.seek(e.target.value / 1000 * d);
  dragging = false;
});

P.on(e => {
  if (e === 'track') updateTrack();
  else if (e === 'state') updateState();
  else if (e === 'time') updateTime();
  else if (e === 'queue') { if (!$('#player').hidden) renderQueue(); }
  else if (e === 'error') toast('Nie udało się odtworzyć utworu – pomijam');
});

/* ---------- akcje ---------- */
const A = {
  back, openPlayer, closePlayer,
  toggle: () => pl.toggle(), next: () => pl.next(), prev: () => pl.prev(),
  shuffle: () => pl.setShuffle(!P.shuffle), repeat: () => pl.cycleRepeat(),
  playAt: d => pl.playList(L.get(d.list), +d.i),
  playAll: d => pl.playList(L.get(d.list), 0, { shuffleIt: !!d.shuffle }),
  more: d => trackMenu(R.get(d.k), d.ctx),
  open: d => { const o = R.get(d.k); go({ v: o.type === 'artist' ? 'artist' : 'album', provider: o.provider, id: o.rawId, name: o.title }); },
  genre: d => go({ v: 'genre', tag: d.v, name: d.v }),
  radioMode: d => {
    const S = states.radio, v = d.v;
    S.q = ''; if (v === 'PL') { S.mode = 'country'; S.value = 'PL'; } else if (v === 'TOP') { S.mode = 'top'; S.value = ''; } else { S.mode = 'tag'; S.value = v.slice(4); }
    render();
  },
  sub: d => { const sh = R.get(d.k); toast(store.toggleSub(sh) ? 'Subskrybujesz podcast' : 'Anulowano subskrypcję'); render(); },
  skipBack: () => pl.skip(-15), skipFwd: () => pl.skip(30), rate: () => pl.cycleRate(),
  syncOn: async () => {
    try { await sync.connect($('#g-repo').value, $('#g-tok').value); toast('Połączono z GitHub'); render(); }
    catch (e) { showSync({ state: 'err', msg: e.message }); }
  },
  syncNow: () => sync.now(),
  syncOff: () => sheet('Rozłączyć synchronizację?', [{ label: 'Rozłącz (dane zostają w repozytorium)', fn: () => { sync.disconnect(); render(); } }, { label: 'Anuluj', fn: () => {} }]),
  libTab: d => { states.lib = d.v; render(); },
  playerFav: () => { const t = P.current; if (t) { toast(store.toggleFav(t) ? 'Dodano do ulubionych' : 'Usunięto z ulubionych'); refreshFav(); } },
  playerArtist: () => { const t = P.current; if (t?.artistId && byId(t.provider)?.artist) nav({ v: 'artist', provider: t.provider, id: t.artistId, name: t.artist }); },
  playerMore: () => { if (P.current) trackMenu(P.current); },
  qJump: d => pl.jump(+d.i),
  qRemove: d => pl.removeAt(+d.i),
  newPl: async () => { const n = await askText('Nazwa playlisty'); if (n) { store.createPlaylist(n); render(); } },
  openPl: d => go({ v: 'playlist', id: d.id, name: store.playlist(d.id)?.name }),
  renamePl: async d => { const n = await askText('Nowa nazwa', store.playlist(d.id)?.name); if (n) { store.renamePlaylist(d.id, n); render(); } },
  deletePl: d => sheet('Usunąć playlistę?', [{ label: 'Usuń', fn: () => { store.deletePlaylist(d.id); back(); } }, { label: 'Anuluj', fn: () => {} }]),
  clearHist: () => { store.clearHistory(); render(); },
  saveSettings: () => {
    store.setSetting('jamendoId', $('#s-jam').value.trim());
    store.setSetting('autoplay', $('#s-auto').checked);
    toast('Zapisano');
  },
  export: async () => {
    const file = new File([new Blob([store.exportJSON()], { type: 'application/json' })], 'muzyka-kopia.json', { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  },
  import: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      try {
        const text = await inp.files[0].text();
        sheet('Import kopii', [
          { label: 'Połącz z obecną biblioteką', fn: () => { store.importJSON(text, 'merge'); toast('Zaimportowano'); render(); } },
          { label: 'Zastąp obecną bibliotekę', fn: () => { store.importJSON(text, 'replace'); toast('Zaimportowano'); render(); } },
        ]);
      } catch (e) { toast('Błąd pliku: ' + e.message); }
    };
    inp.click();
  },
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (t && A[t.dataset.act]) { e.preventDefault(); A[t.dataset.act](t.dataset); return; }
  const tb = e.target.closest('#tabs [data-tab]');
  if (tb) tab(tb.dataset.tab);
});

/* ---------- synchronizacja ---------- */
function showSync(st = sync.status) {
  const el = $('#sync-status');
  if (!el) return;
  el.className = 'status ' + (st.state === 'ok' ? 'ok' : st.state === 'err' ? 'err' : '');
  el.textContent = st.msg || (st.state === 'ok' ? 'Zsynchronizowano' : '');
}
sync.on(e => {
  if (e === 'status') showSync();
  if (e === 'pulled') { const v = stack.at(-1).v; if (v === 'library' || v === 'home') render(); }
});

/* ---------- start ---------- */
$('#back').innerHTML = I.back;
$('#p-close').innerHTML = I.down; $('#p-more').innerHTML = I.more;
$('#p-shuffle').innerHTML = I.shuffle; $('#p-prev').innerHTML = I.prev; $('#p-next').innerHTML = I.next;
$('#mini-next').innerHTML = I.next;
$('#p-repeat').style.position = 'relative';
[['home', 'Start', I.home], ['search', 'Szukaj', I.search], ['radio', 'Radio', I.radio], ['library', 'Biblioteka', I.library]]
  .forEach(([id, l, ic]) => { $(`#tabs [data-tab=${id}]`).innerHTML = ic + `<span>${l}</span>`; });
updateState();
pl.restore();
render();
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
