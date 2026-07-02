/**
 * Service-worker update manager.
 *
 * Detects when a new SW has installed and is WAITING (a new deploy), prompts
 * the caller via an injected callback, applies the update on request, and
 * reloads the page exactly once when the new worker takes control.
 *
 * UI-agnostic by design: the prompt is a callback, so this is unit-testable
 * against a fake ServiceWorkerRegistration and never imports a component.
 * Wired in src/hooks.client.ts (production registration only).
 */

export interface SwUpdateManagerDeps {
  /** The registration returned by navigator.serviceWorker.register(). */
  registration: ServiceWorkerRegistration;
  /** Defaults to navigator.serviceWorker. Injectable for tests. */
  serviceWorker?: ServiceWorkerContainer;
  /**
   * Called once when an update is ready. Receives `apply`, which activates the
   * waiting worker (posts SKIP_WAITING). The caller shows UI and calls `apply`
   * when the user opts in.
   */
  onUpdateReady: (apply: () => void) => void;
  /** Defaults to a full-page reload. Injectable for tests. */
  reload?: () => void;
}

/**
 * Wire update detection for a registration. Returns a disposer that removes
 * all listeners (rarely needed — the app lives for the tab's lifetime).
 */
export function createSwUpdateManager(deps: SwUpdateManagerDeps): () => void {
  const { registration, onUpdateReady } = deps;
  const container = deps.serviceWorker ?? navigator.serviceWorker;
  const reload = deps.reload ?? (() => location.reload());

  let notified = false;
  let refreshing = false;

  const apply = () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  const notify = () => {
    if (notified) return;
    notified = true;
    onUpdateReady(apply);
  };

  // Case A: a worker is already waiting when we wire up (installed on a prior
  // page view). A waiting worker only exists when one already controls the
  // page, so this is always a genuine update.
  if (registration.waiting && container.controller) {
    notify();
  }

  // Case B: a new worker begins installing now. Fire only once it reaches
  // "installed" AND a controller already exists — otherwise it is the very
  // first install, which should activate silently with no reload prompt.
  const onUpdateFound = () => {
    const installing = registration.installing;
    if (!installing) return;
    const onStateChange = () => {
      if (installing.state === "installed" && container.controller) {
        notify();
      }
    };
    installing.addEventListener("statechange", onStateChange);
  };
  registration.addEventListener("updatefound", onUpdateFound);

  // The new worker took control (after SKIP_WAITING) → reload once so the page
  // comes back on fresh code + fresh caches. Guard against a double-fire.
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    reload();
  };
  container.addEventListener("controllerchange", onControllerChange);

  // A long-lived tab discovers a new deploy when it regains focus. Cheap, no
  // timer to leak. update() rejections are non-fatal (offline, etc.).
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      registration.update().catch(() => {});
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    registration.removeEventListener("updatefound", onUpdateFound);
    container.removeEventListener("controllerchange", onControllerChange);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
