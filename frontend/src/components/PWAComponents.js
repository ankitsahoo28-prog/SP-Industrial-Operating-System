import { useState, useEffect } from 'react';
import { promptInstall } from '../lib/serviceWorkerRegistration';
import { Download, X, Wifi, WifiOff } from 'lucide-react';

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('pwa-install-available', handler);
    return () => window.removeEventListener('pwa-install-available', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShow(false);
    window.addEventListener('pwa-installed', handler);
    return () => window.removeEventListener('pwa-installed', handler);
  }, []);

  if (!show) return null;

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) setShow(false);
  };

  return (
    <div data-testid="pwa-install-banner" className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow-2xl border border-slate-700 p-4 animate-in slide-in-from-bottom-4">
      <button onClick={() => setShow(false)} className="absolute top-2 right-2 p-1 hover:bg-slate-700 rounded" data-testid="pwa-install-dismiss">
        <X size={14} />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
          <Download size={20} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install SP Industrial</p>
          <p className="text-xs text-slate-400 mt-0.5">Get instant access from your home screen</p>
          <button onClick={handleInstall} data-testid="pwa-install-button"
            className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div data-testid="offline-indicator" className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 shadow-lg">
      <WifiOff size={14} />
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
}

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!show) return null;

  return (
    <div data-testid="update-banner" className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-3">
      <span>A new version is available!</span>
      <button onClick={() => window.location.reload()} className="px-3 py-0.5 bg-white text-blue-600 rounded text-xs font-semibold hover:bg-blue-50 transition-colors">
        Refresh
      </button>
      <button onClick={() => setShow(false)} className="p-0.5 hover:bg-blue-500 rounded">
        <X size={12} />
      </button>
    </div>
  );
}
