const CACHE_NAME = 'sky-dash-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/engine/Game.js',
  './src/engine/ObstacleManager.js',
  './src/engine/Player.js',
  './src/engine/Renderer.js',
  './src/utils/GifAnimator.js',
  './src/utils/ImageUtils.js',
  './public/assets/app-icon.svg',
  './public/assets/bee.jpg',
  './public/assets/Pipe.JPG',
  './public/assets/bg.gif',
  './public/assets/kissan4-pixel-paradise-358340.mp3'
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
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
