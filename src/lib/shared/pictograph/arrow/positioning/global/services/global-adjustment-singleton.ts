/**
 * Global Arrow Adjustment Singleton
 *
 * Provides a singleton instance of the GlobalArrowAdjustmentRepository
 * that can be initialized after Firebase auth is ready.
 *
 * This pattern allows the repository to be accessed by services
 * like SpecialPlacer without requiring DI container reconstruction.
 */

import { GlobalArrowAdjustmentRepository } from "./global-arrow-adjustment-repository";
import { GlobalArrowAdjustmentPersister } from "./global-arrow-adjustment-persister";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("GlobalAdjustmentSingleton");

let repositoryInstance: GlobalArrowAdjustmentRepository | null = null;
let initializationPromise: Promise<void> | null = null;

let globalReadDisabled = false;
export function setGlobalReadDisabled(v: boolean): void { globalReadDisabled = v; }
export function isGlobalReadDisabled(): boolean { return globalReadDisabled; }

/**
 * Get the global adjustment repository instance.
 * Returns null if not initialized yet.
 */
export function getGlobalAdjustmentRepository(): GlobalArrowAdjustmentRepository | null {
  return repositoryInstance;
}

/**
 * Initialize the global adjustment system.
 * Should be called after Firebase auth is ready.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export async function initializeGlobalAdjustments(): Promise<void> {
  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return immediately if already initialized
  if (repositoryInstance?.isInitialized) {
    return;
  }

  initializationPromise = doInitialize();
  return initializationPromise;
}

async function doInitialize(): Promise<void> {
  try {
    logger.info("Initializing global arrow adjustment system...");

    // Create persister and repository
    const persister = new GlobalArrowAdjustmentPersister();
    const repository = new GlobalArrowAdjustmentRepository(persister);

    // Initialize (loads from Firestore and starts subscription)
    await repository.initialize();

    // Store singleton
    repositoryInstance = repository;

    logger.success(
      `Global arrow adjustment system initialized with ${repository.isInitialized ? "success" : "failure"}`
    );
  } catch (error) {
    logger.error("Failed to initialize global adjustments:", error);
    // Don't throw - the system should continue without global adjustments
  } finally {
    initializationPromise = null;
  }
}

/**
 * Dispose of the global adjustment system.
 * Call this on app shutdown or when the user signs out.
 */
export function disposeGlobalAdjustments(): void {
  if (repositoryInstance) {
    repositoryInstance.dispose();
    repositoryInstance = null;
    logger.info("Global arrow adjustment system disposed");
  }
}
