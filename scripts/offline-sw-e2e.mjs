/**
 * Real-browser offline proof for static/sw.js.
 *
 * The mocked sw-harness (tests/helpers/sw-harness.ts) evaluates the SW source
 * against a fake CacheStorage/fetch — it verifies the STRATEGY LOGIC but can't
 * exercise the actual browser SW runtime, Cache Storage, or network-off
 * serving. This script closes that gap: it drives REAL Chromium (via the
 * installed `playwright` core package — no @playwright/test runner needed),
 * registers the real SW, cuts the network, and asserts the app shell and a
 * render-critical pictograph SVG are served from cache.
 *
 * Why the fake host + HTTPS + cert-ignore flag:
 * - sw.js bypasses `localhost`/`127.0.0.1` on purpose (a stale prod SW on
 *   localhost deadlocks the Vite dev server, sw.js:103) and registration is
 *   production-only (hooks.client.ts `!dev`). So the SW is INERT on any
 *   localhost origin.
 * - Chromium's --host-resolver-rules maps https://tka.test -> 127.0.0.1: a
 *   non-localhost origin where the SW is live, still hitting the local preview.
 * - A SW needs a secure context on a non-localhost host. `vite preview`
 *   inherits `server.https` (the mkcert dev cert) automatically. The cert is
 *   issued for localhost, not tka.test, so --ignore-certificate-errors is
 *   required to make the origin a trusted secure context — a service worker
 *   refuses to register on a cert-error origin, and the context-level
 *   ignoreHTTPSErrors alone does NOT fix that. (The
 *   --unsafely-treat-insecure-origin-as-secure flag was rejected: multiple open
 *   Playwright bugs, not respected headless.)
 *
 * The app full-navigates during boot (unauthenticated redirect), so every page
 * evaluate is navigation-resilient and the load-bearing proof is the offline
 * goto('/app') RESPONSE itself — served by the SW from cache with the network
 * physically off.
 *
 * NON-BLOCKING / LOCAL by design (component-test-discipline): the mkcert cert
 * is absent in CI, so this is not a CI gate. CI wiring (provision a cert or
 * generate one in-process) is the known next step.
 *
 * Prereqs: a production build must exist (`npm run build:fast`) and Playwright
 * Chromium must be installed. Run:
 *   npm run build:fast && node scripts/offline-sw-e2e.mjs
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

// Resolve vite's real bin path via its package.json `bin` field. `require`
// can't reach ./bin/vite.js (not in vite's `exports`), and node_modules/.bin
// shims need a shell on Windows. This works through the pnpm symlink.
const VITE_DIR = resolve(process.cwd(), "node_modules/vite");
const VITE_BIN = join(
  VITE_DIR,
  JSON.parse(readFileSync(join(VITE_DIR, "package.json"), "utf8")).bin.vite
);

const PORT = 4173;
const HOST_ALIAS = "tka.test"; // non-localhost → sw.js does NOT bypass
const BASE = `https://${HOST_ALIAS}:${PORT}`;
const PRECACHED_SVG = "/images/grid/diamond_grid.svg"; // in the precache manifest

function log(msg) {
  console.log(`[offline-e2e] ${msg}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Spawn `vite preview` directly via node (no shell/npx — those launch fragilely
 * on Windows). Resolves once the server prints its ready banner.
 */
function startPreview() {
  log("starting preview server (vite preview, inherits HTTPS from server.https)…");
  const child = spawn(
    process.execPath,
    [VITE_BIN, "preview", "--port", String(PORT), "--host", "127.0.0.1"],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("preview did not become ready within 60s")),
      60_000
    );
    const onData = (buf) => {
      if (buf.toString().includes(String(PORT))) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`preview exited early (code ${code})`));
    });
  });

  return { child, ready };
}

function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    // best effort
  }
}

async function gotoWithRetry(page, url, attempts, delayMs) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: 15_000 });
      return;
    } catch (err) {
      lastErr = err;
      await sleep(delayMs);
    }
  }
  throw new Error(
    `could not load ${url} after ${attempts} attempts: ${lastErr?.message ?? lastErr}`
  );
}

/**
 * page.evaluate that tolerates the app's boot-time full-navigations (which
 * destroy the execution context). Retries until it lands a clean evaluate.
 */
async function resilientEval(page, pageFn, arg, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      return await page.evaluate(pageFn, arg);
    } catch (err) {
      lastErr = err;
      await sleep(400);
    }
  }
  throw lastErr ?? new Error("resilientEval timed out");
}

/** Poll until the registered SW reaches the "activated" state (precache done). */
async function waitForSwActive(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const active = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return !!(reg && reg.active && reg.active.state === "activated");
      });
      if (active) return true;
    } catch {
      // context destroyed by an app navigation — retry
    }
    await sleep(400);
  }
  return false;
}

async function main() {
  const { child: preview, ready } = startPreview();
  const browser = await chromium.launch({
    args: [
      `--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`,
      // Trust the mkcert-for-localhost cert at the network layer so the
      // tka.test origin is a real SECURE CONTEXT — a SW refuses to register on
      // a cert-error origin, which context-level ignoreHTTPSErrors alone does
      // NOT fix.
      "--ignore-certificate-errors",
    ],
  });

  try {
    await ready;
    log("preview ready");

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => log(`[browser:pageerror] ${e.message}`));

    // 1. First online load — registers the SW, triggers install (precache).
    log("loading /app online…");
    await gotoWithRetry(page, `${BASE}/app`, 15, 1000);

    // 2. Wait for the SW to reach "activated" — only happens once install's
    //    waitUntil (the precache) resolves. Navigation-resilient.
    log("waiting for the service worker to activate (precache complete)…");
    const active = await waitForSwActive(page, 60_000);
    assert(active, "service worker reached the activated state");
    log("✓ SW activated");

    // 3. Install precache actually populated Cache Storage with the grid SVG
    //    (proves install RAN, not just that the SW registered).
    const cached = await resilientEval(
      page,
      (url) => caches.match(url).then((r) => !!r),
      PRECACHED_SVG
    );
    assert(cached, `install precache should hold ${PRECACHED_SVG}`);
    log("✓ install precache holds the grid SVG");

    // 4. Cut the network at the browser layer.
    log("going offline…");
    await context.setOffline(true);

    // 5. Navigate to /app with NO network. The active, controlling SW must
    //    serve the cached shell — the goto response is the atomic proof. Use
    //    "commit" (fires on response receipt) so the app's offline boot
    //    failures don't affect the result.
    log("loading /app offline — the SW must serve the cached shell…");
    const resp = await page.goto(`${BASE}/app`, {
      waitUntil: "commit",
      timeout: 20_000,
    });
    assert(resp != null, "offline navigation produced a response");
    assert(
      resp.status() < 400,
      `SW served the app shell offline (got HTTP ${resp.status()})`
    );
    log(`✓ app shell served offline (HTTP ${resp.status()})`);

    // 6. A render-critical pictograph SVG is served from cache while offline.
    //    With the network down, fetch() resolves ONLY if the SW answers.
    const svg = await resilientEval(page, async (url) => {
      const r = await fetch(url);
      return { ok: r.ok, status: r.status, head: (await r.text()).slice(0, 80) };
    }, PRECACHED_SVG);
    assert(svg.ok, `offline fetch of ${PRECACHED_SVG} served by SW (status ${svg.status})`);
    assert(svg.head.includes("<svg"), "served body is the real SVG");
    log("✓ pictograph SVG served from cache while offline");

    console.log("\nOFFLINE SW E2E: PASS ✅");
  } finally {
    await browser.close();
    killTree(preview);
  }
}

main().catch((err) => {
  console.error(`\nOFFLINE SW E2E: FAIL ❌\n${err?.stack ?? err}`);
  process.exitCode = 1;
});
