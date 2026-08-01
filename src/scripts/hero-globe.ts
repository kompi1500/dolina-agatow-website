import { Map as MapLibreMap, Marker, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const SIEDZIBA = [15.52605, 51.064831] as const;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ORTO_SOURCE = 'orto-s2';
const ORTO_LAYER = 'orto-s2';
const ORTO_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/{z}/{y}/{x}.jpg';
const FINAL_ZOOM = 11.5;
const START_ZOOM = 1.5;
const START_CENTER: LngLatLike = [-14, 38];
const INTRO_TIMEOUT = 9500;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

interface Els {
  hero: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  mapDiv: HTMLElement;
  overlay: HTMLElement;
  skip: HTMLButtonElement;
  controls: HTMLElement;
  coordinates: HTMLElement;
  layerButton: HTMLButtonElement;
  compass: HTMLButtonElement;
  fullscreen: HTMLButtonElement;
}

function getEls(): Els | null {
  const hero = document.getElementById('top');
  const stage = document.getElementById('hero-stage');
  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement | null;
  const mapDiv = document.getElementById('hero-map');
  const overlay = document.getElementById('hero-overlay');
  const skip = document.getElementById('hero-skip') as HTMLButtonElement | null;
  const controls = document.getElementById('hero-map-controls');
  const coordinates = document.getElementById('hero-coordinates');
  const layerButton = document.querySelector<HTMLButtonElement>('[data-map-action="layer"]');
  const compass = document.querySelector<HTMLButtonElement>('[data-map-action="compass"]');
  const fullscreen = document.querySelector<HTMLButtonElement>('[data-map-action="fullscreen"]');
  if (!hero || !stage || !canvas || !mapDiv || !overlay || !skip || !controls || !coordinates || !layerButton || !compass || !fullscreen) return null;
  return { hero, stage, canvas, mapDiv, overlay, skip, controls, coordinates, layerButton, compass, fullscreen };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function paintStars(els: Els): void {
  const ctx = els.canvas.getContext('2d');
  if (!ctx) return;
  const draw = () => {
    const { clientWidth: width, clientHeight: height } = els.stage;
    const dpr = Math.min(window.devicePixelRatio, 2);
    els.canvas.width = width * dpr;
    els.canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let seed = 42;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 260; i += 1) {
      ctx.globalAlpha = 0.25 + random() * 0.65;
      ctx.fillStyle = '#f5f2ea';
      ctx.beginPath();
      ctx.arc(random() * width, random() * height, random() * 1.1 + 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  draw();
  window.addEventListener('resize', draw, { passive: true });
}

function tileCacheSize(): number {
  const visibleTiles = Math.ceil(window.innerWidth / 256) * Math.ceil(window.innerHeight / 256);
  return Math.min(128, Math.max(64, visibleTiles * 4));
}

function createMap(mapDiv: HTMLElement, interactive: boolean, zoom: number, center: LngLatLike): MapLibreMap {
  return new MapLibreMap({
    container: mapDiv,
    style: MAP_STYLE,
    center,
    zoom,
    interactive,
    cooperativeGestures: false,
    attributionControl: false,
    canvasContextAttributes: { alpha: true },
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    fadeDuration: 0,
    maxTileCacheSize: tileCacheSize(),
  });
}

async function addPolandOutline(map: MapLibreMap): Promise<void> {
  try {
    const response = await fetch(`${base}/data/poland-outline.geojson`);
    if (!response.ok) return;
    const data = await response.json();
    if (!map.getStyle() || map.getSource('polska-obrys')) return;
    map.addSource('polska-obrys', { type: 'geojson', data });
    map.addLayer({
      id: 'polska-obrys',
      type: 'line',
      source: 'polska-obrys',
      paint: {
        'line-color': '#e8a13c',
        'line-width': 1.6,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.9, 8.5, 0],
      },
    });
  } catch {
    // Obrys jest dekoracyjny; jego brak nie może zatrzymać intro.
  }
}

function addPin(map: MapLibreMap, mapDiv: HTMLElement): void {
  if (mapDiv.dataset.pinned) return;
  mapDiv.dataset.pinned = '1';
  const element = document.createElement('div');
  element.className = 'agat-pin';
  element.innerHTML = '<span class="agat-pin-dot"></span>';
  new Marker({ element, anchor: 'center' }).setLngLat(SIEDZIBA).addTo(map);
}

function landingPadding(els: Els): number {
  return Math.round(els.stage.clientHeight * (window.innerWidth < 680 ? 0.31 : 0.26));
}

function toTile(longitude: number, latitude: number, zoom: number): [number, number] {
  const scale = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * scale);
  const latitudeRad = (latitude * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latitudeRad)) / Math.PI) / 2) * scale);
  return [x, y];
}

function flightTileUrls(): string[] {
  const urls = new Set<string>();
  const portrait = window.innerHeight > window.innerWidth;
  const addArea = (zoom: number, radiusX: number, radiusY: number) => {
    const [centerX, centerY] = toTile(SIEDZIBA[0], SIEDZIBA[1], zoom);
    for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
      for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
        urls.add(ORTO_URL.replace('{z}', String(zoom)).replace('{y}', String(y)).replace('{x}', String(x)));
      }
    }
  };

  // Najpierw finał — najważniejszy przy krótkim limicie czasu.
  for (const zoom of [11, 12]) {
    const radiusX = zoom === 11 ? 1 : portrait ? 1 : 2;
    const radiusY = zoom === 11 ? 1 : portrait ? 2 : 1;
    addArea(zoom, radiusX, radiusY);
  }

  // Następnie drabinka lotu. Sąsiednie kafelki zapobiegają miękkim prostokątom
  // z niższego zoomu, gdy kamera przekracza kolejny poziom szczegółowości.
  for (const zoom of [10, 9, 7, 5, 3]) addArea(zoom, 1, 1);
  return [...urls].slice(0, 64);
}

async function prefetchFlightTiles(): Promise<void> {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3200);
  const queue = flightTileUrls();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url || controller.signal.aborted) return;
      try {
        const response = await fetch(url, { cache: 'force-cache', signal: controller.signal });
        if (response.ok) await response.blob();
      } catch {
        // Prefetch jest wyłącznie optymalizacją.
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  window.clearTimeout(timeout);
}

function waitForOrtho(map: MapLibreMap, timeoutMs = 1600): Promise<void> {
  return new Promise((resolve) => {
    if (map.isSourceLoaded(ORTO_SOURCE)) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      map.off('sourcedata', onSourceData);
      resolve();
    };
    const onSourceData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (event.sourceId === ORTO_SOURCE && event.isSourceLoaded) done();
    };
    const timeout = window.setTimeout(done, timeoutMs);
    map.on('sourcedata', onSourceData);
  });
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return `${degrees}°${String(minutes).padStart(2, '0')}′${String(seconds).padStart(2, '0')}″${value >= 0 ? positive : negative}`;
}

function coordinateLabel(longitude: number, latitude: number): string {
  return `${formatCoordinate(latitude, 'N', 'S')} · ${formatCoordinate(longitude, 'E', 'W')}`;
}

function setSatellite(map: MapLibreMap, els: Els, enabled: boolean): void {
  if (!map.getLayer(ORTO_LAYER)) return;
  map.setLayoutProperty(ORTO_LAYER, 'visibility', enabled ? 'visible' : 'none');
  els.layerButton.dataset.mode = enabled ? 'satellite' : 'map';
  els.layerButton.setAttribute('aria-pressed', String(enabled));
  els.layerButton.querySelector('[data-layer-label]')!.textContent = enabled ? 'Satelita' : 'Mapa';
}

function bindExplorer(map: MapLibreMap, els: Els): void {
  if (els.controls.dataset.ready) return;
  els.controls.dataset.ready = '1';
  els.controls.classList.add('visible');
  els.coordinates.classList.add('visible');
  els.mapDiv.removeAttribute('aria-hidden');

  els.controls.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-map-action]');
    if (!button) return;
    switch (button.dataset.mapAction) {
      case 'reset':
        map.easeTo({ center: SIEDZIBA, zoom: FINAL_ZOOM, bearing: 0, pitch: 0, padding: { top: 0, left: 0, right: 0, bottom: landingPadding(els) }, duration: 900 });
        break;
      case 'layer':
        setSatellite(map, els, button.dataset.mode !== 'satellite');
        break;
      case 'zoom-in':
        map.zoomIn({ duration: 350 });
        break;
      case 'zoom-out':
        map.zoomOut({ duration: 350 });
        break;
      case 'compass':
        map.resetNorthPitch({ duration: 500 });
        break;
      case 'fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void els.hero.requestFullscreen?.();
        break;
    }
  });

  const updateCompass = () => {
    const bearing = map.getBearing();
    els.compass.classList.toggle('visible', Math.abs(bearing) > 1 || map.getPitch() > 1);
    els.compass.style.setProperty('--bearing', `${-bearing}deg`);
  };
  map.on('rotate', updateCompass);
  map.on('pitch', updateCompass);

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let frame = 0;
  let pointer: PointerEvent | null = null;
  if (!coarse) {
    els.mapDiv.addEventListener('pointermove', (event) => {
      pointer = event;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!pointer) return;
        const rect = els.mapDiv.getBoundingClientRect();
        const x = pointer.clientX - rect.left;
        const y = pointer.clientY - rect.top;
        const point = map.unproject([x, y]);
        els.coordinates.textContent = coordinateLabel(point.lng, point.lat);
      });
    }, { passive: true });
    els.mapDiv.addEventListener('pointerleave', () => {
      els.coordinates.textContent = coordinateLabel(SIEDZIBA[0], SIEDZIBA[1]);
    });
  } else {
    map.on('moveend', () => {
      const center = map.getCenter();
      els.coordinates.textContent = coordinateLabel(center.lng, center.lat);
    });
  }

  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === els.hero;
    els.fullscreen.setAttribute('aria-pressed', String(active));
    els.fullscreen.setAttribute('aria-label', active ? 'Wyłącz pełny ekran' : 'Włącz pełny ekran');
    window.setTimeout(() => map.resize(), 50);
  });
}

function enableInteraction(map: MapLibreMap, els: Els): void {
  map.dragPan.enable();
  map.touchZoomRotate.enable();
  map.doubleClickZoom.enable();
  map.keyboard.enable();
  map.scrollZoom.disable();
  bindExplorer(map, els);
}

function showFinal(els: Els, existingMap?: MapLibreMap): void {
  els.stage.classList.add('done', 'map-visible');
  els.overlay.classList.remove('hidden');
  els.skip.classList.remove('visible');
  els.mapDiv.style.opacity = '1';
  try {
    const map = existingMap ?? createMap(els.mapDiv, true, FINAL_ZOOM, SIEDZIBA);
    map.stop();
    map.setPadding({ top: 0, left: 0, right: 0, bottom: landingPadding(els) });
    map.jumpTo({ center: SIEDZIBA, zoom: FINAL_ZOOM });
    enableInteraction(map, els);
    addPin(map, els.mapDiv);
  } catch {
    els.coordinates.classList.remove('visible');
  }
}

function configureStyle(map: MapLibreMap): void {
  map.setProjection({ type: 'globe' });
  const firstSymbol = (map.getStyle().layers ?? []).find((layer) => layer.type === 'symbol')?.id;
  map.addSource(ORTO_SOURCE, {
    type: 'raster',
    tiles: [ORTO_URL],
    tileSize: 256,
    maxzoom: 14,
    attribution: 'Sentinel-2 cloudless 2018 — EOX (CC BY-NC-SA 4.0)',
  });
  map.addLayer({ id: ORTO_LAYER, type: 'raster', source: ORTO_SOURCE, paint: { 'raster-fade-duration': 0 } }, firstSymbol);
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'symbol') map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, 6.8), layer.maxzoom ?? 24);
    if (layer.type === 'fill-extrusion') map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
  void addPolandOutline(map);
}

function runIntro(els: Els): void {
  const map = createMap(els.mapDiv, false, START_ZOOM, START_CENTER);
  map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
  if (import.meta.env.DEV) (window as unknown as { __heroMap?: MapLibreMap }).__heroMap = map;

  let finished = false;
  let styled = false;
  const finish = (skipped: boolean) => {
    if (finished) return;
    finished = true;
    window.clearTimeout(hardTimeout);
    els.skip.classList.remove('visible');
    if (skipped) showFinal(els, map);
    else {
      els.stage.classList.add('done');
      els.overlay.classList.remove('hidden');
      enableInteraction(map, els);
    }
  };

  const hardTimeout = window.setTimeout(() => finish(true), INTRO_TIMEOUT);
  els.skip.classList.add('visible');
  els.skip.addEventListener('click', () => finish(true), { once: true });
  els.overlay.classList.add('hidden');

  map.on('error', (event) => {
    const sourceId = (event as unknown as { sourceId?: string }).sourceId;
    if (finished && sourceId === ORTO_SOURCE) setSatellite(map, els, false);
    if (!finished && !styled && !map.isStyleLoaded()) finish(true);
  });

  map.on('style.load', () => {
    styled = true;
    configureStyle(map);
    const whenVisible = (callback: () => void) => {
      if (document.visibilityState === 'visible') callback();
      else document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && callback(), { once: true });
    };
    let revealed = false;
    const reveal = () => {
      if (finished || revealed) return;
      revealed = true;
      els.mapDiv.style.opacity = '1';
      els.stage.classList.add('map-visible');
      whenVisible(async () => {
        await prefetchFlightTiles();
        window.setTimeout(() => {
        if (finished) return;
        map.flyTo({
          center: SIEDZIBA,
          zoom: FINAL_ZOOM,
          duration: 2600,
          curve: 1.32,
          padding: { top: 0, left: 0, right: 0, bottom: landingPadding(els) },
          essential: true,
        });
        map.once('moveend', async () => {
          if (finished) return;
          await waitForOrtho(map);
          if (finished) return;
          addPin(map, els.mapDiv);
          window.setTimeout(() => finish(false), 150);
        });
        }, 350);
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
  els.coordinates.textContent = coordinateLabel(SIEDZIBA[0], SIEDZIBA[1]);
  paintStars(els);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !hasWebGL()) {
    showFinal(els);
    return;
  }
  try {
    runIntro(els);
  } catch {
    showFinal(els);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
