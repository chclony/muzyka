// Rejestr źródeł muzyki. Aby dodać nowe (np. YouTube przez własny serwer),
// stwórz plik z obiektem o tym samym interfejsie i dopisz go do listy poniżej.
//
// Interfejs źródła:
//   id, label, available(settings)
//   search(q, settings) -> { tracks?, albums?, artists?, stations? }
//   album(id, settings) / artist(id, settings) -> { title, subtitle, cover, tracks, albums? }
//   genre(tag, settings) -> tracks[]       (opcjonalne)
//   home(settings) -> [{ title, tracks? | albums? }]   (opcjonalne)
//   related(track, settings) -> tracks[]   (autoodtwarzanie, opcjonalne)
//   streamUrl(track, settings) -> url      (gdy adres trzeba wyliczyć w locie)
import jamendo from './jamendo.js';
import audius from './audius.js';
import archive from './archive.js';
import radio from './radio.js';
import podcasts from './podcasts.js';

export const providers = [jamendo, audius, archive, podcasts, radio];
export const byId = id => providers.find(p => p.id === id);
export const active = s => providers.filter(p => p.available(s));
