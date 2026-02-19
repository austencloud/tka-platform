/**
 * Playwright Configuration for Multi-Device Screenshot Testing
 *
 * One project per device (9 portrait + optional 9 landscape). No webServer — never start/kill port 5173.
 * Auth happens per-context in the spec, not via storageState.
 */

import { defineConfig } from "@playwright/test";
import { filterDevices, toLandscape, type DevicePreset } from "./devices";

function resolveDevices(): DevicePreset[] {
  const filter = process.env.SCREENSHOT_DEVICE_FILTER;
  const filtered = filterDevices(filter || undefined);

  if (filtered.length === 0) {
    console.warn(`No devices matched filter "${filter}". Using all devices.`);
    return filterDevices();
  }

  // Add landscape variants if requested
  if (process.env.SCREENSHOT_LANDSCAPE === "true") {
    const landscapeVariants = filtered
      .filter((d) => d.category !== "desktop") // Desktop is already landscape-ish
      .map(toLandscape);
    return [...filtered, ...landscapeVariants];
  }

  return filtered;
}

const activeDevices = resolveDevices();

export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    screenshot: "off",
    video: "off",
  },

  // No webServer — never start/kill 5173. The user's dev server is already running.

  projects: activeDevices.map((device) => ({
    name: device.slug,
    use: {
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      colorScheme: process.env.SCREENSHOT_DARK === "false" ? "light" : "dark",
    },
  })),
});
