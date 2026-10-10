// College OS Progressive Web App & Offline Sync Manager

let deferredInstallPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

// Handle PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] beforeinstallprompt event captured');
  updateInstallButtons(true);
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] College OS installed successfully!');
  deferredInstallPrompt = null;
  updateInstallButtons(false, true);
  if (window.showToast) {
    window.showToast('College OS installed on your home screen!', 'success');
  }
});

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function updateInstallButtons(available, installed = false) {
  const installBtns = document.querySelectorAll('.btn-install-pwa');
  installBtns.forEach(btn => {
    if (installed || isAppInstalled()) {
      btn.innerHTML = '<span>✓ Installed</span>';
      btn.classList.add('bg-emerald-600', 'text-white', 'pointer-events-none');
      btn.classList.remove('bg-white', 'text-[#101828]');
    } else if (available || isIOS()) {
      btn.classList.remove('hidden');
    }
  });
}

// Trigger installation
window.triggerPwaInstall = async function() {
  if (isAppInstalled()) {
    if (window.showToast) window.showToast('College OS is already installed on your device!', 'info');
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] User response to install prompt:', outcome);
    deferredInstallPrompt = null;
    return;
  }

  if (isIOS()) {
    alert('To install College OS on iOS:\n1. Tap the Share button at the bottom of Safari (square with arrow up)\n2. Scroll down and tap "Add to Home Screen"\n3. Enjoy fullscreen standalone access!');
    return;
  }

  // Fallback instructions for desktop / other browsers
  alert('To install College OS:\n• On Chrome/Edge: Click the install icon in the URL bar (⊕) or menu ➔ "Install College OS".\n• On Android: Tap Chrome menu (⋮) ➔ "Install App" or "Add to Home screen".');
};

// Offline Network Status Listener
window.addEventListener('online', () => {
  console.log('[Network] Back online');
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.add('hidden');
  if (window.showToast) window.showToast('Connection restored! Syncing with cloud...', 'success');
  if (window.syncOfflineQueue) window.syncOfflineQueue();
});

window.addEventListener('offline', () => {
  console.log('[Network] Offline mode');
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.remove('hidden');
  if (window.showToast) window.showToast('You are currently offline. Local changes saved.', 'warning');
});

document.addEventListener('DOMContentLoaded', () => {
  if (isAppInstalled()) {
    updateInstallButtons(false, true);
  }
});
