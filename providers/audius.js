// Audius – otwarta platforma z muzyką niezależnych twórców. API bez klucza (wystarczy app_name).
import { getJSON, qs, https } from '../util.js';

const BASE = 'https://api.audius.co/v1';
const APP = 'muzyka-pwa';

async function call(path, p = {}) {
  const d = await getJSON(`${BASE}${path}?${qs({ app_name: APP, ...p })}`);
  return d.data;
}

const art = a => https(a?.['480x480'] || a?.['1000x1000'] || a?.['150x150'] || '');
const T = (t, x = {}) => ({
  type: 'track', provider: 'audius', id: 'audius:' + t.id, rawId: t.id,
  title: t.title, artist: t.user?.name || x.artist || '', artistId: t.user?.id || x.artistId,
  album: x.album || '', albumId: x.albumId, cover: art(t.artwork) || x.cover || '',
  duration: +t.duration || 0, genre: t.genre,
});
const A = p => ({ type: 'album', provider: 'audius', rawId: p.id, title: p.playlist_name, subtitle: (p.user?.name || '') + (p.is_album ? '' : ' · playlista'), cover: art(p.artwork) });
const R = u => ({ type: 'artist', provider: 'audius', rawId: u.id, title: u.name, subtitle: 'Wykonawca', cover: art(u.profile_picture) });

export default {
  id: 'audius',
  label: 'Audius',
  available: () => true,

  streamUrl: t => `${BASE}/tracks/${t.rawId || String(t.id).replace('audius:', '')}/stream?app_name=${APP}`,

  async search(q) {
    const [tracks, playlists, users] = await Promise.all([
      call('/tracks/search', { query: q, limit: 25 }),
      call('/playlists/search', { query: q, limit: 10 }),
      call('/users/search', { query: q, limit: 10 }),
    ]);
    return { tracks: (tracks || []).map(t => T(t)), albums: (playlists || []).map(A), artists: (users || []).map(R) };
  },

  async album(id) {
    const [[p], tracks] = await Promise.all([call(`/playlists/${id}`), call(`/playlists/${id}/tracks`)]);
    const x = { artist: p?.user?.name, artistId: p?.user?.id, album: p?.playlist_name, albumId: id, cover: art(p?.artwork) };
    return { title: p?.playlist_name || 'Playlista', subtitle: p?.user?.name || '', cover: art(p?.artwork), tracks: (tracks || []).map(t => T(t, x)) };
  },

  async artist(id) {
    const [u, tracks, pls] = await Promise.all([
      call(`/users/${id}`), call(`/users/${id}/tracks`, { limit: 50 }), call(`/users/${id}/playlists`).catch(() => []),
    ]);
    return { title: u?.name || 'Wykonawca', subtitle: 'Wykonawca', cover: art(u?.profile_picture), tracks: (tracks || []).map(t => T(t)), albums: (pls || []).map(A) };
  },

  async genre(tag) {
    const map = { hiphop: 'Hip-Hop/Rap', electronic: 'Electronic', rock: 'Rock', pop: 'Pop', jazz: 'Jazz', classical: 'Classical', ambient: 'Ambient', metal: 'Metal', reggae: 'Reggae', folk: 'Folk', blues: 'Blues', lounge: 'Lo-Fi' };
    const g = map[tag];
    if (!g) return [];
    return (await call('/tracks/trending', { genre: g, limit: 30 }) || []).map(t => T(t));
  },

  async home() {
    const r = await call('/tracks/trending', { limit: 20 });
    return [{ title: 'Audius: na czasie', tracks: (r || []).map(t => T(t)) }];
  },

  async related(track) {
    const g = track.genre;
    const r = await call('/tracks/trending', { genre: g, limit: 20 });
    return (r || []).map(t => T(t)).filter(t => t.id !== track.id);
  },
};
