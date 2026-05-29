const CACHE_NAME = 'callcutz-v2';
const APP_SHELL = [
    './',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL).catch(err => console.warn('Partial cache bypass:', err));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) return caches.delete(name);
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Prevent caching Supabase POST requests or API interactions
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('supabase.co')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
