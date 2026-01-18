/**
 * Locale State - Backwards Compatibility Layer
 *
 * Re-exports from the main i18n module for existing code that imports from here.
 * New code should import directly from i18n.svelte.ts
 */

import {
  getLocale,
  setLocale,
  initI18n,
  getLocaleDirection,
  type Locale,
} from "./i18n.svelte.js";

/**
 * @deprecated Use getLocale() from i18n.svelte.ts instead
 */
export function getReactiveLocale(): string {
  return getLocale();
}

/**
 * @deprecated Use setLocale() from i18n.svelte.ts instead
 */
export function switchLocale(locale: string): void {
  setLocale(locale as Locale);
}

/**
 * @deprecated Use initI18n() from i18n.svelte.ts instead
 */
export function initLocaleState(): void {
  initI18n();
}

// Re-export for any other usages
export { getLocale, setLocale, initI18n, getLocaleDirection, type Locale };
