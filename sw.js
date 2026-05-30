const CACHE_NAME = 'callcutz-v6';

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

// PUSH NOTIFICATIONS: Handle incoming server push events
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const title = data.title || 'Callcutz';
        const options = {
            body: data.body || '',
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780061690/Untitled_design__2_-removebg-preview_p8g0sc.png',
            tag: data.tag || 'callcutz-notification',
            renotify: true,
            vibrate: [200, 100, 200],
            silent: false,
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
            silent: false
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

    // For everything else (images, CDNs): Use 'Stale-While-Revalidate' for instant loading,
    // while updating the cache in the background for next time.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkFetch = fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return response;
            }).catch(() => {
                // Ignore network failures for assets since we have cache fallback
            });

            // Return cached response instantly if available, otherwise wait for network
            return cachedResponse || networkFetch;
        })
    );
});
