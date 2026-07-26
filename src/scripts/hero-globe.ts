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
const START_CENTER: LngLatLike = [-20, 35]; // Atlantyk, Europa na horyzoncie globu
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 10.9;
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

function addPin(map: MapLibreMap): void {
  const el = document.createElement('div');
  el.className = 'agat-pin';
  el.innerHTML = `<span class="agat-pin-dot"></span><span class="agat-pin-label">Płóczki Górne — Dolina Agatów</span>`;
  new Marker({ element: el, anchor: 'bottom' }).setLngLat(PLOCZKI).addTo(map);
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
    let map = existingMap;
    if (!map) {
      map = createMap(els.mapDiv, true, FINAL_ZOOM, PLOCZKI);
    } else {
      map.stop();
      map.jumpTo({ center: PLOCZKI, zoom: FINAL_ZOOM });
      enableInteraction(map);
    }
    if (!els.mapDiv.dataset.pinned) {
      els.mapDiv.dataset.pinned = '1';
      addPin(map);
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
    void addPolandOutline(map);
    els.mapDiv.style.opacity = '1';

    // start dopiero, gdy karta jest widoczna — w tle animacja by przeskoczyła
    const begin = () => {
      // faza 1: powolny obrót globu ku Europie
      map.easeTo({ center: [2, 44], zoom: START_ZOOM + 0.25, duration: 2600, easing: (t) => t });
      // faza 2: jeden ciągły przelot z orbity na Płóczki Górne
      window.setTimeout(() => {
        if (finished) return;
        map.flyTo({ center: PLOCZKI, zoom: FINAL_ZOOM, duration: 6400, curve: 1.32, essential: true });
        map.once('moveend', () => {
          if (finished) return;
          if (!els.mapDiv.dataset.pinned) {
            els.mapDiv.dataset.pinned = '1';
            addPin(map);
          }
          window.setTimeout(() => finish(false), 350);
        });
      }, 2650);
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
