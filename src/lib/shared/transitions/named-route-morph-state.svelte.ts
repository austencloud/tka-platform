/**
 * Coordination state for route-level named View Transitions.
 *
 * The active flag lets persistent marketing chrome suppress its own page fade,
 * while the temporary root class keeps the expensive full-page snapshot out of
 * this named-element-only transition.
 */

export const NAMED_ROUTE_MORPH_CLASS = "named-route-morph";

interface NamedRouteViewTransition {
  finished: Promise<void>;
}

let active = $state(false);
let nextOwner = 0;
const activeOwners = new Set<number>();
const afterMorphCallbacks = new Set<() => void>();

export function isNamedRouteMorphActive(): boolean {
  return active;
}

function beginNamedRouteMorph(): number {
  nextOwner += 1;
  activeOwners.add(nextOwner);
  active = true;
  document.documentElement.classList.add(NAMED_ROUTE_MORPH_CLASS);
  return nextOwner;
}

function endNamedRouteMorph(token: number): void {
  activeOwners.delete(token);
  active = activeOwners.size > 0;
  document.documentElement.classList.toggle(NAMED_ROUTE_MORPH_CLASS, active);

  if (!active && afterMorphCallbacks.size > 0) {
    const callbacks = [...afterMorphCallbacks];
    afterMorphCallbacks.clear();
    const callbackErrors: unknown[] = [];
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        // One deferred enhancement must not strand the rest of the queue.
        // Report the first failure on a fresh microtask after every subscriber
        // has had its chance to resume.
        callbackErrors.push(error);
      }
    }
    if (callbackErrors.length > 0) {
      queueMicrotask(() => {
        throw callbackErrors[0];
      });
    }
  }
}

/**
 * Run nonessential client work once named route snapshots have finished.
 * Returns a cancellation handle so actions/components do not wake after they
 * have unmounted. Outside a named morph the callback runs immediately.
 */
export function runAfterNamedRouteMorph(callback: () => void): () => void {
  if (!active) {
    callback();
    return () => {};
  }

  afterMorphCallbacks.add(callback);
  return () => afterMorphCallbacks.delete(callback);
}

/**
 * Defer expensive, nonessential work until both the named morph and a browser
 * idle turn have cleared. This keeps generator imports and canvas setup off the
 * transition's final frame while retaining a bounded fallback for busy pages.
 */
export function runAfterNamedRouteMorphIdle(
  callback: () => void,
  options: { timeout?: number; fallbackDelay?: number } = {}
): () => void {
  let cancelled = false;
  let cancelPending = () => {};

  const waitForQuietMorph = (): void => {
    if (cancelled) return;

    if (active) {
      cancelPending = runAfterNamedRouteMorph(() => {
        cancelPending = () => {};
        scheduleIdleTurn();
      });
      return;
    }

    scheduleIdleTurn();
  };

  const wake = (): void => {
    cancelPending = () => {};
    if (cancelled) return;

    // A navigation can begin after an idle callback was queued. Re-arm behind
    // that newer morph instead of letting expensive work cross its snapshot.
    if (active) {
      waitForQuietMorph();
      return;
    }

    callback();
  };

  function scheduleIdleTurn(): void {
    if (cancelled) return;

    if (typeof requestIdleCallback !== "undefined") {
      const idleId = requestIdleCallback(wake, {
        timeout: options.timeout ?? 2400,
      });
      cancelPending = () => cancelIdleCallback(idleId);
      return;
    }

    const timeoutId = setTimeout(wake, options.fallbackDelay ?? 180);
    cancelPending = () => clearTimeout(timeoutId);
  }

  waitForQuietMorph();

  return () => {
    cancelled = true;
    cancelPending();
  };
}

/**
 * Start a named route morph and hold its shared UI/CSS ownership until the
 * browser finishes (or rejects) the transition. Synchronous startup failures
 * release ownership before being rethrown to the navigation fallback.
 */
export function runNamedRouteMorph<T extends NamedRouteViewTransition>(
  start: () => T
): T {
  const token = beginNamedRouteMorph();

  try {
    const transition = start();
    void transition.finished.then(
      () => endNamedRouteMorph(token),
      () => endNamedRouteMorph(token)
    );
    return transition;
  } catch (error) {
    endNamedRouteMorph(token);
    throw error;
  }
}
