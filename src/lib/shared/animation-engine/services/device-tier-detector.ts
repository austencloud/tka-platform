/**
 * Determines the starting quality tier based on device capabilities.
 */

import { DeviceTier } from "../domain/types/quality-types";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 0;
}

export function detectDeviceTier(): DeviceTier {
  const cores = navigator.hardwareConcurrency ?? 4;
  const isMobile = isMobileDevice();

  if (!isMobile || cores >= 8) {
    return DeviceTier.HIGH;
  }

  if (cores > 4) {
    return DeviceTier.MEDIUM;
  }

  return DeviceTier.LOW;
}
