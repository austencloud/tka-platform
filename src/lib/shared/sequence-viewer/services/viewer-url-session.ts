/**
 * ViewerUrlSession — one per viewer mount. Decodes slice payloads from the
 * inbound URL, hands seeds to store construction, collects live captures, and
 * writes the merged snapshot back to the URL (debounced) so the address bar
 * is always a complete snapshot.
 * Spec: docs/superpowers/specs/2026-08-30-viewer-url-addressable-state-design.md
 */
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

export function createViewerUrlSession(
  initialParams: URLSearchParams,
  deps: ViewerUrlSessionDeps
) {
  const seeds: SlicePayloads = decodeViewerStateParams(initialParams);
  const liveCaptures = new Map<SliceId, () => unknown | null>();
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

  function registerSlice(id: SliceId, capture: () => unknown | null): () => void {
    liveCaptures.set(id, capture);
    return () => {
      if (liveCaptures.get(id) === capture) liveCaptures.delete(id);
    };
  }

  /** URL seeds pass through verbatim for slices with no mounted surface. */
  function captureNow(): SlicePayloads {
    const merged: SlicePayloads = { ...seeds };
    for (const [id, capture] of liveCaptures) {
      const value = capture();
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

  /** Synchronous full snapshot as a param patch — used by Share/Copy Link. */
  function captureNowAsParams(): ViewerUrlParamPatch {
    return encodeViewerStateParams(captureNow());
  }

  function ownedParams(): readonly string[] {
    return VIEWER_STATE_PARAM_NAMES;
  }

  function dispose(): void {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    liveCaptures.clear();
  }

  return {
    getSeed,
    isOverride,
    registerSlice,
    captureNow,
    captureNowAsParams,
    scheduleUrlWrite,
    ownedParams,
    dispose,
  };
}
