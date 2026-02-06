// Device models and types
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

export interface DeviceCapabilities {
  touchSupport: boolean;
  accelerometerSupport: boolean;
  orientationSupport: boolean;
  vibrationSupport: boolean;
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceMetrics {
  pixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  orientation: "portrait" | "landscape";
}
