/**
 * Shared contracts for the parity test harness. A parity test runs two-or-more
 * render sources that each produce labeled frames, diffs corresponding pairs,
 * and reports per-pair + worst-case metrics with a PASS/FAIL verdict.
 */

/** One image cell in a parity row (a column in the result grid). */
export interface ParityCell {
  /** Column caption, e.g. "offscreen pre-encode" / "DIFF (red = differs)". */
  label: string;
  canvas: HTMLCanvasElement;
}

/** One comparison row — a frame or a sequence — with its images + metrics. */
export interface ParityRow {
  /** Stable key for the #each block (frame index or sequence id). */
  id: string | number;
  /** Human title, e.g. "frame 12 · t=0.200s" / "DJDJ — cosmic". */
  title: string;
  /** Images shown left→right, including any diff heatmaps. */
  cells: ParityCell[];
  /** Named numeric metrics shown in the row header. */
  metrics: Record<string, number>;
  /** When true, the row is highlighted as exceeding a threshold. */
  bad?: boolean;
  error?: string;
}

/** Progress emitted by a run pipeline. `total` present ⇒ determinate bar. */
export interface ParityProgress {
  phase: string;
  current?: number;
  total?: number;
  detail?: string;
}

/** A single named gate in the verdict (e.g. encoder gate, live gate). */
export interface ParityGate {
  label: string;
  pass: boolean;
  detail: string;
}

/** Final verdict returned by a run pipeline. */
export interface ParityVerdict {
  verdict: "PASS" | "FAIL" | "";
  /** Headline metric line shown in the verdict banner. */
  summary: string;
  gates: ParityGate[];
  /** Arbitrary object mirrored to window[`__${resultKey}`] for headless reads. */
  result: unknown;
}

/** Services the harness hands to a run pipeline. */
export interface ParityRunContext {
  onProgress(p: ParityProgress): void;
  /** Append a row; the harness renders it immediately (incremental grid). */
  addRow(row: ParityRow): void;
  /** Aborts on re-run / unmount; pipelines should bail when aborted. */
  signal: AbortSignal;
}

/** A parity pipeline. The harness calls run() once per Run click. */
export interface ParityRun {
  run(ctx: ParityRunContext): Promise<ParityVerdict>;
}
