export type NativeScanViewerOutcome = "ready" | "failed" | "timeout";
export type NativeScanViewerTransitionPhase =
  | "started"
  | "revealed"
  | "failed";

export interface NativeScanViewerTransition {
  code: string;
  phase: NativeScanViewerTransitionPhase;
}

interface PendingReadiness {
  finish: (outcome: NativeScanViewerOutcome) => void;
}

const DEFAULT_TIMEOUT_MS = 20_000;

let readyCode: string | null = null;
let loadingSurfaceReadyCode: string | null = null;
let transitionCode: string | null = null;
const pendingViewerByCode = new Map<string, Set<PendingReadiness>>();
const pendingLoadingSurfaceByCode = new Map<string, Set<PendingReadiness>>();
const transitionListeners = new Set<
  (transition: NativeScanViewerTransition) => void
>();

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function settleCode(
  pendingByCode: Map<string, Set<PendingReadiness>>,
  code: string,
  outcome: NativeScanViewerOutcome
): void {
  const normalized = normalizeCode(code);
  const pending = pendingByCode.get(normalized);
  if (!pending) return;

  pendingByCode.delete(normalized);
  for (const readiness of pending) readiness.finish(outcome);
}

function waitForCode(
  pendingByCode: Map<string, Set<PendingReadiness>>,
  code: string,
  timeoutMs: number
): Promise<NativeScanViewerOutcome> {
  const normalized = normalizeCode(code);

  return new Promise((resolve) => {
    let settled = false;
    const readiness: PendingReadiness = {
      finish: (outcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const pending = pendingByCode.get(normalized);
        pending?.delete(readiness);
        if (pending?.size === 0) pendingByCode.delete(normalized);
        resolve(outcome);
      },
    };
    const timeout = setTimeout(() => readiness.finish("timeout"), timeoutMs);

    const pending = pendingByCode.get(normalized) ?? new Set();
    pending.add(readiness);
    pendingByCode.set(normalized, pending);
  });
}

function notifyTransition(
  code: string,
  phase: NativeScanViewerTransitionPhase
): void {
  const transition = { code, phase };
  for (const listener of transitionListeners) listener(transition);
}

/**
 * Starts the native handoff before Android raises the splash. Existing viewer
 * playback can therefore stop before the covering surface becomes visible,
 * and the replacement viewer can hold autoplay until reveal.
 */
export function beginNativeScanViewerTransition(code: string): void {
  const normalized = normalizeCode(code);
  if (transitionCode === normalized) {
    notifyTransition(normalized, "started");
    return;
  }

  if (transitionCode && transitionCode !== normalized) {
    const supersededCode = transitionCode;
    transitionCode = null;
    settleCode(pendingViewerByCode, supersededCode, "failed");
    settleCode(pendingLoadingSurfaceByCode, supersededCode, "failed");
    notifyTransition(supersededCode, "failed");
  }

  loadingSurfaceReadyCode = null;
  transitionCode = normalized;
  notifyTransition(normalized, "started");
}

/**
 * Waits only for an app-owned loading surface to paint. Android can remove its
 * launch cover at this boundary without exposing the viewer's empty canvas.
 */
export function waitForNativeScanLoadingSurfaceReady(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<NativeScanViewerOutcome> {
  const normalized = normalizeCode(code);
  if (loadingSurfaceReadyCode === normalized) return Promise.resolve("ready");
  return waitForCode(pendingLoadingSurfaceByCode, normalized, timeoutMs);
}

export function markNativeScanLoadingSurfaceReady(code: string): void {
  const normalized = normalizeCode(code);
  loadingSurfaceReadyCode = normalized;
  settleCode(pendingLoadingSurfaceByCode, normalized, "ready");
}

/**
 * Tracks the later boundary where the requested viewer is safe to reveal. The
 * app loader remains visible and playback remains gated until this settles.
 */
export function waitForNativeScanViewerReady(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<NativeScanViewerOutcome> {
  const normalized = normalizeCode(code);
  if (readyCode === normalized) return Promise.resolve("ready");
  return waitForCode(pendingViewerByCode, normalized, timeoutMs);
}

export function markNativeScanViewerReady(code: string): void {
  const normalized = normalizeCode(code);
  readyCode = normalized;
  settleCode(pendingViewerByCode, normalized, "ready");

  if (transitionCode !== normalized) return;
  transitionCode = null;
  notifyTransition(normalized, "revealed");
}

export function markNativeScanViewerFailed(code: string): void {
  const normalized = normalizeCode(code);
  settleCode(pendingViewerByCode, normalized, "failed");
  settleCode(pendingLoadingSurfaceByCode, normalized, "failed");
  if (transitionCode === normalized) {
    transitionCode = null;
    notifyTransition(normalized, "failed");
  }
}

export function clearNativeScanViewerReady(): void {
  readyCode = null;
  loadingSurfaceReadyCode = null;
  if (!transitionCode) return;

  const cancelledCode = transitionCode;
  transitionCode = null;
  settleCode(pendingViewerByCode, cancelledCode, "failed");
  settleCode(pendingLoadingSurfaceByCode, cancelledCode, "failed");
  notifyTransition(cancelledCode, "failed");
}

export function isNativeScanViewerReady(code: string): boolean {
  return readyCode === normalizeCode(code);
}

export function isNativeScanViewerTransitionPending(code: string): boolean {
  return transitionCode === normalizeCode(code);
}

export function subscribeNativeScanViewerTransition(
  listener: (transition: NativeScanViewerTransition) => void
): () => void {
  transitionListeners.add(listener);
  return () => transitionListeners.delete(listener);
}
