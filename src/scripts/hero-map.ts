import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import mapCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url';

const SIEDZIBA: [number, number] = [15.52605, 51.064831];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/fiord';

export interface HeroMapHandle {
  remove: () => void;
}

export function createHeroMap(container: HTMLElement, onReady: () => void): HeroMapHandle {
  if (!document.querySelector<HTMLLinkElement>('link[data-maplibre-css]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = mapCssUrl;
    stylesheet.dataset.maplibreCss = '';
    document.head.appendChild(stylesheet);
  }

  const map = new MapLibreMap({
    container,
    style: MAP_STYLE,
    center: SIEDZIBA,
    zoom: 12,
    attributionControl: true,
    maxTileCacheSize: 64,
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  });

  map.scrollZoom.disable();
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

  const pin = document.createElement('div');
  pin.className = 'agat-pin';
  pin.setAttribute('aria-label', 'Siedziba stowarzyszenia, Płóczki Górne 4A');
  pin.innerHTML = '<span class="agat-pin-dot"></span>';
  new Marker({ element: pin, anchor: 'center' }).setLngLat(SIEDZIBA).addTo(map);

  map.once('load', onReady);
  return { remove: () => map.remove() };
}
