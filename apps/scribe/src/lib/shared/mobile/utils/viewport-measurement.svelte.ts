/**
 * Viewport Measurement Utility
 *
 * Provides reactive viewport measurement capabilities using ResizeObserver.
 * Determines if compact mode is needed based on available space.
 *
 * This is a Svelte 5 runes-based composable.
 */

import { onMount } from "svelte";

export interface ViewportMeasurementOptions {
  /**
   * Callback fired when measurement completes
   */
  onMeasure?: (needsCompact: boolean) => void;

  /**
   * Delay before initial measurement (ms)
   */
  initialDelay?: number;
}

/**
 * Create a viewport measurement manager
 *
 * @returns An object containing reactive state and measurement functions
 */
export function createViewportMeasurement(
  options: ViewportMeasurementOptions = {}
) {
  const { onMeasure, initialDelay: _initialDelay = 100 } = options;

  let sheetElement = $state<HTMLElement | null>(null);
  let contentElement = $state<HTMLElement | null>(null);
  let needsCompactMode = $state(false);

  /**
   * Measure available space and determine if compact mode is needed
   */
  function measureAndAdapt(): void {
    if (!sheetElement || !contentElement) return;

    try {
      // Get actual viewport height
      const viewportHeight =
        window.visualViewport?.height || window.innerHeight;

      // Calculate fixed elements height (header + footer + handle + padding)
      const headerElement = sheetElement.querySelector(".guide-header");
      const headerHeight =
        (headerElement as HTMLElement | null)?.clientHeight || 70;
      const footerElement = sheetElement.querySelector(".guide-footer");
      const footerHeight =
        (footerElement as HTMLElement | null)?.clientHeight || 70;
      const handleHeight = 25; // Handle + margins

      // Available space for scrollable content
      const available =
        viewportHeight * 0.95 - headerHeight - footerHeight - handleHeight;

      // Measure actual content height
      const scrollHeight = contentElement.scrollHeight;

      // Determine if we need compact mode
      const needsCompact = scrollHeight > available;
      needsCompactMode = needsCompact;

      // Call the callback if provided
      if (onMeasure) {
        onMeasure(needsCompact);
      }
    } catch (error) {
      // Silently fail if measurement doesn't work
      console.warn("Viewport measurement failed:", error);
    }
  }

  /**
   * Initialize measurement and set up ResizeObserver
   */
  onMount(() => {
    // Use double RAF for reliable post-render measurement
    // This avoids console violations and ensures DOM is fully rendered
    let rafId2: number;
    let resizeObserver: ResizeObserver | null = null;

    const rafId = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        measureAndAdapt();

        // Set up resize observer for continuous adaptation
        resizeObserver = new ResizeObserver(() => {
          measureAndAdapt();
        });

        if (sheetElement) {
          resizeObserver.observe(sheetElement);
        }
      });
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (resizeObserver) resizeObserver.disconnect();
    };
  });

  return {
    /**
     * Bind this to the sheet container element
     */
    get sheetElement() {
      return sheetElement;
    },
    set sheetElement(value: HTMLElement | null) {
      sheetElement = value;
    },

    /**
     * Bind this to the scrollable content element
     */
    get contentElement() {
      return contentElement;
    },
    set contentElement(value: HTMLElement | null) {
      contentElement = value;
    },

    /**
     * Whether compact mode is needed
     */
    get needsCompactMode() {
      return needsCompactMode;
    },

    /**
     * Manually trigger measurement (useful after content changes)
     */
    measure: measureAndAdapt,
  };
}
