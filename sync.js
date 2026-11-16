// Synchronizacja biblioteki z PRYWATNYM repozytorium GitHub (plik JSON).
// Dane żyją poza przeglądarką – po wyczyszczeniu pamięci Safari wystarczy ponownie wpisać token.
// Zasada: wygrywa nowsza wersja (znacznik updatedAt); przy pierwszym połączeniu dane są łączone.
import { store } from './store.js';

const KEY = 'muzyka.sync';
const API = 'https://api.github.com';
let cfg = { repo: '', token: '', path: 'muzyka-library.json', sha: '', last: 0 };
try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* brak konfiguracji */ }

const subs = new Set();
const emit = e => subs.forEach(f => f(e));
let status = { state: cfg.repo && cfg.token ? 'idle' : 'off', msg: '' };
let timer = null, dueAt = 0, running = false;

const enabled = () => !!(cfg.repo && cfg.token);
const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ignore */ } };
const setStatus = (state, msg = '') => { status = { state, msg }; emit('status'); };

const enc = s => { const b = new TextEncoder().encode(s); let bin = ''; b.forEach(c => (bin += String.fromCharCode(c))); return btoa(bin); };
const dec = b => { const bin = atob(b.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); };

const fileUrl = () => `${API}/repos/${cfg.repo}/contents/${cfg.path.split('/').map(encodeURIComponent).join('/')}`;
const gh = (url, opt = {}) => fetch(url, {
  cache: 'no-store', ...opt,
  headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', ...(opt.headers || {}) },
});

const httpError = (r, what) => {
  const e = new Error(r.status === 401 ? 'Nieprawidłowy lub wygasły token' : r.status === 403 ? 'Brak uprawnień tokenu (potrzebne: Contents – odczyt i zapis)' :
    r.status === 404 ? 'Nie znaleziono repozytorium – sprawdź nazwę i uprawnienia tokenu' : `${what}: błąd GitHub ${r.status}`);
  e.status = r.status;
  return e;
};

async function getRemote() {
  const r = await gh(fileUrl());
  if (r.status === 404) { cfg.sha = ''; return null; }
  if (!r.ok) throw httpError(r, 'Odczyt');
  const j = await r.json();
  cfg.sha = j.sha;
  let text;
  if (j.encoding === 'base64' && j.content) text = dec(j.content);
  else { // pliki > 1 MB – pobierz surową treść
    const raw = await gh(fileUrl(), { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) throw httpError(raw, 'Odczyt');
    text = await raw.text();
  }
  return JSON.parse(text);
}

async function putRemote() {
  const body = { message: 'sync ' + new Date().toISOString(), content: enc(JSON.stringify(store.snapshot())) };
  if (cfg.sha) body.sha = cfg.sha;
  const r = await gh(fileUrl(), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (r.status === 409 || r.status === 422) { const e = new Error('Konflikt wersji'); e.conflict = true; throw e; }
  if (!r.ok) throw httpError(r, 'Zapis');
  const j = await r.json();
  cfg.sha = j.content?.sha || '';
  saveCfg();
}

const hhmm = () => new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

async function run(retry = true) {
  if (!enabled()) return;
  if (running) return;
  running = true;
  setStatus('busy', 'Synchronizuję…');
  try {
    const remote = await getRemote();
    const localAt = store.updatedAt;
    if (!remote) await putRemote();
    else if ((remote.updatedAt || 0) > localAt) { store.applyRemote(remote); emit('pulled'); }
    else if (localAt > (remote.updatedAt || 0)) await putRemote();
    cfg.last = Date.now(); saveCfg();
    setStatus('ok', 'Zsynchronizowano ' + hhmm());
  } catch (e) {
    running = false;
    if (e.conflict && retry) return run(false);
    setStatus('err', e.message === 'Failed to fetch' ? 'Brak połączenia z GitHub' : e.message);
  } finally { running = false; }
}

function schedule(kind) {
  if (!enabled()) return;
  const delay = kind === 'history' || kind === 'pos' ? 120000 : 4000;
  const due = Date.now() + delay;
  if (timer && dueAt <= due) return;
  clearTimeout(timer);
  dueAt = due;
  timer = setTimeout(() => { timer = null; dueAt = 0; run(); }, delay);
}

store.onChange(schedule);
document.addEventListener('visibilitychange', () => {
  if (!enabled()) return;
  if (document.visibilityState === 'hidden') { if (timer) { clearTimeout(timer); timer = null; dueAt = 0; run(); } }
  else if (Date.now() - cfg.last > 30000) run();
});
if (enabled()) setTimeout(run, 1500);

export const sync = {
  get cfg() { return cfg; },
  get enabled() { return enabled(); },
  get status() { return status; },
  on: f => subs.add(f),
  now: () => run(),

  async connect(repo, token) {
    repo = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/$/, '');
    token = token.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Wpisz repozytorium w formie wlasciciel/nazwa');
    if (!token) throw new Error('Wklej token');
    const prev = { ...cfg };
    cfg = { ...cfg, repo, token, sha: '' };
    setStatus('busy', 'Łączę…');
    try {
      const r = await gh(`${API}/repos/${repo}`);
      if (!r.ok) throw httpError(r, 'Połączenie');
      const info = await r.json();
      if (!info.private) throw new Error('Repozytorium musi być prywatne (to Twoja biblioteka)');
      const remote = await getRemote();
      if (remote) store.importJSON(remote, 'merge'); // pierwsze połączenie: połącz dane z obu stron
      await putRemote();
      cfg.last = Date.now(); saveCfg();
      setStatus('ok', 'Zsynchronizowano ' + hhmm());
      emit('pulled');
    } catch (e) {
      cfg = prev; saveCfg();
      setStatus(enabled() ? 'idle' : 'off', '');
      throw new Error(e.message === 'Failed to fetch' ? 'Brak połączenia z GitHub' : e.message);
    }
  },

  disconnect() {
    cfg = { ...cfg, repo: '', token: '', sha: '', last: 0 };
    saveCfg();
    clearTimeout(timer); timer = null; dueAt = 0;
    setStatus('off', '');
  },
};
