/**
 * Urban Noise PWA High-Speed Image & Asset Cache Service Worker
 * Stores Loyverse product photos locally on iPhone & Android for instant 0ms loading
 */

const CACHE_NAME = 'un-image-cache-v4';
const STATIC_CACHE = 'un-static-assets-v4';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/catalogo/',
    '/catalogo/index.html',
    '/manifest.json',
    '/catalogo/manifest.json',
    '/assets/css/pwa-styles.css',
    '/catalogo/assets/css/pwa-styles.css',
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

    // 1. Estrategia Cache-First para Imágenes de Loyverse y Assets Visuales
    if (url.hostname.includes('loyverse.com') || event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse; // Entrega en 0ms directo de la memoria del iPhone/Android
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

    // 2. Estrategia Stale-While-Revalidate para CSS y Fuentes
    if (event.request.destination === 'style' || event.request.destination === 'font') {
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
