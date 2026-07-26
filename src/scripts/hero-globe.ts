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
import { Map as MapLibreMap, Marker, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const PLOCZKI: LngLatLike = [15.5328, 51.0825];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 11.5; // od ~11 styl pokazuje nazwy wsi — pineska ma być podpisana przez mapę
const START_ZOOM = 3.4; // start od razu nad Polską — krótki zoom zamiast lotu przez pół świata

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
    // płynność > ostrość: na Retinie malujemy maks. 1.5x pikseli (Safari tego wymaga)
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    // cache mieści całą drabinkę preloadu trasy lotu — nic nie wypada i nie doczytuje się w locie
    maxTileCacheSize: 512,
  });
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
  // sama kropka, zawieszona tuż NAD punktem — nie zasłania podpisu wsi z mapy
  const el = document.createElement('div');
  el.className = 'agat-pin';
  el.innerHTML = `<span class="agat-pin-dot"></span>`;
  new Marker({ element: el, anchor: 'bottom', offset: [0, -9] }).setLngLat(PLOCZKI).addTo(map);
}

function enableInteraction(map: MapLibreMap): void {
  // scrollZoom zostaje wyłączony, żeby mapa nie więziła scrolla strony
  map.dragPan.enable();
  map.touchZoomRotate.enable();
  map.doubleClickZoom.enable();
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
    const map = existingMap ?? createMap(els.mapDiv, true, FINAL_ZOOM, PLOCZKI);
    map.stop();
    map.setPadding({ top: 0, left: 0, right: 0, bottom: landingPadding(els) });
    map.jumpTo({ center: PLOCZKI, zoom: FINAL_ZOOM });
    if (existingMap) enableInteraction(map);
    addPin(map, els.mapDiv);
  } catch {
    /* mapa niedostępna (offline) — zostaje gwiezdne tło */
  }
}

function runIntro(els: Els): void {
  // start od FINALNEGO widoku wsi (niewidocznie, pod gwiazdami) — kafelki lądowania
  // wchodzą do cache'u, więc dolot kończy się ostrym obrazem bez doczytywania
  const map = createMap(els.mapDiv, false, FINAL_ZOOM, PLOCZKI);
  map.setPadding({ top: 0, left: 0, right: 0, bottom: landingPadding(els) });
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
    // zwykły mercator — projekcja kulista dławiła Safari, a przy tym kadrze nie robi różnicy

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
    void addPolandOutline(map);
    // mapa pozostaje niewidoczna do końca preloadu — odsłania ją dopiero begin()

    // start dopiero, gdy karta jest widoczna — w tle animacja by przeskoczyła
    const begin = () => {
      // widok Polski (trasa w cache'u), fade-in mapy i po chwili jeden krótki zjazd
      map.jumpTo({ center: PLOCZKI, zoom: START_ZOOM });
      els.mapDiv.style.opacity = '1';
      window.setTimeout(() => {
        if (finished) return;
        map.flyTo({
          center: PLOCZKI,
          zoom: FINAL_ZOOM,
          duration: 2400,
          curve: 1.25,
          padding: { top: 0, left: 0, right: 0, bottom: landingPadding(els) },
          essential: true,
        });
        map.once('moveend', () => {
          if (finished) return;
          addPin(map, els.mapDiv);
          window.setTimeout(() => finish(false), 150);
        });
      }, 550);
    };
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
    // Preload KORYTARZA lotu: po ciemku schodzimy drabinką przez pośrednie zoomy,
    // żeby każdy poziom trasy siedział w cache'u — w locie nic się nie doczytuje.
    const idleOnce = (cap: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, cap);
        map.once('idle', () => {
          window.clearTimeout(t);
          resolve();
        });
      });
    const ladder: { center: LngLatLike; zoom: number }[] = [
      { center: PLOCZKI, zoom: FINAL_ZOOM },
      { center: PLOCZKI, zoom: 9.4 },
      { center: PLOCZKI, zoom: 7.4 },
      { center: PLOCZKI, zoom: 5.4 },
      { center: PLOCZKI, zoom: START_ZOOM },
    ];
    void (async () => {
      for (const step of ladder) {
        if (finished) return;
        map.jumpTo(step);
        await idleOnce(700);
      }
      if (!finished) whenVisible(begin);
    })();
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
