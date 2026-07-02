/**
 * Offline regression suite for static/sw.js (offline audit 2026-06-30).
 *
 * The service worker is a classic script with no exports; the harness
 * (tests/helpers/sw-harness.ts) evaluates the real file inside a controlled
 * scope with a fake CacheStorage and a routed fetch mock. Each test pins a
 * shipped offline fix — exactly the silent-bug class eyes can't catch:
 * everything looks fine online, and only a cold-offline reload (festival
 * field, no console open) reveals the regression.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { createSwHarness, respondWith } from "../helpers/sw-harness";

const ORIGIN = "https://tkaflowarts.com";
const SHELL_HTML = "<html><body>app shell</body></html>";

/** Drain the SW's fire-and-forget cache writes (put chains are microtask +
 * setTimeout(0)-free, but arrayBuffer streams need a couple of turns). */
async function settleBackgroundWork(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

function harnessWithShellRoute() {
  const h = createSwHarness();
  h.route("/app", respondWith(SHELL_HTML, { contentType: "text/html" }));
  return h;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sw.js install precache", () => {
  // Fix: install-time SVG precache (audit fix #1 companion) — pictographs must
  // render cold-offline without ever having been viewed online.
  it("precaches the SVG manifest set alongside the /app shell", async () => {
    const h = harnessWithShellRoute();
    h.route(
      "/svg-precache-manifest.json",
      respondWith({
        count: 2,
        assets: ["/images/grid/diamond_grid.svg", "/images/arrow.svg"],
      })
    );
    h.route("/images/grid/diamond_grid.svg", respondWith("<svg>grid</svg>"));
    h.route("/images/arrow.svg", respondWith("<svg>arrow</svg>"));

    await h.dispatchInstall();

    expect(await h.cacheHas(h.constants.cacheName, "/app")).toBe(true);
    expect(
      await h.cacheHas(h.constants.cacheName, "/images/grid/diamond_grid.svg")
    ).toBe(true);
    expect(await h.cacheHas(h.constants.cacheName, "/images/arrow.svg")).toBe(true);
    expect(h.self.skipWaiting).toHaveBeenCalled();
  });

  // Fix: precacheSvgAssets is failure-tolerant — an older deploy without the
  // manifest (404) must NEVER fail install and brick SW updates.
  it("survives a missing manifest (404) — install resolves, /app still cached", async () => {
    const h = harnessWithShellRoute();
    h.route("/svg-precache-manifest.json", respondWith("not found", { status: 404 }));

    await expect(h.dispatchInstall()).resolves.toBeUndefined();
    expect(await h.cacheHas(h.constants.cacheName, "/app")).toBe(true);

    // Same guarantee when the manifest fetch rejects outright (network error).
    const h2 = harnessWithShellRoute();
    await expect(h2.dispatchInstall()).resolves.toBeUndefined();
    expect(await h2.cacheHas(h2.constants.cacheName, "/app")).toBe(true);
  });

  // Fix: a stray asset 404 (mid-deploy race) must not fail install nor block
  // the sibling assets — Promise.allSettled + per-response ok check.
  it("survives one asset 404 — other assets still cached, install resolves", async () => {
    const h = harnessWithShellRoute();
    h.route(
      "/svg-precache-manifest.json",
      respondWith({ count: 2, assets: ["/images/good.svg", "/images/gone.svg"] })
    );
    h.route("/images/good.svg", respondWith("<svg>good</svg>"));
    h.route("/images/gone.svg", respondWith("nope", { status: 404 }));

    await expect(h.dispatchInstall()).resolves.toBeUndefined();
    expect(await h.cacheHas(h.constants.cacheName, "/images/good.svg")).toBe(true);
    expect(await h.cacheHas(h.constants.cacheName, "/images/gone.svg")).toBe(false);
  });

  // Fix: white-screen — /app was cached but its boot chunks were only ever
  // runtime-cached, so install → go offline → reload died before hydration.
  // precacheBootChunks scrapes /_app/immutable/ URLs out of the cached shell.
  it("precaches boot-critical chunks scraped from the /app shell HTML", async () => {
    const h = createSwHarness();
    const entry = "/_app/immutable/entry/start.abc.js";
    const chunk = "/_app/immutable/chunks/x.js";
    h.route(
      "/app",
      respondWith(
        `<html><head>` +
          `<script src="${entry}"></script>` +
          `<link rel="modulepreload" href="${chunk}">` +
          `</head><body></body></html>`,
        { contentType: "text/html" }
      )
    );
    h.route(entry, respondWith("// entry"));
    h.route(chunk, respondWith("// chunk"));

    await h.dispatchInstall();

    expect(await h.cacheHas(h.constants.cacheName, entry)).toBe(true);
    expect(await h.cacheHas(h.constants.cacheName, chunk)).toBe(true);
  });
});

describe("sw.js activate", () => {
  // Fix: stale version caches (tka-v2) must be swept, but the dedicated 3D
  // asset cache survives version bumps — re-downloading GLB/KTX2 binaries on
  // every SW update would be a silent multi-MB regression.
  it("deletes stale version caches, keeps current + 3D asset cache", async () => {
    const h = createSwHarness();
    await h.seedCache("tka-v2", "/old", "stale entry");
    await h.seedCache(h.constants.cacheName, "/app", SHELL_HTML);
    await h.seedCache(h.constants.assets3dCacheName, "/models/scene.glb", "glb bytes");

    await h.dispatchActivate();

    expect(h.cacheNames()).not.toContain("tka-v2");
    expect(h.cacheNames()).toContain(h.constants.cacheName);
    expect(h.cacheNames()).toContain(h.constants.assets3dCacheName);
    expect(h.self.clients.claim).toHaveBeenCalled();
  });
});

describe("sw.js /images/* stale-while-revalidate", () => {
  // Fix: audit 2026-06-30 BLOCKER — /images was network-only before the rule
  // existed, so pictographs rendered blank offline. SWR must serve the cache
  // when the network is down.
  it("serves the cached copy when the network is down", async () => {
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/images/props/staff.svg", "<svg>cached</svg>");

    const res = await h.dispatchFetch(`${ORIGIN}/images/props/staff.svg`);

    expect(res).not.toBeNull();
    expect(await res!.text()).toBe("<svg>cached</svg>");
  });

  // Fix: SWR contract — serve stale instantly, revalidate in the background,
  // and never let an error response clobber a good cached copy. A 404
  // overwrite would silently blank a pictograph asset until the next deploy.
  it("serves stale, updates the cache in the background, and never caches a 404", async () => {
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/images/a.svg", "stale-body");
    h.route("/images/a.svg", respondWith("fresh-body"));

    const res = await h.dispatchFetch(`${ORIGIN}/images/a.svg`);
    expect(await res!.text()).toBe("stale-body"); // stale served, not fresh

    await settleBackgroundWork();
    expect(await h.cacheBody(h.constants.cacheName, "/images/a.svg")).toBe("fresh-body");

    // Network turns sour: a 404 must NOT overwrite the good cached copy.
    h.route("/images/a.svg", respondWith("error page", { status: 404 }));
    const res2 = await h.dispatchFetch(`${ORIGIN}/images/a.svg`);
    expect(await res2!.text()).toBe("fresh-body");

    await settleBackgroundWork();
    expect(await h.cacheBody(h.constants.cacheName, "/images/a.svg")).toBe("fresh-body");
  });
});

describe("sw.js offline navigation fallbacks", () => {
  // Fix: offline QR — scanning a printed card at a festival with no signal
  // must serve the cached /app shell so the client router's local-decode path
  // (/q/[code]) can resolve the sequence, instead of a raw 503.
  it("serves the cached /app shell for a /q/* navigation when the network is down", async () => {
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/app", SHELL_HTML);

    const res = await h.dispatchFetch(`${ORIGIN}/q/ABC123`, { mode: "navigate" });

    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(await res!.text()).toBe(SHELL_HTML);
  });

  // Fix: degradation ladder for /sequence/* navigations — shell first, then a
  // previously viewed per-URL cached copy, then (and only then) a 503.
  it("falls back to a per-URL cached copy without a shell, and 503 with nothing", async () => {
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/sequence/xyz", "<html>seq page</html>");

    const res = await h.dispatchFetch(`${ORIGIN}/sequence/xyz`, { mode: "navigate" });
    expect(res!.status).toBe(200);
    expect(await res!.text()).toBe("<html>seq page</html>");

    // Cold cache: nothing to serve — explicit 503, not a hang or undefined.
    const h2 = createSwHarness();
    const res2 = await h2.dispatchFetch(`${ORIGIN}/sequence/xyz`, { mode: "navigate" });
    expect(res2!.status).toBe(503);
    expect(await res2!.text()).toBe("Offline");
  });
});

describe("sw.js passthrough boundaries", () => {
  // Fix: the SW must never intercept mutations or foreign origins — a cached
  // response to a POST (or to a third-party request) would be a data-loss
  // class bug that no one sees until a save silently doesn't happen.
  it("does not respond to non-GET or cross-origin requests", async () => {
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/app", SHELL_HTML);

    const postRes = await h.dispatchFetch(`${ORIGIN}/api/save`, { method: "POST" });
    expect(postRes).toBeNull();

    const crossOriginRes = await h.dispatchFetch("https://example.com/whatever");
    expect(crossOriginRes).toBeNull();
  });

  // Fix: dev deadlock — a stale production SW on localhost blocked page
  // refreshes because hooks.client.ts can only unregister AFTER load. The SW
  // must pass through everything on localhost so Vite serves it.
  it("never intercepts on localhost (dev bypass)", async () => {
    const h = createSwHarness({ location: "http://localhost:5173/sw.js" });
    await h.seedCache(h.constants.cacheName, "/images/x.svg", "cached");
    h.route("/images/x.svg", respondWith("network"));

    expect(await h.dispatchFetch("http://localhost:5173/images/x.svg")).toBeNull();
    expect(
      await h.dispatchFetch("http://localhost:5173/app", { mode: "navigate" })
    ).toBeNull();
  });
});

describe("sw.js lie-fi timeout", () => {
  // Fix: on lie-fi (connection opens but never responds) a bare fetch hangs
  // for minutes while a perfectly good cached shell sits in the catch.
  // fetchWithTimeout aborts at ~10s; the harness fetch mock honors the
  // AbortController signal, so fake timers drive the whole path.
  it("falls back to the cached shell after the 10s timeout instead of hanging", async () => {
    vi.useFakeTimers();
    const h = createSwHarness();
    await h.seedCache(h.constants.cacheName, "/app", SHELL_HTML);
    // Connection opens, response never comes: a promise that never settles.
    h.route("/sequence/liefi", () => new Promise<Response>(() => {}));

    const pending = h.dispatchFetch(`${ORIGIN}/sequence/liefi`, { mode: "navigate" });
    await vi.advanceTimersByTimeAsync(11_000);
    const res = await pending;

    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(await res!.text()).toBe(SHELL_HTML);
  });
});
