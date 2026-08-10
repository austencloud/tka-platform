/**
 * Multi-Device Screenshot Capture Spec
 *
 * Each Playwright project (device) runs this spec independently.
 * Auth happens once per context via a shared login flow.
 * SPA navigation uses URL routing (/{module}/{tab}), not localStorage.
 */

import { test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  PUBLIC_ROUTES,
  ALL_ROUTES,
  matchRoutes,
  STORAGE_KEYS,
  validateStorageKeys,
  type RouteConfig,
} from "./devices";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Timeout constants — values determined by observing average load times + buffer
const TIMEOUTS = {
  // Landing page bypass
  LANDING_VISIBLE: 2000,
  LANDING_CONTINUE: 1000,
  POST_CLICK_SETTLE: 2000,
  // Login flow
  LOGIN_POLL_INTERVAL: 500,
  LOGIN_STEP_SETTLE: 800,
  PRE_SUBMIT_DELAY: 300,
  // Modals
  MODAL_APPEAR: 1500,
  MODAL_DISMISS: 1000,
  MODAL_SETTLE: 500,
  // Navigation
  ROUTE_LOAD: 15000,
  INITIAL_LOAD: 30000,
  SPA_RELOAD_SETTLE: 1500,
  PUBLIC_ROUTE_SETTLE: 3000,
  // Stabilization — generous because vite dev compiles heavy modules on-demand
  // on first visit; a short wait captures the mid-compile "Loading…" state.
  SELECTOR_WAIT: 25000,
  NETWORK_IDLE: 5000,
  LOADING_DISAPPEAR: 25000,
  FINAL_SETTLE: 500,
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
  const localConfigPath = join(__dirname, "credentials.local.json");

  if (existsSync(localConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(localConfigPath, "utf-8"));
      // Support both { email, password } and { auth: { email, password } } shapes
      const email = config.email ?? config.auth?.email;
      const password = config.password ?? config.auth?.password;
      if (email && password) {
        return { email, password };
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
  // Guest access means "/" never shows a login screen anymore — the app opens
  // straight into guest mode, so "no login screen appeared" is NOT proof of
  // being signed in (that assumption once shipped a full sweep of guest-state
  // captures). Instead: go to the Library tab, which renders an explicit
  // signed-out block with a "Log in" button, open the auth drawer from there,
  // and hard-verify the signed-in state before returning true.
  await page.goto("/browse/library", {
    waitUntil: "load",
    timeout: TIMEOUTS.INITIAL_LOAD,
  });
  await dismissSplashScreen(page);

  // Wait for the Library tab to settle into signed-out or signed-in state.
  let libState = "loading";
  for (let attempt = 0; attempt < 40; attempt++) {
    libState = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes("Your library lives in your account")) return "signed-out";
      if (document.querySelector(".shelf-heading, .collections-list .card-grid"))
        return "signed-in";
      return "loading";
    });
    if (libState !== "loading") break;
    await page.waitForTimeout(TIMEOUTS.LOGIN_POLL_INTERVAL);
  }

  if (libState === "signed-in") return true; // Session persisted from a prior run
  if (libState !== "signed-out") {
    console.warn("[login] Library tab never settled into a known auth state");
    return false;
  }

  // Open the auth drawer via the signed-out block's "Log in" button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const login = buttons.find((b) => b.textContent?.trim() === "Log in");
    if (login) (login as HTMLElement).click();
  });
  await page.waitForTimeout(TIMEOUTS.LOGIN_STEP_SETTLE);

  // Step 1: Click "Continue with email" to expand the email auth section.
  //         Use evaluate() + click to bypass Svelte transition visibility issues.

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, .email-toggle"));
    const emailBtn = buttons.find((b) => b.textContent?.includes("Continue with email"));
    if (emailBtn) (emailBtn as HTMLElement).click();
  });
  await page.waitForTimeout(TIMEOUTS.LOGIN_STEP_SETTLE);

  // Step 2: Switch from "Magic Link" (default) to "Password" tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
    const pwTab = tabs.find((t) => t.textContent?.includes("Password"));
    if (pwTab) (pwTab as HTMLElement).click();
  });
  await page.waitForTimeout(TIMEOUTS.LOGIN_STEP_SETTLE);

  // Step 3: Fill email — use evaluate to set value directly
  await page.evaluate((email) => {
    const input = document.querySelector('input[type="email"]') as HTMLInputElement;
    if (input) {
      input.value = email;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, credentials.email);

  // Step 4: Fill password
  await page.evaluate((password) => {
    const input = document.querySelector('input[type="password"]') as HTMLInputElement;
    if (input) {
      input.value = password;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, credentials.password);

  // Step 5: Submit
  await page.waitForTimeout(TIMEOUTS.PRE_SUBMIT_DELAY);
  await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]') as HTMLElement;
    if (btn) btn.click();
  });

  // Step 6: Wait for login to complete. The ONLY acceptable success signal is
  // the Library tab re-rendering into its signed-in state — the signed-out
  // block disappearing. Anything else is a failure; never fall back to guest.
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(TIMEOUTS.LOGIN_POLL_INTERVAL);
    const hasError = await page.evaluate(() => {
      const el = document.querySelector(".message.error");
      return el?.textContent || null;
    });
    if (hasError) {
      console.warn(`[login] Auth error: ${hasError}`);
      return false;
    }
    // POSITIVE signal only: the signed-in library shelves must actually render.
    // "Signed-out text gone" is not proof — the drawer overlay can hide it.
    const signedIn = await page.evaluate(
      () =>
        document.querySelector(".shelf-heading") !== null &&
        !document.body.innerText.includes("Your library lives in your account")
    );
    if (signedIn) {
      return true;
    }
  }

  console.warn("[login] Login timed out after 20s");
  return false;
}

async function suppressOnboarding(page: Page): Promise<void> {
  await page.evaluate(
    (storageKeys) => {
      localStorage.setItem(storageKeys.LAST_SEEN_VERSION, "99.99.99");
      localStorage.setItem(storageKeys.LANDING_DISMISSED, "true");
      // Suppress first-run wizard (beta consent + onboarding steps)
      localStorage.setItem("tka-first-run-completed", "true");
      localStorage.setItem("tka-first-run-completed-at", new Date().toISOString());
    },
    STORAGE_KEYS
  );
}

async function completeFirstRunWizard(page: Page): Promise<void> {
  // The first-run wizard blocks the app for new accounts.
  // Strategy: remove the verification banner overlay, then click "Skip all".
  // If "Skip all" isn't available, check the beta checkbox and click Continue step by step.

  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(600);

    // Remove verification banner on every iteration (it can reappear)
    await page.evaluate(() => {
      document.querySelectorAll('[class*="verification-banner"]').forEach((el) => el.remove());
    });

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const isWizardVisible =
        text.includes("Welcome to the beta") ||
        text.includes("Welcome to TKA") ||
        text.includes("What should we call you") ||
        text.includes("Choose your vibe") ||
        text.includes("favorite prop") ||
        text.includes("pictographs");

      if (!isWizardVisible) return "done";

      const buttons = Array.from(document.querySelectorAll("button"));

      // Try "Skip all" first — it's always enabled and skips the entire wizard
      const skipAll = buttons.find((b) => b.textContent?.trim() === "Skip all");
      if (skipAll) {
        skipAll.click();
        return "skipped-all";
      }

      // Beta consent step: toggle checkbox via its input event to trigger Svelte binding
      const checkbox = document.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement | null;
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        checkbox.dispatchEvent(new Event("input", { bubbles: true }));
        return "checkbox-toggled";
      }

      // Click any enabled action button
      const actionBtn = buttons.find(
        (b) =>
          !b.disabled &&
          (b.textContent?.includes("Continue") ||
            b.textContent?.includes("Skip") ||
            b.textContent?.includes("Get Started"))
      );
      if (actionBtn) {
        actionBtn.click();
        return "clicked-" + actionBtn.textContent?.trim();
      }

      return "no-action";
    });

    if (result === "done") break;
  }
}

async function setTheme(page: Page, dark: boolean): Promise<void> {
  const backgroundColor = dark ? "#121212" : "#e0e0da";
  await page.evaluate(
    ([bg, settingsKey]) => {
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
    [backgroundColor, STORAGE_KEYS.MODERN_SETTINGS] as const
  );
}

async function dismissModals(page: Page): Promise<void> {
  await page.waitForTimeout(TIMEOUTS.MODAL_APPEAR);

  // Use page.evaluate for all dismissals to bypass overlay interception issues.
  // The verification banner often sits on top of other UI, blocking Playwright clicks.

  // Dismiss email verification banner first (it overlays everything)
  await page.evaluate(() => {
    const banner = document.querySelector('[class*="verification-banner"]');
    if (banner) {
      const closeBtn = banner.querySelector("button");
      if (closeBtn) closeBtn.click();
      else banner.remove(); // Force-remove if no close button
    }
  });
  await page.waitForTimeout(300);

  // Dismiss "What's New" modal
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const gotIt = buttons.find((b) => b.textContent?.includes("Got it"));
    if (gotIt) gotIt.click();
  });
  await page.waitForTimeout(TIMEOUTS.MODAL_SETTLE);

  // Dismiss any other modals (Dismiss, Close, Skip)
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const dismiss = buttons.find(
      (b) =>
        b.textContent?.includes("Dismiss") ||
        b.textContent?.includes("Close") ||
        b.textContent?.includes("Skip")
    );
    if (dismiss) dismiss.click();
  });
  await page.waitForTimeout(TIMEOUTS.MODAL_SETTLE);
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

  // 1b. For auth routes, wait for Firebase auth to resolve.
  //     After splash dismissal, the app may show "Checking authentication..."
  //     while Firebase reads IndexedDB. Wait for that to clear.
  if (route.requiresAuth) {
    for (let i = 0; i < 40; i++) {
      const checking = await page.evaluate(() =>
        document.body.innerText.includes("Checking authentication")
      ).catch(() => false);
      if (!checking) break;
      await page.waitForTimeout(500);
    }
  }

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

  // 4. Wait for fonts to finish loading (guard against navigation destroying context)
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // 5. Wait for any VISIBLE "Loading…" placeholder (module lazy-load / route
  //    fallback) to actually disappear. In vite dev mode a heavy module can sit
  //    on this for many seconds while its chunk compiles; a fixed probe races it
  //    and captures mid-load, so poll until the leaf "Loading…" node is gone.
  //    Matches any leaf whose text STARTS with "loading" — "Loading…",
  //    "Loading 3D viewer...", "Loading sequence..." — not just the bare word.
  //    Routes with slow async surfaces (3D scenes) extend the deadline.
  const loadingDeadline =
    Date.now() + TIMEOUTS.LOADING_DISAPPEAR + (route.settleMs ?? 0);
  while (Date.now() < loadingDeadline) {
    const stillLoading = await page
      .evaluate(() => {
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== "hidden" &&
            s.display !== "none" &&
            s.opacity !== "0"
          );
        };
        return Array.from(document.querySelectorAll("body *")).some((el) => {
          if (el.children.length > 0) return false; // leaf text nodes only
          const t = (el.textContent || "").trim();
          return /^loading\b/i.test(t) && visible(el);
        });
      })
      .catch(() => false);
    if (!stillLoading) break;
    await page.waitForTimeout(500);
  }

  // 5b. The content selector may only exist AFTER the loading state clears
  //     (lazy chunks compiling in dev mode). If it wasn't found in step 2,
  //     give it one more short chance now.
  if (route.waitSelector) {
    const selectors = route.waitSelector.split(",").map((s) => s.trim());
    for (const selector of selectors) {
      const present = await page
        .locator(selector)
        .first()
        .isVisible()
        .catch(() => false);
      if (present) break;
      try {
        await page.waitForSelector(selector, {
          state: "visible",
          timeout: 10_000,
        });
        break;
      } catch {
        // Try next selector
      }
    }
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

  // 7. Remove any lingering verification banners (they overlay content)
  await page.evaluate(() => {
    document.querySelectorAll('[class*="verification-banner"]').forEach((el) => el.remove());
  });

  // 8. Final settle — let the paint cycle complete after freezing animations.
  //    Routes with async-loading surfaces (3D scenes) declare extra settle time.
  await page.waitForTimeout(TIMEOUTS.FINAL_SETTLE + (route.settleMs ?? 0));
}

// ─── SPA Navigation ──────────────────────────────────────────────────────────

async function navigateToRoute(page: Page, route: RouteConfig): Promise<void> {
  if (!route.isModule) {
    // Public route — standard URL navigation
    await page.goto(route.path, { waitUntil: "load", timeout: TIMEOUTS.ROUTE_LOAD });
    await page.waitForTimeout(TIMEOUTS.PUBLIC_ROUTE_SETTLE);
    return;
  }

  // SPA module — navigate via URL path.
  // The catch-all route ([...path]/+page.svelte) renders MainApplication,
  // and navigation-state.svelte.ts parses the URL to set module + tab.
  // URL is the source of truth — it OVERRIDES localStorage values.
  const urlPath = route.tabId
    ? `/${route.moduleId}/${route.tabId}`
    : `/${route.moduleId}`;

  await page.goto(urlPath, { waitUntil: "load", timeout: TIMEOUTS.ROUTE_LOAD });

  // For auth routes using the shared context, Firebase auth is in IndexedDB.
  // MainApplication will call __tkaLoadProgress(100) after auth resolves,
  // dismissing the splash naturally. Wait for that instead of force-dismissing.
  try {
    await page.waitForSelector("#app-loading", {
      state: "detached",
      timeout: 20_000,
    });
  } catch {
    // If splash is stuck (safety timeout exceeded), force-dismiss
    await dismissSplashScreen(page);
  }

  await page.waitForTimeout(TIMEOUTS.SPA_RELOAD_SETTLE);
}

// ─── Test Definition ──────────────────────────────────────────────────────────

const routes = resolveRoutes();
const credentials = resolveCredentials();
const isDark = process.env.SCREENSHOT_DARK !== "false";
const hasAuth = credentials !== null;
const captureDir = join(__dirname, "captures");

// Validate that STORAGE_KEYS haven't drifted from canonical app sources
test.describe("Storage key sync", () => {
  test("keys match canonical app sources", () => {
    const drift = validateStorageKeys();
    if (drift.length > 0) {
      throw new Error(
        `STORAGE_KEYS out of sync with app source:\n${drift.join("\n")}`
      );
    }
  });
});

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
    // Share a single browser context across all auth tests for this device project.
    // Firebase auth persists in IndexedDB (not captured by storageState), so we
    // keep the context alive to avoid re-logging in for every test (~20-35s saved each).
    let sharedContext: import("@playwright/test").BrowserContext;

    test.beforeAll(async ({ browser }) => {
      sharedContext = await browser.newContext();
      const page = await sharedContext.newPage();

      await page.goto("/", { waitUntil: "load", timeout: TIMEOUTS.INITIAL_LOAD });
      await bypassLandingPage(page);

      const loggedIn = await loginWithCredentials(page, credentials!);
      if (!loggedIn) {
        await sharedContext.close();
        throw new Error(
          "Login failed. Check credentials in tests/screenshots/credentials.local.json.\n" +
            "Possible causes: wrong credentials, UI changed, network timeout."
        );
      }

      // Complete the first-run wizard if it appears (new accounts).
      // The wizard blocks the entire app — must be clicked through, not suppressed.
      await completeFirstRunWizard(page);

      // Set onboarding + theme so every subsequent page inherits them
      await suppressOnboarding(page);
      await setTheme(page, isDark);
      await page.close();
    });

    test.afterAll(async () => {
      if (sharedContext) await sharedContext.close();
    });

    for (const route of authRoutes) {
      test(`${route.label}`, async ({}, testInfo) => {
        const deviceSlug = testInfo.project.name;

        // Slow async surfaces (3D scenes) can exceed the default test timeout
        // once their extended waits are added up.
        if (route.settleMs) testInfo.setTimeout(180_000);

        // New page in the shared context — inherits auth + localStorage
        const page = await sharedContext.newPage();

        // Seed route-specific localStorage BEFORE the app boots (e.g. the
        // sequence-viewer surface via tka-viewer-mode).
        if (route.storageSeed) {
          await page.addInitScript((seed: Record<string, string>) => {
            for (const [key, value] of Object.entries(seed)) {
              localStorage.setItem(key, value);
            }
          }, route.storageSeed);
        }

        // Navigate directly to the target module/tab via URL
        await navigateToRoute(page, route);
        await completeFirstRunWizard(page);
        await dismissModals(page);
        await stabilize(page, route);

        const filename = `${route.label}--${deviceSlug}.png`;
        await page.screenshot({
          path: join(captureDir, filename),
          fullPage: false,
        });

        await page.close();
      });
    }
  });
} else if (authRoutes.length > 0 && !hasAuth) {
  test.describe("App modules (skipped — no credentials)", () => {
    test("credentials not provided", () => {
      console.log(
        "Skipping auth routes. Set SCREENSHOT_TEST_EMAIL and SCREENSHOT_TEST_PASSWORD, " +
          "or add credentials to tests/screenshots/credentials.local.json"
      );
    });
  });
}
