/**
 * HMR-Safe Service Resolution Utility
 *
 * @deprecated This utility was designed for inversify symbol-based resolution.
 * With the ITI container migration, services are accessed via property names:
 *   container.items.serviceName
 *
 * This file is kept for reference but should not be used.
 * For ITI, services are available synchronously and don't need retry logic.
 *
 * Migration example:
 *   // Old (inversify):
 *   const shareService = createServiceResolver<ISharer>(TYPES.ISharer);
 *   if (shareService.value) shareService.value.doSomething();
 *
 *   // New (ITI):
 *   import { container } from "$lib/shared/di";
 *   const shareService = container.items.sharer;
 *   shareService.doSomething();
 */

/**
 * Service resolver state for a specific service type
 * @deprecated Use container.items.serviceName instead
 */
interface ServiceResolver<T> {
  readonly value: T | null;
  readonly isResolving: boolean;
  readonly error: Error | null;
  resolve(): void;
}

/**
 * @deprecated This function is not compatible with ITI container.
 * Use container.items.serviceName directly instead.
 *
 * With ITI, services are synchronously available and don't need retry logic.
 */
export function createServiceResolver<T>(
  _serviceSymbol: symbol,
  _options: {
    maxRetries?: number;
    retryDelay?: number;
    autoResolve?: boolean;
  } = {}
): ServiceResolver<T> {
  throw new Error(
    "createServiceResolver is deprecated. Use container.items.serviceName instead. " +
      "See src/lib/shared/utils/service-resolver.svelte.ts for migration guide."
  );
}

/**
 * @deprecated This function is not compatible with ITI container.
 * Access services directly via container.items instead.
 */
export function createServiceResolvers<T extends Record<string, symbol>>(
  _serviceMap: T,
  _options?: Parameters<typeof createServiceResolver>[1]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { [K in keyof T]: ServiceResolver<any> } {
  throw new Error(
    "createServiceResolvers is deprecated. Use container.items.serviceName instead."
  );
}

/**
 * @deprecated Not needed with ITI - services are always synchronously available.
 */
export function allServicesReady(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _resolvers: Record<string, ServiceResolver<any>>
): boolean {
  throw new Error(
    "allServicesReady is deprecated. ITI services are always synchronously available."
  );
}

/**
 * @deprecated Not needed with ITI - services don't have resolution errors.
 */
export function getServiceErrors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _resolvers: Record<string, ServiceResolver<any>>
): Error[] {
  throw new Error(
    "getServiceErrors is deprecated. ITI services are always synchronously available."
  );
}
