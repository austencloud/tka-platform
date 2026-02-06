/**
 * Panel Height Tracker
 *
 * Consolidates panel height tracking effects using ResizeObserver.
 * Tracks tool panel and button panel heights for accurate positioning.
 *
 * Domain: Create module - Panel Height Management
 */

import type { PanelCoordinationState } from "../panel-coordination-state.svelte";

export interface PanelHeightTrackerConfig {
  toolPanelElement: HTMLElement | null;
  buttonPanelElement: HTMLElement | null;
  panelState: PanelCoordinationState;
}

/**
 * Creates panel height tracking effects
 * @returns Cleanup function
 */
export function createPanelHeightTracker(
  config: PanelHeightTrackerConfig
): () => void {
  const { toolPanelElement, buttonPanelElement, panelState } = config;

  const cleanups: (() => void)[] = [];
  const rootElement =
    typeof document !== "undefined" ? document.documentElement : null;

  const clearCreatePanelMetrics = () => {
    if (!rootElement) {
      return;
    }
    rootElement.style.removeProperty("--create-panel-left");
    rootElement.style.removeProperty("--create-panel-inset-right");
    rootElement.style.removeProperty("--create-panel-top");
    rootElement.style.removeProperty("--create-panel-bottom");
    rootElement.style.removeProperty("--create-panel-width");
    panelState.setNavigationBarHeight(64);
  };

  const updateToolPanelMetrics = () => {
    if (!toolPanelElement) {
      panelState.setToolPanelHeight(0);
      panelState.setToolPanelWidth(0);
      clearCreatePanelMetrics();
      return;
    }

    if (typeof window === "undefined") {
      panelState.setToolPanelHeight(toolPanelElement.clientHeight ?? 0);
      panelState.setToolPanelWidth(toolPanelElement.clientWidth ?? 0);
      return;
    }

    const rect = toolPanelElement.getBoundingClientRect();
    panelState.setToolPanelHeight(rect.height);
    panelState.setToolPanelWidth(rect.width);

    if (!rootElement) {
      return;
    }

    const insetRight = Math.max(window.innerWidth - rect.right, 0);
    const insetBottom = Math.max(window.innerHeight - rect.bottom, 0);
    const insetTop = Math.max(rect.top, 0);
    const insetLeft = Math.max(rect.left, 0);
    const width = Math.max(rect.width, 0);

    rootElement.style.setProperty("--create-panel-left", `${insetLeft}px`);
    rootElement.style.setProperty(
      "--create-panel-inset-right",
      `${insetRight}px`
    );
    rootElement.style.setProperty("--create-panel-top", `${insetTop}px`);
    rootElement.style.setProperty("--create-panel-bottom", `${insetBottom}px`);
    rootElement.style.setProperty("--create-panel-width", `${width}px`);

    // Update navigation bar height based on remaining viewport space
    panelState.setNavigationBarHeight(insetBottom);
  };

  // Track tool panel height
  if (toolPanelElement) {
    updateToolPanelMetrics();

    const toolResizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) {
        return;
      }
      updateToolPanelMetrics();
    });
    toolResizeObserver.observe(toolPanelElement);
    cleanups.push(() => toolResizeObserver.disconnect());

    if (typeof window !== "undefined") {
      const handleViewportChange = () => updateToolPanelMetrics();
      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("orientationchange", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange, true);

      cleanups.push(() => {
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("orientationchange", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
      });
    }
  }

  // Track button panel height
  if (buttonPanelElement) {
    const buttonResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        panelState.setButtonPanelHeight(entry.contentRect.height);
      }
      updateToolPanelMetrics();
    });
    buttonResizeObserver.observe(buttonPanelElement);
    cleanups.push(() => buttonResizeObserver.disconnect());
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    clearCreatePanelMetrics();
  };
}
