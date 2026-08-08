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
  /** A startup path already posted SKIP_WAITING and is awaiting takeover. */
  activationAlreadyRequested?: boolean;
}

export interface StartupSwUpdateDeps {
  registration: ServiceWorkerRegistration;
  serviceWorker?: ServiceWorkerContainer;
  reload?: () => void;
  timeoutMs?: number;
}

export type StartupSwUpdateResult = "none" | "reloading" | "deferred";

/**
 * Activates a worker that was already waiting when this page began loading.
 * The caller runs this from SvelteKit's client init hook, before hydration, so
 * an old deploy never reaches the visible application just to show a toast.
 */
export async function applyWaitingSwUpdateBeforeStart(
  deps: StartupSwUpdateDeps
): Promise<StartupSwUpdateResult> {
  const container = deps.serviceWorker ?? navigator.serviceWorker;
  const waiting = deps.registration.waiting;
  if (!waiting || !container.controller) return "none";

  const reload = deps.reload ?? (() => location.reload());
  const timeoutMs = deps.timeoutMs ?? 2_500;

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      container.removeEventListener("controllerchange", onControllerChange);
      clearTimeout(timeoutId);
    };

    const finish = (result: StartupSwUpdateResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onControllerChange = () => {
      finish("reloading");
      reload();
    };

    const timeoutId = setTimeout(() => finish("deferred"), timeoutMs);
    container.addEventListener("controllerchange", onControllerChange);

    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      finish("deferred");
    }
  });
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
  let activationRequested = deps.activationAlreadyRequested ?? false;
  let refreshing = false;
  const installingListeners = new Map<ServiceWorker, () => void>();

  const apply = () => {
    const waiting = registration.waiting;
    if (!waiting) return;
    activationRequested = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
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
  const watchInstalling = (installing: ServiceWorker | null) => {
    if (!installing) return;
    if (installingListeners.has(installing)) return;
    const onStateChange = () => {
      if (installing.state === "installed" && container.controller) {
        notify();
      }
    };
    installingListeners.set(installing, onStateChange);
    installing.addEventListener("statechange", onStateChange);
    onStateChange();
  };
  const onUpdateFound = () => watchInstalling(registration.installing);
  registration.addEventListener("updatefound", onUpdateFound);
  // register() can discover an update before the caller receives the
  // registration promise. Do not miss an install already in progress.
  watchInstalling(registration.installing);

  // A controllerchange also fires when the very first worker calls
  // clients.claim(). Reload only after this manager explicitly requested a
  // waiting update's activation; otherwise a first-time visitor gets bounced
  // back through the route's loading screen after the page has already opened.
  const onControllerChange = () => {
    if (!activationRequested || refreshing) return;
    refreshing = true;
    reload();
  };
  container.addEventListener("controllerchange", onControllerChange);

  // A long-lived tab discovers a new deploy when it regains focus. Cheap, no
  // timer to leak. update() rejections are non-fatal (offline, etc.).
  const onVisibility = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      registration.update().catch(() => {});
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    registration.removeEventListener("updatefound", onUpdateFound);
    for (const [worker, listener] of installingListeners) {
      worker.removeEventListener("statechange", listener);
    }
    installingListeners.clear();
    container.removeEventListener("controllerchange", onControllerChange);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
