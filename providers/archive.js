// Internet Archive – domena publiczna, koncerty na żywo, nagrania historyczne. Bez klucza.
import { getJSON, qs } from '../util.js';

const MP3 = ['VBR MP3', '128Kbps MP3', '64Kbps MP3', 'MP3'];
const cover = id => `https://archive.org/services/img/${id}`;
const first = v => Array.isArray(v) ? v[0] : v;

function parseLen(l) {
  if (!l) return 0;
  if (String(l).includes(':')) return String(l).split(':').reduce((a, n) => a * 60 + (+n || 0), 0);
  return Math.round(+l) || 0;
}

const A = d => ({ type: 'album', provider: 'archive', rawId: d.identifier, title: first(d.title) || d.identifier, subtitle: first(d.creator) || '', cover: cover(d.identifier) });

async function find(q, rows = 20, sort = 'downloads desc') {
  const url = 'https://archive.org/advancedsearch.php?' + qs({ q, rows, output: 'json', sort }) +
    '&fl[]=identifier&fl[]=title&fl[]=creator';
  const d = await getJSON(url);
  return (d.response?.docs || []).map(A);
}

export default {
  id: 'archive',
  label: 'Internet Archive',
  available: () => true,

  async search(q) {
    const clean = q.replace(/["()]/g, ' ').trim();
    return { albums: await find(`(${clean}) AND mediatype:audio`) };
  },

  async album(id) {
    const m = await getJSON(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    const title = first(m.metadata?.title) || id, creator = first(m.metadata?.creator) || '';
    const files = (m.files || []).filter(f => MP3.includes(f.format));
    // jeśli są wersje VBR, bierz tylko je (unikamy duplikatów tego samego utworu)
    const vbr = files.filter(f => f.format === 'VBR MP3');
    const use = (vbr.length ? vbr : files).sort((a, b) => (a.name > b.name ? 1 : -1));
    const tracks = use.map(f => ({
      type: 'track', provider: 'archive', id: `archive:${id}/${f.name}`,
      title: f.title || f.name.replace(/\.mp3$/i, ''), artist: f.creator || creator, album: title, albumId: id,
      cover: cover(id), url: `https://archive.org/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`,
      duration: parseLen(f.length),
    }));
    return { title, subtitle: creator, cover: cover(id), tracks };
  },

  async home() {
    const [live, old] = await Promise.all([
      find('collection:etree AND mediatype:etree', 14).catch(() => []),
      find('collection:78rpm AND mediatype:audio', 14).catch(() => []),
    ]);
    return [
      { title: 'Archive: koncerty na żywo', albums: live },
      { title: 'Archive: nagrania 78 rpm', albums: old },
    ].filter(s => s.albums.length);
  },
};
