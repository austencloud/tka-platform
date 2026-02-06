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

  // Sidebar collapsed state - toggled by user
  isCollapsed: false,

  // Sidebar widths
  expandedWidth: 220, // Full sidebar width (reduced for minimal footprint)
  collapsedWidth: 64, // Collapsed sidebar width (icon-only)
  width: 220, // Current width (computed based on collapsed state)

  // Track if conditions are met for showing sidebar
  isDesktopDevice: false,
  isSideBySideLayout: false,
});

// Helper functions
export function setDesktopSidebarVisible(visible: boolean) {
  desktopSidebarState.isVisible = visible;
}

export function setDesktopSidebarWidth(width: number) {
  desktopSidebarState.width = width;
}

export function setDesktopSidebarCollapsed(collapsed: boolean) {
  desktopSidebarState.isCollapsed = collapsed;
  // Update current width based on collapsed state
  desktopSidebarState.width = collapsed
    ? desktopSidebarState.collapsedWidth
    : desktopSidebarState.expandedWidth;
}

export function toggleDesktopSidebarCollapsed() {
  setDesktopSidebarCollapsed(!desktopSidebarState.isCollapsed);
}

export function setIsDesktopDevice(isDesktop: boolean) {
  desktopSidebarState.isDesktopDevice = isDesktop;
}

export function setIsSideBySideLayout(isSideBySide: boolean) {
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
) {
  const shouldShow = shouldShowDesktopSidebar(
    isDesktop,
    viewportWidth,
    isSideBySideLayout
  );
  setDesktopSidebarVisible(shouldShow);
  setIsDesktopDevice(isDesktop);
  setIsSideBySideLayout(isSideBySideLayout);
}

/**
 * LocalStorage persistence for collapsed state
 */
const STORAGE_KEY = "tka-desktop-sidebar-collapsed";

export function loadDesktopSidebarCollapsedState(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  } catch (error) {
    console.warn("Failed to load desktop sidebar collapsed state:", error);
    return false;
  }
}

export function saveDesktopSidebarCollapsedState(collapsed: boolean) {
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
export function initializeDesktopSidebarCollapsedState() {
  const collapsed = loadDesktopSidebarCollapsedState();
  setDesktopSidebarCollapsed(collapsed);
}
