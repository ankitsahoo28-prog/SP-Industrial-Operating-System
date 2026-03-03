const API_URL = process.env.REACT_APP_BACKEND_URL;

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('SW registered:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        });
      } catch (error) {
        console.log('SW registration failed:', error);
      }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_REQUIRED') {
        window.dispatchEvent(new CustomEvent('sync-required'));
      }
    });
  }
}

let deferredPrompt = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function canInstall() {
  return deferredPrompt !== null;
}
