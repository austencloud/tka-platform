import type { ViewportManager } from '$lib/shared/device/services/viewport-manager.svelte'
/**
 * Responsive Layout Service Implementation
 *
 * Manages all responsive layout logic for two-panel construction interfaces.
 * Determines optimal panel arrangement based on device context.
 *
 * Domain: Create module - Sequence Construction Interface
 */

import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
import { BREAKPOINTS } from "$lib/shared/device/domain/constants/device-constants";
import type { LayoutConfiguration } from "$lib/shared/create/services/layout-types";

export class ResponsiveLayoutManager {
  private layoutChangeCallbacks: Set<(config: LayoutConfiguration) => void> =
    new Set();
  private viewportUnsubscribe: (() => void) | null = null;

  constructor(
    private deviceDetector: DeviceDetector,
    private viewportService: ViewportManager
  ) {}

  initialize(): void {
    // Subscribe to viewport changes and notify listeners
    this.viewportUnsubscribe = this.viewportService.onViewportChange(() => {
      this.notifyLayoutChange();
    });
  }

  dispose(): void {
    if (this.viewportUnsubscribe) {
      this.viewportUnsubscribe();
      this.viewportUnsubscribe = null;
    }
    this.layoutChangeCallbacks.clear();
  }

  getViewportWidth(): number {
    return this.viewportService.width;
  }

  getViewportHeight(): number {
    return this.viewportService.height;
  }

  getNavigationLayout(): "top" | "left" {
    const layout = this.deviceDetector.getNavigationLayoutImmediate();
    // Filter out 'bottom' if present, default to 'top'
    return layout === "left" ? "left" : "top";
  }

  shouldUseSideBySideLayout(): boolean {
    const viewportWidth = this.getViewportWidth();

    // Hard gate: narrow viewports are NEVER side-by-side, regardless of what
    // the device detector reports. This is the 10-year rule - viewport width
    // is the only reliable signal. Device detection APIs lie (emulators,
    // hybrid devices, future form factors).
    if (viewportWidth < BREAKPOINTS.MOBILE) {
      return false;
    }

    const isDesktop = this.isDesktop();
    const isLandscapeMobile = this.isLandscapeMobile();
    const hasWideViewport = this.hasWideViewport();
    const isLikelyZFold = this.isLikelyZFoldUnfolded();
    const aspectRatio = this.getAspectRatio();
    const isSignificantlyLandscape = aspectRatio >= 1.15;

    return (
      (isDesktop && hasWideViewport) ||
      isLandscapeMobile ||
      isLikelyZFold ||
      isSignificantlyLandscape
    );
  }

  isMobilePortrait(): boolean {
    // Mobile portrait is the inverse of side-by-side layout
    // When NOT using side-by-side, we're in mobile portrait stacked layout
    return !this.shouldUseSideBySideLayout();
  }

  isDesktop(): boolean {
    return this.deviceDetector.isDesktop();
  }

  isLandscapeMobile(): boolean {
    return this.deviceDetector.isLandscapeMobile();
  }

  hasWideViewport(): boolean {
    // Standard desktop breakpoint
    return this.getViewportWidth() >= BREAKPOINTS.DESKTOP;
  }

  getAspectRatio(): number {
    const width = this.getViewportWidth();
    const height = this.getViewportHeight();
    return height > 0 ? width / height : 1;
  }

  isLikelyZFoldUnfolded(): boolean {
    const width = this.getViewportWidth();
    const aspectRatio = this.getAspectRatio();

    // Z Fold specific: More flexible detection that accounts for browser UI
    return (
      width >= 700 &&
      width <= 950 && // Wider range to account for browser UI
      aspectRatio >= 1.1 &&
      aspectRatio <= 1.4 // Broader aspect ratio range
    );
  }

  onLayoutChange(callback: (config: LayoutConfiguration) => void): () => void {
    this.layoutChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.layoutChangeCallbacks.delete(callback);
    };
  }

  calculateLayout(): LayoutConfiguration {
    return {
      width: this.getViewportWidth(),
      height: this.getViewportHeight(),
    } as unknown as LayoutConfiguration;
  }

  private notifyLayoutChange(): void {
    const config = this.calculateLayout();
    this.layoutChangeCallbacks.forEach((callback) => callback(config));
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { deviceDetector } from "$lib/shared/device/services/device-detector";
import { viewportManager } from "$lib/shared/device/services/viewport-manager.svelte";

export const responsiveLayoutManager = new ResponsiveLayoutManager(
  deviceDetector,
  viewportManager
);
