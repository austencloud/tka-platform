/**
 * Safe Binding Helper for HMR
 *
 * Prevents duplicate bindings during hot module replacement by using
 * Inversify 7's rebind functionality which automatically unbinds before binding.
 *
 * This is the PERMANENT FIX for the "Ambiguous bindings" error that
 * occurs during HMR when modules are re-evaluated.
 */

import type { ContainerModuleLoadOptions, ServiceIdentifier } from "inversify";

/**
 * Create an HMR-safe binder that uses rebindSync instead of bind.
 *
 * - On first load: behaves like bind() (no existing binding to replace)
 * - On HMR reload: uses rebindSync() to replace existing binding (no duplicates)
 *
 * This is the PERMANENT FIX for the "Ambiguous bindings" error that occurs
 * during HMR when modules are re-evaluated.
 *
 * Usage in module:
 * ```typescript
 * export const myModule = new ContainerModule((options) => {
 *   const bind = createHMRSafeBinder(options);
 *   bind(TYPES.IMyService).to(MyService).inSingletonScope();
 * });
 * ```
 */
export function createHMRSafeBinder(options: ContainerModuleLoadOptions) {
  return function hmrSafeBind<T>(serviceIdentifier: ServiceIdentifier<T>) {
    // Check if already bound using the options.isBound method
    if (options.isBound(serviceIdentifier)) {
      // Use rebindSync to synchronously replace the existing binding
      return options.rebindSync<T>(serviceIdentifier);
    }
    // First time binding - use normal bind
    return options.bind<T>(serviceIdentifier);
  };
}

// Alias for backward compatibility
export const createSafeBinder = createHMRSafeBinder;

/**
 * Check if a service is already bound in the global container.
 * Useful for conditional binding logic outside of modules.
 */
export function isAlreadyBound(serviceIdentifier: symbol): boolean {
  const container = globalThis.__TKA_CONTAINER__;
  if (!container) return false;
  return container.isBound(serviceIdentifier);
}
