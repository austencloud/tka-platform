/**
 * LayoutState
 * Domain: Application Layout State
 *
 * Responsibilities:
 * - Manage layout measurements (heights, widths)
 * - Track layout orientations (landscape/portrait)
 * - Provide layout state to components
 */

// Reactive state object using Svelte 5 $state rune
export const layoutState = $state({
  // MobileNavigation height - measured dynamically by MobileNavigation component
  primaryNavHeight: 64, // Default fallback

  // Navigation layout state - updated by MobileNavigation
  isPrimaryNavLandscape: false,

  // Panel accessibility state - updated by Create Module
  // Note: Edit and Export are panels, not tabs
  canAccessEditAndExportPanels: false,

  // Current word state - updated by Create Module
  currentCreateWord: "",

  // Current learn header - updated by LearnTab
  currentLearnHeader: "",

  // Side-by-side layout detection - true when viewport is wide enough for desktop layout
  // Updated by MainInterface component based on container width
  isSideBySideLayout: false,

  // Viewport width - updated by MainInterface resize listener
  // Used by moduleSections() to reactively filter device-inappropriate tabs
  viewportWidth: typeof window !== "undefined" ? window.innerWidth : 1024,
});

// Helper functions
export function setPrimaryNavHeight(height: number) {
  layoutState.primaryNavHeight = height;
}

export function setPrimaryNavLandscape(isLandscape: boolean) {
  layoutState.isPrimaryNavLandscape = isLandscape;
}

export function setTabAccessibility(canAccess: boolean) {
  layoutState.canAccessEditAndExportPanels = canAccess;
}

export function setCurrentWord(word: string) {
  layoutState.currentCreateWord = word;
}

export function setLearnHeader(header: string) {
  layoutState.currentLearnHeader = header;
}

export function setSideBySideLayout(isSideBySide: boolean) {
  layoutState.isSideBySideLayout = isSideBySide;
}

export function setViewportWidth(width: number) {
  layoutState.viewportWidth = width;
}

/**
 * Modules that explicitly opt OUT of bottom navigation.
 *
 * ARCHITECTURE DECISION (2026-01-04):
 * We use a BLOCKLIST (opt-out) instead of an ALLOWLIST (opt-in).
 * This means new modules automatically get navigation - no action needed.
 *
 * Only add a module here if it has a specific reason to hide navigation.
 * Currently empty because all modules need the module switcher button on mobile.
 */
const MODULES_WITHOUT_NAV: Set<string> = new Set([
  // Museum is a full-screen immersive experience — no nav chrome
  "museum",
]);

/**
 * Check if module should show primary navigation (bottom nav on mobile).
 *
 * Returns TRUE by default for all modules.
 * The bottom nav contains the module switcher button - without it,
 * mobile users have no way to navigate away from the current module.
 */
export function moduleHasPrimaryNav(moduleId: string): boolean {
  return !MODULES_WITHOUT_NAV.has(moduleId);
}
