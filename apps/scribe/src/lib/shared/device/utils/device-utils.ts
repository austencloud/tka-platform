/**
 * Option Picker Utility Functions
 *
 * Utility functions for device detection, container aspect calculation,
 * and device configuration management for the option picker component.
 */

import { ContainerAspect, DeviceType } from "../domain/enums/device-enums";
import type { DeviceConfig } from "../domain/models/device-models";

/**
 * Determines the device type based on container width and user agent
 */
export function getDeviceType(
  containerWidth: number,
  isMobileUserAgent?: boolean
): DeviceType {
  // Mobile user agent detection takes precedence for small screens
  if (isMobileUserAgent && containerWidth < 768) {
    if (containerWidth < 480) {
      return DeviceType.SMALL_MOBILE;
    }
    return DeviceType.MOBILE;
  }

  // Screen width-based detection
  if (containerWidth < 480) {
    return DeviceType.SMALL_MOBILE;
  } else if (containerWidth < 768) {
    return DeviceType.MOBILE;
  } else if (containerWidth < 1024) {
    return DeviceType.TABLET;
  } else if (containerWidth < 1440) {
    return DeviceType.DESKTOP;
  } else {
    return DeviceType.LARGE_DESKTOP;
  }
}

/**
 * Determines the container aspect ratio category
 */
export function getContainerAspect(
  width: number,
  height: number
): ContainerAspect {
  const aspectRatio = width / height;

  if (aspectRatio < 0.8) {
    return ContainerAspect.TALL;
  } else if (aspectRatio < 1.2) {
    return ContainerAspect.SQUARE;
  } else if (aspectRatio < 1.6) {
    return ContainerAspect.WIDISH;
  } else {
    return ContainerAspect.WIDE;
  }
}

/**
 * Gets device-specific configuration for layout calculations
 */
export function getDeviceConfig(deviceType: DeviceType): DeviceConfig {
  switch (deviceType) {
    case DeviceType.SMALL_MOBILE:
      return {
        padding: { horizontal: 16, vertical: 16 },
        gap: 8,
        minItemSize: 60,
        maxItemSize: 120,
        scaleFactor: 0.8,
      };

    case DeviceType.MOBILE:
      return {
        padding: { horizontal: 20, vertical: 20 },
        gap: 12,
        minItemSize: 80,
        maxItemSize: 140,
        scaleFactor: 0.9,
      };

    case DeviceType.TABLET:
      return {
        padding: { horizontal: 24, vertical: 24 },
        gap: 16,
        minItemSize: 100,
        maxItemSize: 160,
        scaleFactor: 1.0,
      };

    case DeviceType.DESKTOP:
      return {
        padding: { horizontal: 32, vertical: 32 },
        gap: 20,
        minItemSize: 120,
        maxItemSize: 180,
        scaleFactor: 1.1,
      };

    case DeviceType.LARGE_DESKTOP:
      return {
        padding: { horizontal: 40, vertical: 40 },
        gap: 24,
        minItemSize: 140,
        maxItemSize: 200,
        scaleFactor: 1.2,
      };

    default:
      // Fallback to mobile config
      return {
        padding: { horizontal: 20, vertical: 20 },
        gap: 12,
        minItemSize: 80,
        maxItemSize: 140,
        scaleFactor: 0.9,
      };
  }
}
