// Modern Service Worker for TKA Launcher PWA
// Implements advanced caching strategies, offline support, and real-time sync

const CACHE_VERSION = "v0.7.6";
const STATIC_CACHE = `tka-launcher-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `tka-launcher-dynamic-${CACHE_VERSION}`;
const API_CACHE = `tka-launcher-api-${CACHE_VERSION}`;

// Cache strategies configuration
const CACHE_STRATEGIES = {
  // Static assets - Cache First (long-term cache)
  static: [
    "/app",
    "/app.css",
    "/pwa/manifest.webmanifest",
    "/pwa/",
    "/_app/immutable/",
  ],

  // API calls - Network First with fallback
  api: ["/api/", "/health", "/metrics", "/logs"],

  // Dynamic content - Stale While Revalidate
  dynamic: ["/compare", "/performance", "/settings"],
};

// Offline fallbacks
const OFFLINE_FALLBACKS = {
  page: "/offline.html",
  image: "/images/offline-icon.svg",
  api: {
    error: "offline",
    message: "This feature requires an internet connection",
  },
};

// Background sync tags
const SYNC_TAGS = {
  VERSION_ACTION: "version-action-sync",
  SETTINGS_SYNC: "settings-sync",
  PERFORMANCE_SYNC: "performance-sync",
};

// Install event - Pre-cache critical resources
self.addEventListener("install", (event) => {
  console.log("🚀 TKA Launcher SW: Installing...");

  event.waitUntil(
    (async () => {
      try {
        // Pre-cache static assets
        const staticCache = await caches.open(STATIC_CACHE);
        const staticUrls = [
          "/app",
          "/app.css",
          "/pwa/manifest.webmanifest",
          "/offline.html",
          "/images/offline-icon.svg",
        ];

        await staticCache.addAll(staticUrls);
        console.log("✅ Static assets cached");

        // Skip waiting to activate immediately
        await self.skipWaiting();
      } catch (error) {
        console.error("❌ Install failed:", error);
      }
    })()
  );
});

// Activate event - Clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🔄 TKA Launcher SW: Activating...");

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(
          (name) =>
            name.includes("tka-launcher") && !name.includes(CACHE_VERSION)
        );

        await Promise.all(oldCaches.map((name) => caches.delete(name)));

        if (oldCaches.length > 0) {
          console.log(`🗑️ Cleaned up ${oldCaches.length} old caches`);
        }

        // Take control of all clients
        await self.clients.claim();

        // Notify clients of successful activation
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: "SW_ACTIVATED",
            version: CACHE_VERSION,
          });
        });

        console.log("✅ Service Worker activated");
      } catch (error) {
        console.error("❌ Activation failed:", error);
      }
    })()
  );
});

// Fetch event - Implement sophisticated caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Static assets - Cache First
    if (matchesPattern(pathname, CACHE_STRATEGIES.static)) {
      return await cacheFirst(request, STATIC_CACHE);
    }

    // API calls - Network First with offline support
    if (matchesPattern(pathname, CACHE_STRATEGIES.api)) {
      return await networkFirst(request, API_CACHE);
    }

    // Dynamic pages - Stale While Revalidate
    if (matchesPattern(pathname, CACHE_STRATEGIES.dynamic)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }

    // Default: Network with cache fallback
    return await networkWithCacheFallback(request);
  } catch (error) {
    console.error("Fetch failed:", error);
    return await getOfflineFallback(request);
  }
}

// Cache First strategy - For static assets
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return await getOfflineFallback(request);
  }
}

// Network First strategy - For API calls
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return await getOfflineFallback(request);
  }
}

// Stale While Revalidate - For dynamic content
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Start network request (don't await)
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }

  // If no cache, wait for network
  return (await networkPromise) || (await getOfflineFallback(request));
}

// Network with cache fallback
async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    return cached || (await getOfflineFallback(request));
  }
}

// Get appropriate offline fallback
async function getOfflineFallback(request) {
  const url = new URL(request.url);

  if (request.destination === "document") {
    return caches.match(OFFLINE_FALLBACKS.page);
  }

  if (request.destination === "image") {
    return caches.match(OFFLINE_FALLBACKS.image);
  }

  if (matchesPattern(url.pathname, CACHE_STRATEGIES.api)) {
    return new Response(JSON.stringify(OFFLINE_FALLBACKS.api), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }

  return new Response("Offline", { status: 503 });
}

// Background Sync - Handle offline actions
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync:", event.tag);

  switch (event.tag) {
    case SYNC_TAGS.VERSION_ACTION:
      event.waitUntil(syncVersionActions());
      break;
    case SYNC_TAGS.SETTINGS_SYNC:
      event.waitUntil(syncSettings());
      break;
    case SYNC_TAGS.PERFORMANCE_SYNC:
      event.waitUntil(syncPerformanceData());
      break;
  }
});

async function syncVersionActions() {
  try {
    const pendingActions = (await getStoredData("pending-actions")) || [];

    for (const action of pendingActions) {
      try {
        const response = await fetch("/api/versions/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });

        if (response.ok) {
          // Remove successful action
          const remaining = pendingActions.filter((a) => a.id !== action.id);
          await storeData("pending-actions", remaining);

          // Notify client
          notifyClients({
            type: "ACTION_SYNCED",
            action: action,
          });
        }
      } catch (error) {
        console.error("Failed to sync action:", error);
      }
    }
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

async function syncSettings() {
  try {
    const pendingSettings = await getStoredData("pending-settings");
    if (!pendingSettings) return;

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingSettings),
    });

    if (response.ok) {
      await removeStoredData("pending-settings");
      notifyClients({
        type: "SETTINGS_SYNCED",
        settings: pendingSettings,
      });
    }
  } catch (error) {
    console.error("Settings sync failed:", error);
  }
}

async function syncPerformanceData() {
  try {
    const pendingMetrics = (await getStoredData("pending-metrics")) || [];

    if (pendingMetrics.length === 0) return;

    const response = await fetch("/api/metrics/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingMetrics),
    });

    if (response.ok) {
      await removeStoredData("pending-metrics");
      notifyClients({
        type: "METRICS_SYNCED",
        count: pendingMetrics.length,
      });
    }
  } catch (error) {
    console.error("Metrics sync failed:", error);
  }
}

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("📱 Push received:", event.data?.text());

  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "TKA Launcher notification",
      icon: "/pwa/icon-192x192.png",
      badge: "/pwa/badge-72x72.png",
      tag: data.tag || "tka-launcher",
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [
        {
          action: "open",
          title: "Open Launcher",
          icon: "/pwa/action-open.png",
        },
        {
          action: "dismiss",
          title: "Dismiss",
          icon: "/pwa/action-dismiss.png",
        },
      ],
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "TKA Launcher", options)
    );
  } catch (error) {
    console.error("Push notification failed:", error);
  }
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.action);

  event.notification.close();

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });

      // Handle different actions
      switch (event.action) {
        case "open":
          if (clients.length > 0) {
            // Focus existing client
            await clients[0].focus();
          } else {
            // Open new window
            await self.clients.openWindow("/app");
          }
          break;

        case "dismiss":
          // Just close notification (already done above)
          break;

        default:
          // Default action - open or focus app
          if (clients.length > 0) {
            await clients[0].focus();
          } else {
            await self.clients.openWindow("/app");
          }
      }
    })()
  );
});

// Message handling from clients
self.addEventListener("message", (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;

    case "STORE_OFFLINE_ACTION":
      storeOfflineAction(data);
      break;

    case "GET_CACHE_STATUS":
      getCacheStatus().then((status) => {
        event.ports[0].postMessage(status);
      });
      break;

    case "CLEAR_CACHE":
      clearSpecificCache(data.cacheName).then((success) => {
        event.ports[0].postMessage({ success });
      });
      break;
  }
});

// Utility functions
function matchesPattern(pathname, patterns) {
  return patterns.some(
    (pattern) => pathname.startsWith(pattern) || pathname.includes(pattern)
  );
}

async function storeOfflineAction(action) {
  try {
    const existing = (await getStoredData("pending-actions")) || [];
    const updated = [
      ...existing,
      { ...action, id: Date.now(), timestamp: new Date() },
    ];
    await storeData("pending-actions", updated);

    // Register background sync
    await self.registration.sync.register(SYNC_TAGS.VERSION_ACTION);
  } catch (error) {
    console.error("Failed to store offline action:", error);
  }
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const cacheInfos = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return { name, size: keys.length };
    })
  );

  return {
    version: CACHE_VERSION,
    caches: cacheInfos,
    totalEntries: cacheInfos.reduce((sum, info) => sum + info.size, 0),
  };
}

async function clearSpecificCache(cacheName) {
  try {
    const success = await caches.delete(cacheName);
    if (success) {
      notifyClients({
        type: "CACHE_CLEARED",
        cacheName,
      });
    }
    return success;
  } catch (error) {
    console.error("Failed to clear cache:", error);
    return false;
  }
}

function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// IndexedDB helpers for offline storage
async function storeData(key, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TKALauncherDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["offline-store"], "readwrite");
      const store = transaction.objectStore("offline-store");
      const putRequest = store.put(data, key);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("offline-store")) {
        db.createObjectStore("offline-store");
      }
    };
  });
}

async function getStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TKALauncherDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["offline-store"], "readonly");
      const store = transaction.objectStore("offline-store");
      const getRequest = store.get(key);

      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("offline-store")) {
        db.createObjectStore("offline-store");
      }
    };
  });
}

async function removeStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TKALauncherDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(["offline-store"], "readwrite");
      const store = transaction.objectStore("offline-store");
      const deleteRequest = store.delete(key);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

console.log("🎯 TKA Launcher Service Worker loaded");
