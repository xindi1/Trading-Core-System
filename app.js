const STORAGE_KEY = 'trading-core-system-launcher-v1';

let deferredPrompt = null;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function updateLastOpenedUI() {
  const state = readState();
  const title = document.getElementById('lastOpenedTitle');
  const meta = document.getElementById('lastOpenedMeta');
  const resumeBtn = document.getElementById('resumeBtn');

  if (!state.lastTool || !state.lastHref) {
    title.textContent = 'None yet';
    meta.textContent = 'Open a module from this launcher and it will appear here.';
    resumeBtn.disabled = true;
    return;
  }

  title.textContent = state.lastTool;
  meta.textContent = `Last opened: ${state.lastOpenedAt || 'Recently'}`;
  resumeBtn.disabled = false;
  resumeBtn.onclick = () => {
    window.location.href = state.lastHref;
  };
}

function initToolTracking() {
  document.querySelectorAll('[data-tool]').forEach((link) => {
    link.addEventListener('click', () => {
      const label = link.querySelector('h3')?.textContent?.trim() || link.dataset.tool;
      writeState({
        lastTool: label,
        lastHref: link.getAttribute('href'),
        lastOpenedAt: new Date().toLocaleString()
      });
    });
  });
}

function initInstallPrompt() {
  const installBtn = document.getElementById('installBtn');

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

initToolTracking();
updateLastOpenedUI();
initInstallPrompt();
registerServiceWorker();
