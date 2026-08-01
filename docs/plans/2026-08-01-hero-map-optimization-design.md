# Optymalizacja fotograficznego hero i eksploratora mapy

## Cel

Zachować obecny układ strony, fotograficzny glob Sentinel-2, lot do Płóczek Górnych i interaktywną mapę, jednocześnie ograniczając obciążenie GPU, liczbę żądań i widoczność brakujących kafelków na słabszej sieci.

## Architektura hero

- Pozostaje jedna widoczna instancja MapLibre. Ukryty `warmCorridor` zostaje usunięty.
- Finałowy kadr jest podgrzewany ograniczonym prefetchingiem samych URL-i kafelków, bez drugiego renderera i workera. Preload respektuje `Save-Data` i wolne połączenia.
- Cache kafelków jest dopasowany do ekranu zamiast stałej wartości 512.
- Pod Sentinel-2 pozostaje lekka mapa wektorowa, dzięki czemu brak rastra nie tworzy białej plamy.
- Obrys Polski korzysta z małego lokalnego GeoJSON zamiast danych granic całego świata.
- Intro ma niezależny limit czasu i zawsze odsłania tytuł oraz interakcje.

## Eksplorator po lądowaniu

- Własny panel zawiera: reset do kadru Doliny, przełącznik Satelita/Mapa, zoom, pełny ekran i kompas widoczny po obrocie.
- Scroll zoom działa w trybie cooperative gestures, aby mapa nie blokowała przewijania strony; drag, pinch i obrót pozostają dostępne.
- Współrzędne geograficzne są aktualizowane na podstawie kursora, z limitem jednej aktualizacji na klatkę. Po opuszczeniu mapy wracają do współrzędnych siedziby.
- Na urządzeniach dotykowych panel pokazuje współrzędne środka widoku po przesunięciu mapy.
- Nie dodajemy wyszukiwarki, geolokalizacji ani punktów POI bez lokalnej bazy danych.

## Testy

- Porównać liczbę instancji MapLibre, początkowe żądania i rozmiar cache.
- Sprawdzić normalną i wolną sieć, błędy EOX, pominięcie intro, reduced motion oraz twardy timeout.
- Zweryfikować przełączanie warstw, reset, pełny ekran, kompas, gesty i współrzędne na desktopie i mobile.
