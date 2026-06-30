/**
 * Scan-stage performance instrumentation.
 *
 * Marks each boundary on the QR-scan critical path so we can measure
 * "time from page mount to all pictographs stable" on real devices, and
 * regression-test it under throttling. No-ops gracefully when the Performance
 * API is unavailable. Stage marks are namespaced "scan:" to avoid collisions.
 */

export type ScanStage =
  | "start"
  | "shortcode-resolved"
  | "hydrated"
  | "card-mount"
  | "first-cell-painted"
  | "all-cells-stable";

const PREFIX = "scan:";
let reported = false;

function hasPerf(): boolean {
  return typeof performance !== "undefined" && typeof performance.mark === "function";
}

/** Mark a scan stage boundary (idempotent per stage within a page load). */
export function markScan(stage: ScanStage): void {
  if (!hasPerf()) return;
  const name = `${PREFIX}${stage}`;
  if (performance.getEntriesByName(name, "mark").length > 0) return;
  try {
    performance.mark(name);
  } catch {
    /* ignore */
  }
}

/**
 * Compute scan-to-stable once both ends are marked. Returns the duration in ms,
 * or null if scan:start was never marked (non-scan route) or already reported.
 * Logs a per-stage table in dev.
 */
export function reportScanToStable(): number | null {
  if (!hasPerf() || reported) return null;
  const startMarks = performance.getEntriesByName(`${PREFIX}start`, "mark");
  const endMarks = performance.getEntriesByName(`${PREFIX}all-cells-stable`, "mark");
  if (startMarks.length === 0 || endMarks.length === 0) return null;

  reported = true;
  let durationMs = 0;
  try {
    const m = performance.measure(`${PREFIX}to-stable`, `${PREFIX}start`, `${PREFIX}all-cells-stable`);
    durationMs = m.duration;
  } catch {
    durationMs = endMarks[0]!.startTime - startMarks[0]!.startTime;
  }

  if (typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    logStageTable(durationMs);
  }
  return durationMs;
}

function logStageTable(total: number): void {
  const stages: ScanStage[] = [
    "start", "shortcode-resolved", "hydrated", "card-mount", "first-cell-painted", "all-cells-stable",
  ];
  const start = performance.getEntriesByName(`${PREFIX}start`, "mark")[0]?.startTime ?? 0;
  const rows: Record<string, { "t (ms)": number }> = {};
  for (const s of stages) {
    const e = performance.getEntriesByName(`${PREFIX}${s}`, "mark")[0];
    if (e) rows[s] = { "t (ms)": Math.round(e.startTime - start) };
  }
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(`[scan-perf] scan-to-stable = ${Math.round(total)}ms`);
}

/** Test-only reset of the one-shot guard. */
export function _resetScanPerf(): void {
  reported = false;
}
