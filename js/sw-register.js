/* ==========================================================================
   SERVICE WORKER REGISTRATION
   ========================================================================== */
import { showToast } from './ui.js';

    export function registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
      try {
        navigator.serviceWorker.register('sw.js').then(reg => {
          const promptUpdate = (worker) => {
            showToast('Update available', 'Update', () => {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }, 0);
          };

          if (reg.waiting && navigator.serviceWorker.controller) {
            promptUpdate(reg.waiting);
          }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptUpdate(newWorker);
              }
            });
          });
        }).catch(() => {});

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (_) {}
    }
