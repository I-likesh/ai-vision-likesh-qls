const loadedScripts: Record<string, Promise<boolean> | undefined> = {};
let initQueue: Promise<unknown> = Promise.resolve();

export function runSequentialInit<T>(task: () => Promise<T>): Promise<T> {
  const next = initQueue.then(
    () => task(),
    () => task()
  );
  initQueue = next.catch(() => undefined);
  return next;
}

export function loadScript(src: string): Promise<boolean> {
  const cached = loadedScripts[src];
  if (cached !== undefined) {
    return cached;
  }

  loadedScripts[src] = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(true);
        return;
      }
      const onExistingLoad = () => {
        existing.dataset.loaded = 'true';
        resolve(true);
      };
      const onExistingError = () => {
        resolve(false);
      };
      existing.addEventListener('load', onExistingLoad, { once: true });
      existing.addEventListener('error', onExistingError, { once: true });
      setTimeout(() => resolve(true), 1500);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(false);
      }
    }, 12000);

    script.onload = () => {
      script.dataset.loaded = 'true';
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(true);
      }
    };

    script.onerror = (err) => {
      console.warn(`Failed to load external ML model script from CDN: ${src}`, err);
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(false);
      }
    };

    document.head.appendChild(script);
  });

  return loadedScripts[src];
}

export interface ModelLoadingState {
  status: 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
  progress: number;
  message: string;
}
