// Podcasty – katalog Apple (iTunes Search/Lookup API, bez klucza). Odcinki mają bezpośrednie linki audio,
// więc nie trzeba pobierać feedów RSS (które zwykle blokuje CORS).
import { getJSON, qs, https } from '../util.js';
import { store } from '../store.js';

const API = 'https://itunes.apple.com';
const COUNTRY = 'PL';

const show = r => ({
  type: 'album', provider: 'podcasts', rawId: r.collectionId, title: r.collectionName || r.trackName,
  subtitle: r.artistName || '', cover: https(r.artworkUrl600 || r.artworkUrl100 || ''),
});

export default {
  id: 'podcasts',
  label: 'Podcasty',
  available: () => true,

  async search(q) {
    const d = await getJSON(`${API}/search?${qs({ term: q, media: 'podcast', entity: 'podcast', limit: 20, country: COUNTRY })}`);
    return { albums: (d.results || []).filter(r => r.collectionId).map(show).map(s => ({ ...s, subtitle: 'Podcast · ' + s.subtitle })) };
  },

  async album(id) {
    const d = await getJSON(`${API}/lookup?${qs({ id, media: 'podcast', entity: 'podcastEpisode', limit: 200, country: COUNTRY })}`);
    const res = d.results || [];
    const head = res.find(r => r.kind === 'podcast' || r.wrapperType === 'track') || {};
    const s = show({ ...head, collectionId: head.collectionId || id });
    const tracks = res.filter(r => r.wrapperType === 'podcastEpisode' && r.episodeUrl).map(r => ({
      type: 'track', provider: 'podcasts', id: 'podcasts:' + r.trackId, episode: true,
      title: r.trackName, artist: r.collectionName || s.title, album: r.collectionName || s.title, albumId: r.collectionId || id,
      cover: https(r.artworkUrl600 || r.artworkUrl160 || s.cover), url: https(r.episodeUrl),
      duration: Math.round((r.trackTimeMillis || 0) / 1000), date: r.releaseDate,
    })).sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
    return { title: s.title, subtitle: s.subtitle, cover: s.cover, tracks, show: s };
  },

  async home() {
    const subs = store.podcasts;
    return subs.length ? [{ title: 'Twoje podcasty', albums: subs }] : [];
  },
};
