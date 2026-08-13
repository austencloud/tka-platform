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
let transitionCode: string | null = null;
const pendingByCode = new Map<string, Set<PendingReadiness>>();
const transitionListeners = new Set<
  (transition: NativeScanViewerTransition) => void
>();

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function settleCode(code: string, outcome: NativeScanViewerOutcome): void {
  const normalized = normalizeCode(code);
  const pending = pendingByCode.get(normalized);
  if (!pending) return;

  pendingByCode.delete(normalized);
  for (const readiness of pending) readiness.finish(outcome);
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
  if (transitionCode && transitionCode !== normalized) {
    const supersededCode = transitionCode;
    transitionCode = null;
    settleCode(supersededCode, "failed");
    notifyTransition(supersededCode, "failed");
  }

  transitionCode = normalized;
  notifyTransition(normalized, "started");
}

/**
 * Keeps the native launch surface visible until the app viewer has painted the
 * sequence requested by the incoming QR. The viewer host owns the matching
 * ready/failure signals because it owns shortcode resolution and card paint.
 */
export function waitForNativeScanViewerReady(
  code: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<NativeScanViewerOutcome> {
  const normalized = normalizeCode(code);
  if (readyCode === normalized) return Promise.resolve("ready");

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

export function markNativeScanViewerReady(code: string): void {
  const normalized = normalizeCode(code);
  readyCode = normalized;
  settleCode(normalized, "ready");
}

export function markNativeScanViewerFailed(code: string): void {
  const normalized = normalizeCode(code);
  settleCode(normalized, "failed");
}

/** Releases animation only after the native splash is fully gone. */
export function markNativeScanViewerRevealed(code: string): void {
  const normalized = normalizeCode(code);
  if (transitionCode !== normalized) return;

  transitionCode = null;
  notifyTransition(normalized, "revealed");
}

export function clearNativeScanViewerReady(): void {
  readyCode = null;
  if (!transitionCode) return;

  const cancelledCode = transitionCode;
  transitionCode = null;
  settleCode(cancelledCode, "failed");
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
