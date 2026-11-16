# Muzyka – osobisty odtwarzacz (PWA, bez serwera)

Statyczna aplikacja webowa w stylu Spotify. Źródła muzyki (wszystkie bez reklam i bez własnego serwera):

| Źródło | Co daje | Klucz |
|---|---|---|
| **Jamendo** | muzyka Creative Commons, albumy, artyści, gatunki | darmowy `client_id` |
| **Audius** | muzyka niezależnych twórców, trendy | nie |
| **Internet Archive** | domena publiczna, koncerty na żywo, 78 rpm | nie |
| **Podcasty (katalog Apple)** | wyszukiwanie, subskrypcje, odcinki, wznawianie, tempo | nie |
| **Radio Browser** | tysiące stacji radiowych (tylko https) | nie |

Funkcje: wyszukiwanie we wszystkich źródłach naraz, albumy i strony wykonawców, kolejka, losowo/powtarzanie,
autoodtwarzanie podobnych utworów po końcu kolejki, ulubione, playlisty, historia, kopia zapasowa (JSON),
Media Session (okładka i przyciski na ekranie blokady oraz w CarPlay „Teraz odtwarzane”).

## 1. Klucz Jamendo (2 minuty, darmowy)
1. Wejdź na `devportal.jamendo.com`, załóż konto i utwórz aplikację.
2. Skopiuj **Client ID**.
3. W aplikacji: Biblioteka → Ustawienia → wklej klucz → Zapisz.

## 2. Zapis biblioteki poza przeglądarką (GitHub, 0 zł)
Ulubione, playlisty, subskrypcje podcastów, historia i pozycje odcinków trafiają do **prywatnego** repozytorium GitHub.
Po wyczyszczeniu pamięci Safari wystarczy ponownie wpisać repozytorium i token – dane wrócą.
1. Na github.com utwórz **prywatne** repozytorium (np. `muzyka-dane`), możesz zaznaczyć „Add a README”.
2. Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate:
   - Repository access: **Only select repositories** → wybierz `muzyka-dane`,
   - Permissions → Repository permissions → **Contents: Read and write**.
3. W aplikacji: Biblioteka → Ustawienia → Synchronizacja → wpisz `twojlogin/muzyka-dane` i wklej token → Połącz.
Synchronizacja działa automatycznie (zmiany po ok. 4 s, historia i pozycje odcinków co ~2 min, pull po powrocie do aplikacji).
Wygrywa nowsza wersja; przy pierwszym połączeniu dane z obu stron są łączone. Token jest zapisany tylko na urządzeniu
(nie trafia do repozytorium ani do pliku kopii). Aplikacja odmówi połączenia z repozytorium publicznym.

## 3. Hosting za 0 zł (potrzebny HTTPS)
**Cloudflare Pages** (najprostsze): załóż konto → Workers & Pages → Create → Pages → „Upload assets” → przeciągnij
cały folder projektu → dostajesz adres `https://twoja-nazwa.pages.dev`.

Alternatywa: **GitHub Pages** – wrzuć pliki do repozytorium → Settings → Pages → branch `main`, folder `/`.

## 4. Instalacja na iPhonie
1. Otwórz adres w **Safari** → przycisk Udostępnij → **Do ekranu początkowego**.
2. Uruchamiaj z ikony (pełny ekran). Dane są kopiowane do GitHub (pkt 2); dodatkowo możesz
   zrobić Eksport do pliku w Ustawieniach.

## 5. CarPlay
Telefon podłączony do CarPlay (kabel lub bezprzewodowo) wysyła dźwięk do auta jak każda aplikacja audio.
Na ekranie „Teraz odtwarzane” widać okładkę, tytuł i przyciski play/pauza/następny/poprzedni (również z kierownicy). Dla odcinków podcastów iOS pokazuje przyciski przewijania (−15 s / +30 s).
Przeglądanie biblioteki na ekranie auta jest niemożliwe dla PWA (wymaga natywnej aplikacji) – wybierz muzykę na telefonie przed jazdą.

## 6. Dodawanie kolejnych źródeł (np. YouTube)
Każde źródło to plik w `providers/` z tym samym interfejsem (opis na górze `providers/index.js`).
Moduł YouTube będzie wymagał małego serwera pośredniczącego (yt-dlp) i po prostu dopisze się do listy `providers`.

## Struktura
`index.html`, `style.css`, `app.js` (UI), `player.js` (odtwarzacz + Media Session), `store.js` (biblioteka),
`sync.js` (zapis w GitHub), `providers/*` (źródła), `sw.js` + `manifest.webmanifest` + `icons/` (PWA).
