/**
 * Device Tier Detector Implementation
 *
 * Determines the starting quality tier based on device capabilities.
 * Wraps the existing DeviceDetector infrastructure.
 */

import { DeviceTier } from "../../domain/types/QualityTypes";

export class DeviceTierDetector {
  detect(): DeviceTier {
    const cores = navigator.hardwareConcurrency ?? 4;
    const isMobile = this.isMobileDevice();

    // Desktop or high-core mobile: start at HIGH
    if (!isMobile || cores >= 8) {
      return DeviceTier.HIGH;
    }

    // Mobile with >4 cores: start at MEDIUM
    if (cores > 4) {
      return DeviceTier.MEDIUM;
    }

    // Mobile with <=4 cores: start at LOW
    return DeviceTier.LOW;
  }

  private isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    // Use maxTouchPoints as the most reliable heuristic (avoids user-agent sniffing)
    return navigator.maxTouchPoints > 0;
  }
}
