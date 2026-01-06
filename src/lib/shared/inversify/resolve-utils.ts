/**
 * Minimal resolution utilities for services registered in the DI container.
 *
 * IMPORTANT: This file must NOT import from di.ts or container.ts to avoid
 * circular dependencies. Services that are registered in the DI container
 * (via modules like core.module.ts) should use these utilities instead of
 * importing from di.ts.
 *
 * The dependency chain is:
 *   di.ts → container.ts → modules → services
 *
 * Services cannot import from di.ts because that would create:
 *   di.ts → container.ts → modules → services → di.ts (CYCLE!)
 *
 * This file breaks the cycle by accessing globalThis directly.
 */

import type { Container } from "inversify";
import type { HMRContainerManager } from "./hmr/HMRContainerManager";

// Re-declare globals (type-only, no runtime import)
declare global {
   
  var __TKA_CONTAINER__: Container | undefined;
   
  var __TKA_HMR_MANAGER__: HMRContainerManager | undefined;
}

/**
 * Try to resolve a service - returns null instead of throwing.
 * Safe to use in services registered in the DI container.
 *
 * Use this instead of importing tryResolve from di.ts when your file
 * is imported by a DI module (core.module.ts, etc.).
 */
export function tryResolve<T>(serviceIdentifier: symbol): T | null {
  if (typeof window === "undefined") return null;

  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  if (hmrManager) {
    return hmrManager.tryResolve<T>(serviceIdentifier);
  }

  const container = globalThis.__TKA_CONTAINER__;
  if (!container) return null;

  try {
    return container.get<T>(serviceIdentifier);
  } catch {
    return null;
  }
}

/**
 * Resolve a service - throws if not found.
 * Safe to use in services registered in the DI container.
 */
export function resolve<T>(serviceIdentifier: symbol): T {
  if (typeof window === "undefined") {
    throw new Error(
      `Cannot resolve service ${String(serviceIdentifier)} during SSR.`
    );
  }

  const hmrManager = globalThis.__TKA_HMR_MANAGER__;
  if (hmrManager) {
    return hmrManager.resolve<T>(serviceIdentifier);
  }

  const container = globalThis.__TKA_CONTAINER__;
  if (!container) {
    throw new Error(
      `Container not initialized. Service: ${String(serviceIdentifier)}`
    );
  }

  return container.get<T>(serviceIdentifier);
}

/**
 * Check if the container is ready for resolution.
 */
export function isContainerReady(): boolean {
  return globalThis.__TKA_CONTAINER__ !== undefined;
}

/**
 * Wait for the container to be initialized.
 * Polls globalThis until the container is available.
 */
export async function waitForContainer(
  timeoutMs: number = 10000
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cannot wait for container during SSR.");
  }

  const startTime = Date.now();

  while (!isContainerReady()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Container initialization timeout after ${timeoutMs}ms. ` +
          "Ensure the application initializes the DI container."
      );
    }
    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
