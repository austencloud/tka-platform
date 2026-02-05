/**
 * Device Context Capturer
 *
 * Captures device, browser, and app context information for feedback submissions.
 * Helps developers understand the user's environment when debugging issues.
 */

import type { DeviceContext } from "../domain/models/feedback-models";

/**
 * Capture current device/browser context
 */
export function captureDeviceContext(
  currentModule?: string,
  currentTab?: string
): DeviceContext {
  // Get app version from package.json (injected at build time via Vite)
  const appVersion = import.meta.env.VITE_APP_VERSION || "unknown";

  return {
    // Device & Browser
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    isTouchDevice: "ontouchstart" in window || navigator.maxTouchPoints > 0,

    // Viewport & Screen
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,

    // App Context
    appVersion,
    currentModule,
    currentTab,

    // Timestamp
    capturedAt: new Date(),
  };
}
