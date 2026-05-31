/**
 * Special Arrow Placement Override Singleton
 *
 * Provides a singleton instance of the SpecialArrowPlacementRepository
 * that can be initialized after Firebase auth is ready.
 *
 * Mirrors the pattern used by global-adjustment-singleton.ts.
 */

import type { SpecialArrowPlacementRepository } from "./special-arrow-placement-repository";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("SpecialOverrideSingleton");

let repositoryInstance: SpecialArrowPlacementRepository | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Get the special placement override repository instance.
 * Returns null if not initialized yet.
 */
export function getSpecialOverrideRepository(): SpecialArrowPlacementRepository | null {
  return repositoryInstance;
}

/**
 * Initialize the special placement override system.
 * Should be called after Firebase auth is ready.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export async function initializeSpecialOverrides(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  if (repositoryInstance?.isInitialized) return;
  initializationPromise = doInitialize();
  return initializationPromise;
}

async function doInitialize(): Promise<void> {
  try {
    logger.info("Initializing special placement override system...");
    const { SpecialArrowPlacementPersister } = await import("./special-arrow-placement-persister");
    const { SpecialArrowPlacementRepository } = await import("./special-arrow-placement-repository");
    const persister = new SpecialArrowPlacementPersister();
    const repository = new SpecialArrowPlacementRepository(persister);
    await repository.initialize();
    repositoryInstance = repository;
    logger.success("Special placement override system initialized");
  } catch (error) {
    logger.error("Failed to initialize special overrides:", error);
    // Don't throw - system should continue without special overrides
  } finally {
    initializationPromise = null;
  }
}

/**
 * Dispose of the special placement override system.
 * Call this on app shutdown or when the user signs out.
 */
export function disposeSpecialOverrides(): void {
  if (repositoryInstance) {
    repositoryInstance.dispose();
    repositoryInstance = null;
    logger.info("Special placement override system disposed");
  }
}
