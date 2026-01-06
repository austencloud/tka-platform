/**
 * Firebase Configuration and Initialization
 *
 * Sets up Firebase app and exports auth instance for use throughout the application.
 * Uses environment variables for configuration.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
} from "firebase/auth";
// Firestore, Database, and Analytics are now lazy-loaded - imports moved to async functions
import type { Firestore } from "firebase/firestore";
import type { Analytics } from "firebase/analytics";
import type { Database } from "firebase/database";
import type { FirebaseStorage } from "firebase/storage";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("Firebase");

// Firebase Storage is lazily loaded - only imported where actually needed
// See: src/routes/api/instagram/upload-media/+server.ts

/**
 * Firebase configuration object
 * Uses hardcoded values for reliable deployment across environments
 */
const firebaseConfig = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  databaseURL: "https://the-kinetic-alphabet-default-rtdb.firebaseio.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
  measurementId: "G-CQH94GGM6B",
};

/**
 * Initialize Firebase App
 * Prevents multiple initializations in development with HMR
 */
let app: FirebaseApp;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!; // Safe because we check length above
}

/**
 * Firebase Auth instance
 * Use this throughout the app for authentication operations
 */
export const auth: Auth = getAuth(app);

/**
 * Get Firestore instance (lazy loaded)
 * Use this for all database operations (gamification, user data, etc.)
 * Configured with persistent local cache for offline support with multi-tab sync
 * Multi-tab mode avoids IndexedDB ownership errors when multiple tabs are open
 * OPTIMIZATION: Lazy-loaded to reduce initial bundle size (~200-300KB saved)
 */
let firestoreInstance: Firestore | null = null;
// Initialization promise to prevent race conditions
let firestoreInitPromise: Promise<Firestore> | null = null;
// Track if we're using fallback memory cache (for debugging)
let usingMemoryCache = false;
// Track if Firestore was terminated (for HMR recovery)
let _firestoreTerminated = false;

/**
 * Check if an error is the known IndexedDB/persistence corruption error
 */
function isFirestoreCorruptionError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message || "";
    return (
      message.includes("INTERNAL ASSERTION FAILED") ||
      message.includes("Unexpected state") ||
      message.includes("IndexedDB") ||
      message.includes("persistence") ||
      message.includes("asyncQueue") ||
      message.includes("Cannot read properties of undefined")
    );
  }
  return false;
}

/**
 * Clear corrupted Firestore IndexedDB databases
 * Called when persistent cache initialization fails
 */
async function clearFirestoreIndexedDB(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  try {
    // Get all databases
    const databases = await indexedDB.databases();
    const firestoreDbs = databases.filter(
      (db) => db.name?.includes("firestore") || db.name?.includes("firebase")
    );

    // Delete Firestore-related databases
    for (const db of firestoreDbs) {
      if (db.name) {
        debug.warn(`Deleting corrupted IndexedDB: ${db.name}`);
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            debug.warn(`IndexedDB deletion blocked: ${db.name}`);
            resolve(); // Continue anyway
          };
        });
      }
    }

    debug.success("Cleared corrupted Firestore IndexedDB databases");
  } catch (error) {
    debug.error("Failed to clear IndexedDB:", error);
  }
}

/**
 * Terminate Firestore instance (for HMR cleanup)
 * This must be called before re-initializing to avoid corruption
 */
async function terminateFirestore(): Promise<void> {
  if (!firestoreInstance) return;

  try {
    const { terminate } = await import("firebase/firestore");
    await terminate(firestoreInstance);
    debug.info("Firestore terminated for cleanup");
  } catch (error) {
    debug.warn("Failed to terminate Firestore:", error);
  } finally {
    firestoreInstance = null;
    firestoreInitPromise = null;
    _firestoreTerminated = true;
  }
}

export async function getFirestoreInstance(): Promise<Firestore> {
  // If already initialized, return immediately
  if (firestoreInstance) {
    return firestoreInstance;
  }

  // If initialization is in progress, wait for it
  if (firestoreInitPromise) {
    return firestoreInitPromise;
  }

  // Start initialization - MUST only happen once
  firestoreInitPromise = (async () => {
    const { getFirestore, initializeFirestore, memoryLocalCache } =
      await import("firebase/firestore");

    // DEVELOPMENT: Always use memory cache to avoid HMR/IndexedDB corruption issues
    // The persistent cache with multi-tab manager causes "asyncQueue undefined" errors
    // when Vite hot-reloads modules, corrupting the Firestore internal state
    if (import.meta.env.DEV) {
      try {
        // Try to get existing instance first
        const existingInstance = getFirestore(app);

        // CRITICAL: Validate the instance is actually usable
        // After HMR terminate(), getFirestore() returns a corrupt instance
        // that still exists but has undefined internal properties
        if (existingInstance && typeof existingInstance === "object") {
          // Check if the instance has the expected internal structure
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingObj = existingInstance as any;
          const hasAsyncQueue =
            existingObj._firestoreClient !== undefined ||
            existingObj._queue !== undefined;

          if (!hasAsyncQueue) {
            debug.warn(
              "Firestore instance exists but appears corrupted, will reinitialize"
            );
            throw new Error("Corrupted instance detected");
          }
        }

        firestoreInstance = existingInstance;
        debug.success("Firestore instance retrieved (dev mode)");
        return firestoreInstance;
      } catch {
        // Not initialized yet OR instance is corrupted - create with memory cache
        try {
          firestoreInstance = initializeFirestore(app, {
            localCache: memoryLocalCache(),
          });
          usingMemoryCache = true;
          debug.success("Firestore initialized with memory cache (dev mode)");
          return firestoreInstance;
        } catch (initError) {
          // initializeFirestore throws if already initialized - fall back to getFirestore
          debug.warn(
            "initializeFirestore failed, using existing instance:",
            initError
          );
          firestoreInstance = getFirestore(app);
          return firestoreInstance;
        }
      }
    }

    // PRODUCTION: Use persistent cache for offline support
    try {
      // Try to get existing instance first
      firestoreInstance = getFirestore(app);
      debug.success("Firestore instance retrieved");
      return firestoreInstance;
    } catch {
      // Not initialized yet
    }

    // Initialize with persistent cache for production
    try {
      const { persistentLocalCache, persistentMultipleTabManager } =
        await import("firebase/firestore");

      firestoreInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      debug.success("Firestore initialized with persistent cache");
      return firestoreInstance;
    } catch (persistentError) {
      // Check if this is the known corruption error
      if (isFirestoreCorruptionError(persistentError)) {
        debug.warn("Persistent cache failed, falling back to memory cache");
        await clearFirestoreIndexedDB();

        try {
          firestoreInstance = initializeFirestore(app, {
            localCache: memoryLocalCache(),
          });
          usingMemoryCache = true;
          debug.success("Firestore initialized with memory cache (fallback)");
          return firestoreInstance;
        } catch {
          // Last resort
          debug.error("Memory cache also failed, trying bare Firestore");
          firestoreInstance = getFirestore(app);
          usingMemoryCache = true;
          return firestoreInstance;
        }
      }

      firestoreInitPromise = null;
      throw persistentError;
    }
  })();

  return firestoreInitPromise;
}

/** Check if Firestore is running in degraded (memory-only) mode */
export function isFirestoreUsingMemoryCache(): boolean {
  return usingMemoryCache;
}

/**
 * Get Firebase Realtime Database instance (lazy loaded)
 * Used for real-time presence tracking (online/offline status, current location)
 * Provides sub-second updates and automatic disconnect detection via onDisconnect()
 * OPTIMIZATION: Lazy-loaded to reduce initial bundle size
 */
let databaseInstance: Database | null = null;
// Forward declare _cachedDatabase for the Proxy
let _cachedDatabase: Database | null = null;
// Initialization promise to prevent race conditions
let databaseInitPromise: Promise<Database> | null = null;

export async function getDatabaseInstance(): Promise<Database> {
  // If already initialized, return immediately
  if (databaseInstance) {
    return databaseInstance;
  }

  // If initialization is in progress, wait for it
  if (databaseInitPromise) {
    return databaseInitPromise;
  }

  // Start initialization
  databaseInitPromise = (async () => {
    const { getDatabase } = await import("firebase/database");
    databaseInstance = getDatabase(app);

    // CRITICAL: Update the Proxy's cached instance so services can use it
    _cachedDatabase = databaseInstance;

    debug.success("Realtime Database lazy-loaded");
    return databaseInstance;
  })();

  return databaseInitPromise;
}

/**
 * Get Firebase Storage instance (lazy loaded)
 * Use this for file uploads (profile photos, sequence thumbnails, etc.)
 * Storage is loaded on-demand to reduce initial bundle size (~84KB saved)
 */
export async function getStorageInstance(): Promise<FirebaseStorage> {
  const { getStorage } = await import("firebase/storage");
  return getStorage(app);
}

/**
 * Get Firebase Analytics instance (lazy loaded)
 * Provides: user demographics, device info, geography, sessions, page views,
 * screen time, crash reporting, funnel analysis, retention reports,
 * A/B testing integration, Google Ads integration, and real-time monitoring.
 *
 * View dashboards at: https://console.firebase.google.com/project/the-kinetic-alphabet/analytics
 * OPTIMIZATION: Lazy-loaded to reduce initial bundle size
 */
let analyticsInstance: Analytics | null = null;
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (analyticsInstance) {
    return analyticsInstance;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const { getAnalytics, isSupported } = await import("firebase/analytics");

  const supported = await isSupported();
  if (!supported) {
    debug.warn("Firebase Analytics not supported on this device");
    return null;
  }

  analyticsInstance = getAnalytics(app);
  debug.success("Firebase Analytics lazy-loaded");
  return analyticsInstance;
}

/**
 * Configure Firebase Auth persistence
 * Try IndexedDB first (most reliable), fallback to localStorage
 * This provides the best resilience against storage clearing during redirects
 *
 * CRITICAL: This must complete BEFORE auth listener is initialized
 * to prevent race conditions after cache clearing
 */
let authPersistenceReady: Promise<void> | null = null;

if (typeof window !== "undefined") {
  authPersistenceReady = setPersistence(auth, indexedDBLocalPersistence)
    .catch(() => {
      debug.warn("IndexedDB persistence failed, falling back to localStorage");
      return setPersistence(auth, browserLocalPersistence);
    })
    .then(() => {
      debug.success("Auth persistence configured");
    })
    .catch((error) => {
      debug.error("Failed to set persistence:", error);
      // Even if persistence fails, we can still proceed
      // Auth will work, just without session persistence
    });
}

/**
 * Wait for auth persistence to be configured
 * Call this before initializing auth listeners to prevent race conditions
 */
export async function ensureAuthPersistence(): Promise<void> {
  if (authPersistenceReady) {
    await authPersistenceReady;
  }
}

/**
 * Export the app instance if needed for other Firebase services
 */
export { app };

// Initialize firestore asynchronously (browser only)
if (typeof window !== "undefined") {
  getFirestoreInstance().catch((error) => {
    console.error("❌ Failed to initialize Firestore:", error);
  });
}

/**
 * DEPRECATED: Backward-compatible database export
 * For top-level await support in legacy code.
 * New code should use getDatabaseInstance() instead.
 *
 * This is a Proxy that lazy-loads Realtime Database on first property access.
 * Works seamlessly with existing code like `ref(database, 'path')`.
 */
export const database = new Proxy({} as Database, {
  get(_target, prop) {
    // Lazy-load database on first access
    if (!_cachedDatabase) {
      throw new Error(
        "❌ Realtime Database accessed before initialization. " +
          "Import and call getDatabaseInstance() instead, or ensure your component/service " +
          "is only used in browser context after Firebase initialization."
      );
    }
    return Reflect.get(_cachedDatabase, prop);
  },
});

// Initialize database cache asynchronously (browser only)
if (typeof window !== "undefined") {
  getDatabaseInstance().then((instance) => {
    _cachedDatabase = instance;
  });
}

/**
 * DEPRECATED: Backward-compatible analytics export
 * For top-level await support in legacy code.
 * New code should use getAnalyticsInstance() instead.
 *
 * Note: This will be null if analytics is not supported on the device.
 * Always check for null before using, or wrap in try-catch.
 */
export let analytics: Analytics | null = null;

// Initialize analytics asynchronously (browser only)
if (typeof window !== "undefined") {
  getAnalyticsInstance()
    .then((instance) => {
      analytics = instance;
    })
    .catch(() => {
      // Silently handle analytics initialization failure
      console.debug("[Firebase] Analytics not available");
    });
}

/**
 * HMR Cleanup - Force page reload when firebase.ts changes
 *
 * The Firebase SDK caches Firestore instances internally. After calling terminate(),
 * getFirestore(app) still returns the terminated (corrupt) instance, causing
 * "asyncQueue undefined" and "INTERNAL ASSERTION FAILED" errors.
 *
 * The only reliable fix is to force a full page reload when this module changes.
 * This ensures a clean Firebase initialization from scratch.
 */
if (import.meta.hot) {
  // Accept the module update but force a page reload
  // This is necessary because Firebase SDK's internal Firestore cache persists
  // across HMR and returns terminated instances
  import.meta.hot.accept(() => {
    debug.warn(
      "HMR: firebase.ts changed - forcing page reload for clean state"
    );
    window.location.reload();
  });

  // Also handle dispose for cleanup (may not reach if reload happens first)
  import.meta.hot.dispose(async () => {
    debug.info("HMR: Cleaning up Firebase instances...");
    await terminateFirestore();
  });
}
