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
import { Map as MapLibreMap, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const PLOCZKI: LngLatLike = [15.5328, 51.0825];
const START_CENTER: LngLatLike = [-20, 35]; // Atlantyk, Europa na horyzoncie globu
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 11.5; // od ~11 styl pokazuje nazwy wsi — pineska ma być podpisana przez mapę
const START_ZOOM = 1.4;

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

function enableInteraction(map: MapLibreMap): void {
  // scrollZoom zostaje wyłączony, żeby mapa nie więziła scrolla strony
  map.dragPan.enable();
  map.touchZoomRotate.enable();
  map.doubleClickZoom.enable();
}

/** Stan końcowy bez animacji (fallback i „pomiń intro”). */
function showFinal(els: Els, existingMap?: MapLibreMap): void {
  els.stage.classList.add('done');
  els.overlay.classList.remove('hidden');
  els.skip.classList.remove('visible');
  els.mapDiv.style.opacity = '1';
  try {
    if (!existingMap) {
      createMap(els.mapDiv, true, FINAL_ZOOM, PLOCZKI);
    } else {
      existingMap.stop();
      existingMap.jumpTo({ center: PLOCZKI, zoom: FINAL_ZOOM });
      enableInteraction(existingMap);
    }
  } catch {
    /* mapa niedostępna (offline) — zostaje gwiezdne tło */
  }
}

function runIntro(els: Els): void {
  const map = createMap(els.mapDiv, false, START_ZOOM, START_CENTER);
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
    void addPolandOutline(map);
    els.mapDiv.style.opacity = '1';

    // start dopiero, gdy karta jest widoczna — w tle animacja by przeskoczyła
    const begin = () => {
      // faza 1: krótki obrót globu ku Europie
      map.easeTo({ center: [2, 44], zoom: START_ZOOM + 0.25, duration: 1200, easing: (t) => t });
      // faza 2: jeden ciągły, żwawy przelot z orbity na Płóczki Górne
      window.setTimeout(() => {
        if (finished) return;
        map.flyTo({ center: PLOCZKI, zoom: FINAL_ZOOM, duration: 3400, curve: 1.4, essential: true });
        map.once('moveend', () => {
          if (finished) return;
          window.setTimeout(() => finish(false), 150);
        });
      }, 1250);
    };
    if (document.visibilityState === 'visible') {
      begin();
    } else {
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVisible);
          begin();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
    }
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
