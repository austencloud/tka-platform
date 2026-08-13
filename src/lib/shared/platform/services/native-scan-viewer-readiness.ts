export type NativeScanViewerOutcome = "ready" | "failed" | "timeout";

interface PendingReadiness {
  finish: (outcome: NativeScanViewerOutcome) => void;
}

const DEFAULT_TIMEOUT_MS = 20_000;

let readyCode: string | null = null;
const pendingByCode = new Map<string, Set<PendingReadiness>>();

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
  settleCode(code, "failed");
}

export function clearNativeScanViewerReady(): void {
  readyCode = null;
}

export function isNativeScanViewerReady(code: string): boolean {
  return readyCode === normalizeCode(code);
}
