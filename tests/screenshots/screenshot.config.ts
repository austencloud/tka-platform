/**
 * Playwright Configuration for Multi-Device Screenshot Testing
 *
 * One project per device (9 total). No webServer — never start/kill port 5173.
 * Auth happens per-context in the spec, not via storageState.
 */

import { defineConfig } from "@playwright/test";
import { DEVICES, type DevicePreset } from "./devices";

function resolveDeviceFilter(): DevicePreset[] {
  const filter = process.env.SCREENSHOT_DEVICE_FILTER;
  if (!filter) return DEVICES;

  const validCategories = ["phone", "tablet", "desktop"] as const;
  if (validCategories.includes(filter as (typeof validCategories)[number])) {
    return DEVICES.filter(
      (d) => d.category === (filter as DevicePreset["category"])
    );
  }

  // Filter by specific device slug
  const slugs = filter.split(",").map((s) => s.trim().toLowerCase());
  const filtered = DEVICES.filter((d) => slugs.includes(d.slug));
  return filtered.length > 0 ? filtered : DEVICES;
}

const activeDevices = resolveDeviceFilter();

export default defineConfig({
  testDir: ".",
  testMatch: "capture.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 4,
  timeout: 60_000,
  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:5173",
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
