const CACHE_NAME = 'callcutz-v21';

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
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780240888/Untitled_2_rzvlap.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1771827572/Untitled_design-removebg-preview_bj0uah.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
    'https://res.cloudinary.com/dobnqmfsg/image/upload/v1772612374/Untitled_design__1_-removebg-preview_ux1end.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            const results = await Promise.allSettled(
                PRECACHE_URLS.map(async (url) => {
                    try {
                        const response = await fetch(url, { mode: 'no-cors' });
                        if (response && (response.status === 200 || response.type === 'opaque')) {
                            await cache.put(url, response);
                        }
                    } catch (e) {}
                })
            );
            return results;
        }).then(() => self.skipWaiting())
    );
});

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

// PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        const title = data.title || 'Callcutz';
        
        // Guarantee unique tags so notifications stack in the OS instead of overwriting
        const baseTag = data.tag || 'callcutz-notification';
        const uniqueTag = `${baseTag}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const options = {
            body: data.body || '',
            icon: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780240888/Untitled_2_rzvlap.png',
            badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
            tag: uniqueTag,
            renotify: true,
            requireInteraction: true, // Forces aggressive Android OS (like MIUI) to display it
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

    // Determine the target URL based on the notification tag
    let targetUrl = self.location.origin;
    const tag = event.notification.tag || '';
    
    // If it's a meeting request or lead request, deep link to the requests tab
    if (tag.includes('meeting-request') || tag.includes('lead-request')) {
        targetUrl = self.location.origin + '/?tab=requests';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    // Navigate the existing client to the correct tab
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
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
            icon: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780240888/Untitled_2_rzvlap.png',
            badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062578/Untitled_design_3_oghhka.png',
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

    if (url.hostname.includes('supabase.co') || url.hostname.includes('google.com')) {
        return;
    }

    // Never intercept PWA icon fetches — Chrome needs to read real pixel dimensions
    const iconUrls = [
        'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062578/Untitled_design_3_oghhka.png',
        'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780237175/Untitled_jx2z0u.png',
        'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780240888/Untitled_2_rzvlap.png'
    ];
    if (iconUrls.some(iconUrl => event.request.url === iconUrl)) {
        return;
    }

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
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);

            const networkFetch = fetch(event.request, { mode: 'no-cors' })
                .then((response) => {
                    if (response && (response.status === 200 || response.type === 'opaque')) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => null);

            if (cachedResponse) {
                return cachedResponse;
            }

            const networkResponse = await networkFetch;
            return networkResponse || new Response('', { status: 408, statusText: 'Network unavailable' });
        })
    );
});
