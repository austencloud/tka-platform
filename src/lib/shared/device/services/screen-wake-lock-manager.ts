interface ScreenWakeLockDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(
    type: "visibilitychange",
    listener: EventListenerOrEventListenerObject
  ): void;
  removeEventListener(
    type: "visibilitychange",
    listener: EventListenerOrEventListenerObject
  ): void;
}

interface ScreenWakeLockSentinel {
  readonly released: boolean;
  addEventListener(
    type: "release",
    listener: EventListenerOrEventListenerObject
  ): void;
  removeEventListener(
    type: "release",
    listener: EventListenerOrEventListenerObject
  ): void;
  release(): Promise<void>;
}

export interface ScreenWakeLockDependencies {
  document?: ScreenWakeLockDocument | null;
  requestWakeLock?: (() => Promise<ScreenWakeLockSentinel>) | null;
}

export interface IScreenWakeLockManager {
  setActive(active: boolean): void;
  dispose(): void;
}

/**
 * Keeps the screen awake only while one user activity needs it.
 *
 * Each activity owns its own instance. Stopping Train must not release a lock
 * held by Meditation, and a late browser response must not keep the Review
 * screen awake after Train has ended.
 */
export function createScreenWakeLockManager(
  dependencies: ScreenWakeLockDependencies = {}
): IScreenWakeLockManager {
  let desiredActive = false;
  let sentinel: ScreenWakeLockSentinel | null = null;
  let sentinelReleaseListener: EventListener | null = null;
  let requestInFlight: Promise<void> | null = null;
  let generation = 0;
  let disposed = false;
  let listeningDocument: ScreenWakeLockDocument | null = null;

  function resolveDocument(): ScreenWakeLockDocument | null {
    if (dependencies.document !== undefined) {
      return dependencies.document;
    }

    return typeof document === "undefined" ? null : document;
  }

  function resolveRequest(): (() => Promise<ScreenWakeLockSentinel>) | null {
    if (dependencies.requestWakeLock !== undefined) {
      return dependencies.requestWakeLock;
    }

    if (
      typeof navigator === "undefined" ||
      !("wakeLock" in navigator) ||
      !navigator.wakeLock
    ) {
      return null;
    }

    return () => navigator.wakeLock.request("screen");
  }

  function isVisible(
    targetDocument: ScreenWakeLockDocument | null = resolveDocument()
  ): boolean {
    return targetDocument?.visibilityState === "visible";
  }

  function releaseSentinel(target: ScreenWakeLockSentinel): void {
    try {
      void target.release().catch(() => {
        // The browser may have released it before our cleanup ran.
      });
    } catch {
      // A device-policy failure must never interrupt the activity lifecycle.
    }
  }

  function releaseCurrentSentinel(): void {
    const current = sentinel;
    const releaseListener = sentinelReleaseListener;

    sentinel = null;
    sentinelReleaseListener = null;

    if (!current) return;
    if (releaseListener) {
      current.removeEventListener("release", releaseListener);
    }
    releaseSentinel(current);
  }

  function ensureVisibilityListener(): ScreenWakeLockDocument | null {
    const targetDocument = resolveDocument();
    if (!targetDocument || targetDocument === listeningDocument) {
      return targetDocument;
    }

    listeningDocument?.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    targetDocument.addEventListener("visibilitychange", handleVisibilityChange);
    listeningDocument = targetDocument;
    return targetDocument;
  }

  function requestIfNeeded(): void {
    if (
      disposed ||
      !desiredActive ||
      sentinel !== null ||
      requestInFlight !== null
    ) {
      return;
    }

    const targetDocument = ensureVisibilityListener();
    if (!isVisible(targetDocument)) return;

    const requestWakeLock = resolveRequest();
    if (!requestWakeLock) return;

    const requestGeneration = generation;
    let requestPromise: Promise<ScreenWakeLockSentinel>;
    try {
      requestPromise = requestWakeLock();
    } catch {
      return;
    }

    let reconcileAfterCompletion = false;
    const task = (async () => {
      try {
        const acquiredSentinel = await requestPromise;
        const canKeepSentinel =
          !disposed &&
          desiredActive &&
          generation === requestGeneration &&
          isVisible();

        if (!canKeepSentinel) {
          reconcileAfterCompletion =
            !disposed &&
            desiredActive &&
            generation !== requestGeneration &&
            isVisible();
          releaseSentinel(acquiredSentinel);
          return;
        }

        const handleRelease = () => {
          if (sentinel !== acquiredSentinel) return;

          acquiredSentinel.removeEventListener("release", handleRelease);
          sentinel = null;
          sentinelReleaseListener = null;

          if (!disposed && desiredActive && isVisible()) {
            if (requestInFlight) {
              reconcileAfterCompletion = true;
            } else {
              requestIfNeeded();
            }
          }
        };

        sentinel = acquiredSentinel;
        sentinelReleaseListener = handleRelease;
        acquiredSentinel.addEventListener("release", handleRelease);

        // A browser can release the handle between resolving the request and
        // our listener being attached. Treat it like any other release.
        if (acquiredSentinel.released) {
          handleRelease();
        }
      } catch {
        // Rejections are expected under low power or device policy. A newer
        // activation still deserves its own request after this stale one ends.
        reconcileAfterCompletion =
          !disposed &&
          desiredActive &&
          generation !== requestGeneration &&
          isVisible();
      }
    })();

    requestInFlight = task;
    void task.then(() => {
      try {
        if (requestInFlight !== task) return;
        requestInFlight = null;

        if (reconcileAfterCompletion) {
          requestIfNeeded();
        }
      } catch {
        // Wake-lock cleanup cannot be allowed to escape into the activity.
        if (requestInFlight === task) {
          requestInFlight = null;
        }
      }
    });
  }

  function handleVisibilityChange(): void {
    const targetDocument = listeningDocument ?? resolveDocument();
    if (!isVisible(targetDocument)) {
      generation += 1;
      releaseCurrentSentinel();
      return;
    }

    if (desiredActive) {
      requestIfNeeded();
    }
  }

  function setActive(active: boolean): void {
    if (disposed) return;

    if (active) {
      desiredActive = true;
      ensureVisibilityListener();
      requestIfNeeded();
      return;
    }

    if (!desiredActive) return;
    desiredActive = false;
    generation += 1;
    releaseCurrentSentinel();
  }

  function dispose(): void {
    if (disposed) return;

    desiredActive = false;
    disposed = true;
    generation += 1;
    releaseCurrentSentinel();

    listeningDocument?.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    listeningDocument = null;
  }

  return {
    setActive,
    dispose,
  };
}
