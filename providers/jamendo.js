// Jamendo – muzyka na licencjach Creative Commons. Wymaga darmowego client_id (devportal.jamendo.com).
import { getJSON, qs, https } from '../util.js';

const BASE = 'https://api.jamendo.com/v3.0';
export const GENRES = ['pop', 'rock', 'electronic', 'jazz', 'classical', 'hiphop', 'ambient', 'metal', 'lounge', 'reggae', 'folk', 'blues'];

async function call(s, path, p = {}) {
  const d = await getJSON(`${BASE}${path}/?${qs({ client_id: s.jamendoId, format: 'json', imagesize: 300, audioformat: 'mp32', ...p })}`);
  if (d.headers && d.headers.status === 'failed') throw new Error(d.headers.error_message || 'Jamendo');
  return d.results || [];
}

const T = (t, x = {}) => ({
  type: 'track', provider: 'jamendo', id: 'jamendo:' + t.id,
  title: t.name, artist: t.artist_name || x.artist || '', artistId: t.artist_id || x.artistId,
  album: t.album_name || x.album || '', albumId: t.album_id || x.albumId,
  cover: https(t.image || t.album_image || x.cover || ''), url: https(t.audio), duration: +t.duration || 0,
});
const A = a => ({ type: 'album', provider: 'jamendo', rawId: a.id, title: a.name, subtitle: a.artist_name, cover: https(a.image) });
const R = a => ({ type: 'artist', provider: 'jamendo', rawId: a.id, title: a.name, subtitle: 'Wykonawca', cover: https(a.image) });

export default {
  id: 'jamendo',
  label: 'Jamendo',
  available: s => !!s.jamendoId,

  async search(q, s) {
    const [tracks, albums, artists] = await Promise.all([
      call(s, '/tracks', { search: q, limit: 25 }),
      call(s, '/albums', { namesearch: q, limit: 10 }),
      call(s, '/artists', { namesearch: q, limit: 10 }),
    ]);
    return { tracks: tracks.map(t => T(t)), albums: albums.map(A), artists: artists.map(R) };
  },

  async album(id, s) {
    const [a] = await call(s, '/albums/tracks', { id });
    if (!a) throw new Error('Nie znaleziono albumu');
    const x = { artist: a.artist_name, artistId: a.artist_id, album: a.name, albumId: a.id, cover: a.image };
    return { title: a.name, subtitle: a.artist_name, cover: https(a.image), tracks: (a.tracks || []).map(t => T(t, x)) };
  },

  async artist(id, s) {
    const [[a], albums] = await Promise.all([
      call(s, '/artists/tracks', { id, limit: 50, order: 'popularity_total' }),
      call(s, '/albums', { artist_id: id, limit: 30 }),
    ]);
    if (!a) throw new Error('Nie znaleziono wykonawcy');
    const x = { artist: a.name, artistId: a.id };
    return { title: a.name, subtitle: 'Wykonawca', cover: https(a.image), tracks: (a.tracks || []).map(t => T(t, x)), albums: albums.map(A) };
  },

  async genre(tag, s) {
    const r = await call(s, '/tracks', { tags: tag, order: 'popularity_week', limit: 40 });
    return r.map(t => T(t));
  },

  async home(s) {
    const r = await call(s, '/tracks', { order: 'popularity_week', limit: 20 });
    return [{ title: 'Jamendo: popularne w tym tygodniu', tracks: r.map(t => T(t)) }];
  },

  async related(track, s) {
    const id = String(track.id).replace('jamendo:', '');
    const r = await call(s, '/tracks/similar', { id, limit: 15 });
    return r.map(t => T(t));
  },
};
