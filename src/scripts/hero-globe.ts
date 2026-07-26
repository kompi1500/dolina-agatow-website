/**
 * Hero „z kosmosu do doliny” — JEDEN silnik (MapLibre z projekcją globe):
 * glob 3D obraca się i jednym ciągłym przelotem (flyTo) ląduje na Płóczkach Górnych,
 * gdzie spada pineska i wyłania się tytuł. Bez crossfade'u — zero szwów.
 *
 * Fallback (brak WebGL / prefers-reduced-motion / błąd stylu): statyczna mapa
 * na finalnej pozycji albo samo gwiezdne tło z CSS — tytuł zawsze widoczny.
 */
import { mesh as topoMesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Map as MapLibreMap, Marker, NavigationControl, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const PLOCZKI: LngLatLike = [15.5328, 51.0825];
// siedziba stowarzyszenia: Płóczki Górne 4A — oficjalny punkt adresowy (GUGiK, PRG)
const SIEDZIBA: LngLatLike = [15.52605, 51.064831];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 11.5; // od ~11 styl pokazuje nazwy wsi — pineska ma być podpisana przez mapę
const START_ZOOM = 1.5; // glob w kosmosie — widoczny OD RAZU, cache trasy grzeje się w tle
const START_CENTER: LngLatLike = [-14, 38]; // Atlantyk, Europa wchodzi na horyzont

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

type CountriesTopo = Topology<{ countries: GeometryCollection<{ name?: string }> }>;

interface Els {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  mapDiv: HTMLElement;
  overlay: HTMLElement;
  skip: HTMLButtonElement;
}

function getEls(): Els | null {
  const stage = document.getElementById('hero-stage');
  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
  const mapDiv = document.getElementById('hero-map');
  const overlay = document.getElementById('hero-overlay');
  const skip = document.getElementById('hero-skip') as HTMLButtonElement | null;
  if (!stage || !canvas || !mapDiv || !overlay || !skip) return null;
  return { stage, canvas, mapDiv, overlay, skip };
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Statyczne pole gwiazd na canvasie 2D — tło przestrzeni wokół globu. */
function paintStars(els: Els): void {
  const ctx = els.canvas.getContext('2d');
  if (!ctx) return;
  const draw = () => {
    const { clientWidth: w, clientHeight: h } = els.stage;
    const dpr = Math.min(window.devicePixelRatio, 2);
    els.canvas.width = w * dpr;
    els.canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    // deterministyczny pseudolosowy rozsyp (mulberry32), żeby nie migotał przy resize
    let seed = 42;
    const rnd = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = rnd() * 1.1 + 0.2;
      ctx.globalAlpha = 0.25 + rnd() * 0.65;
      ctx.fillStyle = '#f5f2ea';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  draw();
  window.addEventListener('resize', draw);
}

function createMap(mapDiv: HTMLElement, interactive: boolean, zoom: number, center: LngLatLike) {
  return new MapLibreMap({
    container: mapDiv,
    style: MAP_STYLE,
    center,
    zoom,
    interactive,
    attributionControl: false,
    canvasContextAttributes: { alpha: true },
    // ostry obraz w spoczynku; na czas animacji schodzimy do 1.0 (setPixelRatio)
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    // zero crossfade'ów kafelków i etykiet — mniej blendowania na klatkę
    fadeDuration: 0,
    // cache mieści całą drabinkę preloadu trasy lotu — nic nie wypada i nie doczytuje się w locie
    maxTileCacheSize: 512,
  });
}

/** Rozdzielczość renderu: 1.0 na czas animacji (płynność), 1.5 w spoczynku (ostrość). */
function setRenderScale(map: MapLibreMap, moving: boolean): void {
  const target = moving ? 1 : Math.min(window.devicePixelRatio, 1.5);
  (map as unknown as { setPixelRatio?: (r: number) => void }).setPixelRatio?.(target);
}

/** Obrys Polski (bursztyn) rysowany bezpośrednio na globie/mapie. */
async function addPolandOutline(map: MapLibreMap): Promise<void> {
  try {
    const topo = (await fetch(`${base}/data/countries-50m.json`).then((r) =>
      r.json(),
    )) as CountriesTopo;
    const isPL = (g: { id?: string | number }) => String(g.id) === '616';
    const outline = topoMesh(topo, topo.objects.countries, (a, b) => isPL(a) || isPL(b));
    map.addSource('polska-obrys', {
      type: 'geojson',
      data: { type: 'Feature', geometry: outline, properties: {} },
    });
    map.addLayer({
      id: 'polska-obrys',
      type: 'line',
      source: 'polska-obrys',
      paint: {
        'line-color': '#e8a13c',
        'line-width': 1.6,
        // obrys znika, gdy jesteśmy już nisko nad regionem
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.9, 8.5, 0],
      },
    });
  } catch {
    /* brak obrysu to tylko strata ozdoby */
  }
}

function addPin(map: MapLibreMap, mapDiv: HTMLElement): void {
  if (mapDiv.dataset.pinned) return;
  mapDiv.dataset.pinned = '1';
  // kropka dokładnie na adresie siedziby (Płóczki Górne 4A)
  const el = document.createElement('div');
  el.className = 'agat-pin';
  el.innerHTML = `<span class="agat-pin-dot"></span>`;
  new Marker({ element: el, anchor: 'center' }).setLngLat(SIEDZIBA).addTo(map);
}

function enableInteraction(map: MapLibreMap): void {
  setRenderScale(map, false);
  // scrollZoom zostaje wyłączony, żeby mapa nie więziła scrolla strony —
  // zoomowanie przyciskami nawigacji, przeciąganie i pinch normalnie
  map.dragPan.enable();
  map.touchZoomRotate.enable();
  map.doubleClickZoom.enable();
  map.scrollZoom.disable();
  const container = map.getContainer();
  if (!container.dataset.nav) {
    container.dataset.nav = '1';
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  }
}

/** Wieś ma siedzieć w górnej strefie złotego podziału — nad blokiem tytułowym. */
function landingPadding(els: Els): number {
  return Math.round(els.stage.clientHeight * 0.26);
}

/** Stan końcowy bez animacji (fallback i „pomiń intro”). */
function showFinal(els: Els, existingMap?: MapLibreMap): void {
  els.stage.classList.add('done');
  els.overlay.classList.remove('hidden');
  els.skip.classList.remove('visible');
  els.mapDiv.style.opacity = '1';
  try {
    const map = existingMap ?? createMap(els.mapDiv, true, FINAL_ZOOM, SIEDZIBA);
    map.stop();
    map.setPadding({ top: 0, left: 0, right: 0, bottom: landingPadding(els) });
    map.jumpTo({ center: SIEDZIBA, zoom: FINAL_ZOOM });
    enableInteraction(map);
    addPin(map, els.mapDiv);
  } catch {
    /* mapa niedostępna (offline) — zostaje gwiezdne tło */
  }
}

/**
 * Cichy podgrzewacz cache'u: drugi, niewidoczny map przelatuje drabinką przez
 * zoomy trasy — kafelki lądują w HTTP-cache przeglądarki, skąd widoczna mapa
 * bierze je potem błyskawicznie. Dzieje się to, GDY użytkownik ogląda glob.
 */
function warmCorridor(els: Els): Promise<void> {
  return new Promise((resolve) => {
    const done = window.setTimeout(resolve, 3000); // twardy limit — nie blokujemy intro
    try {
      const div = document.createElement('div');
      div.style.cssText = `position:fixed;left:-99999px;top:0;width:${els.stage.clientWidth}px;height:${els.stage.clientHeight}px;`;
      document.body.appendChild(div);
      const warm = new MapLibreMap({
        container: div,
        style: MAP_STYLE,
        center: SIEDZIBA,
        zoom: FINAL_ZOOM,
        interactive: false,
        attributionControl: false,
        pixelRatio: 1,
        maxTileCacheSize: 16,
      });
      const cleanup = () => {
        window.clearTimeout(done);
        try {
          warm.remove();
          div.remove();
        } catch {
          /* posprzątane */
        }
        resolve();
      };
      warm.on('error', () => {
        /* pojedyncze błędy kafelków nie przerywają grzania */
      });
      warm.on('style.load', () => {
        warm.addSource('orto-s2', {
          type: 'raster',
          tiles: [
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/{z}/{y}/{x}.jpg',
          ],
          tileSize: 256,
          maxzoom: 14,
        });
        warm.addLayer({ id: 'orto-s2', type: 'raster', source: 'orto-s2' });
        const ladder = [FINAL_ZOOM, 9.4, 7.4, 5.4, 3.4];
        let i = 0;
        const step = () => {
          if (i >= ladder.length) {
            cleanup();
            return;
          }
          warm.jumpTo({ center: SIEDZIBA, zoom: ladder[i]! });
          i += 1;
          const t = window.setTimeout(step, 650);
          warm.once('idle', () => {
            window.clearTimeout(t);
            step();
          });
        };
        step();
      });
    } catch {
      window.clearTimeout(done);
      resolve();
    }
  });
}

function runIntro(els: Els): void {
  // glob widoczny od razu — kafelki niskich zoomów są lekkie i wchodzą natychmiast
  const map = createMap(els.mapDiv, false, START_ZOOM, START_CENTER);
  map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
  // grzanie cache'u trasy rusza NATYCHMIAST, równolegle z ładowaniem widocznej mapy;
  // drabinka idzie od kafelków lądowania w górę, więc finał jest ostry najwcześniej
  const warmed = warmCorridor(els);
  void warmed;
  if (import.meta.env.DEV) (window as unknown as { __heroMap?: MapLibreMap }).__heroMap = map;

  let finished = false;
  const finish = (skipped: boolean) => {
    if (finished) return;
    finished = true;
    els.skip.classList.remove('visible');
    if (skipped) {
      showFinal(els, map);
      return;
    }
    els.stage.classList.add('done');
    els.overlay.classList.remove('hidden');
    enableInteraction(map);
  };

  els.skip.classList.add('visible');
  els.skip.addEventListener('click', () => finish(true), { once: true });
  els.overlay.classList.add('hidden');

  map.on('error', () => {
    if (!finished && !map.isStyleLoaded()) {
      // styl padł — pokaż chociaż tytuł na gwiazdach
      finished = true;
      els.skip.classList.remove('visible');
      els.overlay.classList.remove('hidden');
    }
  });

  map.on('style.load', () => {
    map.setProjection({ type: 'globe' });

    // JEDNA warstwa ortofoto od orbity do wsi: Sentinel-2 cloudless (10 m).
    // Wchodzi POD napisy stylu (beforeId), więc podpisy miejscowości zostają.
    const firstSymbol = (map.getStyle().layers ?? []).find((l) => l.type === 'symbol')?.id;
    map.addSource('orto-s2', {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      maxzoom: 14,
      attribution: 'Sentinel-2 cloudless 2018 — EOX (CC BY 4.0)',
    });
    map.addLayer(
      { id: 'orto-s2', type: 'raster', source: 'orto-s2', paint: { 'raster-fade-duration': 150 } },
      firstSymbol,
    );
    // napisy dopiero po zejściu z orbity — na fotorealistycznym globie tylko przeszkadzają
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type === 'symbol') {
        map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, 6.8), layer.maxzoom ?? 24);
      }
    }
    // warstwy wektorowe schowane POD ortofoto i tak nie są widoczne — wyłączamy je,
    // żeby nie malowały się na darmo pod spodem (mniej pracy GPU na klatkę)
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.id === 'orto-s2') break;
      if (layer.type === 'fill' || layer.type === 'line' || layer.type === 'fill-extrusion') {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    }
    void addPolandOutline(map);

    const whenVisible = (fn: () => void) => {
      if (document.visibilityState === 'visible') {
        fn();
        return;
      }
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVisible);
          fn();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
    };

    // glob odsłaniamy dopiero, gdy ORTOFOTO startowego kadru jest wczytane —
    // żadnej topograficznej wstawki przed satelitą
    let revealed = false;
    const reveal = () => {
      if (finished || revealed) return;
      revealed = true;
      els.mapDiv.style.opacity = '1';
      whenVisible(() => {
        if (finished) return;
        // krótka chwila na glob i od razu zjazd na Płóczki
        window.setTimeout(() => {
          if (finished) return;
          setRenderScale(map, true); // na czas lotu mniej pikseli = stabilny klatkarz
          map.flyTo({
            center: SIEDZIBA,
            zoom: FINAL_ZOOM,
            duration: 2600,
            curve: 1.32,
            padding: { top: 0, left: 0, right: 0, bottom: landingPadding(els) },
            essential: true,
          });
          map.once('moveend', () => {
            if (finished) return;
            addPin(map, els.mapDiv);
            window.setTimeout(() => finish(false), 150);
          });
        }, 500);
      });
    };
    const revealCap = window.setTimeout(reveal, 2500);
    map.once('idle', () => {
      window.clearTimeout(revealCap);
      reveal();
    });
  });
}

function init(): void {
  const els = getEls();
  if (!els) return;

  paintStars(els);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !hasWebGL()) {
    showFinal(els);
    return;
  }

  try {
    runIntro(els);
  } catch {
    showFinal(els);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
