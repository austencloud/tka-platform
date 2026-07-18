/**
 * Playwright Configuration for Multi-Device Screenshot Testing
 *
 * One project per device (9 portrait + optional 9 landscape). No webServer — never start/kill port 5173.
 * Auth happens per-context in the spec, not via storageState.
 */

import { defineConfig } from "@playwright/test";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { filterDevices, toLandscape, type DevicePreset } from "./devices";

// Mirror vite.config.ts: the dev server runs HTTPS/h2 when the mkcert dev cert
// exists (.cert/), else HTTP/1.1 (fresh clone / CI). Match its protocol so the
// captures hit the same origin the browser does.
const __dir = dirname(fileURLToPath(import.meta.url));
const certDir = resolve(__dir, "../../.cert");
const useHttps =
  existsSync(resolve(certDir, "dev-cert.pem")) &&
  existsSync(resolve(certDir, "dev-key.pem"));
const baseURL = useHttps
  ? "https://127.0.0.1:5173"
  : "http://127.0.0.1:5173";

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
    baseURL,
    // The mkcert dev cert is self-signed; Playwright's bundled Chromium doesn't
    // trust the local CA, so accept it explicitly.
    ignoreHTTPSErrors: true,
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
