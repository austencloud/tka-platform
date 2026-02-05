/**
 * Device Detection and Responsive Types
 *
 * Types for device capability detection and responsive design.
 */

/**
 * Navigation layout orientation
 * - 'top': Traditional horizontal navigation bar at the top
 * - 'left': Vertical navigation bar on the left side (for landscape mobile)
 * - 'bottom': Bottom navigation bar (for portrait mobile)
 */
export type NavigationLayout = "top" | "left" | "bottom";

export interface DeviceConfig {
  padding: {
    horizontal: number;
    vertical: number;
  };
  gap: number;
  minItemSize: number;
  maxItemSize: number;
  scaleFactor: number;
}
export interface DeviceCapabilities {
  // Primary input method
  primaryInput: "touch" | "mouse" | "hybrid";

  // Screen characteristics
  screenSize: "mobile" | "tablet" | "desktop" | "largeDesktop";

  // Device features
  hasTouch: boolean;
  hasPrecisePointer: boolean;
  hasKeyboard: boolean;

  // Viewport information
  viewport: {
    width: number;
    height: number;
  };

  // Display characteristics
  pixelRatio: number;
  colorDepth: number;
  supportsHDR: boolean;

  // Performance indicators
  memoryEstimate?: number; // MB
  hardwareConcurrency: number;
  connectionSpeed?: "slow" | "medium" | "fast";
}

export interface ResponsiveSettings {
  // Touch and interaction
  minTouchTarget: number;
  elementSpacing: number;
  allowScrolling: boolean;
  layoutDensity: "compact" | "comfortable" | "spacious";
  fontScaling: number;

  // Device detection data
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  touchSupported: boolean;
  orientation: "portrait" | "landscape";

  // Navigation layout
  navigationLayout: NavigationLayout;
  isLandscapeMobile: boolean;
}
// ============================================================================
// BREAKPOINT CONFIGURATION
// ============================================================================

export interface BreakpointConfig {
  smallMobile: number;
  mobile: number;
  tablet: number;
  laptop: number;
  desktop: number;
  largeDesktop: number;
}

export interface AspectRatioConfig {
  tall: number;
  square: number;
  wide: number;
}

export interface DeviceFeatureCapabilities {
  touch: boolean;
  mouse: boolean;
  keyboard: boolean;
  orientation: boolean;
  vibration: boolean;
  geolocation: boolean;
}

export interface ScreenMetrics {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  pixelRatio: number;
  orientation: "portrait" | "landscape";
}

export interface DeviceInfo {
  type: "mobile" | "tablet" | "desktop" | "unknown";
  platform: string;
  userAgent: string;
  capabilities: DeviceFeatureCapabilities;
  screenMetrics: ScreenMetrics;
  isFoldable: boolean;
}
