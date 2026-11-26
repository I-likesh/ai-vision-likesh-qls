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

  const promise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(true);
        return;
      }
      if (existing.dataset.failed === 'true') {
        existing.remove();
      } else {
        let settledExisting = false;
        const existingTimeoutId = window.setTimeout(() => {
          if (!settledExisting) {
            settledExisting = true;
            delete loadedScripts[src];
            resolve(false);
          }
        }, 12000);
        const onExistingLoad = () => {
          existing.dataset.loaded = 'true';
          if (!settledExisting) {
            settledExisting = true;
            window.clearTimeout(existingTimeoutId);
            resolve(true);
          }
        };
        const onExistingError = () => {
          existing.dataset.failed = 'true';
          if (!settledExisting) {
            settledExisting = true;
            window.clearTimeout(existingTimeoutId);
            delete loadedScripts[src];
            resolve(false);
          }
        };
        existing.addEventListener('load', onExistingLoad, { once: true });
        existing.addEventListener('error', onExistingError, { once: true });
        return;
      }
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        delete loadedScripts[src];
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
      script.dataset.failed = 'true';
      console.warn(`Failed to load external ML model script from CDN: ${src}`, err);
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
        delete loadedScripts[src];
        resolve(false);
      }
    };

    document.head.appendChild(script);
  });

  loadedScripts[src] = promise;
  return promise;
}

export interface ModelLoadingState {
  status: 'idle' | 'loading' | 'ready' | 'fallback' | 'error';
  progress: number;
  message: string;
}
