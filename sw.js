const CACHE_NAME = 'callcutz-v12';

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
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780233538/Untitled_design_4_hwn0q7.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780237175/Untitled_jx2z0u.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062578/Untitled_design_3_oghhka.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1771827572/Untitled_design-removebg-preview_bj0uah.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1772612374/Untitled_design__1_-removebg-preview_ux1end.png'
];

// Install: pre-cache the app shell and all critical resources
// FIX: Use fetch() + cache.put() instead of cache.add() so opaque CDN responses
// (like Tailwind, Lucide) are force-stored even when they redirect or lack CORS headers.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const results = await Promise.allSettled(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        const response = await fetch(url, { mode: 'no-cors' });
                        // Store both real (status 200) and opaque (status 0) responses.
                        // Opaque responses are from cross-origin CDNs — they work fine offline
                        // when served from cache even though their status appears as 0.
                        if (response && (response.status === 200 || response.type === 'opaque')) {
                            await cache.put(url, response);
                        }
                    } catch (e) {
                        // Silently ignore — network may be unavailable during install
                    }
                })
            );
            return results;
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

// PUSH NOTIFICATIONS: Handle incoming server push events
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const title = data.title || 'Callcutz';
        const options = {
            body: data.body || '',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
            tag: data.tag || 'callcutz-notification',
            renotify: true,
            vibrate: [200, 100, 200],
            silent: false,
            sound: 'default',
            data: { url: self.location.origin }
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } catch(e) {
        console.log('Push parse error:', e);
    }
});

// Handle notification click: open/focus the PWA
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(self.location.origin);
            }
        })
    );
});

// Handle LOCAL_NOTIFICATION messages from the page (e.g. password change)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LOCAL_NOTIFICATION') {
        const title = event.data.title || 'Callcutz';
        const options = {
            body: event.data.body || '',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
            tag: 'password-change',
            renotify: true,
            vibrate: [200, 100, 200],
            silent: false,
            sound: 'default'
        };
        self.registration.showNotification(title, options);
    }
});

// Fetch: smart caching strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept Supabase API calls — these must always go to the network
    if (url.hostname.includes('supabase.co') || url.hostname.includes('google.com')) {
        return;
    }

    // CRITICAL FIX: For HTML requests (the app shell), force network check bypassing HTTP cache.
    // This ensures users always get your newest deployed code without clearing browser cache.
    if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    // Network failed (Offline) — serve from cache
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // For everything else (scripts, styles, images, CDNs):
    // FIX: Stale-While-Revalidate with guaranteed fallback.
    // The key fix: always return cachedResponse immediately if available,
    // and explicitly return the network promise only when there is NO cache.
    // Previously, the networkFetch promise could resolve to undefined on failure
    // causing the browser to receive nothing even when a cached version existed.
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            // Always kick off a background network refresh to keep cache fresh
            const networkFetch = fetch(event.request, { mode: 'no-cors' })
                .then((response) => {
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => null); // FIX: Return null instead of undefined/reject on network failure

            // If we have a cached version, return it INSTANTLY and revalidate in background
            if (cachedResponse) {
                return cachedResponse;
            }

            // No cache — must wait for network (first load or cache miss)
            const networkResponse = await networkFetch;
            return networkResponse || new Response('', { status: 408, statusText: 'Network unavailable' });
        })
    );
});
