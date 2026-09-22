// Service worker — Copa Integración DNB 2026
// Cachea el "shell" de la app (HTML/CSS/JS/íconos) para que abra sin conexión.
// Los datos (equipos, tiempos, ranking) siguen viniendo de Google Sheets vía
// Apps Script cuando hay conexión; sin conexión, la propia app usa el último
// snapshot guardado en localStorage (ver saveOfflineCache/loadOfflineCache en index.html).

const CACHE_NAME = 'copa-integracion-shell-v3-redisenada';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca interceptar el backend de Google Apps Script: esos pedidos deben
  // ir siempre a la red (o fallar naturalmente si no hay conexión), la
  // propia app ya sabe qué hacer en ese caso.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  if (req.method !== 'GET') return;

  // Navegación (abrir/recargar la app): red primero, con fallback a caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto de recursos propios (CSS/JS/íconos/fonts): caché primero, red de respaldo.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
