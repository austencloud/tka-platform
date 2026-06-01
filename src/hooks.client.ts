/**
 * Client-side hooks
 */
import { browser, dev } from "$app/environment";
if (typeof window !== 'undefined' && 'Capacitor' in window) {
  import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
    CapacitorUpdater.notifyAppReady();
  }).catch(() => {});
}

// Suppress Three.js "Multiple instances" warning caused by Vite optimizer
// bundling globe.gl's three-globe with a separate copy despite pnpm dedupe.
if (browser) {
  const _origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Multiple instances of Three.js being imported")) return;
    _origWarn.apply(console, args);
  };
}

// Always expose cache benchmark utility globally (in both dev and prod for testing)
if (browser) {
  import("$lib/shared/render/utils/cache-benchmark")
    .then((module) => {
      // Explicitly expose on window
      (window as unknown as { runCacheBenchmark: typeof module.runCacheBenchmark }).runCacheBenchmark = module.runCacheBenchmark;
    })
    .catch(() => {
      // Cache benchmark not available - expected in some builds
    });
}

// Dev mode: tear down ALL service workers + their caches to prevent stale
// production SWs from intercepting Vite HMR fetches.
//
// The footgun: the browser runs the SW bytes that were INSTALLED (from a prior
// prod/preview visit), not the current static/sw.js. An old sw.js that predates
// the localhost-bypass intercepts HMR chunk/asset fetches with no-timeout
// cache-first logic → "Failed to fetch" + dead HMR until a manual hard refresh.
//
// unregister() alone is insufficient: it does NOT release the SW from the page
// it is ALREADY controlling. So if a stale SW controls this load, we also force
// a single guarded reload so the page reloads uncontrolled and HMR works again.
if (browser && dev && "serviceWorker" in navigator) {
  const SW_ESCAPE_KEY = "tka-dev-sw-escape";
  void (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      if (navigator.serviceWorker.controller) {
        // A stale SW is still controlling this page. A plain reload is not
        // enough: the SW may serve a CACHED HTML shell that points at old chunk
        // hashes, so the reload just re-loads stale code (e.g. an old renderer
        // bundle over the dev.tkaflowarts.com tunnel). Cache-bust the navigation
        // with a unique query so the HTML — and thus the fresh chunk hashes — is
        // refetched from the network. Same trick as forceFreshReload().
        if (!sessionStorage.getItem(SW_ESCAPE_KEY)) {
          sessionStorage.setItem(SW_ESCAPE_KEY, "1");
          const url = new URL(window.location.href);
          url.searchParams.set("fresh", String(Date.now()));
          window.location.replace(url.toString());
        }
      } else {
        // Clean (no controller) — re-arm the escape for any future stale SW and
        // strip the one-shot cache-bust param so the URL stays tidy.
        sessionStorage.removeItem(SW_ESCAPE_KEY);
        const url = new URL(window.location.href);
        if (url.searchParams.has("fresh")) {
          url.searchParams.delete("fresh");
          window.history.replaceState(null, "", url.toString());
        }
      }
    } catch {
      // Best-effort cleanup; never block app boot on SW teardown.
    }
  })();
}

// Dev: auto-recover from a failed HMR update.
// When a child module fails to hot-reload (commonly: a .svelte/.svelte.ts file
// saved mid-write by an external editor or cloud agent), Vite leaves an
// undefined module in the graph and the HMR apply throws an unhandled rejection
// inside the HMR client (HMRClient.queueUpdate → "reading 'default'"). The
// affected pane goes dead until a manual refresh — and that refresh often hangs
// because in-flight /data/*.json fetches stall while the server re-settles.
// Detect the HMR-client crash signature and do ONE guarded full reload so the
// page self-heals. The sessionStorage guard prevents an infinite reload loop if
// the error is a genuine, persistent syntax error (then Vite's overlay shows it).
if (browser && dev) {
  const HMR_RELOAD_KEY = "tka-hmr-reload";

  const isHmrClientFailure = (reason: unknown): boolean => {
    const stack = (reason as Error)?.stack ?? "";
    return /HMRClient|queueUpdate|fetchUpdate|warnFailedUpdate/.test(stack);
  };

  const recoverFromHmrFailure = (reason: unknown): void => {
    if (!isHmrClientFailure(reason)) return;
    if (sessionStorage.getItem(HMR_RELOAD_KEY)) return; // already tried — don't loop
    sessionStorage.setItem(HMR_RELOAD_KEY, "1");
    location.reload();
  };

  window.addEventListener("unhandledrejection", (event) =>
    recoverFromHmrFailure(event.reason),
  );
  window.addEventListener("error", (event) => recoverFromHmrFailure(event.error));

  // Re-arm after the page has stayed alive: a later edit may legitimately need
  // another recovery reload. If a reload immediately re-errors during boot, the
  // guard is still set within this window, so the loop is broken.
  setTimeout(() => sessionStorage.removeItem(HMR_RELOAD_KEY), 4000);
}

// Production: auto-recover from stale chunks after a deploy.
// When the SW serves an old HTML shell that references chunk hashes the server
// no longer has, dynamic imports fail. A single reload fetches the new manifest.
if (browser && !dev) {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const reloaded = sessionStorage.getItem("tka-chunk-reload");
    if (!reloaded) {
      sessionStorage.setItem("tka-chunk-reload", "1");
      window.location.reload();
    }
  });

  // Clear the reload guard on successful page load (no stale chunks)
  sessionStorage.removeItem("tka-chunk-reload");

  // Report unhandled promise rejections to error telemetry
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason) || "Unknown rejection";
    const stack = reason?.stack;

    if (
      message.includes("ResizeObserver loop") ||
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("MIME type")
    ) {
      return;
    }

    import("$lib/shared/error/services/error-telemetry-reporter")
      .then(({ reportErrorTelemetry }) => {
        reportErrorTelemetry({
          message: `Unhandled rejection: ${message.slice(0, 200)}`,
          severity: "warning",
          context: {
            module: "global",
            action: "unhandledrejection",
            additionalData: {
              url: window.location.pathname,
              stack: stack?.slice(0, 1000),
            },
          },
          error: reason instanceof Error ? reason : undefined,
        });
      })
      .catch(() => {});
  });
}

// Production: register the minimal hand-written service worker
if (browser && !dev && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      if (registration.active && "sync" in registration) {
        (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register("tka-sync-queue")
          .catch(() => {});
      }
    })
    .catch((err) => {
      console.error("[SW] Registration failed:", err);
    });
}
