/**
 * Minimal service worker — caches app shell, fonts, immutable assets, and viewed content.
 * No Workbox. No precache manifest. Hashed immutable assets are cached on first visit.
 */

const CACHE_NAME = "tka-v3";
const ASSETS_3D_CACHE = "tka-3d-assets-v1";
const APP_SHELL_URLS = ["/app"];
// Build-generated list of pictograph SVGs (props/grid/arrows/letters/numbers/
// glyphs) so pictographs render cold-offline. See scripts/generate-svg-precache-manifest.cjs.
const SVG_PRECACHE_MANIFEST = "/svg-precache-manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL_URLS);
      await precacheSvgAssets(cache);
    })
  );
  self.skipWaiting();
});

// Precache the finite essential pictograph SVG set. Resilient: a missing
// manifest (older deploy) or a stray 404 must NEVER fail install — the runtime
// /images cache-first rule below still covers everything on first online view.
async function precacheSvgAssets(cache) {
  try {
    const res = await fetch(SVG_PRECACHE_MANIFEST, { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    const assets = Array.isArray(data.assets) ? data.assets : [];
    await Promise.allSettled(
      assets.map(async (url) => {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r.clone());
      })
    );
  } catch {
    // No manifest / network hiccup — non-fatal.
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== ASSETS_3D_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Dev mode: never intercept requests on localhost — Vite serves everything.
  // A stale production SW on localhost blocks page refreshes because
  // hooks.client.ts can only unregister AFTER the page loads (deadlock).
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests except Firebase Storage thumbnails
  if (url.origin !== self.location.origin) {
    if (url.hostname === "firebasestorage.googleapis.com") {
      event.respondWith(staleWhileRevalidate(event.request));
    }
    return;
  }

  // 3D model assets: cache-first in dedicated cache (GLB, KTX2, Draco WASM)
  // These are large binaries that rarely change — skip 304 round-trips entirely
  if (
    /\/models\/.*\.glb$/.test(url.pathname) ||
    /\/models\/.*\.ktx2$/.test(url.pathname) ||
    url.pathname.startsWith("/draco/")
  ) {
    event.respondWith(cacheFirstDedicated(event.request, ASSETS_3D_CACHE));
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

  // Pictograph render assets + bundled thumbnails: cache-first (durable offline).
  // /images/* = prop/grid/arrow/letter/number/glyph SVGs the live pictograph
  // renderer fetches on demand; /thumbnails/*.webp = static bundled thumbnails.
  // Without this they fell through to "network only" and pictographs rendered
  // blank offline (audit 2026-06-30 fix #1). The essential SVG subset is also
  // precached on install; this rule durably caches everything else on first view.
  if (
    url.pathname.startsWith("/images/") ||
    (url.pathname.startsWith("/thumbnails/") && url.pathname.endsWith(".webp"))
  ) {
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
        fetchWithTimeout(event.request, 10000).catch(() =>
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

async function cacheFirstDedicated(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
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

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    fetch(request, { signal: controller.signal })
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// Firebase Cloud Messaging handler (push notifications)
importScripts("/firebase-messaging-handler.js");
