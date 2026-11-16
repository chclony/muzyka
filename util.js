export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmt = s => {
  s = Math.floor(+s || 0);
  if (!isFinite(s) || s <= 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};

export async function getJSON(url, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

export const shuffle = a => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const qs = o => new URLSearchParams(
  Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')
).toString();

export const uid = () => Math.random().toString(36).slice(2, 10);

export const https = u => (u || '').replace(/^http:\/\//i, 'https://');

// Miesza kilka list naprzemiennie (a1, b1, c1, a2, b2 ...)
export const interleave = lists => {
  const out = [], max = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
};
