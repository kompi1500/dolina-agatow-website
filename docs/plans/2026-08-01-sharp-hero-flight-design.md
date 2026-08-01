# Projekt ostrego przelotu hero

## Cel

Fotograficzny glob i zjazd do Doliny mają pozostać ostre i jednolite. Płynność pozostaje ważna, ale nie może być uzyskiwana przez widoczne obniżanie rozdzielczości.

## Rozwiązanie

- MapLibre używa jednego, stałego pixel ratio przez intro i stan końcowy. Nie przełącza jakości na czas animacji.
- Przed lotem ograniczony prefetch pobiera kafelki ortofoto z kilku poziomów całej trasy oraz dokładniejszy zestaw dla lądowania.
- Prefetch ma ograniczoną współbieżność i twardy limit czasu. Przy Save Data lub 2G zostaje pominięty.
- Raster nie używa przejścia fade pomiędzy kafelkami.
- Po zakończeniu ruchu pineska i tytuł końcowy czekają krótko na stan `source loaded`, ale twardy limit gwarantuje zakończenie intro przy awarii sieci.
- Blok tytułowy zostaje opuszczony o około 8–10 px względem obecnej pozycji.

## Weryfikacja

Sprawdzane są: normalne intro, pominięcie intro, odcięte kafelki EOX, desktop, mobile oraz brak drugiej instancji mapy.
