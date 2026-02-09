/**
 * Multi-Device Screenshot Capture Spec
 *
 * Each Playwright project (device) runs this spec independently.
 * Auth happens once per context via a shared login flow.
 * SPA navigation uses localStorage keys, not URL routing.
 */

import { test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  PUBLIC_ROUTES,
  ALL_ROUTES,
  matchRoutes,
  type RouteConfig,
} from "./devices";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Timeout constants — values determined by observing average load times + buffer
const TIMEOUTS = {
  LANDING_VISIBLE: 2000,
  LANDING_CONTINUE: 1000,
  POST_CLICK_SETTLE: 2000,
  AUTH_UI_VISIBLE: 3000,
  INPUT_VISIBLE: 1000,
  EMAIL_INPUT_VISIBLE: 2000,
  PRE_SUBMIT_DELAY: 500,
  POST_LOGIN_SETTLE: 4000,
  LOGIN_VERIFY: 2000,
  MODAL_APPEAR: 1500,
  MODAL_DISMISS: 1000,
  MODAL_SETTLE: 500,
  ROUTE_LOAD: 15000,
  INITIAL_LOAD: 30000,
  SELECTOR_WAIT: 8000,
  NETWORK_IDLE: 5000,
  LOADING_DISAPPEAR: 8000,
  FINAL_SETTLE: 500,
  SPA_RELOAD_SETTLE: 1500,
  PUBLIC_ROUTE_SETTLE: 3000,
} as const;

// ─── Resolve which routes to capture ──────────────────────────────────────────

function resolveRoutes(): RouteConfig[] {
  const publicOnly = process.env.SCREENSHOT_PUBLIC === "true";
  const routeFilter = process.env.SCREENSHOT_ROUTES;

  let pool = publicOnly ? PUBLIC_ROUTES : ALL_ROUTES;

  if (routeFilter) {
    const patterns = routeFilter.split(",").map((s) => s.trim());
    pool = matchRoutes(pool, patterns);
  }

  return pool;
}

// ─── Resolve auth credentials ─────────────────────────────────────────────────

interface Credentials {
  email: string;
  password: string;
}

function resolveCredentials(): Credentials | null {
  // Env vars take precedence
  if (process.env.SCREENSHOT_TEST_EMAIL && process.env.SCREENSHOT_TEST_PASSWORD) {
    const email = process.env.SCREENSHOT_TEST_EMAIL;
    const password = process.env.SCREENSHOT_TEST_PASSWORD;

    if (!email.includes("@")) {
      console.warn(`Invalid SCREENSHOT_TEST_EMAIL: missing @ in "${email}"`);
      return null;
    }
    if (password.length === 0) {
      console.warn("SCREENSHOT_TEST_PASSWORD is empty");
      return null;
    }

    return { email, password };
  }

  // Fall back to local config file
  const localConfigPath = join(
    process.cwd(),
    "scripts",
    "screenshot-capture",
    "screenshot-config.local.json"
  );

  if (existsSync(localConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(localConfigPath, "utf-8"));
      if (config.auth?.email && config.auth?.password) {
        return { email: config.auth.email, password: config.auth.password };
      }
    } catch (err) {
      console.warn(
        `Failed to parse ${localConfigPath}:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return null;
}

// ─── Auth Flow ────────────────────────────────────────────────────────────────

async function bypassLandingPage(page: Page): Promise<void> {
  const launchApp = page.locator("text=Launch App");
  const continueLink = page.locator("text=continue in browser");

  if (await launchApp.isVisible({ timeout: TIMEOUTS.LANDING_VISIBLE }).catch(() => false)) {
    await launchApp.click();
    await page.waitForTimeout(TIMEOUTS.POST_CLICK_SETTLE);
  } else if (
    await continueLink.isVisible({ timeout: TIMEOUTS.LANDING_CONTINUE }).catch(() => false)
  ) {
    await continueLink.click();
    await page.waitForTimeout(TIMEOUTS.POST_CLICK_SETTLE);
  }
}

async function loginWithCredentials(
  page: Page,
  credentials: Credentials
): Promise<boolean> {
  const loginVisible = await page
    .locator("text=Sign in to continue")
    .or(page.locator("text=Welcome back"))
    .isVisible({ timeout: TIMEOUTS.AUTH_UI_VISIBLE })
    .catch(() => false);

  if (!loginVisible) return true; // Already logged in

  // Might need to click "Continue with email" first
  let emailInput = page.locator('input[type="email"]');
  if (!(await emailInput.isVisible({ timeout: TIMEOUTS.INPUT_VISIBLE }).catch(() => false))) {
    const emailButton = page.locator("text=Continue with email");
    if (await emailButton.isVisible({ timeout: TIMEOUTS.INPUT_VISIBLE }).catch(() => false)) {
      await emailButton.click();
      await page.waitForTimeout(TIMEOUTS.INPUT_VISIBLE);
    }
  }

  // Fill credentials
  emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: TIMEOUTS.EMAIL_INPUT_VISIBLE }).catch(() => false)) {
    await emailInput.fill(credentials.email);
  }

  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: TIMEOUTS.INPUT_VISIBLE }).catch(() => false)) {
    await passwordInput.fill(credentials.password);
  }

  // Submit
  await page.waitForTimeout(TIMEOUTS.PRE_SUBMIT_DELAY);
  const signInBtn = page.locator(
    'button:has-text("Sign In"), button:has-text("Sign in"), button:has-text("Log in")'
  );
  if (await signInBtn.first().isVisible({ timeout: TIMEOUTS.INPUT_VISIBLE }).catch(() => false)) {
    await signInBtn.first().click();
    await page.waitForTimeout(TIMEOUTS.POST_LOGIN_SETTLE);
  }

  // Verify login succeeded
  const stillOnLogin = await page
    .locator("text=Sign in to continue")
    .isVisible({ timeout: TIMEOUTS.LOGIN_VERIFY })
    .catch(() => false);

  return !stillOnLogin;
}

async function suppressOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("tka-last-seen-version", "99.99.99");
    localStorage.setItem("tka-landing-dismissed", "true");
    localStorage.setItem("tka-sidebar-tour-completed", "true");

    const tabIntros = [
      "tabIntroSeen:create:constructor",
      "tabIntroSeen:create:generator",
      "tabIntroSeen:create:assembler",
      "tabIntroSeen:create:spell",
      "tabIntroSeen:learn:concepts",
      "tabIntroSeen:learn:codex",
      "tabIntroSeen:discover:gallery",
      "tabIntroSeen:discover:sequences",
      "tabIntroSeen:discover:creators",
      "tabIntroSeen:library:sequences",
      "tabIntroSeen:library:favorites",
      "tabIntroSeen:compose:playback",
      "tabIntroSeen:compose:arrange",
      "tabIntroSeen:compose:timeline",
      "tabIntroSeen:train:practice",
      "tabIntroSeen:settings:theme",
      "tabIntroSeen:settings:visibility",
    ];
    tabIntros.forEach((key) => localStorage.setItem(key, "true"));
  });
}

async function setTheme(page: Page, dark: boolean): Promise<void> {
  const backgroundColor = dark ? "#121212" : "#e0e0da";
  await page.evaluate(
    ([bg]) => {
      const settingsKey = "tka-modern-web-settings";
      let settings: Record<string, unknown> = {};
      try {
        const raw = localStorage.getItem(settingsKey);
        if (raw) settings = JSON.parse(raw);
      } catch {
        // Start fresh
      }
      settings.backgroundType = "SOLID_COLOR";
      settings.backgroundColor = bg;
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    },
    [backgroundColor]
  );
}

async function dismissModals(page: Page): Promise<void> {
  await page.waitForTimeout(TIMEOUTS.MODAL_APPEAR);

  // Dismiss "What's New" modal
  const gotIt = page.locator('button:has-text("Got it")');
  if (await gotIt.isVisible({ timeout: TIMEOUTS.MODAL_DISMISS }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(TIMEOUTS.MODAL_SETTLE);
  }

  // Dismiss any other modals
  const dismiss = page.locator(
    'button:has-text("Dismiss"), button:has-text("Close"), button:has-text("Skip")'
  );
  if (await dismiss.first().isVisible({ timeout: TIMEOUTS.MODAL_SETTLE }).catch(() => false)) {
    await dismiss.first().click();
    await page.waitForTimeout(TIMEOUTS.MODAL_SETTLE);
  }
}

// ─── Splash Screen Dismissal ─────────────────────────────────────────────────

/**
 * Force-dismiss the app.html splash screen via JavaScript injection.
 *
 * Public routes bypass the main +layout.svelte which calls __tkaLoadProgress(100).
 * Without that call, the splash only disappears after its 15-second safety timeout.
 * Instead of waiting 15s per test, we call __tkaLoadProgress(100) ourselves to
 * trigger the normal dismissal flow (crossfade "Ready" message → fade out → remove).
 *
 * We then wait for the element to actually detach from the DOM, with a generous
 * timeout to cover the fade animation (~1.4s) plus buffer.
 */
async function dismissSplashScreen(page: Page): Promise<void> {
  // Trigger the normal dismissal flow if the splash is still present
  await page.evaluate(() => {
    const screen = document.getElementById("app-loading");
    if (screen && typeof (window as any).__tkaLoadProgress === "function") {
      (window as any).__tkaLoadProgress(100, "Ready");
    } else if (screen) {
      // Fallback: directly remove if the progress function isn't available
      screen.classList.add("loaded");
      screen.addEventListener("transitionend", () => screen.remove());
      // Safety: remove after 500ms even if transitionend doesn't fire
      setTimeout(() => screen.remove(), 500);
    }
  });

  // Wait for the splash element to be fully removed from the DOM
  try {
    await page.waitForSelector("#app-loading", {
      state: "detached",
      timeout: 5000,
    });
  } catch {
    // Already gone, or was never present
  }
}

// ─── Content Stabilization ────────────────────────────────────────────────────

async function stabilize(page: Page, route: RouteConfig): Promise<void> {
  // 1. Dismiss the splash screen immediately via JS injection.
  //    Public routes bypass the main layout that calls __tkaLoadProgress(100),
  //    so the splash would otherwise sit for 15 seconds on its safety timeout.
  await dismissSplashScreen(page);

  // 2. Wait for route-specific content selector — proves actual page content rendered.
  //    This is the CRITICAL check. Without this, we capture black/splash screens.
  if (route.waitSelector) {
    const selectors = route.waitSelector.split(",").map((s) => s.trim());
    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, {
          state: "visible",
          timeout: TIMEOUTS.SELECTOR_WAIT,
        });
        found = true;
        break;
      } catch {
        // Try next selector
      }
    }
    if (!found) {
      console.warn(`[stabilize] No content selector found for ${route.label}`);
    }
  }

  // 3. Wait for network to settle (non-blocking — fonts, images, etc.)
  await page
    .waitForLoadState("networkidle", { timeout: TIMEOUTS.NETWORK_IDLE })
    .catch(() => {});

  // 4. Wait for fonts to finish loading
  await page.evaluate(() => document.fonts.ready);

  // 5. Also wait for generic "Loading" text (used by some component loading states)
  try {
    const loading = page.locator("text=Loading");
    if (await loading.isVisible({ timeout: 300 }).catch(() => false)) {
      await loading.waitFor({
        state: "hidden",
        timeout: TIMEOUTS.LOADING_DISAPPEAR,
      });
    }
  } catch {
    // Not present, fine
  }

  // 6. Freeze animations for deterministic screenshots.
  //    Done AFTER content loads so CSS animations don't interfere with rendering.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });

  // 7. Final settle — let the paint cycle complete after freezing animations
  await page.waitForTimeout(TIMEOUTS.FINAL_SETTLE);
}

// ─── SPA Navigation ──────────────────────────────────────────────────────────

async function navigateToRoute(page: Page, route: RouteConfig): Promise<void> {
  if (!route.isModule) {
    // Public route — standard URL navigation
    await page.goto(route.path, { waitUntil: "load", timeout: TIMEOUTS.ROUTE_LOAD });
    await page.waitForTimeout(TIMEOUTS.PUBLIC_ROUTE_SETTLE);
    return;
  }

  // SPA module — set localStorage and reload
  await page.evaluate(
    ([moduleId, tabId]) => {
      localStorage.setItem("tka-current-module", moduleId);
      if (tabId) {
        localStorage.setItem("tka-active-tab", tabId);
      }
    },
    [route.moduleId!, route.tabId ?? ""]
  );

  await page.reload({ waitUntil: "load", timeout: TIMEOUTS.ROUTE_LOAD });
  await page.waitForTimeout(TIMEOUTS.SPA_RELOAD_SETTLE);
}

// ─── Test Definition ──────────────────────────────────────────────────────────

const routes = resolveRoutes();
const credentials = resolveCredentials();
const isDark = process.env.SCREENSHOT_DARK !== "false";
const hasAuth = credentials !== null;
const captureDir = join(__dirname, "captures");

// Separate routes by auth requirement
const publicRoutes = routes.filter((r) => !r.requiresAuth);
const authRoutes = routes.filter((r) => r.requiresAuth);

// Public routes (no login needed)
if (publicRoutes.length > 0) {
  test.describe("Public routes", () => {
    for (const route of publicRoutes) {
      test(`${route.label}`, async ({ page }, testInfo) => {
        const deviceSlug = testInfo.project.name;
        await page.goto(route.path, { waitUntil: "load", timeout: TIMEOUTS.ROUTE_LOAD });
        await dismissSplashScreen(page);
        await stabilize(page, route);

        const filename = `${route.label}--${deviceSlug}.png`;
        await page.screenshot({
          path: join(captureDir, filename),
          fullPage: false,
        });
      });
    }
  });
}

// Auth-required routes
if (authRoutes.length > 0 && hasAuth) {
  test.describe("App modules", () => {
    test.beforeAll(async ({ browser }) => {
      // Validate credentials once by doing a quick login
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto("/", { waitUntil: "load", timeout: TIMEOUTS.INITIAL_LOAD });
      await page.waitForTimeout(TIMEOUTS.POST_CLICK_SETTLE);
      await bypassLandingPage(page);

      const loggedIn = await loginWithCredentials(page, credentials!);
      if (!loggedIn) {
        const currentUrl = page.url();
        throw new Error(
          `Login failed (still on: ${currentUrl}).\n` +
            "Check SCREENSHOT_TEST_EMAIL / SCREENSHOT_TEST_PASSWORD.\n" +
            "Possible causes: wrong credentials, UI changed, network timeout."
        );
      }

      await context.close();
    });

    for (const route of authRoutes) {
      test(`${route.label}`, async ({ page }, testInfo) => {
        const deviceSlug = testInfo.project.name;

        // Each test does its own login (contexts are isolated in Playwright)
        await page.goto("/", { waitUntil: "load", timeout: TIMEOUTS.INITIAL_LOAD });
        await page.waitForTimeout(TIMEOUTS.POST_CLICK_SETTLE);
        await bypassLandingPage(page);
        await loginWithCredentials(page, credentials!);
        await suppressOnboarding(page);
        await setTheme(page, isDark);
        await dismissModals(page);

        // Navigate to the target module/tab
        await navigateToRoute(page, route);
        await stabilize(page, route);

        const filename = `${route.label}--${deviceSlug}.png`;
        await page.screenshot({
          path: join(captureDir, filename),
          fullPage: false,
        });
      });
    }
  });
} else if (authRoutes.length > 0 && !hasAuth) {
  test.describe("App modules (skipped — no credentials)", () => {
    test("credentials not provided", () => {
      console.log(
        "Skipping auth routes. Set SCREENSHOT_TEST_EMAIL and SCREENSHOT_TEST_PASSWORD, " +
          "or add credentials to scripts/screenshot-capture/screenshot-config.local.json"
      );
    });
  });
}
