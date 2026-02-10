/**
 * Device Detector Interface
 *
 * Detects device capabilities and characteristics.
 */

import type { DeviceType } from "../../domain/enums/device-enums";
import type {
  DeviceCapabilities,
  ResponsiveSettings,
} from "../../domain/models/device-models";

export interface IDeviceDetector {
  /**
   * Detect the current device type
   */
  detectDeviceType(): DeviceType;

  /**
   * Whether the device's PRIMARY input is touch.
   * Returns false for touchscreen desktops where mouse/keyboard is primary.
   */
  isTouchDevice(): boolean;

  /**
   * Whether the device has touch hardware at all (including touchscreen laptops).
   * Use `isTouchDevice()` for UX decisions; this is for raw capability checks.
   */
  hasTouchHardware(): boolean;

  /**
   * Check if device is mobile
   */
  isMobile(): boolean;

  /**
   * Check if device is tablet
   */
  isTablet(): boolean;

  /**
   * Check if device is desktop
   */
  isDesktop(): boolean;

  /**
   * Check if device is in landscape mobile mode
   * (mobile device held sideways with wide aspect ratio)
   */
  isLandscapeMobile(): boolean;

  /**
   * Check if device is in portrait mobile mode
   * (mobile device held upright with narrow width)
   */
  isPortraitMobile(): boolean;

  /**
   * Get device screen information
   */
  getScreenInfo(): {
    width: number;
    height: number;
    pixelRatio: number;
  };

  /**
   * Check if device supports foldable features
   */
  supportsFoldable(): boolean;

  /**
   * Get comprehensive device capabilities
   */
  getCapabilities(): DeviceCapabilities;

  /**
   * Get navigation layout immediately without caching
   * This ensures navigation layout responds instantly to viewport changes
   * - "top": Desktop and tablet (horizontal navigation bar at top)
   * - "left": Landscape mobile (vertical navigation bar on left)
   * - "bottom": Portrait mobile (bottom navigation bar)
   */
  getNavigationLayoutImmediate(): "top" | "left" | "bottom";

  /**
   * Get responsive design settings based on device
   */
  getResponsiveSettings(): ResponsiveSettings;

  /**
   * Register callback for device capability changes
   */
  onCapabilitiesChanged(
    callback: (caps: DeviceCapabilities) => void
  ): () => void;

  /**
   * Check if running in a simulated mobile environment (e.g., Chrome DevTools)
   * Returns true when touch is detected but no actual virtual keyboard exists.
   * Use this to determine if touch-specific behaviors (like hiding keyboard hints)
   * should be skipped because the user actually has a physical keyboard.
   */
  isSimulatedMobile(): boolean;
}
