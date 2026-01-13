/**
 * Svelte 5 Runes Mock for Node.js
 *
 * Provides minimal implementations of Svelte 5 runes so that .svelte.ts files
 * can be imported in Node.js contexts without compilation errors.
 *
 * These are non-reactive in Node.js - they just return the initial value.
 */

// Mock $state rune - returns a plain variable
(globalThis as any).$state = function <T>(initial: T): T {
  return initial;
};

// Mock $derived rune - just returns the value/computed value once
(globalThis as any).$derived = function <T>(fnOrValue: (() => T) | T): T {
  if (typeof fnOrValue === 'function') {
    return (fnOrValue as () => T)();
  }
  return fnOrValue;
};

// Mock $effect rune - runs the effect once immediately
(globalThis as any).$effect = function (fn: () => void | (() => void)): void {
  fn(); // Run once, ignore cleanup
};

// Mock $effect.root - creates an effect root
(globalThis as any).$effect.root = function (fn: () => void | (() => void)): () => void {
  fn(); // Run once
  return () => {}; // Return empty cleanup function
};

// Mock $props rune - returns the props object
(globalThis as any).$props = function <T>(): T {
  return {} as T;
};

// Mock $bindable rune - returns the initial value
(globalThis as any).$bindable = function <T>(initial: T): T {
  return initial;
};

// Polyfill import.meta.env for Vite environment variables
if (typeof import.meta.env === 'undefined') {
  (import.meta as any).env = {
    DEV: false,
    PROD: true,
    MODE: 'production',
    SSR: false,
  };
}

// Stub out require() for ES modules (used by some services for dynamic imports)
if (typeof (globalThis as any).require === 'undefined') {
  (globalThis as any).require = function(modulePath: string) {
    throw new Error(`require() not available in Node.js ES modules context for: ${modulePath}`);
  };
}
