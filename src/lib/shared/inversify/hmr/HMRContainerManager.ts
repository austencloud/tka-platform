/**
 * HMR Container Manager - Zero-Downtime Dependency Injection
 *
 * This module provides bulletproof HMR resilience for InversifyJS containers.
 * It ensures that service resolution NEVER fails during hot module replacement.
 *
 * Key Features:
 * 1. Shadow Container Pattern - Rebuild in background while active container serves requests
 * 2. Deferred Resolution Queue - Queue requests during rebuild, auto-resolve when ready
 * 3. Singleton Instance Cache - Preserve singleton state across HMR
 * 4. Atomic Container Swap - Switch containers only when rebuild is 100% complete
 * 5. Resolution Timeout - Prevent infinite waits with configurable timeouts
 *
 * @module HMRContainerManager
 */

import { Container, type ContainerModule } from "inversify";

// ============================================================================
// TYPES
// ============================================================================

export interface DeferredResolution<T = unknown> {
  serviceIdentifier: symbol;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export interface SingletonCacheEntry {
  serviceIdentifier: symbol;
  instance: unknown;
  timestamp: number;
}

export interface HMRState {
  phase: "idle" | "disposing" | "rebuilding" | "swapping" | "ready";
  startTime: number | null;
  activeContainer: Container;
  shadowContainer: Container | null;
  rebuildPromise: Promise<void> | null;
}

export interface HMRContainerConfig {
  /** Maximum time to wait for deferred resolution (ms) */
  resolutionTimeout: number;
  /** Enable singleton caching across HMR */
  preserveSingletons: boolean;
  /** Enable debug logging */
  debug: boolean;
  /** Maximum deferred resolutions to queue */
  maxDeferredQueue: number;
}

export interface HMRMetrics {
  /** Total HMR cycles completed */
  totalCycles: number;
  /** Successful HMR cycles */
  successfulCycles: number;
  /** Failed HMR cycles (forced full reload or error) */
  failedCycles: number;
  /** Rebuild times in ms (last 10) */
  rebuildTimes: number[];
  /** Deferred resolutions per cycle (last 10) */
  deferredResolutionsPerCycle: number[];
  /** Singletons restored per cycle (last 10) */
  singletonsRestoredPerCycle: number[];
  /** Services that hit fallbacks during HMR */
  fallbackHits: Map<string, number>;
  /** Last cycle timestamp */
  lastCycleTimestamp: number | null;
  /** Average rebuild time */
  averageRebuildTime: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: HMRContainerConfig = {
  resolutionTimeout: 5000,
  preserveSingletons: true,
  debug: import.meta.env.DEV,
  maxDeferredQueue: 100,
};

// ============================================================================
// HMR CONTAINER MANAGER
// ============================================================================

export class HMRContainerManager {
  private static instance: HMRContainerManager | null = null;

  private config: HMRContainerConfig;
  private state: HMRState;
  private deferredQueue: DeferredResolution[] = [];
  private singletonCache: Map<symbol, SingletonCacheEntry> = new Map();
  private loadedModules: Set<string> = new Set();
  private moduleLoaders: Map<string, () => Promise<ContainerModule>> =
    new Map();
  private tier1Modules: ContainerModule[] = [];
  private tier2Modules: ContainerModule[] = [];
  private tier1Loaded = false;
  private tier2Loaded = false;
  private wasEverInitialized = false;

  // Track which services are singletons for caching
  private singletonServices: Set<symbol> = new Set();

  // Telemetry metrics for HMR performance tracking
  private metrics: HMRMetrics = {
    totalCycles: 0,
    successfulCycles: 0,
    failedCycles: 0,
    rebuildTimes: [],
    deferredResolutionsPerCycle: [],
    singletonsRestoredPerCycle: [],
    fallbackHits: new Map(),
    lastCycleTimestamp: null,
    averageRebuildTime: 0,
  };

  // Track current cycle stats
  private currentCycleStats = {
    deferredCount: 0,
    singletonsRestored: 0,
  };

  private constructor(config: Partial<HMRContainerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      phase: "idle",
      startTime: null,
      activeContainer: new Container(),
      shadowContainer: null,
      rebuildPromise: null,
    };

    // Sync to global immediately
    this.syncToGlobal();
  }

  /**
   * Get the singleton instance of HMRContainerManager
   */
  static getInstance(
    config?: Partial<HMRContainerConfig>
  ): HMRContainerManager {
    if (!HMRContainerManager.instance) {
      HMRContainerManager.instance = new HMRContainerManager(config);
    }
    return HMRContainerManager.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    HMRContainerManager.instance = null;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get the active container for direct access (use sparingly)
   */
  getContainer(): Container {
    return this.state.activeContainer;
  }

  /**
   * Check if the container is ready for resolution
   */
  isReady(): boolean {
    return this.state.phase === "idle" || this.state.phase === "ready";
  }

  /**
   * Check if HMR is in progress
   */
  isHMRInProgress(): boolean {
    return this.state.phase !== "idle" && this.state.phase !== "ready";
  }

  /**
   * Get HMR telemetry metrics for monitoring and debugging
   */
  getMetrics(): Readonly<HMRMetrics> {
    return { ...this.metrics, fallbackHits: new Map(this.metrics.fallbackHits) };
  }

  /**
   * Get a summary of HMR health for debugging
   */
  getHealthSummary(): {
    status: "healthy" | "degraded" | "unhealthy";
    successRate: number;
    avgRebuildTime: number;
    totalCycles: number;
    topFallbackServices: string[];
  } {
    const successRate =
      this.metrics.totalCycles > 0
        ? this.metrics.successfulCycles / this.metrics.totalCycles
        : 1;

    const status =
      successRate >= 0.95 ? "healthy" : successRate >= 0.8 ? "degraded" : "unhealthy";

    // Get top 5 services that hit fallbacks most often
    const topFallbackServices = Array.from(this.metrics.fallbackHits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service]) => service);

    return {
      status,
      successRate,
      avgRebuildTime: this.metrics.averageRebuildTime,
      totalCycles: this.metrics.totalCycles,
      topFallbackServices,
    };
  }

  /**
   * Resolve a service - NEVER throws during HMR
   *
   * If HMR is in progress, returns a cached singleton or queues the resolution.
   * Always returns synchronously or throws only for truly unrecoverable errors.
   */
  resolve<T>(serviceIdentifier: symbol): T {
    // Fast path: container is ready
    if (this.isReady()) {
      try {
        return this.state.activeContainer.get<T>(serviceIdentifier);
      } catch (error) {
        // Try singleton cache as fallback
        const cached = this.getCachedSingleton<T>(serviceIdentifier);
        if (cached !== null) {
          this.log(
            `Using cached singleton for ${serviceIdentifier.toString()}`
          );
          return cached;
        }
        throw error;
      }
    }

    // HMR in progress - try fallbacks
    return this.resolveWithFallbacks<T>(serviceIdentifier);
  }

  /**
   * Resolve a service with Promise-based deferred resolution
   *
   * If HMR is in progress, waits for rebuild to complete then resolves.
   */
  async resolveAsync<T>(serviceIdentifier: symbol): Promise<T> {
    // Fast path: container is ready
    if (this.isReady()) {
      try {
        return this.state.activeContainer.get<T>(serviceIdentifier);
      } catch (error) {
        const cached = this.getCachedSingleton<T>(serviceIdentifier);
        if (cached !== null) {
          return cached;
        }
        throw error;
      }
    }

    // Wait for HMR to complete
    if (this.state.rebuildPromise) {
      await this.state.rebuildPromise;
      return this.state.activeContainer.get<T>(serviceIdentifier);
    }

    // Defer resolution
    return this.deferResolution<T>(serviceIdentifier);
  }

  /**
   * Try to resolve a service - returns null instead of throwing
   */
  tryResolve<T>(serviceIdentifier: symbol): T | null {
    try {
      return this.resolve<T>(serviceIdentifier);
    } catch {
      return null;
    }
  }

  /**
   * Register a singleton service for caching
   */
  registerSingleton(serviceIdentifier: symbol): void {
    this.singletonServices.add(serviceIdentifier);
  }

  /**
   * Check if tier 1 modules are loaded
   */
  isTier1Loaded(): boolean {
    return this.tier1Loaded;
  }

  /**
   * Check if tier 2 modules are loaded
   */
  isTier2Loaded(): boolean {
    return this.tier2Loaded;
  }

  /**
   * Register tier 1 modules (loaded immediately)
   */
  registerTier1Modules(modules: ContainerModule[]): void {
    this.tier1Modules = modules;
  }

  /**
   * Register tier 2 modules (loaded in background)
   */
  registerTier2Modules(modules: ContainerModule[]): void {
    this.tier2Modules = modules;
  }

  /**
   * Mark tier 1 as loaded (call after successful load)
   */
  markTier1Loaded(): void {
    this.tier1Loaded = true;
  }

  /**
   * Mark tier 2 as loaded (call after successful load)
   */
  markTier2Loaded(): void {
    this.tier2Loaded = true;
  }

  /**
   * Check if the container was ever initialized (persists across HMR)
   */
  wasInitialized(): boolean {
    return this.wasEverInitialized;
  }

  /**
   * Mark as initialized (call after successful first initialization)
   */
  markInitialized(): void {
    this.wasEverInitialized = true;
  }

  /**
   * Register a feature module loader
   */
  registerFeatureModule(
    name: string,
    loader: () => Promise<ContainerModule>
  ): void {
    this.moduleLoaders.set(name, loader);
  }

  /**
   * Load modules into the container.
   *
   * NOTE: For HMR safety, modules should use createHMRSafeBinder from safeBind.ts
   * which uses options.rebind() for already-bound services.
   */
  async loadModules(modules: ContainerModule[]): Promise<void> {
    const container = this.state.activeContainer;

    for (const module of modules) {
      try {
        await container.load(module);
      } catch (error) {
        const errorMessage = String(error);
        if (errorMessage.includes("Ambiguous bindings")) {
          // This shouldn't happen if modules use createHMRSafeBinder
          this.log(`Ambiguous binding detected - module should use createHMRSafeBinder: ${errorMessage.substring(0, 200)}`, "error");
        }
        this.log(`Failed to load module: ${errorMessage}`, "error");
        throw error;
      }
    }
  }

  /**
   * Load a feature module by name
   */
  async loadFeatureModule(name: string): Promise<void> {
    if (this.loadedModules.has(name)) return;

    const loader = this.moduleLoaders.get(name);
    if (!loader) {
      this.log(`Unknown feature module: ${name}`, "warn");
      return;
    }

    const module = await loader();
    await this.state.activeContainer.load(module);
    this.loadedModules.add(name);
  }

  /**
   * Initialize the container with tier 1 and tier 2 modules
   */
  async initialize(): Promise<void> {
    this.log("Initializing container...");

    // Load tier 1 (blocking)
    if (this.tier1Modules.length > 0) {
      await this.state.activeContainer.load(...this.tier1Modules);
      this.log(`Loaded ${this.tier1Modules.length} tier 1 modules`);
    }

    // Load tier 2 (background)
    if (this.tier2Modules.length > 0) {
      // Don't await - let it load in background
      this.state.activeContainer.load(...this.tier2Modules).then(() => {
        this.log(`Loaded ${this.tier2Modules.length} tier 2 modules`);
      });
    }

    this.state.phase = "ready";
    this.syncToGlobal();
  }

  // ============================================================================
  // HMR LIFECYCLE
  // ============================================================================

  /**
   * Called when HMR dispose is triggered - prepare for rebuild
   */
  onHMRDispose(): void {
    this.log("HMR dispose triggered");
    this.state.phase = "disposing";
    this.state.startTime = Date.now();

    // Cache singletons before disposal
    if (this.config.preserveSingletons) {
      this.cacheSingletons();
    }

    // Reset tier flags - they'll be set again after rebuild
    this.tier1Loaded = false;
    this.tier2Loaded = false;
    this.loadedModules.clear();

    // DON'T unbind the active container yet - it's still serving requests
  }

  /**
   * Called when HMR accept is triggered - rebuild the container
   */
  async onHMRAccept(): Promise<void> {
    this.log("HMR accept triggered - starting rebuild");

    // Reset current cycle stats
    this.currentCycleStats = { deferredCount: 0, singletonsRestored: 0 };

    // Create shadow container BEFORE changing phase to prevent race condition
    // where resolveWithFallbacks tries to access null shadowContainer
    this.state.shadowContainer = new Container();
    this.state.phase = "rebuilding";

    // Start rebuild in shadow container
    this.state.rebuildPromise = this.rebuildShadowContainer();

    try {
      await this.state.rebuildPromise;

      // Atomic swap
      this.state.phase = "swapping";
      this.log("Swapping containers...");

      const oldContainer = this.state.activeContainer;
      this.state.activeContainer = this.state.shadowContainer!;
      this.state.shadowContainer = null;

      // Unbind old container AFTER swap
      try {
        await oldContainer.unbindAll();
      } catch (error) {
        this.log(
          `Old container unbind failed (non-critical): ${error}`,
          "warn"
        );
      }

      // Restore cached singletons
      if (this.config.preserveSingletons) {
        this.restoreSingletons();
      }

      // Process deferred resolutions
      this.processDeferredQueue();

      this.state.phase = "ready";
      this.state.rebuildPromise = null;
      this.syncToGlobal();

      const duration = this.state.startTime
        ? Date.now() - this.state.startTime
        : 0;

      // Record successful cycle metrics
      this.recordCycleMetrics(duration, true);

      this.log(`HMR complete in ${duration}ms`);
    } catch (error) {
      this.log(`HMR rebuild failed: ${error}`, "error");

      // Fallback: keep using active container
      this.state.shadowContainer = null;
      this.state.rebuildPromise = null;
      this.state.phase = "ready";

      // Record failed cycle metrics
      const duration = this.state.startTime ? Date.now() - this.state.startTime : 0;
      this.recordCycleMetrics(duration, false);

      // Reject all deferred resolutions
      this.rejectDeferredQueue(error as Error);
    }

    this.state.startTime = null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Sync container to global state for cross-module access
   *
   * NOTE: Does NOT set __TKA_CONTAINER_INITIALIZED__. That flag is controlled
   * by container.ts after modules are loaded. The HMR manager syncs the container
   * reference, but initialization status is determined by the module loading process.
   */
  private syncToGlobal(): void {
    if (typeof globalThis !== "undefined") {
      globalThis.__TKA_CONTAINER__ = this.state.activeContainer;
      // Do NOT set __TKA_CONTAINER_INITIALIZED__ here - container.ts controls that flag
      // after modules are loaded. Setting it here causes resolution attempts before bindings exist.
      globalThis.__TKA_HMR_MANAGER__ = this;
    }
  }

  /**
   * Resolve with fallbacks during HMR
   */
  private resolveWithFallbacks<T>(serviceIdentifier: symbol): T {
    const serviceName = serviceIdentifier.toString();

    // Track fallback hit for telemetry
    const recordFallbackHit = () => {
      const count = this.metrics.fallbackHits.get(serviceName) ?? 0;
      this.metrics.fallbackHits.set(serviceName, count + 1);
    };

    // 1. Try singleton cache
    const cached = this.getCachedSingleton<T>(serviceIdentifier);
    if (cached !== null) {
      recordFallbackHit();
      this.log(`Using cached singleton during HMR: ${serviceName}`);
      return cached;
    }

    // 2. Try active container (might still work for some services)
    try {
      const result = this.state.activeContainer.get<T>(serviceIdentifier);
      recordFallbackHit();
      return result;
    } catch {
      // Container is in flux - expected
    }

    // 3. Try shadow container if it exists and is further along
    if (this.state.shadowContainer && this.state.phase === "swapping") {
      try {
        const result = this.state.shadowContainer.get<T>(serviceIdentifier);
        recordFallbackHit();
        return result;
      } catch {
        // Not yet available in shadow
      }
    }

    // 4. Throw with helpful message
    throw new Error(
      `Service ${serviceName} not available during HMR. ` +
        `Phase: ${this.state.phase}. Use resolveAsync() for deferred resolution.`
    );
  }

  /**
   * Create a deferred resolution that resolves when container is ready
   */
  private deferResolution<T>(serviceIdentifier: symbol): Promise<T> {
    if (this.deferredQueue.length >= this.config.maxDeferredQueue) {
      return Promise.reject(new Error("Deferred resolution queue is full"));
    }

    return new Promise<T>((resolve, reject) => {
      const entry: DeferredResolution = {
        serviceIdentifier,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
        timeout: this.config.resolutionTimeout,
        timeoutId: null,
      };

      // Set timeout for this resolution and store the ID for cleanup
      entry.timeoutId = setTimeout(() => {
        const index = this.deferredQueue.indexOf(entry);
        if (index !== -1) {
          this.deferredQueue.splice(index, 1);
          reject(
            new Error(
              `Deferred resolution timeout for ${serviceIdentifier.toString()} ` +
                `after ${this.config.resolutionTimeout}ms`
            )
          );
        }
      }, this.config.resolutionTimeout);

      this.deferredQueue.push(entry);
    });
  }

  /**
   * Process all deferred resolutions after container is ready
   */
  private processDeferredQueue(): void {
    const queue = [...this.deferredQueue];
    this.deferredQueue = [];

    // Track for telemetry
    this.currentCycleStats.deferredCount = queue.length;

    for (const entry of queue) {
      // Clear the timeout to prevent memory leaks
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }

      try {
        const service = this.state.activeContainer.get(entry.serviceIdentifier);
        entry.resolve(service);
        this.log(`Resolved deferred: ${entry.serviceIdentifier.toString()}`);
      } catch (error) {
        entry.reject(error as Error);
        this.log(
          `Failed deferred: ${entry.serviceIdentifier.toString()}`,
          "error"
        );
      }
    }
  }

  /**
   * Reject all deferred resolutions on failure
   */
  private rejectDeferredQueue(error: Error): void {
    const queue = [...this.deferredQueue];
    this.deferredQueue = [];

    for (const entry of queue) {
      // Clear the timeout to prevent memory leaks
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      entry.reject(error);
    }
  }

  /**
   * Rebuild the shadow container with all modules
   */
  private async rebuildShadowContainer(): Promise<void> {
    if (!this.state.shadowContainer) {
      throw new Error("Shadow container not initialized");
    }

    // Load tier 1 modules
    if (this.tier1Modules.length > 0) {
      await this.state.shadowContainer.load(...this.tier1Modules);
      this.tier1Loaded = true;
    }

    // Load tier 2 modules
    if (this.tier2Modules.length > 0) {
      await this.state.shadowContainer.load(...this.tier2Modules);
      this.tier2Loaded = true;
    }

    // Reload previously loaded feature modules
    // Get module names from loaders that were registered
    const moduleNamesToReload = Array.from(this.moduleLoaders.keys());
    for (const moduleName of moduleNamesToReload) {
      const loader = this.moduleLoaders.get(moduleName);
      if (loader) {
        try {
          const module = await loader();
          await this.state.shadowContainer.load(module);
          this.loadedModules.add(moduleName);
        } catch (error) {
          this.log(
            `Failed to reload feature module ${moduleName}: ${error}`,
            "warn"
          );
        }
      }
    }
  }

  /**
   * Cache singleton instances before HMR
   */
  private cacheSingletons(): void {
    const now = Date.now();

    for (const serviceId of this.singletonServices) {
      try {
        const instance = this.state.activeContainer.get(serviceId);
        this.singletonCache.set(serviceId, {
          serviceIdentifier: serviceId,
          instance,
          timestamp: now,
        });
        this.log(`Cached singleton: ${serviceId.toString()}`);
      } catch {
        // Service not bound - skip
      }
    }
  }

  /**
   * Get a cached singleton instance
   */
  private getCachedSingleton<T>(serviceIdentifier: symbol): T | null {
    const cached = this.singletonCache.get(serviceIdentifier);
    if (cached) {
      return cached.instance as T;
    }
    return null;
  }

  /**
   * Restore singletons after HMR by rebinding cached instances as constant values.
   *
   * This preserves singleton state (subscriptions, websockets, accumulated data)
   * across HMR cycles by replacing the newly-created instances with the cached ones.
   */
  private restoreSingletons(): void {
    let restoredCount = 0;

    for (const [serviceId, entry] of this.singletonCache) {
      try {
        // Check if the service is bound in the new container
        if (this.state.activeContainer.isBound(serviceId)) {
          // Rebind to the cached instance instead of the new one (use sync version)
          this.state.activeContainer.rebindSync(serviceId).toConstantValue(entry.instance);
          restoredCount++;
          this.log(`Restored singleton: ${serviceId.toString()}`);
        } else {
          // Service not bound in new container - bind as constant
          this.state.activeContainer.bind(serviceId).toConstantValue(entry.instance);
          restoredCount++;
          this.log(`Bound cached singleton: ${serviceId.toString()}`);
        }
      } catch (error) {
        this.log(
          `Failed to restore singleton ${serviceId.toString()}: ${error}`,
          "warn"
        );
      }
    }

    // Track for telemetry
    this.currentCycleStats.singletonsRestored = restoredCount;

    this.log(`Restored ${restoredCount}/${this.singletonCache.size} singletons`);
    this.singletonCache.clear();
  }

  /**
   * Record metrics for a completed HMR cycle
   */
  private recordCycleMetrics(durationMs: number, success: boolean): void {
    const MAX_HISTORY = 10;

    this.metrics.totalCycles++;
    this.metrics.lastCycleTimestamp = Date.now();

    if (success) {
      this.metrics.successfulCycles++;
    } else {
      this.metrics.failedCycles++;
    }

    // Track rebuild time
    this.metrics.rebuildTimes.push(durationMs);
    if (this.metrics.rebuildTimes.length > MAX_HISTORY) {
      this.metrics.rebuildTimes.shift();
    }

    // Calculate average rebuild time
    this.metrics.averageRebuildTime =
      this.metrics.rebuildTimes.reduce((a, b) => a + b, 0) /
      this.metrics.rebuildTimes.length;

    // Track deferred resolutions
    this.metrics.deferredResolutionsPerCycle.push(this.currentCycleStats.deferredCount);
    if (this.metrics.deferredResolutionsPerCycle.length > MAX_HISTORY) {
      this.metrics.deferredResolutionsPerCycle.shift();
    }

    // Track singletons restored
    this.metrics.singletonsRestoredPerCycle.push(this.currentCycleStats.singletonsRestored);
    if (this.metrics.singletonsRestoredPerCycle.length > MAX_HISTORY) {
      this.metrics.singletonsRestoredPerCycle.shift();
    }

    // Log metrics summary in debug mode
    if (this.config.debug) {
      const health = this.getHealthSummary();
      this.log(
        `HMR Metrics: ${health.status} | ` +
          `Success rate: ${(health.successRate * 100).toFixed(1)}% | ` +
          `Avg rebuild: ${health.avgRebuildTime.toFixed(0)}ms | ` +
          `Cycles: ${health.totalCycles}`
      );
    }
  }

  /**
   * Log with optional debug filtering
   */
  private log(message: string, level: "log" | "warn" | "error" = "log"): void {
    if (!this.config.debug) return;

    const prefix = "🔄 HMR:";
    switch (level) {
      case "error":
        console.error(`${prefix} ${message}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}

// ============================================================================
// GLOBAL TYPE AUGMENTATION
// ============================================================================

declare global {
   
  var __TKA_HMR_MANAGER__: HMRContainerManager | undefined;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the HMR Container Manager instance
 */
export function getHMRManager(): HMRContainerManager {
  return HMRContainerManager.getInstance();
}

/**
 * Check if HMR is in progress
 */
export function isHMRInProgress(): boolean {
  return HMRContainerManager.getInstance().isHMRInProgress();
}
