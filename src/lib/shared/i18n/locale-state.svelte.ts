/**
 * Reactive Locale State
 *
 * Provides a reactive wrapper around Paraglide's locale system.
 * Allows UI to update instantly when language changes without page reload.
 */

import {
  getLocale,
  setLocale as paraglideSetLocale,
  type Locale,
} from "$lib/paraglide/runtime.js";

// Reactive locale state - triggers Svelte re-renders when changed
let currentLocale = $state<string>(getLocale());

/**
 * Get the current locale reactively.
 * Components using this will re-render when locale changes.
 */
export function getReactiveLocale(): string {
  return currentLocale;
}

/**
 * Switch to a new locale without page reload.
 * Updates both Paraglide's internal state and triggers Svelte reactivity.
 */
export function switchLocale(locale: string): void {
  // Update Paraglide's locale (persists to cookie/localStorage)
  // Pass reload: false to prevent page refresh
  paraglideSetLocale(locale as Locale, { reload: false });

  // Trigger Svelte reactivity by updating our state
  currentLocale = locale;
}

/**
 * Initialize locale state on app startup.
 * Call this once in your root layout to sync with persisted locale.
 */
export function initLocaleState(): void {
  currentLocale = getLocale();
}
