/**
 * Minimal service worker — caches app shell, fonts, immutable assets, and viewed content.
 * No Workbox. No precache manifest. Hashed immutable assets are cached on first visit.
 */

const CACHE_NAME = "tka-v2";
const APP_SHELL_URLS = ["/app"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests except Firebase Storage thumbnails
  if (url.origin !== self.location.origin) {
    if (url.hostname === "firebasestorage.googleapis.com") {
      event.respondWith(staleWhileRevalidate(event.request));
    }
    return;
  }

  // Font files: cache-first (immutable, never change)
  if (url.pathname.startsWith("/fonts/") && /\.woff2?$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Font CSS: cache-first (changes only on FA version bump)
  if (url.pathname.startsWith("/fonts/css/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // SvelteKit immutable assets (JS/CSS chunks with content hashes): cache-first.
  // These filenames contain a hash — once built they never change, so caching is safe.
  // This is the critical fix for offline: without this, the app can't load when
  // the browser HTTP cache is evicted.
  if (url.pathname.startsWith("/_app/immutable/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Viewed sequences and QR pages: network-first (offline festival use)
  if (url.pathname.startsWith("/sequence/") || url.pathname.startsWith("/q/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // SPA navigation fallback: serve cached /app for any app navigation.
  // Public/prerendered routes (guide, landing) try network first, but all
  // in-app routes (/create, /browse, /train, etc.) get the cached shell
  // so the client-side router can handle them offline.
  if (event.request.mode === "navigate") {
    // Static public routes that have their own prerendered HTML — skip SPA fallback
    const isPublicRoute =
      url.pathname === "/" ||
      url.pathname.startsWith("/guide/") ||
      url.pathname.startsWith("/landing/") ||
      url.pathname.startsWith("/auth/");

    if (!isPublicRoute) {
      event.respondWith(
        fetch(event.request).catch(() =>
          caches.match("/app").then((cached) => cached || new Response("Offline", { status: 503 }))
        )
      );
      return;
    }
  }

  // Everything else: network only (non-immutable assets use standard HTTP cache)
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if ((response.ok || response.type === "opaque") && !response.bodyUsed) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// Firebase Cloud Messaging handler (push notifications)
importScripts("/firebase-messaging-handler.js");
