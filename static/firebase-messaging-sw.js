/**
 * Minimal service worker for Firebase Cloud Messaging in dev mode.
 * In production, the Workbox-generated SW imports firebase-messaging-handler.js instead.
 * This file exists solely so FCM token registration works on localhost (dev + ADB).
 *
 * It's a thin wrapper: just import the shared handler.
 */

// Import the shared FCM handler (same one used by the production Workbox SW)
importScripts("/firebase-messaging-handler.js");
