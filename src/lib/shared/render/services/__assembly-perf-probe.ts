// TEMP assembly profiler — instrumentation for the cold-deck render profiler on
// the worker-pictograph harness. Measures where card-front assembly time goes so
// a caching-rebuild decision can be grounded in numbers, not guesses. Mirrors the
// old __render-perf-probe.ts pattern. REMOVE once the caching design lands.
//
// All taps are gated on `assemblyProbe.enabled` so the probe is a pair of cheap
// branch checks (a `performance.now()` only when enabled) on the hot path when
// off. The harness flips `enabled` around a cold render, snapshots, flips it off.

export interface AssemblyPerf {
  enabled: boolean;
  /** SVG decode time (svg-image-cache miss path: grids, letters, turn numbers, arrows/props). */
  decodeMs: number;
  /** Per-cell LayerCompositor.compose time (the step + start-position cell loop). */
  cellMs: number;
  /** QR code generation + draw. */
  qrMs: number;
  /** Mandala geometry + per-placement draw. */
  mandalaMs: number;
  /** Word-header (TKA glyph) render. */
  headerMs: number;
  /** User-info footer render. */
  footerMs: number;
  /** Smart cell border draw. */
  borderMs: number;
  /** Final cell drawImage composite onto the card canvas (the ctx.drawImage of each cell). */
  compositeMs: number;
  /** Number of cells composed (start position + steps). */
  cellCount: number;
}

export const assemblyProbe: AssemblyPerf = {
  enabled: false,
  decodeMs: 0,
  cellMs: 0,
  qrMs: 0,
  mandalaMs: 0,
  headerMs: 0,
  footerMs: 0,
  borderMs: 0,
  compositeMs: 0,
  cellCount: 0,
};

export function resetAssemblyProbe(): void {
  Object.assign(assemblyProbe, {
    decodeMs: 0,
    cellMs: 0,
    qrMs: 0,
    mandalaMs: 0,
    headerMs: 0,
    footerMs: 0,
    borderMs: 0,
    compositeMs: 0,
    cellCount: 0,
  });
}

export function snapshotAssemblyProbe(): Omit<AssemblyPerf, "enabled"> {
  const { enabled: _enabled, ...rest } = assemblyProbe;
  return { ...rest };
}
