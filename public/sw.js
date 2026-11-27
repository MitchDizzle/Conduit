/* Conduit's service worker. It exists so phones offer to add the game to the
   home screen (as Order Up's does), and does nothing else: it caches nothing
   and never answers a request itself, so it can never serve an old copy of
   the game. Its scope is the game's folder. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* the network, as always */ });
