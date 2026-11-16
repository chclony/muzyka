// Radio Browser – otwarty katalog internetowych stacji radiowych. Bez klucza.
import { getJSON, qs, https } from '../util.js';

const SERVERS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
export const RADIO_TAGS = ['pop', 'rock', 'jazz', 'classical', 'electronic', 'lofi', 'dance', 'hits', 'oldies', 'news', 'talk'];

async function call(path, p = {}) {
  let err;
  for (const s of SERVERS) {
    try { return await getJSON(`${s}/json${path}?${qs({ hidebroken: 'true', ...p })}`, 8000); }
    catch (e) { err = e; }
  }
  throw err;
}

const S = s => ({
  type: 'track', provider: 'radio', id: 'radio:' + s.stationuuid, live: true,
  title: s.name.trim(), artist: [s.countrycode, (s.tags || '').split(',').filter(Boolean).slice(0, 2).join(', ')].filter(Boolean).join(' · ') || 'Radio',
  album: 'Radio', cover: https(s.favicon || ''), url: s.url_resolved, duration: 0,
});

const onlyHttps = list => list.filter(s => (s.url_resolved || '').startsWith('https://') && s.name).map(S);

export default {
  id: 'radio',
  label: 'Radio',
  available: () => true,

  async stations({ name, tag, countrycode, limit = 40 } = {}) {
    const r = await call('/stations/search', { name, tag, countrycode, limit: limit * 2, order: 'votes', reverse: 'true' });
    return onlyHttps(r).slice(0, limit);
  },

  async search(q) { return { stations: await this.stations({ name: q, limit: 15 }) }; },
};
