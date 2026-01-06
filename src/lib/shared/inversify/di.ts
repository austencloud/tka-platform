/**
 * InversifyJS dependency injection system - Service Resolution
 *
 * This module provides the main DI functionality including:
 * - Service resolution (resolve, tryResolve, resolveAsync)
 * - Lazy container initialization
 * - Feature module loading
 *
 * HMR RESILIENCE: All resolution is delegated to HMRContainerManager in container.ts
 * which provides zero-downtime HMR with shadow container pattern.
 *
 * PERFORMANCE FIX: All container access is now dynamic to enable proper code-splitting
 */

// Export type symbols (these are safe to import statically)
import { TYPES } from "./types";
export { TYPES };

// NOTE: Do NOT re-export inversify decorators (inject, injectable, Container) here.
// They require reflect-metadata to be loaded first and break SSR.
// Import them directly from "inversify" in service implementations.
import type { Container as InversifyContainer } from "inversify";
import type { HMRContainerManager } from "./hmr/HMRContainerManager";

// ============================================================================
// GLOBAL TYPE AUGMENTATION
// ============================================================================

declare global {
   
  var __TKA_CONTAINER__: InversifyContainer | undefined;
   
  var __TKA_CONTAINER_INITIALIZED__: boolean | undefined;
   
  var __TKA_HMR_MANAGER__: HMRContainerManager | undefined;
}

// Browser detection
const isBrowser = typeof window !== "undefined";

// ============================================================================
// HMR-RESILIENT SERVICE RESOLUTION
// ============================================================================

/**
 * Resolve a service from the DI container.
 *
 * This function delegates to HMRContainerManager for zero-downtime HMR support.
 * During HMR, it will:
 * 1. Try the active container
 * 2. Fall back to cached singletons
 * 3. Try the shadow container (if swapping)
 * 4. Throw with helpful message if service unavailable
 *
 * @throws Error if service not found and no fallback available
 */
export function resolve<T>(serviceIdentifier: symbol): T {
  if (!isBrowser) {
    throw new Error(
      `Cannot resolve service ${String(serviceIdentifier)} during server-side rendering.`
    );
  }

  // Delegate to container.ts which uses HMRContainerManager
  // Dynamic import would break sync resolution, so we use the global
  const container = globalThis.__TKA_CONTAINER__;
  if (!container) {
    throw new Error(
      `Container not initialized. Call ensureContainerInitialized() before resolving services. ` +
        `This usually means a component is trying to resolve services before the app is fully loaded.`
    );
  }

  // Try HMR manager first if available (provides fallbacks during HMR)
  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  if (hmrManager) {
    return hmrManager.resolve<T>(serviceIdentifier);
  }

  // Fall back to direct container access
  return container.get<T>(serviceIdentifier);
}

/**
 * Resolve a service asynchronously, waiting for HMR to complete if in progress.
 *
 * Use this when you can handle async resolution and want guaranteed availability.
 */
export async function resolveAsync<T>(serviceIdentifier: symbol): Promise<T> {
  if (!isBrowser) {
    throw new Error(
      `Cannot resolve service ${String(serviceIdentifier)} during server-side rendering.`
    );
  }

  await ensureContainerInitialized();

  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  if (hmrManager) {
    return hmrManager.resolveAsync<T>(serviceIdentifier);
  }

  const container = globalThis.__TKA_CONTAINER__;
  if (!container) {
    throw new Error(
      "Container not initialized after ensureContainerInitialized()"
    );
  }

  return container.get<T>(serviceIdentifier);
}

/**
 * Try to resolve a service - returns null instead of throwing.
 *
 * Safe to use during HMR or when service might not be bound.
 * No error logging - the caller expects this for optional dependencies.
 */
export function tryResolve<T>(serviceIdentifier: symbol): T | null {
  if (!isBrowser) return null;

  // Try HMR manager first if available
  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  if (hmrManager) {
    return hmrManager.tryResolve<T>(serviceIdentifier);
  }

  // Fall back to direct container access
  const container = globalThis.__TKA_CONTAINER__;
  if (!container) return null;

  try {
    return container.get<T>(serviceIdentifier);
  } catch {
    return null;
  }
}

/**
 * Resolve with HMR-safe fallback - returns null on failure.
 * @deprecated Use tryResolve() instead
 */
export function resolveHMRSafe<T>(serviceIdentifier: symbol): T | null {
  return tryResolve<T>(serviceIdentifier);
}

// ============================================================================
// CONTAINER INITIALIZATION
// ============================================================================

let _initPromise: Promise<void> | null = null;

/**
 * Ensure the DI container is initialized.
 * Safe to call multiple times - only initializes once.
 */
export async function ensureContainerInitialized(): Promise<void> {
  if (globalThis.__TKA_CONTAINER_INITIALIZED__) return;

  if (!_initPromise) {
    _initPromise = import("./container").then(
      async ({ ensureContainerInitialized: init }) => {
        await init();
      }
    );
  }

  await _initPromise;
}

/**
 * Check if container is ready for synchronous access.
 */
export function isContainerReady(): boolean {
  return globalThis.__TKA_CONTAINER_INITIALIZED__ === true;
}

/**
 * Check if HMR is currently in progress.
 */
export function isHMRInProgress(): boolean {
  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  return hmrManager ? hmrManager.isHMRInProgress() : false;
}

// ============================================================================
// LAZY FEATURE MODULE LOADING (prevents static import of container.ts)
// ============================================================================

/**
 * Load a feature module on-demand. Dynamically imports container.ts to enable code-splitting.
 * @param feature - The feature module name to load
 */
export async function loadFeatureModule(feature: string): Promise<void> {
  const { loadFeatureModule: load } = await import("./container");
  return load(feature);
}

/**
 * Preload a feature module in the background (non-blocking).
 * @param feature - The feature module name to preload
 */
export function preloadFeatureModule(feature: string): void {
  import("./container")
    .then(({ preloadFeatureModule: preload }) => {
      preload(feature);
    })
    .catch((error) => {
      console.warn(`Failed to preload feature module '${feature}':`, error);
    });
}

/**
 * Load shared modules (Tier 2). Dynamically imports container.ts to enable code-splitting.
 */
export async function loadSharedModules(): Promise<void> {
  const { loadSharedModules: load } = await import("./container");
  return load();
}

// ============================================================================
// ON-DEMAND HEAVY LIBRARY MODULES
// These modules contain heavy dependencies and are loaded only when needed
// ============================================================================

/**
 * Load the Animation Renderer module on-demand.
 * Call this before using IAnimationRenderer.
 *
 * Uses container.isBound() as the source of truth to prevent duplicate bindings
 * (module-level flags get duplicated across production chunks)
 */
export async function loadAnimationModule(): Promise<void> {
  const container = await getContainerInstance();

  // Use container.isBound() as the source of truth (survives code-splitting)
  if (container.isBound(TYPES.IAnimationRenderer)) {
    return; // Already loaded
  }

  const { pixiModule } =
    await import("../../features/compose/inversify/PixiModule");
  await container.load(pixiModule);
}

/**
 * @deprecated Use loadAnimationModule() instead
 */
export const loadPixiModule = loadAnimationModule;

/**
 * Get the container instance. Use sparingly - prefer resolve() for service access.
 * This is provided for cases where direct container access is absolutely necessary.
 *
 * IMPORTANT: This waits for container initialization to complete before returning.
 * The container will have all Tier 1 (critical) modules loaded.
 */
export async function getContainerInstance(): Promise<InversifyContainer> {
  // Wait for initialization to complete before returning the container
  await ensureContainerInitialized();
  const { container } = await import("./container");
  return container;
}

// DEPRECATED: Synchronous container access - only works if container is already loaded
// Use getContainerInstance() or resolve() instead
export const container = {
  get: <T>(serviceIdentifier: symbol): T => {
    return resolve<T>(serviceIdentifier);
  },
  // Proxy other methods through resolve for backward compatibility
  isBound: (serviceIdentifier: symbol): boolean => {
    // Use tryResolve as the safest way to check binding
    return tryResolve(serviceIdentifier) !== null;
  },
};

// Alias for convenience in components
export const di = container;

// ============================================================================
// LEGACY EXPORTS (backward compatibility)
// ============================================================================

/**
 * @deprecated Use resolve() instead
 */
export const resolveSyncUnsafe = resolve;

/**
 * @deprecated Use getContainerInstance() instead
 */
export const getContainer = getContainerInstance;

/**
 * Reset container state - primarily for testing
 */
export function resetContainer(): void {
  // Reset is handled by HMRContainerManager
  // This is kept for backward compatibility but is mostly a no-op
  _initPromise = null;
}
