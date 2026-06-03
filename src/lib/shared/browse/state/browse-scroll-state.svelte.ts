/**
 * BrowseScrollState.svelte.ts
 *
 * Manages the reactive state for UI visibility in the Browser module
 * based on scroll behavior. Controls visibility of:
 * - TopBar (header)
 * - DesktopNavigationSidebar (bottom navigation)
 * - Filtering controls (top section in Browser)
 *
 * Inspired by TabScroll's LayoutState pattern.
 */

export class BrowseScrollState {
  // UI visibility state
  isUIVisible = $state(true);

  // Last scroll position tracking
  lastScrollY = $state(0);

  /**
   * Show all UI elements (TopBar, Navigation, Filters)
   */
  showUI() {
    this.isUIVisible = true;
  }

  /**
   * Hide all UI elements (TopBar, Navigation, Filters)
   */
  hideUI() {
    this.isUIVisible = false;
  }

  /**
   * Update the last scroll position
   */
  updateScrollPosition(scrollY: number) {
    this.lastScrollY = scrollY;
  }

  /**
   * Force UI to be visible (used for navigation events)
   */
  forceShowUI() {
    this.isUIVisible = true;
  }

  /**
   * Force UI to be hidden (used for fullscreen modes)
   */
  forceHideUI() {
    this.isUIVisible = false;
  }
}

/**
 * Singleton instance for global Browser scroll state
 */
export const browseScrollState = new BrowseScrollState();
