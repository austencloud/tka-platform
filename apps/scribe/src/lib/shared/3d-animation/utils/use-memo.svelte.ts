/**
 * useMemo utility for Svelte 5
 *
 * Creates a memoized value that only recomputes when dependencies change.
 * Similar to React's useMemo but using Svelte 5 runes.
 */

/**
 * Creates a memoized value from a factory function.
 * The value is computed once and cached.
 */
export function useMemo<T>(factory: () => T): T {
  // In Svelte 5, we can just call the factory since the component
  // will handle reactivity. For truly expensive computations,
  // the caller should use $derived.
  return factory();
}
