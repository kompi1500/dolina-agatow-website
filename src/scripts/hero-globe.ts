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
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const PLOCZKI = { lat: 51.0825, lon: 15.5328 };
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FINAL_ZOOM = 11.4;
const CROSSFADE_MAP_ZOOM = 4.6; // kadr mapy odpowiadający końcowemu kadrowi globu

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

function makeAtmosphere(): THREE.Mesh {
  // poświata: odwrócona sfera z fresnelem od krawędzi
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: { c: { value: new THREE.Color(0x6fb7ff) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 c;
      varying vec3 vNormal;
      void main() {
        float glow = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, -1.0)), 3.5);
        gl_FragColor = vec4(c, 1.0) * glow;
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.16, 48, 48), mat);
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
  const [dayTex, cloudTex] = await Promise.all([
    loader.loadAsync(`${base}/textures/2k_earth_daymap.jpg`),
    loader.loadAsync(`${base}/textures/2k_earth_clouds.jpg`),
  ]);
  dayTex.colorSpace = THREE.SRGBColorSpace;

  const renderer = new THREE.WebGLRenderer({
    canvas: els.canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
  scene.add(globe);
  scene.add(makeAtmosphere());

  // orientacje: start nad Atlantykiem (Europa na horyzoncie), koniec — Płóczki Górne
  // na wprost kamery; obie liczone tak samo, więc slerp idzie po ładnym łuku
  const toCamera = new THREE.Vector3(0, 0, 1);
  const endQ = new THREE.Quaternion().setFromUnitVectors(
    latLonToVector3(PLOCZKI.lat, PLOCZKI.lon, 1).normalize(),
    toCamera,
  );
  const startQ = new THREE.Quaternion().setFromUnitVectors(
    latLonToVector3(18, -38, 1).normalize(),
    toCamera,
  );

  // mapa czeka pod spodem w kadrze kontynentalnym
  let map: MapLibreMap | undefined;
  try {
    map = createMap(els.mapDiv, false, CROSSFADE_MAP_ZOOM);
    if (import.meta.env.DEV) (window as unknown as { __heroMap?: MapLibreMap }).__heroMap = map;
  } catch {
    map = undefined;
  }

  const T_HOLD = 900; // spokojny start
  const T_FLY = 3600; // lot: obrót + zoom
  const T_FADE = 1100; // crossfade glob→mapa
  const T_MAPFLY = 3400; // dolot mapy do wsi

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
    camera.position.z = 3.6 - e * (3.6 - 1.55);
    renderer.render(scene, camera);

    // faza 3: crossfade
    const fadeT = THREE.MathUtils.clamp((t - T_HOLD - T_FLY + 250) / T_FADE, 0, 1);
    if (fadeT > 0) {
      els.mapDiv.style.opacity = String(fadeT);
      els.canvas.style.opacity = String(1 - fadeT);
      if (map && !mapFlightStarted) {
        mapFlightStarted = true;
        map.flyTo({
          center: [PLOCZKI.lon, PLOCZKI.lat],
          zoom: FINAL_ZOOM,
          duration: T_MAPFLY,
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
