/**
 * InversifyJS Application Bootstrap
 *
 * This file handles the initialization of the InversifyJS container
 * and replaces the complex bootstrap.ts from the old DI system.
 */

import "reflect-metadata";

/**
 * Initialize the InversifyJS container and all services
 * This replaces the createWebApplication() function from the old bootstrap
 */
export function initializeInversifyContainer(): void {
  try {
    // TODO: Load service modules here as they are converted
    // Example:
    // loadCoreServices();
    // loadRenderingServices();
    // loadPositioningServices();
  } catch (error) {
    throw error;
  }
}

// Export container and types for convenience
// NOTE: These re-exports are through di.ts to enable lazy loading
export { container, resolve, TYPES } from "./di";
