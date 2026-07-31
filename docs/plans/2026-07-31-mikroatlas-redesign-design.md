# Mikroatlas Doliny Agatów — projekt przebudowy

## Cel

Zastąpić niestabilne intro WebGL lekkim, pre-renderowanym przelotem, przenieść mapę do interakcji na żądanie oraz nadać stronie autentyczny, lokalny charakter redakcyjnego mikroatlasu. Strona ma być niezawodna na iOS, Androidzie i desktopie oraz nie zależeć od zewnętrznych kafelków, aby pokazać hero.

## Zachowanie

- Intro trwa 4–5 sekund, ma osobny kadr desktopowy i mobilny, poster oraz formaty WebM/MP4. Błąd, blokada autoplay, oszczędzanie danych i `prefers-reduced-motion` natychmiast pokazują finał.
- „Pomiń intro” działa tylko dla bieżącego odtworzenia. Pełne wejście, odświeżenie i powrót z bfcache uruchamiają sekwencję ponownie, o ile użytkownik nie ogranicza ruchu.
- Interaktywna mapa otwiera się w dostępnym dialogu dopiero po kliknięciu. MapLibre jest pobierane dynamicznie; mapa ma poster, stan błędu, ponowienie i link do OpenStreetMap.
- Mobile otrzymuje pełnoekranowe menu tekstowe, jednokolumnowy układ, kontrolowane kadry i wyrównanie tekstu do lewej.

## Warstwa redakcyjna

Po hero następują credo stowarzyszenia i cztery historie: Kamień, Krajobraz, Pamięć i Mapa. Działalność stowarzyszenia jest przedstawiona jako lista priorytetów zamiast zestawu identycznych kart. Długie akapity są justowane wyłącznie na szerokich łamach, z polskim dzieleniem wyrazów.

Materiały pochodzą z Wikimedia Commons oraz wiarygodnych źródeł PIG-PIB i NID. Każde medium przechowuje autora, źródło, licencję, tekst alternatywny i opis zmian. Nie publikujemy materiałów o niejasnych prawach.

## Kryteria odbioru

- Hero zawsze osiąga czytelny stan końcowy, również offline i przy awarii mediów.
- MapLibre nie występuje w początkowym bundle i nie jest inicjalizowane przed akcją użytkownika.
- Brak poziomego przewijania i kolizji przy 320, 390, 768, 1024 i 1440 px.
- Intro, menu i mapa działają klawiaturą, dotykiem i z ograniczeniem ruchu.
- Build Astro oraz testy przeglądarkowe przechodzą bez regresji.
