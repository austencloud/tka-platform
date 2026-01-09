/**
 * Background Builder State
 *
 * Manages tab persistence for the background builder module.
 * Follows the same pattern as settings-module-state.svelte.ts.
 */

const STORAGE_KEY = "tka-background-builder-active-tab";

export type BackgroundBuilderTab =
  | "deep-ocean"
  | "night-sky"
  | "firefly-forest"
  | "gradient";

const VALID_TABS: BackgroundBuilderTab[] = ["deep-ocean", "night-sky", "firefly-forest", "gradient"];
const DEFAULT_TAB: BackgroundBuilderTab = "deep-ocean";

function isValidTab(value: string): value is BackgroundBuilderTab {
  return VALID_TABS.includes(value as BackgroundBuilderTab);
}

function loadFromStorage(): BackgroundBuilderTab {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isValidTab(stored) ? stored : DEFAULT_TAB;
}

function saveToStorage(tab: BackgroundBuilderTab): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, tab);
}

// Reactive state
let currentTab = $state<BackgroundBuilderTab>(loadFromStorage());

export const backgroundBuilderState = {
  get currentTab() {
    return currentTab;
  },

  setCurrentTab(tab: BackgroundBuilderTab) {
    currentTab = tab;
    saveToStorage(tab);
  },

  reset() {
    currentTab = DEFAULT_TAB;
    saveToStorage(DEFAULT_TAB);
  },
};
