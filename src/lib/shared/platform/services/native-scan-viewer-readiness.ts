export type NativeScanViewerOutcome = "ready" | "failed" | "timeout";
export type NativeScanViewerTransitionPhase = "started" | "revealed" | "failed";

export interface NativeScanViewerTransition {
  code: string;
  phase: NativeScanViewerTransitionPhase;
}

export type NativeScanTransitionStage =
  | "transition-started"
  | "deep-link-received"
  | "native-cover-show-start"
  | "native-cover-shown"
  | "auth-settled"
  | "route-navigation-start"
  | "route-navigation-complete"
  | "loader-state-created"
  | "loader-dom-painted"
  | "loader-visible"
  | "shortcode-resolve-start"
  | "shortcode-resolved"
  | "glyph-load-start"
  | "glyphs-ready"
  | "hydrate-start"
  | "hydrate-complete"
  | "settings-applied"
  | "viewer-overlay-opened"
  | "animation-surface-ready"
  | "loader-complete-painted"
  | "loader-removed-painted"
  | "viewer-ready"
  | "native-cover-hide-start"
  | "native-cover-hidden"
  | "playback-released"
  | "failed";

export type NativeScanTraceDetails = Record<
  string,
  string | number | boolean | null
>;

export interface NativeScanTraceEntry {
  traceId: string;
  code: string;
  stage: NativeScanTransitionStage;
  elapsedMs: number;
  timestamp: string;
  details?: NativeScanTraceDetails;
}

interface PendingReadiness {
  finish: (outcome: NativeScanViewerOutcome) => void;
}

const DEFAULT_TIMEOUT_MS = 20_000;

let readyCode: string | null = null;
let loadingSurfaceReadyCode: string | null = null;
let transitionCode: string | null = null;
let activeTrace: {
  id: string;
  code: string;
  startedAt: number;
  entries: NativeScanTraceEntry[];
} | null = null;
let lastTrace: NativeScanTraceEntry[] = [];
const pendingViewerByCode = new Map<string, Set<PendingReadiness>>();
const pendingLoadingSurfaceByCode = new Map<string, Set<PendingReadiness>>();
const transitionListeners = new Set<
  (transition: NativeScanViewerTransition) => void
>();

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function persistTrace(entries: NativeScanTraceEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("tka:last-native-scan-trace", JSON.stringify(entries));
  } catch {
    // Logcat remains the source of truth if browser storage is unavailable.
  }
}

/**
 * Records the exact surfaces a scanner sees during the native handoff. Every
 * entry is emitted as one JSON logcat line and retained for post-scan review.
 */
export function markNativeScanTransitionStage(
  code: string,
  stage: NativeScanTransitionStage,
  details?: NativeScanTraceDetails
): NativeScanTraceEntry | null {
  const normalized = normalizeCode(code);
  if (!activeTrace || activeTrace.code !== normalized) return null;

  const entry: NativeScanTraceEntry = {
    traceId: activeTrace.id,
    code: normalized,
    stage,
    elapsedMs: Math.round(now() - activeTrace.startedAt),
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
  };
  activeTrace.entries.push(entry);
  lastTrace = [...activeTrace.entries];
  persistTrace(lastTrace);
  console.info(`[native-scan-trace] ${JSON.stringify(entry)}`);
  return entry;
}

export function getLastNativeScanTrace(): readonly NativeScanTraceEntry[] {
  return lastTrace;
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
  activeTrace = {
    id: `${normalized}-${Date.now().toString(36)}`,
    code: normalized,
    startedAt: now(),
    entries: [],
  };
  markNativeScanTransitionStage(normalized, "transition-started");
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
  markNativeScanTransitionStage(normalized, "viewer-ready");

  if (transitionCode !== normalized) return;
  transitionCode = null;
  notifyTransition(normalized, "revealed");
}

export function markNativeScanViewerFailed(
  code: string,
  details?: NativeScanTraceDetails
): void {
  const normalized = normalizeCode(code);
  markNativeScanTransitionStage(normalized, "failed", details);
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
