// ICYEREKEZO OMS service worker — app-shell caching, offline API read cache,
// an offline write queue for mutations, and browser push notifications.

const CACHE_VERSION = 'icyerekezo-v1';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;
const SHELL_URLS = ['/dashboard'];

const DB_NAME = 'icyerekezo-outbox';
const STORE_NAME = 'requests';

function openOutboxDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function queueRequest(entry) {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function listQueuedRequests() {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function removeQueuedRequest(id) {
    const db = await openOutboxDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function broadcast(message) {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage(message));
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => null)
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navigations: network-first so the SPA shell (and its asset references) stay fresh,
    // falling back to the cached shell when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then((response) => {
                const copy = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put('/dashboard', copy));
                return response;
            }).catch(() => caches.match('/dashboard').then((cached) => cached || caches.match('/')))
        );
        return;
    }

    // Built JS/CSS/fonts/images: cache-first, since Vite fingerprints filenames by content.
    if (url.pathname.startsWith('/build/') || url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                const copy = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
                return response;
            }))
        );
        return;
    }

    if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET') {
            event.respondWith(
                fetch(request).then((response) => {
                    const copy = response.clone();
                    caches.open(API_CACHE).then((cache) => cache.put(request, copy));
                    return response;
                }).catch(() => caches.match(request).then((cached) => {
                    if (cached) return cached;
                    return new Response(JSON.stringify({ message: 'You are offline and this has not been loaded before.', offline: true }), {
                        status: 503, headers: { 'Content-Type': 'application/json' },
                    });
                }))
            );
            return;
        }

        // Mutations (POST/PUT/PATCH/DELETE): try the network; if it's unreachable,
        // queue the request in IndexedDB and let a later sync (or the next reconnect) replay it.
        event.respondWith(
            fetch(request.clone()).catch(async () => {
                const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.clone().text();
                const entry = {
                    url: request.url,
                    method: request.method,
                    headers: Array.from(request.headers.entries()),
                    body,
                    queuedAt: Date.now(),
                };
                await queueRequest(entry);
                if ('sync' in self.registration) {
                    try { await self.registration.sync.register('sync-outbox'); } catch (e) { /* unsupported */ }
                }
                await broadcast({ type: 'outbox-queued', url: request.url });

                return new Response(JSON.stringify({ message: 'Saved offline. This will sync automatically once you are back online.', queued: true }), {
                    status: 202, headers: { 'Content-Type': 'application/json' },
                });
            })
        );
    }
});

async function flushOutbox() {
    const entries = await listQueuedRequests();
    for (const entry of entries) {
        try {
            const response = await fetch(entry.url, {
                method: entry.method,
                headers: entry.headers,
                body: entry.body,
            });
            if (response.ok || response.status < 500) {
                await removeQueuedRequest(entry.id);
                await broadcast({ type: 'outbox-synced', url: entry.url, ok: response.ok });
            }
        } catch (error) {
            // Still offline — stop here and try again on the next sync/reconnect.
            break;
        }
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-outbox') {
        event.waitUntil(flushOutbox());
    }
});

self.addEventListener('message', (event) => {
    if (event.data === 'flush-outbox') {
        event.waitUntil(flushOutbox());
    }
});

self.addEventListener('push', (event) => {
    if (!event.data) return;
    let payload = {};
    try { payload = event.data.json(); } catch (e) { payload = { title: 'ICYEREKEZO OMS', body: event.data.text() }; }
    const title = payload.title || 'ICYEREKEZO OMS';
    event.waitUntil(self.registration.showNotification(title, {
        body: payload.body || '',
        icon: '/assets/images/pwa/icon-192.png',
        badge: '/assets/images/pwa/icon-192.png',
        data: { url: payload.url || '/dashboard' },
        tag: payload.category || 'general',
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/dashboard';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) {
                    client.postMessage({ type: 'navigate', url: targetUrl });
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
