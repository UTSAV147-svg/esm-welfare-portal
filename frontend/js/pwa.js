/**
 * ==============================================================================
 * VeerSeva - PWA & Auto-Update Engine
 * Registers Service Worker and polls /api/v1/version to detect new releases
 * ==============================================================================
 */

import { api } from './api.js';

let newWorker = null;
let currentClientVersion = '1.2.0';

export function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/public/sw.js').then((reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);

      reg.addEventListener('updatefound', () => {
        newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    }).catch((err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    });

    // Listen for controlling service worker change
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // Periodic Backend Version Polling (every 45 seconds)
  setInterval(checkServerVersion, 45000);
}

async function checkServerVersion() {
  try {
    const res = await api.getVersion();
    if (res && res.version && res.version !== currentClientVersion) {
      console.log(`[Auto-Update] Detected server version ${res.version} (current: ${currentClientVersion})`);
      showUpdateBanner(`New VeerSeva Release (${res.version}) Available!`);
    }
  } catch {}
}

export function showUpdateBanner(customMessage = null) {
  if (document.getElementById('pwa-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.className = 'pwa-update-banner';
  banner.innerHTML = `
    <div>
      <div class="fw-bold mb-1"><i class="bi bi-cloud-arrow-down-fill me-2 text-warning"></i> ${customMessage || 'New version available!'}</div>
      <div class="small text-light">Click update to apply security patches and latest benefits data.</div>
    </div>
    <button class="btn btn-gold btn-sm px-3" id="btn-pwa-apply-update">Update Now</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('btn-pwa-apply-update')?.addEventListener('click', () => {
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });
}
