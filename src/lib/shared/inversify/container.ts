/**
 * InversifyJS Container - Zero-Downtime HMR Support
 *
 * This module provides the dependency injection container with bulletproof
 * Hot Module Replacement (HMR) resilience.
 *
 * Key Features:
 * - Shadow Container Pattern: Rebuild in background while active serves requests
 * - Atomic Container Swap: Switch only when rebuild is 100% complete
 * - Deferred Resolution: Queue requests during rebuild, auto-resolve when ready
 * - Singleton Caching: Preserve singleton state across HMR
 *
 * @module container
 */

import type { Container } from "inversify";
import type { ContainerModule } from "inversify";
import { HMRContainerManager } from "./hmr/HMRContainerManager";

// Export TYPES immediately to avoid circular dependency
export { TYPES } from "./types";

// ============================================================================
// GLOBAL TYPE AUGMENTATION
// ============================================================================

declare global {
   
  var __TKA_CONTAINER__: Container | undefined;
   
  var __TKA_CONTAINER_INITIALIZED__: boolean | undefined;
   
  var __TKA_HMR_MANAGER__: HMRContainerManager | undefined;
}

// ============================================================================
// HMR MANAGER SETUP
// ============================================================================

const hmrManager = HMRContainerManager.getInstance({
  resolutionTimeout: 5000,
  preserveSingletons: true,
  debug: import.meta.env.DEV,
  maxDeferredQueue: 100,
});

// Export the container from the manager
export const container = hmrManager.getContainer();
export const inversifyContainer = container;

// ============================================================================
// MODULE TRACKING
// ============================================================================

// Track loaded modules to prevent duplicate loading
// Use HMR manager as source of truth for tier1/tier2
// Feature modules tracked locally since they're on-demand
const loadedModules: Set<string> = new Set<string>();
const pendingModules = new Map<string, Promise<void>>();
let tier2Promise: Promise<void> | null = null;

// Browser detection utility
const isBrowser = typeof window !== "undefined";

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// ============================================================================
// HMR LIFECYCLE HANDLERS
// ============================================================================

if (import.meta.hot) {
  import.meta.hot.accept(async () => {
    // Clear local feature module tracking
    // HMR manager tracks tier1/tier2 state
    loadedModules.clear();
    tier2Promise = null;

    // Trigger HMR rebuild through manager
    // This rebuilds the container with tier1, tier2, and all feature modules
    await hmrManager.onHMRAccept();

    // Reset state after successful rebuild
    isInitialized = true;
  });

  import.meta.hot.dispose(() => {
    // Trigger dispose on manager (caches singletons, prepares for rebuild)
    hmrManager.onHMRDispose();

    // DON'T call unbindAll() here - manager handles it during atomic swap
  });
}

/**
 * Get names of tier 1 and tier 2 modules
 */
function _getTierModuleNames(): string[] {
  return [
    // Tier 1: Core infrastructure
    "core",
    "navigation",
    "data",
    "keyboard",
    "analytics",
    "presence",
    // Tier 2: Shared services
    "render",
    "pictograph",
    "admin",
    "feedback",
    "share",
    "community",
  ];
}

// ============================================================================
// SYNC TO GLOBAL STATE
// ============================================================================

function syncContainerToGlobal(): void {
  if (typeof globalThis !== "undefined") {
    globalThis.__TKA_CONTAINER__ = hmrManager.getContainer();
    globalThis.__TKA_CONTAINER_INITIALIZED__ = isInitialized;
  }
}

// ============================================================================
// RESOLUTION FUNCTIONS (HMR-RESILIENT)
// ============================================================================

/**
 * Resolve a service synchronously.
 * During HMR, uses fallbacks (cached singletons, shadow container).
 * Throws only if service is truly unavailable.
 */
export function resolve<T>(serviceType: symbol): T {
  if (!isBrowser) {
    throw new Error(
      `Cannot resolve service ${String(serviceType)} during server-side rendering.`
    );
  }

  // Use HMR manager for resilient resolution
  return hmrManager.resolve<T>(serviceType);
}

/**
 * Try to resolve a service - returns null instead of throwing.
 * Safe to use during HMR or when service might not be bound.
 */
export function tryResolve<T>(serviceType: symbol): T | null {
  if (!isBrowser) return null;
  return hmrManager.tryResolve<T>(serviceType);
}

/**
 * Resolve a service asynchronously.
 * Waits for HMR to complete if in progress.
 */
export async function resolveAsync<T>(serviceType: symbol): Promise<T> {
  await ensureContainerInitialized();
  return hmrManager.resolveAsync<T>(serviceType);
}

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Check if container is initialized
 */
export function isContainerInitialized(): boolean {
  return isInitialized;
}

/**
 * Get container status for debugging
 */
export function getContainerStatus() {
  return {
    isInitialized,
    hasInitializationPromise: initializationPromise !== null,
    containerExists: container !== null,
    hmrPhase: hmrManager.isHMRInProgress() ? "rebuilding" : "ready",
  };
}

/**
 * Ensure container is initialized
 */
export async function ensureContainerInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initializationPromise) {
    await initializationPromise;
    return;
  }
  await initializeContainer();
}

// ============================================================================
// TIER 1: CRITICAL INFRASTRUCTURE MODULES
// ============================================================================

/**
 * Load critical infrastructure modules (blocking).
 * Target: <500ms - Essential for app shell to become interactive
 */
export async function loadCriticalModules(): Promise<void> {
  // Use HMR manager as source of truth to prevent double-loading
  if (hmrManager.isTier1Loaded()) return;

  try {
    const [
      { coreModule },
      { navigationModule },
      { dataModule },
      { keyboardModule },
      { analyticsModule },
      { presenceModule },
    ] = await Promise.all([
      import("./modules/core.module"),
      import("./modules/navigation.module"),
      import("./modules/data.module"),
      import("./modules/keyboard.module"),
      import("./modules/analytics.module"),
      import("./modules/presence.module"),
    ]);

    // Register modules with HMR manager for rebuild
    hmrManager.registerTier1Modules([
      coreModule,
      navigationModule,
      dataModule,
      keyboardModule,
      analyticsModule,
      presenceModule,
    ]);

    // Load into container
    await hmrManager.loadModules([
      coreModule,
      navigationModule,
      dataModule,
      keyboardModule,
      analyticsModule,
      presenceModule,
    ]);

    // Mark as loaded in HMR manager (source of truth)
    hmrManager.markTier1Loaded();
  } catch (error) {
    console.error("❌ Failed to load Tier 1 modules:", error);
    throw error;
  }
}

// ============================================================================
// TIER 2: SHARED SERVICE MODULES
// ============================================================================

/**
 * Load shared service modules (non-blocking background).
 * Loads in background while user reads content.
 */
export async function loadSharedModules(): Promise<void> {
  // Use HMR manager as source of truth to prevent double-loading
  if (hmrManager.isTier2Loaded()) return;
  if (tier2Promise) {
    await tier2Promise;
    return;
  }

  tier2Promise = (async () => {
    try {
      const [
        { renderModule },
        { pictographModule },
        { adminModule },
        { feedbackModule },
        { shareModule },
        { communityModule },
      ] = await Promise.all([
        import("./modules/render.module"),
        import("./modules/pictograph.module"),
        import("./modules/admin.module"),
        import("./modules/feedback.module"),
        import("./modules/share.module"),
        import("./modules/community.module"),
      ]);

      // Register modules with HMR manager for rebuild
      hmrManager.registerTier2Modules([
        renderModule,
        pictographModule,
        adminModule,
        feedbackModule,
        shareModule,
        communityModule,
      ]);

      // Load into container
      await hmrManager.loadModules([
        renderModule,
        pictographModule,
        adminModule,
        feedbackModule,
        shareModule,
        communityModule,
      ]);

      // Mark as loaded in HMR manager (source of truth)
      hmrManager.markTier2Loaded();
    } catch (error) {
      console.error("❌ Failed to load Tier 2 modules:", error);
      tier2Promise = null;
    }
  })();

  await tier2Promise;
}

// ============================================================================
// TIER 3: FEATURE MODULES (ON-DEMAND)
// ============================================================================

/**
 * Load a feature module on-demand.
 *
 * @param feature - Tab name: 'create', 'discover', 'compose', etc.
 */
export async function loadFeatureModule(feature: string): Promise<void> {
  if (loadedModules.has(feature)) return;

  // CRITICAL: Ensure container is initialized before loading feature modules
  // Without this, tier2Promise may be null and dependencies won't be loaded
  await ensureContainerInitialized();

  // Helper to load a module only if not already loaded
  const loadIfNeeded = async (
    name: string,
    importFn: () => Promise<{ [key: string]: ContainerModule }>
  ): Promise<void> => {
    if (loadedModules.has(name)) {
      // Already loaded, skip
      return;
    }

    const pending = pendingModules.get(name);
    if (pending) {
      // Already loading, wait for it
      return pending;
    }

    const loadPromise = (async () => {
      try {
        const moduleExports = await importFn();
        const module = Object.values(moduleExports)[0] as ContainerModule;
        if (!module) throw new Error(`Module ${name} export is undefined`);

        // Double-check after async import
        if (loadedModules.has(name)) {
          return; // Race condition: another call loaded it while we were importing
        }

        // Register with HMR manager for rebuild
        hmrManager.registerFeatureModule(name, async () => {
          const exports = await importFn();
          return Object.values(exports)[0] as ContainerModule;
        });

        await hmrManager.loadModules([module]);
        loadedModules.add(name);
      } finally {
        pendingModules.delete(name);
      }
    })();

    pendingModules.set(name, loadPromise);
    return loadPromise;
  };

  try {
    switch (feature) {
      case "create":
        if (tier2Promise) await tier2Promise;
        await Promise.all([
          loadIfNeeded("create", () => import("./modules/build.module")),
          loadIfNeeded("animator", () => import("./modules/animator.module")),
          loadIfNeeded(
            "gamification",
            () => import("./modules/gamification.module")
          ),
        ]);
        break;

      case "discover":
        if (tier2Promise) await tier2Promise;
        await loadIfNeeded(
          "discover",
          () => import("./modules/discover.module")
        );
        break;

      case "community":
        if (tier2Promise) await tier2Promise;
        await Promise.all([
          loadIfNeeded("create", () => import("./modules/build.module")),
          loadIfNeeded("discover", () => import("./modules/discover.module")),
          loadIfNeeded("library", () => import("./modules/library.module")),
        ]);
        break;

      case "learn":
        await loadIfNeeded("learn", () => import("./modules/learn.module"));
        break;

      case "train":
        await Promise.all([
          loadIfNeeded("discover", () => import("./modules/discover.module")),
          loadIfNeeded("train", () => import("./modules/train.module")),
          loadIfNeeded("animator", () => import("./modules/animator.module")),
        ]);
        break;

      case "compose":
      case "animate":
        // Wait for tier 2 (pictograph module has IStartPositionDeriver)
        if (tier2Promise) await tier2Promise;
        await Promise.all([
          loadIfNeeded("discover", () => import("./modules/discover.module")),
          loadIfNeeded("animator", () => import("./modules/animator.module")),
        ]);
        break;

      case "edit":
        await loadIfNeeded(
          "discover",
          () => import("./modules/discover.module")
        );
        break;

      case "collect":
      case "library":
        await Promise.all([
          loadIfNeeded("create", () => import("./modules/build.module")),
          loadIfNeeded("library", () => import("./modules/library.module")),
        ]);
        break;

      case "account":
      case "settings":
        // Settings module is lightweight - no heavy dependencies needed
        // Previously loaded create/library which pulled in 150+ files unnecessarily
        break;

      case "about":
      case "dashboard":
        break;

      case "feedback":
        if (tier2Promise) await tier2Promise;
        break;

      case "word_card":
        await Promise.all([
          loadIfNeeded("word_card", () => import("./modules/word-card.module")),
          loadIfNeeded("discover", () => import("./modules/discover.module")),
        ]);
        break;

      case "write":
        await loadIfNeeded("write", () => import("./modules/write.module"));
        break;

      case "admin":
        await Promise.all([
          loadIfNeeded("create", () => import("./modules/build.module")),
          loadIfNeeded("library", () => import("./modules/library.module")),
          loadIfNeeded("train", () => import("./modules/train.module")),
          loadIfNeeded("discover", () => import("./modules/discover.module")),
        ]);
        break;

      case "share":
        if (tier2Promise) await tier2Promise;
        break;

      case "gamification":
        await loadIfNeeded(
          "gamification",
          () => import("./modules/gamification.module")
        );
        break;

      case "messaging":
        await loadIfNeeded(
          "messaging",
          () => import("./modules/messaging.module")
        );
        break;

      case "inbox":
        await loadIfNeeded("inbox", () => import("./modules/inbox.module"));
        break;

      case "loop-labeler":
        await loadIfNeeded("create", () => import("./modules/build.module"));
        await loadIfNeeded(
          "loop-labeler",
          () => import("./modules/loop-labeler.module")
        );
        break;

      case "3d-viewer":
        await Promise.all([
          loadIfNeeded("discover", () => import("./modules/discover.module")),
          loadIfNeeded(
            "animation-3d",
            () =>
              import("../../shared/3d-animation/inversify/animation-3d.module")
          ),
        ]);
        break;

      case "mandala":
        // Wait for tier 2 (pictograph module has arrow loading services)
        if (tier2Promise) await tier2Promise;
        await loadIfNeeded("mandala", () => import("./modules/mandala.module"));
        break;

      case "gallery":
        // Gallery needs library services (which depends on build module for OrientationCycleDetector)
        // and 3D animation. Build module requires tier2 services.
        if (tier2Promise) await tier2Promise;
        await Promise.all([
          loadIfNeeded("create", () => import("./modules/build.module")),
          loadIfNeeded("library", () => import("./modules/library.module")),
          loadIfNeeded(
            "gallery",
            () => import("../../features/gallery/inversify/gallery.module")
          ),
          loadIfNeeded(
            "animation-3d",
            () =>
              import("../../shared/3d-animation/inversify/animation-3d.module")
          ),
        ]);
        break;

      default:
        console.warn(`Unknown feature module: ${feature}`);
        return;
    }

    loadedModules.add(feature);
  } catch (error) {
    console.error(`❌ Failed to load feature module '${feature}':`, error);
    throw error;
  }
}

/**
 * Preload a feature module in the background (non-blocking)
 */
export function preloadFeatureModule(feature: string): void {
  loadFeatureModule(feature).catch((error) => {
    console.warn(`Preload failed for '${feature}':`, error);
  });
}

// ============================================================================
// CONTAINER INITIALIZATION
// ============================================================================

/**
 * Initialize the DI container with three-tier loading strategy.
 *
 * TIER 1: Critical modules (blocking) - Auth, navigation, persistence
 * TIER 2: Shared services (non-blocking) - Rendering, animation, pictographs
 * TIER 3: Feature modules (on-demand) - User tabs loaded when accessed
 */
function initializeContainer(): Promise<void> {
  if (!isBrowser) return Promise.resolve();
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      // TIER 1: Load critical infrastructure (BLOCKING)
      await loadCriticalModules();

      // TIER 2: Start loading shared services in background (NON-BLOCKING)
      tier2Promise = loadSharedModules();

      // Preload cached feature module
      preloadCachedFeatureModule();

      isInitialized = true;
      syncContainerToGlobal();
    } catch (error) {
      console.error("❌ Container initialization failed:", error);
      isInitialized = false;
      initializationPromise = null;
      loadedModules.clear();
      pendingModules.clear();
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Preload the cached feature module from localStorage
 */
function preloadCachedFeatureModule(): void {
  if (!isBrowser) return;

  try {
    const cached = localStorage.getItem("tka-active-module-cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.moduleId && typeof parsed.moduleId === "string") {
        loadFeatureModule(parsed.moduleId).catch((error) => {
          console.warn(`⚠️ Failed to preload cached module:`, error);
        });
      }
    }
  } catch {
    // Ignore errors - optimization only
  }
}

// ============================================================================
// AUTO-INITIALIZATION (Browser Only)
// ============================================================================

if (isBrowser) {
  initializeContainer().catch((error) => {
    console.error("💥 FATAL: Container initialization failed:", error);
  });
}

// Export initialization function for testing/manual control
export { initializeContainer };
