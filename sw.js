const CACHE_NAME = 'callcutz-v2';

// All external CDN scripts and resources the app needs to function
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/luxon@3.4.4/build/global/luxon.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062578/Untitled_design_3_oghhka.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1771827572/Untitled_design-removebg-preview_bj0uah.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1772612374/Untitled_design__1_-removebg-preview_ux1end.png'
];

// Install: pre-cache the app shell and all critical resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache one by one so a single failure doesn't break everything
            return Promise.allSettled(
                PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
            );
        }).then(() => self.skipWaiting())
    );
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => clients.claim())
    );
});

// Fetch: smart caching strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept Supabase API calls — these must always go to the network
    // (offline fallback is handled in the app via localStorage, not here)
    if (url.hostname.includes('supabase.co') || url.hostname.includes('google.com')) {
        return; // Let it fail naturally so the app's own offline logic kicks in
    }

    // For everything else: try network first, fall back to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If we got a valid response, update the cache with it
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed — serve from cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Last resort for navigation requests: return the app shell
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
