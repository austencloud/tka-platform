/**
 * Device Tier Detector Interface
 *
 * Determines the starting quality tier based on device capabilities.
 * Uses hardware concurrency and device type from the existing DeviceDetector.
 */

import type { DeviceTier } from "../../domain/types/QualityTypes";

export interface IDeviceTierDetector {
  /**
   * Detect the device's capability tier.
   * Called once at startup to determine the initial quality tier.
   */
  detect(): DeviceTier;
}
