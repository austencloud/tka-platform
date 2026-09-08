/**
 * RenderActivityGate — the single owner of "should this animated surface be
 * producing frames right now".
 *
 * ## Why this exists
 *
 * `/composer` idled at 29fps with nothing happening: seven independent
 * requestAnimationFrame loops ran every frame, three of them belonging to a
 * hero that had been scrolled entirely off screen. `activate-when-near.ts`
 * gates MOUNTING and is one-way by design, so once a surface mounts its loops
 * run forever regardless of whether anyone can see them.
 *
 * A gate answers one question — is this element worth rendering into — from
 * two signals:
 *
 *   1. IntersectionObserver on the surface's own element (with a margin, so a
 *      surface wakes slightly before it is visible and never reveals a frozen
 *      first frame).
 *   2. `document.visibilityState` — a hidden tab renders nothing.
 *
 * The gate owns NO rAF of its own. Both signals are event-driven, so an idle
 * gate costs zero per-frame work.
 *
 * ## Holds
 *
 * Exports, recordings, and pre-renders drive frames deliberately and must keep
 * running off screen. They take a keyed, refcounted `hold()`, which forces the
 * gate active until every key releases. Same shape as `background-hold`.
 *
 * ## What this deliberately does NOT own
 *
 * Threlte's own render loop and `shared/3d/scene-boot/` (renderer warmup +
 * frame gate) are excluded: the 3D reveal is gated on proven frame stability,
 * so pausing those loops deadlocks the curtain. See the rule row in
 * `docs/architecture/canonical-capabilities.md`.
 */

/** How a gate reports itself for diagnostics. */
export interface RenderActivityGateSnapshot {
  readonly active: boolean;
  readonly intersecting: boolean;
  readonly documentVisible: boolean;
  readonly holds: readonly string[];
  readonly attached: boolean;
}

export interface RenderActivityGateOptions {
  /**
   * IntersectionObserver margin. A surface wakes this far before it scrolls
   * into view, so the first visible frame is already live. Default 200px —
   * roughly one flick of a scroll wheel at 60fps.
   */
  readonly rootMargin?: string;
  /**
   * Skip the viewport arm entirely. For surfaces that are legitimately always
   * on screen (a fixed full-viewport backdrop): the gate then tracks document
   * visibility alone.
   */
  readonly ignoreViewport?: boolean;
  /** Debug label surfaced in `snapshot()`. */
  readonly name?: string;
}

export interface RenderActivityGate {
  /** True when the surface should be producing frames right now. */
  readonly active: boolean;
  /** Observe this element. Replaces any previously attached element. */
  attach(node: Element): void;
  /** Stop observing. The gate reverts to "not intersecting". */
  detach(): void;
  /**
   * Subscribe to activity changes. Fires only on transition, never per frame.
   * Returns an unsubscribe.
   */
  subscribe(listener: (active: boolean) => void): () => void;
  /** Force active while `key` is held. Refcounted; idempotent per key. */
  hold(key: string): void;
  /** Release a hold. The gate resumes tracking once every key has released. */
  release(key: string): void;
  /** Diagnostics for tests and the dev console. */
  snapshot(): RenderActivityGateSnapshot;
  dispose(): void;
}

// ── Shared document-visibility arm ────────────────────────────────────────────
// One listener for the whole app. Gates register here rather than each adding
// their own `visibilitychange` handler.

type VisibilityListener = (visible: boolean) => void;

const visibilityListeners = new Set<VisibilityListener>();
let documentVisible = true;
let installedVisibilityHandler: (() => void) | null = null;

function readDocumentVisibility(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

function installVisibilityListener(): void {
  if (installedVisibilityHandler) return;
  if (typeof document === "undefined") return;
  documentVisible = readDocumentVisibility();
  installedVisibilityHandler = () => {
    const next = readDocumentVisibility();
    if (next === documentVisible) return;
    documentVisible = next;
    for (const listener of visibilityListeners) listener(next);
  };
  document.addEventListener("visibilitychange", installedVisibilityHandler);
}

/**
 * Exposed for tests: forget the shared document-visibility arm and the shared
 * observer pool, so one test's stubbed IntersectionObserver cannot leak into
 * the next.
 */
export function __resetRenderGatingSharedState(): void {
  if (installedVisibilityHandler && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", installedVisibilityHandler);
  }
  installedVisibilityHandler = null;
  visibilityListeners.clear();
  documentVisible = true;
  for (const entry of observerPool.values()) entry.observer.disconnect();
  observerPool.clear();
}

// ── Shared IntersectionObserver pool ──────────────────────────────────────────
// `rootMargin` is a property of the observer, not of the target, so gates that
// want the same margin share one observer. A page with a dozen animated
// surfaces then pays for one observer, not a dozen.

interface PoolEntry {
  readonly observer: IntersectionObserver;
  readonly targets: Map<Element, (intersecting: boolean) => void>;
}

const observerPool = new Map<string, PoolEntry>();

function poolFor(rootMargin: string): PoolEntry | null {
  if (typeof IntersectionObserver === "undefined") return null;
  const existing = observerPool.get(rootMargin);
  if (existing) return existing;

  const targets = new Map<Element, (intersecting: boolean) => void>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        targets.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { rootMargin }
  );
  const created: PoolEntry = { observer, targets };
  observerPool.set(rootMargin, created);
  return created;
}

// ── The gate ──────────────────────────────────────────────────────────────────

const DEFAULT_ROOT_MARGIN = "200px";

export function createRenderActivityGate(
  options: RenderActivityGateOptions = {}
): RenderActivityGate {
  const rootMargin = options.rootMargin ?? DEFAULT_ROOT_MARGIN;
  const ignoreViewport = options.ignoreViewport ?? false;

  // Without an IntersectionObserver (SSR, or an ancient browser) the gate must
  // fail OPEN: rendering a surface nobody can see is a performance cost, but
  // NOT rendering one the user is looking at is a broken page.
  const viewportSupported =
    !ignoreViewport && typeof IntersectionObserver !== "undefined";

  let intersecting = !viewportSupported;
  let visible = readDocumentVisibility();
  let attachedNode: Element | null = null;
  let disposed = false;

  const holds = new Set<string>();
  const listeners = new Set<(active: boolean) => void>();

  let active = computeActive();

  function computeActive(): boolean {
    if (holds.size > 0) return true;
    return intersecting && visible;
  }

  function publish(): void {
    if (disposed) return;
    const next = computeActive();
    if (next === active) return;
    active = next;
    for (const listener of listeners) listener(next);
  }

  const onVisibility: VisibilityListener = (next) => {
    visible = next;
    publish();
  };

  if (typeof document !== "undefined") {
    installVisibilityListener();
    visible = documentVisible;
    visibilityListeners.add(onVisibility);
    active = computeActive();
  }

  function detach(): void {
    if (!attachedNode) return;
    const entry = observerPool.get(rootMargin);
    if (entry) {
      entry.observer.unobserve(attachedNode);
      entry.targets.delete(attachedNode);
    }
    attachedNode = null;
    if (viewportSupported) {
      intersecting = false;
      publish();
    }
  }

  return {
    get active(): boolean {
      return active;
    },

    attach(node: Element): void {
      if (disposed) return;
      if (attachedNode === node) return;
      detach();
      if (!viewportSupported) {
        // Nothing to observe against — stay open (see the fail-open note).
        intersecting = true;
        publish();
        return;
      }
      const entry = poolFor(rootMargin);
      if (!entry) {
        intersecting = true;
        publish();
        return;
      }
      attachedNode = node;
      entry.targets.set(node, (next) => {
        intersecting = next;
        publish();
      });
      entry.observer.observe(node);
    },

    detach,

    subscribe(listener: (active: boolean) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    hold(key: string): void {
      if (holds.has(key)) return;
      holds.add(key);
      publish();
    },

    release(key: string): void {
      if (!holds.delete(key)) return;
      publish();
    },

    snapshot(): RenderActivityGateSnapshot {
      return {
        active,
        intersecting,
        documentVisible: visible,
        holds: [...holds],
        attached: attachedNode !== null,
      };
    },

    dispose(): void {
      if (disposed) return;
      // Marked FIRST so the unobserve below cannot publish a farewell `false`
      // to a host that is already tearing down.
      disposed = true;
      detach();
      visibilityListeners.delete(onVisibility);
      listeners.clear();
      holds.clear();
    },
  };
}

/**
 * Svelte action form: `<div use:renderGateTarget={gate}>`. The gate is created
 * during component init (SSR-safe, no DOM work), the element is handed over
 * once it exists.
 */
export function renderGateTarget(
  node: HTMLElement,
  gate: RenderActivityGate | null | undefined
): { destroy(): void } {
  gate?.attach(node);
  return {
    destroy(): void {
      gate?.detach();
    },
  };
}

/**
 * Always-active gate for callers that must never pause: offscreen export
 * engines, video pre-renderers, and any deterministic frame driver. Cheaper
 * and more honest than creating a real gate and immediately holding it.
 */
export function createAlwaysActiveGate(): RenderActivityGate {
  const noop = (): void => {};
  return {
    active: true,
    attach: noop,
    detach: noop,
    subscribe: () => noop,
    hold: noop,
    release: noop,
    snapshot: () => ({
      active: true,
      intersecting: true,
      documentVisible: true,
      holds: ["always-active"],
      attached: false,
    }),
    dispose: noop,
  };
}
