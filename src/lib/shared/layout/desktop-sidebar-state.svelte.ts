/**
 * Desktop Sidebar State
 * Domain: Desktop Navigation Sidebar
 *
 * Responsibilities:
 * - Track desktop sidebar visibility
 * - Manage sidebar dimensions
 * - Determine when sidebar should be shown (desktop + side-by-side layout)
 */

// Reactive state object using Svelte 5 $state rune
export const desktopSidebarState = $state({
  // Sidebar visibility - controlled by viewport and layout conditions
  isVisible: false,

  // Module-level suppression - when true, sidebar stays hidden regardless of viewport
  forcedHidden: false,

  // Sidebar collapsed state - toggled by user
  isCollapsed: false,

  // Sidebar widths. `width` is the RESERVED layout width — the space content
  // permanently cedes to the sidebar (64 rail / 220 pinned). Hover-expansion
  // is a purely visual overlay inside DesktopNavigationSidebar and NEVER
  // changes this value. All --desktop-sidebar-width consumers (MainInterface
  // padding, drawer left edges, TabIntro, BrowseModule) align to this
  // reserved edge by design.
  expandedWidth: 220, // Pinned sidebar width
  collapsedWidth: 64, // Rail width (icon-only)
  width: 220, // Current RESERVED width (computed from collapsed state)

  // Track if conditions are met for showing sidebar
  isDesktopDevice: false,
  isSideBySideLayout: false,
});

// Helper functions
export function setDesktopSidebarVisible(visible: boolean): void {
  desktopSidebarState.isVisible = visible;
}

/** Modules that need full-screen (museum) call this to suppress the sidebar
 *  even when viewport recalculations fire. */
export function setDesktopSidebarForcedHidden(hidden: boolean): void {
  desktopSidebarState.forcedHidden = hidden;
  if (hidden) {
    desktopSidebarState.isVisible = false;
  } else {
    // Recalculate visibility based on current viewport conditions
    const shouldShow = shouldShowDesktopSidebar(
      desktopSidebarState.isDesktopDevice,
      typeof window !== 'undefined' ? window.innerWidth : 0,
      desktopSidebarState.isSideBySideLayout,
    );
    desktopSidebarState.isVisible = shouldShow;
  }
}

export function setDesktopSidebarCollapsed(collapsed: boolean): void {
  desktopSidebarState.isCollapsed = collapsed;
  // Update current width based on collapsed state
  desktopSidebarState.width = collapsed
    ? desktopSidebarState.collapsedWidth
    : desktopSidebarState.expandedWidth;
}

export function toggleDesktopSidebarCollapsed(): void {
  setDesktopSidebarCollapsed(!desktopSidebarState.isCollapsed);
}

export function setIsDesktopDevice(isDesktop: boolean): void {
  desktopSidebarState.isDesktopDevice = isDesktop;
}

export function setIsSideBySideLayout(isSideBySide: boolean): void {
  desktopSidebarState.isSideBySideLayout = isSideBySide;
}

/**
 * Determine if desktop sidebar should be visible
 * Only show on desktop devices in side-by-side layout with sufficient width
 */
export function shouldShowDesktopSidebar(
  isDesktop: boolean,
  viewportWidth: number,
  isSideBySideLayout: boolean
): boolean {
  const MINIMUM_WIDTH_FOR_SIDEBAR = 1280; // Require wider viewport to avoid cramming
  return (
    isDesktop &&
    viewportWidth >= MINIMUM_WIDTH_FOR_SIDEBAR &&
    isSideBySideLayout
  );
}

/**
 * Update sidebar visibility based on current conditions
 */
export function updateDesktopSidebarVisibility(
  isDesktop: boolean,
  viewportWidth: number,
  isSideBySideLayout: boolean
): void {
  const shouldShow = desktopSidebarState.forcedHidden
    ? false
    : shouldShowDesktopSidebar(isDesktop, viewportWidth, isSideBySideLayout);
  setDesktopSidebarVisible(shouldShow);
  setIsDesktopDevice(isDesktop);
  setIsSideBySideLayout(isSideBySideLayout);
}

/**
 * LocalStorage persistence for collapsed state
 */
const STORAGE_KEY = "tka-desktop-sidebar-collapsed";

export function loadDesktopSidebarCollapsedState(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // No stored preference → rail mode (collapsed) is the default: content
    // keeps max width and the rail hover-expands as an overlay. Users who
    // explicitly pinned the sidebar open (stored "false") keep push layout.
    return stored === null ? true : stored === "true";
  } catch (error) {
    console.warn("Failed to load desktop sidebar collapsed state:", error);
    return true;
  }
}

export function saveDesktopSidebarCollapsedState(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.toString());
  } catch (error) {
    console.warn("Failed to save desktop sidebar collapsed state:", error);
  }
}

/**
 * Initialize desktop sidebar collapsed state from localStorage
 */
export function initializeDesktopSidebarCollapsedState(): void {
  const collapsed = loadDesktopSidebarCollapsedState();
  setDesktopSidebarCollapsed(collapsed);
}
