/**
 * Lazy Container Utility
 *
 * Creates lazily-initialized container getters that:
 * 1. Defer instantiation until first access (improves startup time)
 * 2. Cache the instance after creation (singleton behavior)
 * 3. Break the HMR invalidation chain (editing a service doesn't invalidate the composition root)
 *
 * Usage:
 * ```typescript
 * const getCreateContainer = createLazyContainer(() => createCreateContainer(getDeps()));
 * // Later:
 * const service = getCreateContainer().items.myService;
 * ```
 */

type ContainerFactory<T> = () => T;

interface LazyContainer<T> {
	(): T;
	reset: () => void;
	isInitialized: () => boolean;
}

/**
 * Creates a lazy container getter with caching.
 *
 * @param factory - Function that creates the container (called only once, on first access)
 * @returns A getter function that returns the cached container instance
 */
export function createLazyContainer<T>(factory: ContainerFactory<T>): LazyContainer<T> {
	let instance: T | null = null;

	const getter = (() => {
		if (instance === null) {
			instance = factory();
		}
		return instance;
	}) as LazyContainer<T>;

	// For testing: allows resetting the cached instance
	getter.reset = () => {
		instance = null;
	};

	// For debugging: check if container has been initialized
	getter.isInitialized = () => instance !== null;

	return getter;
}

/**
 * Creates a lazy container getter that only initializes in browser context.
 * Returns null during SSR.
 *
 * @param factory - Function that creates the container
 * @returns A getter function that returns the container or null during SSR
 */
export function createBrowserOnlyLazyContainer<T>(
	factory: ContainerFactory<T>
): LazyContainer<T | null> {
	let instance: T | null = null;

	const getter = (() => {
		if (typeof window === 'undefined') {
			return null;
		}
		if (instance === null) {
			instance = factory();
		}
		return instance;
	}) as LazyContainer<T | null>;

	getter.reset = () => {
		instance = null;
	};

	getter.isInitialized = () => instance !== null;

	return getter;
}
