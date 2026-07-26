# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Komendy

- `npm run dev` — dev server (Astro 7 daemonizuje: `astro dev status` / `astro dev logs` / `astro dev stop`); strona pod `http://localhost:4321/dolina-agatow-website/` (uwaga na `base`!)
- `npm run build` — build produkcyjny do `dist/`
- Deploy: push builda na branch `gh-pages` repo `kompi1500/dolina-agatow-website` (GitHub Pages). Docelowo GitHub Actions (`.github/workflows/deploy.yml` istnieje lokalnie, NIE jest w repo — token gh nie ma scope'a `workflow`; po `gh auth refresh -h github.com -s workflow` dodać go do repo i wyłączyć ręczny deploy)
- Żywa strona: https://kompi1500.github.io/dolina-agatow-website/

## Stack i architektura

Astro 7 (static) + czysty CSS (custom properties w `src/styles/global.css` — paleta agatowa) + fonty self-hosted (fontsource: Fraunces Variable, Inter Variable). One-pager (`src/pages/index.astro` składa komponenty z `src/components/`) + podstrona `/regulamin` (`src/pages/regulamin.md` → `src/layouts/RegulaminLayout.astro`).

**Hero** (`src/scripts/hero-globe.ts` + `components/Hero.astro`): glob Three.js (tekstury NASA/Solar System Scope w `public/textures/`) autoplay-leci z kosmosu do Płóczek Górnych, crossfade do mapy MapLibre (kafelki OpenFreeMap, bez klucza). Timeline liczony akumulowaną deltą z clampem (karta w tle = pauza, nie przeskok). Fallbacki: brak WebGL / `prefers-reduced-motion` → od razu finalna mapa; brak sieci → gwiezdne tło. Overlay tytułu zmienia kolor na ciemny po wylądowaniu (`.hero-stage.done`).

**Pułapki:**
- `maplibre-gl` MUSI zostać na ^5 — 6.0.0 ma zepsutego workera: styl nigdy się nie ładuje, bez żadnego błędu w konsoli
- Wszystkie wewnętrzne linki/assety przez `import.meta.env.BASE_URL` (GitHub Pages serwuje spod `/dolina-agatow-website/`)
- Zdjęcia w `public/images/` są z Wikimedia Commons na licencjach CC — każda zmiana galerii (`components/Dolina.astro`) wymaga aktualizacji atrybucji w `components/Footer.astro`

## O czym jest ta strona

Strona dla **Stowarzyszenia na Rzecz Rozwoju Płóczek Górnych, Nagórza i Okolic — „Dolina Agatów"** — stowarzyszenia zwykłego (wpis do ewidencji Starosty Lwóweckiego, poz. 18, 6 lipca 2026).

- Siedziba: Płóczki Górne 4A, 59-600 Lwówek Śląski (Gmina Lwówek Śląski, Pogórze Izerskie)
- Zarząd: Artur Kompanowski (Prezes), Katarzyna Kołodziejczyk (Wiceprezes), Kinga Nestorowicz (Sekretarz), Mateusz Markowski (Członek Zarządu)
- Profil działalności: zrównoważony rozwój lokalny, ochrona krajobrazu i dziedzictwa przyrodniczo-geologicznego (agaty, zlewnia rzeki Słotwiny), historycznego i kulturowego okolic Płóczek Górnych i Nagórza
- Brak e-maila kontaktowego stowarzyszenia — do uzupełnienia w `components/Kontakt.astro`, gdy user go poda

## Dokumenty źródłowe (`docs/`)

- `Regulamin_Dolina_Agatowa_US.docx` — pełny regulamin stowarzyszenia (cele, władze, członkostwo). Kanoniczne źródło treści o stowarzyszeniu; przepisany 1:1 do `src/pages/regulamin.md` — zmiany treści regulaminu tylko za zgodą usera.
- `zaświadczenie o wpisie.pdf` — zaświadczenie o wpisie do ewidencji (skan). Zawiera dane osobowe zarządu i podpis urzędnika — **nie publikować skanu na stronie ani nie commitować** (jest w `.gitignore`; repo jest publiczne!).

## Zasady

- Cała treść strony po polsku, z pełnymi diakrytykami.
- Pełna nazwa stowarzyszenia w treściach oficjalnych; skrót „Dolina Agatów" w nawigacji/brandingu.
- Fakty krajoznawcze (agaty, historia wsi, Lwóweckie Lato Agatowe) pochodzą z Wikipedii/PIG-PIB — przy nowych treściach podawać źródła, nie zmyślać.
