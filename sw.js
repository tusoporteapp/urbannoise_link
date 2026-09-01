/**
 * Urban Noise PWA High-Speed Image & Asset Cache Service Worker (v6)
 * Real-time updates with Network-First navigation & 0ms instant image delivery
 */

const CACHE_NAME = 'un-image-cache-v6';
const STATIC_CACHE = 'un-static-assets-v6';

const STATIC_ASSETS = [
    '/manifest.json',
    '/catalogo/manifest.json',
    '/assets/css/pwa-styles.css',
    '/catalogo/assets/css/pwa-styles.css',
    '/assets/js/tailwind.js',
    '/catalogo/assets/js/tailwind.js',
    'https://urbannoise.cc/assets/img/logo/LOGO_WEB.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {});
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE).map((key) => caches.delete(key))
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Navegación HTML -> Network-First (Garantiza ver cambios al instante)
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const resClone = networkResponse.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, resClone));
                }
                return networkResponse;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Estrategia Cache-First para Imágenes de Loyverse y Assets Visuales
    if (url.hostname.includes('loyverse.com') || event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    return cachedResponse || Response.error();
                }
            })
        );
        return;
    }

    // 3. Estrategia Stale-While-Revalidate para CSS, JS y Fuentes
    if (event.request.destination === 'style' || event.request.destination === 'font' || event.request.destination === 'script') {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request);
                const networkFetch = fetch(event.request).then((res) => {
                    if (res && res.status === 200) cache.put(event.request, res.clone());
                    return res;
                }).catch(() => null);
                return cached || networkFetch;
            })
        );
        return;
    }
});
