/**
 * Hero „z kosmosu do doliny”:
 *  1. glob Three.js (NASA Blue Marble) obraca się i zbliża ku Polsce,
 *  2. crossfade do mapy MapLibre (OpenFreeMap) przy zgodnym kadrze,
 *  3. mapa doleci do Płóczek Górnych, spada pineska, wyłania się tytuł.
 *
 * Fallback (brak WebGL / prefers-reduced-motion / błąd tekstur): statyczna mapa
 * na finalnej pozycji albo samo gwiezdne tło z CSS — tytuł zawsze widoczny.
 */
import * as THREE from 'three';
import { mesh as topoMesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const PLOCZKI = { lat: 51.0825, lon: 15.5328 };
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 10.9;
const CROSSFADE_MAP_ZOOM = 5.6; // kadr mapy odpowiadający końcowemu kadrowi globu

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

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

function latLonToVector3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function makeStars(): THREE.Points {
  const n = 1600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xf5f2ea,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });
  return new THREE.Points(geo, mat);
}

type CountriesTopo = Topology<{ countries: GeometryCollection<{ name?: string }> }>;

/** Granice państw jako linie tuż nad powierzchnią globu. */
function bordersFromTopo(
  topo: CountriesTopo,
  filter: (a: { id?: string | number }, b: { id?: string | number }) => boolean,
  color: number,
  opacity: number,
  radius: number,
): THREE.LineSegments {
  const multiline = topoMesh(topo, topo.objects.countries, filter);
  const positions: number[] = [];
  const push = (lon: number, lat: number) => {
    const v = latLonToVector3(lat, lon, radius);
    positions.push(v.x, v.y, v.z);
  };
  const lines =
    multiline.type === 'MultiLineString' ? multiline.coordinates : [multiline.coordinates];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      push(line[i]![0]!, line[i]![1]!);
      push(line[i + 1]![0]!, line[i + 1]![1]!);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  return new THREE.LineSegments(geo, mat);
}

function createMap(mapDiv: HTMLElement, interactive: boolean, zoom: number): MapLibreMap {
  return new MapLibreMap({
    container: mapDiv,
    style: MAP_STYLE,
    center: [PLOCZKI.lon, PLOCZKI.lat],
    zoom,
    interactive,
    attributionControl: false,
  });
}

function addPin(map: MapLibreMap): void {
  const el = document.createElement('div');
  el.className = 'agat-pin';
  el.innerHTML = `<span class="agat-pin-dot"></span><span class="agat-pin-label">Płóczki Górne — Dolina Agatów</span>`;
  new Marker({ element: el, anchor: 'bottom' })
    .setLngLat([PLOCZKI.lon, PLOCZKI.lat])
    .addTo(map);
}

/** Stan końcowy bez animacji (fallback i „pomiń intro”). */
function showFinal(els: Els, existingMap?: MapLibreMap): void {
  els.stage.classList.add('done');
  els.overlay.classList.remove('hidden');
  els.skip.classList.remove('visible');
  els.canvas.style.opacity = '0';
  els.mapDiv.style.opacity = '1';
  try {
    let map = existingMap;
    if (!map) {
      map = createMap(els.mapDiv, true, FINAL_ZOOM);
    } else {
      map.stop();
      map.jumpTo({ center: [PLOCZKI.lon, PLOCZKI.lat], zoom: FINAL_ZOOM });
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
    }
    if (!els.mapDiv.dataset.pinned) {
      els.mapDiv.dataset.pinned = '1';
      addPin(map);
    }
  } catch {
    /* mapa niedostępna (offline) — zostaje gwiezdne tło z CSS */
  }
}

async function runIntro(els: Els): Promise<void> {
  const loader = new THREE.TextureLoader();
  const [dayTex, cloudTex, topo] = await Promise.all([
    loader.loadAsync(`${base}/textures/2k_earth_daymap.jpg`),
    loader.loadAsync(`${base}/textures/2k_earth_clouds.jpg`),
    fetch(`${base}/data/countries-50m.json`).then((r) => r.json() as Promise<CountriesTopo>),
  ]);
  dayTex.colorSpace = THREE.SRGBColorSpace;

  const renderer = new THREE.WebGLRenderer({
    canvas: els.canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.z = 3.6;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = els.stage;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-2.5, 1.2, 2.2);
  scene.add(sun);
  scene.add(makeStars());

  const globe = new THREE.Group();
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.MeshStandardMaterial({ map: dayTex, roughness: 0.92, metalness: 0 }),
    ),
  );
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 64, 64),
    new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  globe.add(clouds);
  // granice państw + wyróżniona Polska (bursztyn), obracają się razem z globem
  const isPL = (g: { id?: string | number }) => String(g.id) === '616';
  globe.add(bordersFromTopo(topo, (a, b) => a !== b, 0xfaf6ef, 0.32, 1.002));
  globe.add(bordersFromTopo(topo, (a, b) => isPL(a) || isPL(b), 0xe8a13c, 0.95, 1.003));
  scene.add(globe);

  // Orientacja globu dla punktu (lat, lon): punkt na wprost kamery (+z),
  // lokalna północ w górę ekranu (+y) — bez przechyłu (roll), północ zawsze u góry.
  const orientForPoint = (lat: number, lon: number): THREE.Quaternion => {
    const p = latLonToVector3(lat, lon, 1).normalize();
    const north = new THREE.Vector3(0, 1, 0);
    const northTangent = north.clone().addScaledVector(p, -p.dot(north)).normalize();
    const east = new THREE.Vector3().crossVectors(northTangent, p);
    const basis = new THREE.Matrix4().makeBasis(east, northTangent, p);
    return new THREE.Quaternion().setFromRotationMatrix(basis).invert();
  };
  // start nad Atlantykiem (Europa na horyzoncie), koniec — Płóczki Górne
  const endQ = orientForPoint(PLOCZKI.lat, PLOCZKI.lon);
  const startQ = orientForPoint(18, -38);

  // mapa czeka pod spodem w kadrze kontynentalnym
  let map: MapLibreMap | undefined;
  try {
    map = createMap(els.mapDiv, false, CROSSFADE_MAP_ZOOM);
    if (import.meta.env.DEV) (window as unknown as { __heroMap?: MapLibreMap }).__heroMap = map;
  } catch {
    map = undefined;
  }

  const T_HOLD = 800; // spokojny start
  const T_FLY = 4300; // lot: obrót + zoom
  const T_FADE = 900; // crossfade glob→mapa (w trakcie ruchu obu warstw)
  const T_MAPFLY = 3200; // dolot mapy do wsi

  let finished = false;
  let raf = 0;

  const finish = (skipped: boolean) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    renderer.dispose();
    if (skipped) {
      showFinal(els, map);
      return;
    }
    els.stage.classList.add('done');
    els.skip.classList.remove('visible');
    if (map) {
      // mapa staje się interaktywna; scrollZoom zostaje wyłączony, żeby nie więził scrolla strony
      map.getCanvas().style.pointerEvents = 'auto';
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
    }
  };

  els.skip.classList.add('visible');
  els.skip.addEventListener('click', () => finish(true), { once: true });
  els.overlay.classList.add('hidden');

  let mapFlightStarted = false;
  let pinDropped = false;

  // czas akumulowany z clampem delty — karta w tle / lag nie przeskakuje animacji
  let t = 0;
  let last = performance.now();

  const frame = (now: number) => {
    if (finished) return;
    t += Math.min(now - last, 50);
    last = now;

    // faza 1-2: glob
    const flyT = THREE.MathUtils.clamp((t - T_HOLD) / T_FLY, 0, 1);
    const e = easeInOut(flyT);
    globe.quaternion.slerpQuaternions(startQ, endQ, e);
    clouds.rotation.y += 0.00018;
    camera.position.z = 3.6 - e * (3.6 - 1.32);
    renderer.render(scene, camera);

    // faza 3: crossfade — zaczyna się, gdy glob jeszcze leci, a mapa już rusza
    const fadeT = THREE.MathUtils.clamp((t - T_HOLD - T_FLY + 700) / T_FADE, 0, 1);
    if (fadeT > 0) {
      els.mapDiv.style.opacity = String(fadeT);
      els.canvas.style.opacity = String(1 - fadeT);
      if (map && !mapFlightStarted) {
        mapFlightStarted = true;
        map.flyTo({
          center: [PLOCZKI.lon, PLOCZKI.lat],
          zoom: FINAL_ZOOM,
          duration: T_MAPFLY,
          curve: 1.25,
          essential: true,
        });
      }
    }

    // faza 4: pineska + tytuł tuż przed końcem dolotu
    const total = T_HOLD + T_FLY + T_MAPFLY - 600;
    if (t > total - 900 && map && !pinDropped) {
      pinDropped = true;
      els.mapDiv.dataset.pinned = '1';
      addPin(map);
    }
    if (t > total) {
      els.overlay.classList.remove('hidden');
      finish(false);
      return;
    }
    if (!map && fadeT >= 1) {
      // mapa padła (offline): kończymy na globie
      els.canvas.style.opacity = '1';
      els.mapDiv.style.opacity = '0';
      els.overlay.classList.remove('hidden');
      finish(false);
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

function init(): void {
  const els = getEls();
  if (!els) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !hasWebGL()) {
    showFinal(els);
    return;
  }

  runIntro(els).catch(() => showFinal(els));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
