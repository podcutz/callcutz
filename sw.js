const CACHE_NAME = 'callcutz-v33';

const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './styles.css',
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
    
    // W3C compliant Promise chain ensures the OS does not kill the thread prematurely
    const promiseChain = Promise.resolve().then(async () => {
        const data = event.data.json();
        
        // Server-Side Liveness Ping (Do not show UI)
        if (data.tag === 'liveness-check') return;

        const title = data.title || 'Callcutz';
        const bodyText = data.body || 'You have a new update.';
        
        // Guarantee unique tags so notifications stack in the OS instead of overwriting
        const baseTag = data.tag || 'callcutz-notification';
        const uniqueTag = `${baseTag}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const options = {
                body: bodyText,
                icon: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780240888/Untitled_2_rzvlap.png',
                badge: 'https://res.cloudinary.com/dobnqmfsg/image/upload/v1780062631/Untitled_design__3_-removebg-preview_qnvznn.png',
                tag: uniqueTag,
                renotify: true,
                requireInteraction: true, // Forces Android to wake screen and wait for user action
                vibrate: [500, 250, 500, 250, 500, 250, 500], // Extended aggressive vibration mimics a ring/call
                silent: false, 
                data: { url: self.registration.scope }
            };
            
            return self.registration.showNotification(title, options);
    });

    event.waitUntil(promiseChain);
});

// BATTLE-READY ARCHITECTURE: Store User ID and Anon Key durably so SW can heal itself
let backgroundUserId = null;
let backgroundAnonKey = null;

// IndexedDB persistence fallback (survives cache clears)
function saveToIDB(key, value) {
    return new Promise((resolve) => {
        const req = indexedDB.open('CallcutzSWDB', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('sw_store');
        req.onsuccess = e => {
            const db = e.target.result;
            const tx = db.transaction('sw_store', 'readwrite');
            tx.objectStore('sw_store').put(value, key);
            tx.oncomplete = () => resolve(true);
        };
        req.onerror = () => resolve(false);
    });
}

function getFromIDB(key) {
    return new Promise((resolve) => {
        const req = indexedDB.open('CallcutzSWDB', 1);
        req.onsuccess = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('sw_store')) return resolve(null);
            const tx = db.transaction('sw_store', 'readonly');
            const getReq = tx.objectStore('sw_store').get(key);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
    });
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_USER_ID') {
        backgroundUserId = event.data.userId;
        backgroundAnonKey = event.data.anonKey;
        // Dual-write to Cache and IDB
        caches.open('callcutz-sw-cache').then(cache => {
            cache.put('/background-user-id', new Response(event.data.userId));
            if (event.data.anonKey) cache.put('/background-anon-key', new Response(event.data.anonKey));
        });
        saveToIDB('userId', event.data.userId);
        if (event.data.anonKey) saveToIDB('anonKey', event.data.anonKey);
    } else if (event.data && event.data.type === 'LOCAL_NOTIFICATION') {
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

// Handle notification click: open/focus the PWA
    self.addEventListener('notificationclick', (event) => {
        event.notification.close();

        // Determine the target URL based on the notification tag
        // Use self.registration.scope instead of location.origin to avoid 404s on GitHub Pages/subfolders
        let targetUrl = self.registration.scope;
        const tag = event.notification.tag || '';
        
        // If it's a meeting request or lead request, deep link to the requests tab
        if (tag.includes('meeting-request') || tag.includes('lead-request')) {
            targetUrl = targetUrl.replace(/\/$/, '') + '/?tab=requests';
        }

        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                for (const client of windowClients) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
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

// SUPER ENFORCE: OS-Level Push Subscription Expiration/Rotation Handler
self.addEventListener('pushsubscriptionchange', (event) => {
    const vapidPublicKey = 'BCIIpPz64bIzSpEGCgPH8It5eMTqvtUA2-JKjQJficFYoMpgEdbMJLaSOvjy9gu74Kf-FIArTZYtTw7eRqIFJQU';
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    event.waitUntil(async function() {
        try {
            // 1. Negotiate new token with Apple/Google natively
            const newSubscription = await self.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // 2. Retrieve the User ID and Anon Key from memory, cache, or IDB
            let uid = backgroundUserId;
            let aKey = backgroundAnonKey;
            
            if (!uid || !aKey) {
                uid = await getFromIDB('userId');
                aKey = await getFromIDB('anonKey');
                
                if (!uid || !aKey) {
                    const cache = await caches.open('callcutz-sw-cache');
                    const resId = await cache.match('/background-user-id');
                    if (resId) uid = await resId.text();
                    const resKey = await cache.match('/background-anon-key');
                    if (resKey) aKey = await resKey.text();
                }
            }

            // 3. DIRECTLY UPDATE SUPABASE FROM THE BACKGROUND (With Timeout/Retry)
            if (uid && aKey && newSubscription) {
                const subJson = newSubscription.toJSON();
                const postPromise = fetch('https://ikeyqwtrqaqogecvxmiq.supabase.co/rest/v1/push_subscriptions?on_conflict=user_id,endpoint', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': aKey,
                        'Authorization': `Bearer ${aKey}`,
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({
                        user_id: uid,
                        endpoint: subJson.endpoint,
                        p256dh: subJson.keys.p256dh,
                        auth: subJson.keys.auth
                    })
                });
                
                // Timeout-aware fetch to prevent SW kill
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
                
                try {
                    const response = await Promise.race([postPromise, timeoutPromise]);
                    if (!response.ok) {
                        // Explicitly capture key rotation / auth failures
                        if (response.status === 401 || response.status === 403) {
                            saveToIDB('debug_auth_error', `Auth failed at ${new Date().toISOString()}: ${response.status}`);
                        }
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (fetchErr) {
                    // Save failed payload for next app load
                    saveToIDB('pending_sub', JSON.stringify(subJson));
                    console.error('Self-heal POST failed, saving for retry:', fetchErr);
                }
            }

            // 4. Also broadcast to UI if it happens to be open
            const windowClients = await clients.matchAll({ type: 'window' });
            windowClients.forEach(client => {
                client.postMessage({ type: 'PUSH_SUBSCRIPTION_UPDATE', subscription: newSubscription });
            });
        } catch (err) {
            console.error('Failed to self-heal push subscription:', err);
        }
    }());
});

// Helper for VAPID conversion in Service Worker
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

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
