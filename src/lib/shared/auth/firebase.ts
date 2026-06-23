/**
 * Firebase Configuration and Initialization
 *
 * Zero-Downtime HMR Support via App Instance Rotation
 *
 * The Firebase SDK caches instances internally. After calling terminate(),
 * getFirestore(app) still returns the terminated (corrupt) instance.
 * This module solves that by creating a new Firebase App on each HMR cycle.
 *
 * Key Features:
 * - App instance rotation (new app name each HMR cycle)
 * - Auth state preservation across HMR
 * - Automatic listener resubscription
 * - Presence handler re-establishment
 * - Lazy loading for Firestore, Database, Storage, Analytics
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  setPersistence,
} from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { Database } from "firebase/database";
import type { FirebaseStorage } from "firebase/storage";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { resolveAuthDomain } from "./auth-domain";
import { getFirebaseHMRManager, type FirebaseHMRManager } from "./firebase-hmr-manager";
import type { Functions } from 'firebase/functions';
import type { Unsubscribe } from 'firebase/firestore';

const debug = createComponentLogger("Firebase");

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

/**
 * Firebase configuration object
 * Uses hardcoded values for reliable deployment across environments.
 * authDomain is resolved per environment — see resolveAuthDomain (auth-domain.ts).
 */
const firebaseConfig = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: resolveAuthDomain(),
  databaseURL: "https://the-kinetic-alphabet-default-rtdb.firebaseio.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
  measurementId: "G-CQH94GGM6B",
};

// ============================================================================
// HMR MANAGER
// ============================================================================

// Get or create HMR manager (survives HMR via global)
const hmrManager: FirebaseHMRManager = getFirebaseHMRManager();

// ============================================================================
// APP INITIALIZATION
// ============================================================================

/**
 * Generate app name for HMR rotation
 * In dev: unique name per HMR cycle
 * In prod: default (undefined = "[DEFAULT]")
 */
function getAppName(): string | undefined {
  if (import.meta.env?.DEV) {
    return `tka-app-${hmrManager.getAppId()}`;
  }
  return undefined;
}

/**
 * Initialize or get existing Firebase App
 */
function initializeFirebaseApp(): FirebaseApp {
  const appName = getAppName();

  // In production or first dev load, check for existing app
  if (!import.meta.env?.DEV || hmrManager.getAppId() === 0) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      const existing = appName
        ? existingApps.find((a) => a.name === appName)
        : existingApps[0];
      if (existing) {
        debug.info(`Using existing Firebase App: ${existing.name}`);
        return existing;
      }
    }
  }

  // Create new app
  const newApp = initializeApp(firebaseConfig, appName);
  debug.success(`Firebase App initialized: ${newApp.name}`);
  return newApp;
}

// Initialize app
let app: FirebaseApp = initializeFirebaseApp();
hmrManager.setApp(app);

// ============================================================================
// AUTH (LAZY ACCESSOR)
// ============================================================================

let authInstance: Auth | null = null;
let authInitPromise: Promise<Auth> | null = null;

/**
 * Get Firebase Auth instance (lazy, HMR-safe)
 *
 * This is the recommended way to access Auth. It:
 * - Lazily initializes auth
 * - Survives HMR rotation
 * - Waits for persistence configuration
 */
export async function getAuthInstance(): Promise<Auth> {
  // If HMR rotation is in progress, wait for it
  if (hmrManager.isRotating()) {
    await hmrManager.waitForReady();
  }

  // Check if we have a valid instance
  if (authInstance) {
    return authInstance;
  }

  // If initialization is in progress, wait for it
  if (authInitPromise) {
    return authInitPromise;
  }

  // Start initialization
  authInitPromise = (async () => {
    authInstance = getAuth(app);
    hmrManager.setAuth(authInstance);

    // Configure persistence
    try {
      await setPersistence(authInstance, indexedDBLocalPersistence);
      debug.success("Auth persistence: IndexedDB");
    } catch {
      try {
        await setPersistence(authInstance, browserLocalPersistence);
        debug.info("Auth persistence: localStorage (fallback)");
      } catch (error) {
        debug.warn("Auth persistence configuration failed:", error);
      }
    }

    return authInstance;
  })();

  return authInitPromise;
}

/**
 * Get Auth instance synchronously (for backward compatibility)
 * During HMR rotation, returns cached auth from HMR manager.
 *
 * @deprecated Use getAuthInstance() for HMR safety
 */
export function getAuthSync(): Auth {
  // During HMR rotation, try to use cached auth from HMR manager
  if (hmrManager.isRotating()) {
    const cachedAuth = hmrManager.getAuth();
    if (cachedAuth) {
      return cachedAuth;
    }
    // If no cached auth, log warning but don't throw - try to continue
    debug.warn("getAuthSync called during HMR rotation with no cached auth");
  }

  if (!authInstance) {
    // Initialize synchronously for backward compat
    authInstance = getAuth(app);
    hmrManager.setAuth(authInstance);
  }

  return authInstance;
}

/**
 * Legacy auth export for backward compatibility
 * New code should use getAuthInstance()
 *
 * Initialized via initializeAuth so persistence is configured atomically
 * during construction. This avoids the IndexedDB race that caused setPersistence
 * to hang for 5+ seconds on every refresh (firebase-js-sdk #8626).
 *
 * @deprecated Use getAuthInstance() for HMR safety
 */
function initAuthWithPersistence(): Auth {
  // initializeAuth can only run once per Firebase app - fall back to getAuth
  // if it's already been initialized (e.g., via HMR or another call site).
  // popupRedirectResolver is required here because signInWithPopup relies on it;
  // getAuth() installs it by default, but initializeAuth() does not.
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = initAuthWithPersistence();

// Register with HMR manager
hmrManager.setAuth(auth);

// ============================================================================
// FIRESTORE (LAZY, HMR-SAFE)
// ============================================================================

let firestoreInstance: Firestore | null = null;
let firestoreInitPromise: Promise<Firestore> | null = null;
let usingMemoryCache = false;

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
 */
async function clearFirestoreIndexedDB(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  try {
    const databases = await indexedDB.databases();
    const firestoreDbs = databases.filter(
      (db) => db.name?.includes("firestore") || db.name?.includes("firebase")
    );

    for (const db of firestoreDbs) {
      if (db.name) {
        debug.warn(`Deleting corrupted IndexedDB: ${db.name}`);
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        });
      }
    }

    debug.success("Cleared corrupted Firestore IndexedDB databases");
  } catch (error) {
    debug.error("Failed to clear IndexedDB:", error);
  }
}

/**
 * Get Firestore instance (lazy, HMR-safe)
 *
 * Features:
 * - Lazy initialization (reduces bundle size)
 * - Memory cache in dev (avoids HMR corruption)
 * - Persistent cache in production (offline support)
 * - Automatic recovery from corruption
 */
export async function getFirestoreInstance(): Promise<Firestore> {
  // If HMR rotation is in progress, wait for it
  if (hmrManager.isRotating()) {
    await hmrManager.waitForReady();
    // After rotation, firestore instance is cleared - need fresh one
  }

  // Return existing instance if valid
  if (firestoreInstance) {
    return firestoreInstance;
  }

  // Wait for in-progress initialization
  if (firestoreInitPromise) {
    return firestoreInitPromise;
  }

  // Start initialization
  firestoreInitPromise = initializeFirestore();
  return firestoreInitPromise;
}

async function initializeFirestore(): Promise<Firestore> {
  const { getFirestore, initializeFirestore: initFs, memoryLocalCache } =
    await import("firebase/firestore");

  // DEV: memory cache (avoids HMR corruption) + forced long-polling.
  // experimentalAutoDetectLongPolling is on by default, but its probe still
  // opens a WebChannel/QUIC connection first — on flaky local networks those
  // probes stall and Chrome floods the console with
  // ERR_QUIC_PROTOCOL_ERROR.QUIC_TOO_MANY_RTOS (the request still 200s after
  // fallback, so it's pure noise). Forcing long-polling never opens WebChannel,
  // so the QUIC errors never appear. Must run initFs BEFORE any getFirestore,
  // or the default WebChannel instance is created without these settings.
  if (import.meta.env?.DEV) {
    try {
      firestoreInstance = initFs(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      });
      usingMemoryCache = true;
      debug.success("Firestore initialized with memory cache + long-polling (dev)");
    } catch {
      // Already initialized (HMR) — reuse the existing instance, which already
      // carries the long-polling setting from the first init.
      firestoreInstance = getFirestore(app);
      debug.warn("Firestore reused existing instance (dev)");
    }

    hmrManager.setFirestore(firestoreInstance);
    return firestoreInstance;
  }

  // PRODUCTION: Use persistent cache with timeout fallback
  try {
    firestoreInstance = getFirestore(app);
    debug.success("Firestore instance retrieved");
    hmrManager.setFirestore(firestoreInstance);
    return firestoreInstance;
  } catch {
    // Not yet initialized - proceed to initFs
  }

  // persistentMultipleTabManager can hang if BroadcastChannel/IndexedDB is stuck.
  // Race against a 5s timeout that falls back to memory cache.
  const FIRESTORE_INIT_TIMEOUT = 5000;

  try {
    const { persistentLocalCache, persistentMultipleTabManager } =
      await import("firebase/firestore");

    firestoreInstance = await Promise.race([
      (async () => {
        const fs = initFs(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
        debug.success("Firestore initialized with persistent cache");
        return fs;
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firestore persistent cache timed out")), FIRESTORE_INIT_TIMEOUT)
      ),
    ]);
  } catch (error) {
    debug.warn("Persistent cache failed, falling back to memory cache:", error);
    if (isFirestoreCorruptionError(error)) {
      await clearFirestoreIndexedDB();
    }

    try {
      firestoreInstance = initFs(app, { localCache: memoryLocalCache() });
      usingMemoryCache = true;
      debug.success("Firestore initialized with memory cache (fallback)");
    } catch {
      firestoreInstance = getFirestore(app);
      debug.error("Memory cache failed, using bare Firestore");
    }
  }

  hmrManager.setFirestore(firestoreInstance);
  return firestoreInstance;
}

/** Check if Firestore is using memory-only cache */
export function isFirestoreUsingMemoryCache(): boolean {
  return usingMemoryCache;
}

// ============================================================================
// REALTIME DATABASE (LAZY, HMR-SAFE)
// ============================================================================

let databaseInstance: Database | null = null;
let databaseInitPromise: Promise<Database> | null = null;

/**
 * Get Realtime Database instance (lazy, HMR-safe)
 */
export async function getDatabaseInstance(): Promise<Database> {
  if (hmrManager.isRotating()) {
    await hmrManager.waitForReady();
  }

  if (databaseInstance) {
    return databaseInstance;
  }

  if (databaseInitPromise) {
    return databaseInitPromise;
  }

  databaseInitPromise = (async () => {
    const { getDatabase } = await import("firebase/database");
    databaseInstance = getDatabase(app);
    hmrManager.setDatabase(databaseInstance);
    debug.success("Realtime Database lazy-loaded");
    return databaseInstance;
  })();

  return databaseInitPromise;
}

/**
 * Legacy database proxy for backward compatibility
 * @deprecated Use getDatabaseInstance() for HMR safety
 */
let _cachedDatabase: Database | null = null;

export const database = new Proxy({} as Database, {
  get(_target, prop) {
    if (!_cachedDatabase) {
      throw new Error(
        "Realtime Database accessed before initialization. " +
          "Use getDatabaseInstance() instead."
      );
    }
    return Reflect.get(_cachedDatabase, prop);
  },
});

// Initialize database cache (browser only)
if (typeof window !== "undefined") {
  getDatabaseInstance().then((instance) => {
    _cachedDatabase = instance;
  });
}

// ============================================================================
// STORAGE (LAZY)
// ============================================================================

/**
 * Get Firebase Storage instance (lazy)
 */
export async function getStorageInstance(): Promise<FirebaseStorage> {
  const { getStorage } = await import("firebase/storage");
  return getStorage(app);
}

// ============================================================================
// FUNCTIONS (LAZY + SYNC)
// ============================================================================

let functionsInstance: Functions | null = null;
let functionsInitPromise: Promise<Functions> | null = null;

/**
 * Get Firebase Functions instance (lazy)
 * Uses the current HMR-safe app instance
 */
export async function getFunctionsInstance(): Promise<Functions> {
  if (functionsInstance) {
    return functionsInstance;
  }

  if (functionsInitPromise) {
    return functionsInitPromise;
  }

  functionsInitPromise = (async () => {
    const { getFunctions } = await import("firebase/functions");
    functionsInstance = getFunctions(app);
    return functionsInstance;
  })();

  return functionsInitPromise;
}

// Pre-initialize functions in browser for faster first call
if (typeof window !== "undefined") {
  getFunctionsInstance();
}

// ============================================================================
// AUTH PERSISTENCE
//
// Persistence is now configured atomically by initializeAuth() above.
// This function exists for backward compatibility - it resolves immediately
// because there's nothing to wait for. Previously this Promise.raced
// setPersistence with a 5-second timeout, which fired on every refresh
// because setPersistence races with IndexedDB setup (firebase-js-sdk #8626).
// ============================================================================

export async function ensureAuthPersistence(): Promise<void> {
  // No-op: persistence is configured during initializeAuth(), no waiting needed.
}

// Keep setPersistence imported for any code that needs to switch persistence
// (e.g., session-only mode for Remember Me unchecked). Not used at boot.
void setPersistence;

// ============================================================================
// EXPORTS
// ============================================================================

export { app };

// Initialize Firestore (browser only)
if (typeof window !== "undefined") {
  getFirestoreInstance().catch((error) => {
    console.error("Failed to initialize Firestore:", error);
  });
}

// ============================================================================
// HMR LIFECYCLE - ZERO-DOWNTIME ROTATION
// ============================================================================

if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    debug.info("HMR dispose: Preparing for rotation...");

    // Let HMR manager handle cleanup
    await hmrManager.onHMRDispose();

    // Clear local instance references
    firestoreInstance = null;
    firestoreInitPromise = null;
    databaseInstance = null;
    databaseInitPromise = null;
    authInstance = null;
    authInitPromise = null;
    _cachedDatabase = null;
  });

  import.meta.hot.accept(async () => {
    debug.info("HMR accept: Rotating Firebase App...");

    try {
      // Rotate to new app instance
      await hmrManager.onHMRAccept(firebaseConfig, initializeApp, getAuth);

      // Get new instances from manager
      const newApp = hmrManager.getApp();
      if (newApp) {
        app = newApp;
      }

      const newAuth = hmrManager.getAuth();
      if (newAuth) {
        authInstance = newAuth;
      }

      // Re-initialize lazy services with new app
      await Promise.all([
        getFirestoreInstance(),
        getDatabaseInstance(),
      ]);

      debug.success("HMR rotation complete - no page reload needed!");
    } catch (error) {
      debug.error("HMR rotation failed:", error);
      debug.warn("Falling back to page reload");
      window.location.reload();
    }
  });
}

// ============================================================================
// LISTENER HELPERS (HMR-SAFE)
// ============================================================================

/**
 * Create an HMR-safe Firestore listener
 *
 * Usage:
 * ```typescript
 * const unsubscribe = createHMRSafeFirestoreListener(
 *   'user-profile-listener',
 *   `users/${userId}`,
 *   () => onSnapshot(doc(db, 'users', userId), callback)
 * );
 * ```
 */
export function createHMRSafeFirestoreListener(
  id: string,
  path: string,
  subscribe: () => Unsubscribe
): Unsubscribe {
  return hmrManager.registerFirestoreListener(id, path, subscribe);
}

/**
 * Create an HMR-safe Realtime Database listener
 */
export function createHMRSafeDatabaseListener(
  id: string,
  path: string,
  subscribe: () => () => void
): () => void {
  return hmrManager.registerDatabaseListener(id, path, subscribe);
}

/**
 * Register a presence handler for automatic re-establishment after HMR
 */
export function registerPresenceHandler(
  handler: () => Promise<void> | void
): () => void {
  return hmrManager.registerPresenceHandler(handler);
}

/**
 * Wait for Firebase to be ready (after HMR rotation)
 */
export { waitForFirebaseReady } from "./firebase-hmr-manager";
