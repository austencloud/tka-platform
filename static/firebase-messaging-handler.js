/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging handler for the service worker.
 * Imported into the Workbox-generated SW via importScripts.
 *
 * Handles:
 * - Background push notifications (app closed/unfocused)
 * - App badge updates
 * - Notification click routing
 */

// Firebase compat SDK (required for service worker context)
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
});

const messaging = firebase.messaging();

// Background message handler (fires when app is NOT in foreground)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || "TKA Composer";
  const body = notification.body || data.body || "";

  self.registration.showNotification(title, {
    body,
    icon: "/pwa/icons/icon-192x192.png",
    badge: "/pwa/icons/icon-96x96.png",
    tag: data.tag || "tka-notification",
    // Same-tag notifications REPLACE each other; without renotify the
    // replacement is silent (no sound/vibration/heads-up) — a second QR-scan
    // alert would slip in unnoticed. renotify makes every arrival alert.
    renotify: true,
    data: {
      url: data.url || "/app",
      conversationId: data.conversationId || null,
      notificationId: data.notificationId || null,
      type: data.type || "generic",
    },
    vibrate: [100, 200, 100],
  });

  // Update app badge with unread count
  const unreadCount = parseInt(data.unreadCount, 10);
  if (!isNaN(unreadCount) && unreadCount > 0 && self.navigator?.setAppBadge) {
    self.navigator.setAppBadge(unreadCount);
  }
});

// Notification click handler - focus existing window or open new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing window
      for (const client of windowClients) {
        if (new URL(client.url).pathname.startsWith("/app") && "focus" in client) {
          if (url !== "/app" && client.url !== new URL(url, self.location.origin).href) {
            client.navigate(url);
          }
          return client.focus();
        }
      }
      // No existing window - open new one
      return self.clients.openWindow(url);
    })
  );
});
