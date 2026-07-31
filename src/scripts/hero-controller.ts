interface HeroEls {
  root: HTMLElement;
  video: HTMLVideoElement;
  skip: HTMLButtonElement;
  openMap: HTMLButtonElement;
  dialog: HTMLDialogElement;
  closeMap: HTMLButtonElement;
  retryMap: HTMLButtonElement;
  mapCanvas: HTMLElement;
  mapState: HTMLElement;
}

function getEls(): HeroEls | null {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return null;
  const video = root.querySelector<HTMLVideoElement>('[data-intro-video]');
  const skip = root.querySelector<HTMLButtonElement>('[data-skip-intro]');
  const openMap = root.querySelector<HTMLButtonElement>('[data-open-map]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-map-dialog]');
  const closeMap = dialog?.querySelector<HTMLButtonElement>('[data-close-map]');
  const retryMap = dialog?.querySelector<HTMLButtonElement>('[data-retry-map]');
  const mapCanvas = dialog?.querySelector<HTMLElement>('[data-map-canvas]');
  const mapState = dialog?.querySelector<HTMLElement>('[data-map-state]');
  if (!video || !skip || !openMap || !dialog || !closeMap || !retryMap || !mapCanvas || !mapState) {
    return null;
  }
  return { root, video, skip, openMap, dialog, closeMap, retryMap, mapCanvas, mapState };
}

function init(): void {
  const els = getEls();
  if (!els) return;

  let fallbackTimer = 0;
  let mapHandle: { remove: () => void } | null = null;
  let mapLoading = false;

  const completeIntro = () => {
    window.clearTimeout(fallbackTimer);
    els.video.pause();
    els.root.classList.remove('is-playing');
    els.root.classList.add('is-complete');
    els.skip.hidden = true;
  };

  const playIntro = async () => {
    window.clearTimeout(fallbackTimer);
    els.root.classList.add('is-js');
    els.root.classList.remove('is-complete');
    els.skip.hidden = false;
    els.video.currentTime = 0;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduceMotion || connection?.saveData) {
      completeIntro();
      return;
    }

    fallbackTimer = window.setTimeout(completeIntro, 5500);
    try {
      await els.video.play();
      els.root.classList.add('is-playing');
    } catch {
      completeIntro();
    }
  };

  const loadMap = async () => {
    if (mapHandle || mapLoading) return;
    mapLoading = true;
    els.dialog.dataset.state = 'loading';
    els.mapState.textContent = 'Przygotowujemy mapę Doliny…';
    try {
      const { createHeroMap } = await import('./hero-map');
      mapHandle = createHeroMap(els.mapCanvas, () => {
        els.dialog.dataset.state = 'ready';
        mapLoading = false;
      });
      window.setTimeout(() => {
        if (els.dialog.dataset.state === 'loading') {
          mapHandle?.remove();
          mapHandle = null;
          mapLoading = false;
          els.dialog.dataset.state = 'error';
          els.mapState.textContent = 'Mapa nie odpowiedziała. Możesz spróbować ponownie.';
        }
      }, 9000);
    } catch {
      mapLoading = false;
      els.dialog.dataset.state = 'error';
      els.mapState.textContent = 'Nie udało się załadować mapy. Sprawdź połączenie i spróbuj ponownie.';
    }
  };

  els.video.addEventListener('ended', completeIntro);
  els.video.addEventListener('error', completeIntro);
  els.skip.addEventListener('click', completeIntro);
  els.openMap.addEventListener('click', () => {
    els.dialog.showModal();
    document.body.classList.add('dialog-open');
    void loadMap();
  });
  els.closeMap.addEventListener('click', () => els.dialog.close());
  els.retryMap.addEventListener('click', () => void loadMap());
  els.dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    els.openMap.focus();
  });
  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) els.dialog.close();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      if (els.dialog.open) els.dialog.close();
      void playIntro();
    }
  });

  void playIntro();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
