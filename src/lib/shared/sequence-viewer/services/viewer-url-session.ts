/**
 * ViewerUrlSession — one per viewer mount. Decodes slice payloads from the
 * inbound URL, hands seeds to store construction, collects live captures, and
 * writes the merged snapshot back to the URL (debounced) so the address bar
 * is always a complete snapshot.
 * Spec: docs/superpowers/specs/2026-08-30-viewer-url-addressable-state-design.md
 */
import { getContext, setContext } from "svelte";
import {
  decodeViewerStateParams,
  encodeViewerStateParams,
  deepEqual,
  VIEWER_STATE_PARAM_NAMES,
  type SliceId,
  type SlicePayloads,
  type ViewerUrlParamPatch,
} from "./viewer-url-state-codec";

const URL_WRITE_DEBOUNCE_MS = 400;

export interface ViewerUrlSessionDeps {
  /** Applies a param patch to the live URL (production: mutateCurrentUrl). */
  writeParams: (patch: ViewerUrlParamPatch) => void;
}

export type ViewerUrlSession = ReturnType<typeof createViewerUrlSession>;

/**
 * Two capture modes, one registration.
 *
 * - `full: false` (the address bar): each slice emits only what differs from
 *   its defaults, so the live URL stays short and an untouched viewer carries
 *   no state params at all.
 * - `full: true` (Share / Copy Link): each slice emits every encoded field,
 *   defaults included. A shared link then pins the recipient to the sender's
 *   complete state instead of letting an absent field fall through to the
 *   recipient's own saved value. Seeds merge onto defaults either way, so a
 *   full payload decodes through the same path a diff does.
 */
export interface SliceCaptureOptions {
  full: boolean;
}
export type SliceCapture = (options: SliceCaptureOptions) => unknown | null;

const DIFF: SliceCaptureOptions = { full: false };

export function createViewerUrlSession(
  initialParams: URLSearchParams,
  deps: ViewerUrlSessionDeps
) {
  const seeds: SlicePayloads = decodeViewerStateParams(initialParams);
  const liveCaptures = new Map<SliceId, SliceCapture>();
  const fullFallbacks = new Map<SliceId, SliceCapture>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  function getSeed(id: SliceId): unknown | null {
    return seeds[id] ?? null;
  }

  /**
   * The own-link rule: a seed that deep-equals what the user's own disk would
   * load is NOT an override — their own link must not flip them to view-only.
   */
  function isOverride(id: SliceId, persisted: unknown | null): boolean {
    const seed = seeds[id];
    if (seed == null) return false;
    return !deepEqual(seed, persisted);
  }

  function registerSlice(id: SliceId, capture: SliceCapture): () => void {
    liveCaptures.set(id, capture);
    return () => {
      if (liveCaptures.get(id) === capture) liveCaptures.delete(id);
    };
  }

  /**
   * A full-snapshot stand-in for a slice whose surface is not mounted (the
   * closed 3D pane, the tunnel, Post Studio). The address bar never uses it:
   * in diff mode an unmounted slice passes its URL seed through verbatim, as
   * before. In full mode the fallback outranks that pass-through — it can
   * expand the seed itself, or read what the sender's own disk would load —
   * and a live capture still outranks the fallback.
   */
  function registerFullFallback(id: SliceId, capture: SliceCapture): () => void {
    fullFallbacks.set(id, capture);
    return () => {
      if (fullFallbacks.get(id) === capture) fullFallbacks.delete(id);
    };
  }

  /** URL seeds pass through verbatim for slices with no mounted surface. */
  function captureNow(options: SliceCaptureOptions = DIFF): SlicePayloads {
    const merged: SlicePayloads = { ...seeds };
    if (options.full) {
      for (const [id, fallback] of fullFallbacks) {
        if (liveCaptures.has(id)) continue;
        const value = fallback(options);
        if (value == null) delete merged[id];
        else merged[id] = value;
      }
    }
    for (const [id, capture] of liveCaptures) {
      const value = capture(options);
      if (value == null) delete merged[id];
      else merged[id] = value;
    }
    return merged;
  }

  function scheduleUrlWrite(): void {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      writeTimer = null;
      deps.writeParams(encodeViewerStateParams(captureNow()));
    }, URL_WRITE_DEBOUNCE_MS);
  }

  /**
   * Synchronous snapshot as a param patch. Share/Copy Link pass
   * `{ full: true }` so the copied link specifies every field; the address
   * bar stays on the diff form.
   */
  function captureNowAsParams(
    options: SliceCaptureOptions = DIFF
  ): ViewerUrlParamPatch {
    return encodeViewerStateParams(captureNow(options));
  }

  function ownedParams(): readonly string[] {
    return VIEWER_STATE_PARAM_NAMES;
  }

  function dispose(): void {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    liveCaptures.clear();
    fullFallbacks.clear();
  }

  return {
    getSeed,
    isOverride,
    registerSlice,
    registerFullFallback,
    captureNow,
    captureNowAsParams,
    scheduleUrlWrite,
    ownedParams,
    dispose,
  };
}

const VIEWER_URL_SESSION_KEY = Symbol("viewer-url-session");

/**
 * Publish the session to viewer-internal hosts. Slices whose store is
 * constructed per PANE rather than at orchestrator scope (`t3`, whose scene
 * feature state lives inside `Viewer3DCanvas`) register their capture through
 * this instead of being reached from the orchestrator. Set once, by the
 * orchestrator that owns the session.
 */
export function setViewerUrlSessionContext(session: ViewerUrlSession): void {
  setContext(VIEWER_URL_SESSION_KEY, session);
}

/**
 * The session, or `undefined` outside a sequence viewer. Shared 3D components
 * mount under half a dozen other hosts (saved-scene tiles, the composer demo,
 * test routes); there is no session there and registration is a no-op.
 */
export function tryGetViewerUrlSessionContext(): ViewerUrlSession | undefined {
  return getContext<ViewerUrlSession | undefined>(VIEWER_URL_SESSION_KEY);
}
