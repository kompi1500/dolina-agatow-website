# Logo „D z agatu" — design

Data: 2026-08-01 · Status: zaakceptowany przez usera (rozmowa, sesja Claude Code)

## Cel

Znak graficzny dla Stowarzyszenia „Dolina Agatów" wyprowadzony ze zdjęcia przekroju
agatu z Płóczek Górnych (`D-logo.png` — lustrzane odbicie/obrót zdjęcia
`public/images/agat-przekroj.jpg`, fot. Robert Niedźwiedzki, CC BY 3.0; atrybucja
jest w stopce strony).

Bohaterem znaku jest **wnętrze agatu**: koncentryczne pasma (warstwowość) i okrągłe
„oczka". Sylwetka pozostaje organiczna, nieregularna — podobieństwo do litery D jest
smaczkiem drugiego odczytania, nie narzuconą geometrią. Stylistyka: nowoczesny
minimalizm (czerń/biel, czysta kreska), charakter „topograficzny/geologiczny".

## Deliverables

- `logo.svg` — czarna kreska na przezroczystym tle, ~4–6 pasm + 2–3 oczka
- `logo-inverse.svg` — biała kreska na ciemne tła
- `favicon.svg` — wersja zredukowana (mniej pasm, grubsza kreska), podmiana obecnej
- opcjonalnie wariant z jednym akcentem z palety agatowej `global.css`
- pliki robocze w `docs/logo-work/` (poza `public/` — nie trafiają na stronę)

## Podejście: hybryda (wybrana z 3 opcji)

1. Narzędzia: `brew install imagemagick potrace` (GIMP.app w odwodzie).
2. Automatyczny szkielet: szarość → rozmycie → posterize 4–6 poziomów → granice
   warstw. Kilka wariantów parametrów w siatce → user wybiera szkielet.
3. Ręczne czyste krzywe SVG (gładkie beziery, jednolita grubość kreski) po
   szkielecie. Pętla: render → pokaz w rozmowie → korekty słowne → iteracja.
4. Finalizacja: inverse + favicon, test czytelności 16/32/200 px.
5. Wpięcie w stronę (Nav/favicon) — osobny etap, po akceptacji znaku.

## Kryteria sukcesu

- Znak rozpoznawalny w 32 px; kreska gładka, bez artefaktów rastrowych.
- „D" wyczuwalne, organiczny charakter zachowany.

## Ryzyka

- Automat może nie rozdzielić pasm (miękkie gradienty) → szkielet tylko jako
  podkład, więcej rysowania ręcznego.
- Krzywe „na oko" wymagają rund poprawek → na to jest pętla renderów.

## Licencja

Fot. CC BY 3.0 (Robert Niedźwiedzki, Wikimedia Commons). Przeróbka dozwolona,
atrybucja obecna w stopce. Silna transformacja do prostych linii → praktycznie
samodzielna grafika.
