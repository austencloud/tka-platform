/**
 * LOOPLayoutDetector
 *
 * Determines the optimal layout for the LOOP selection modal based on viewport dimensions.
 * Follows the same pattern as PhotoPickerLayoutDetector.
 *
 * Layout hierarchy:
 * 1. 4K/Ultrawide (≥1400px wide, ≥700px tall) -> Side-by-side modal
 * 2. Desktop (≥768px wide, ≥500px tall) -> Tabbed modal
 * 3. Mobile (≥400px wide) -> Drawer with compact UI
 * 4. Tiny mobile (<400px wide) -> Wizard (step-by-step)
 */

import type {
  LOOPLayoutConfig,
  LOOPSelectionLayout,
} from "../../domain/models/loop-selection-types";

/**
 * Layout breakpoints with documented rationale
 */
export const LOOP_LAYOUT_BREAKPOINTS = {
  /**
   * Width threshold for modal vs drawer.
   * 768px is the standard tablet/desktop breakpoint.
   */
  DESKTOP_WIDTH: 768,

  /**
   * Minimum height for any modal layout.
   * Below this, content won't fit comfortably - use drawer instead.
   */
  MIN_MODAL_HEIGHT: 500,

  /**
   * Width threshold for 4K/ultrawide classification.
   * At this width, we have room for side-by-side panels.
   */
  ULTRAWIDE_WIDTH: 1400,

  /**
   * Minimum height for side-by-side layout.
   * Both panels need vertical space to show all controls.
   */
  SIDE_BY_SIDE_MIN_HEIGHT: 700,

  /**
   * Width threshold for wizard mode.
   * Below this, the standard UI doesn't fit - use step-by-step wizard.
   */
  COMPACT_WIDTH: 400,
} as const;

/**
 * Detects the optimal layout configuration for the LOOP selection modal.
 *
 * @param viewportWidth - Current viewport width in pixels
 * @param viewportHeight - Current viewport height in pixels
 * @returns Layout configuration object
 */
export function detectLOOPLayout(
  viewportWidth: number,
  viewportHeight: number
): LOOPLayoutConfig {
  // Desktop shows modal, mobile shows drawer
  const isDesktop =
    viewportWidth >= LOOP_LAYOUT_BREAKPOINTS.DESKTOP_WIDTH &&
    viewportHeight >= LOOP_LAYOUT_BREAKPOINTS.MIN_MODAL_HEIGHT;

  // Side-by-side requires ultrawide AND enough height
  const useSideBySide =
    isDesktop &&
    viewportWidth >= LOOP_LAYOUT_BREAKPOINTS.ULTRAWIDE_WIDTH &&
    viewportHeight >= LOOP_LAYOUT_BREAKPOINTS.SIDE_BY_SIDE_MIN_HEIGHT;

  // Wizard mode for very small screens
  const useWizardMode = viewportWidth < LOOP_LAYOUT_BREAKPOINTS.COMPACT_WIDTH;

  // Resolve the layout type
  let layout: LOOPSelectionLayout;
  if (useWizardMode) {
    layout = "wizard";
  } else if (isDesktop) {
    layout = useSideBySide ? "side-by-side" : "tabbed";
  } else {
    layout = "drawer";
  }

  return {
    isDesktop,
    useSideBySide,
    useWizardMode,
    layout,
  };
}

/**
 * Pure function to determine if we're in a narrow viewport
 * Useful for adjusting content within components
 */
export function isNarrowViewport(viewportWidth: number): boolean {
  return viewportWidth < LOOP_LAYOUT_BREAKPOINTS.COMPACT_WIDTH;
}

/**
 * Pure function to determine if we're in an ultrawide viewport
 * Useful for enabling enhanced features
 */
export function isUltrawideViewport(viewportWidth: number): boolean {
  return viewportWidth >= LOOP_LAYOUT_BREAKPOINTS.ULTRAWIDE_WIDTH;
}
