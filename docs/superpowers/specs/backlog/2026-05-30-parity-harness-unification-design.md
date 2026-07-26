---
status: backlog
value: 3
effort: M
remaining: "Body status: Approved (design), pending implementation plan"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Parity Harness Unification — Design

**Date:** 2026-05-30
**Status:** Approved (design), pending implementation plan

## Problem

The codebase has grown multiple ad-hoc "render-parity" test pages that each compare
one image against another and report a pixel diff:

- `src/routes/test/card-back-parity/+page.svelte` — back (old DOM vs new BackJob) and
  front (worker vs main-thread) modes.
- `src/routes/test/trail-export-parity/+page.svelte` — live render → real MP4 export →
  decode, with an encoder gate and a live-vs-offscreen gate.
- `src/routes/test/worker-pictograph/+page.svelte` — also hand-rolls a pixel diff.

Every one re-implements the same primitives inline: an `AA_TOLERANCE` constant, a
`diff()` that produces `{diffPct, maxDelta}` plus a red heatmap, a `normalize`/`flatten`
canvas helper, `status`/`running` state, the multi-column image grid, a summary JSON
block, and a `window.__*Result` mirror for headless reads. None of the diff math has a
single unit test.

`trail-export-parity` additionally has poor UX:

1. One Run button → a multi-minute wait with **no progress feedback** across its phases
   (export, decode, live-reference pass).
2. It mounts a **visible** live `AnimatorCanvas` that warms up (plays ~2 steps), then the
   export and live-reference passes drive it so it visibly jumps/freezes — it looks broken
   while it is actually working correctly.
3. Results appear only at the very end, all at once.

## Goal

Extract the shared concept — *a parity test runs two-or-more render sources that each
produce labeled frames, diffs corresponding pairs, and reports per-pair plus worst-case
metrics with a PASS/FAIL verdict* — into a reusable primitive, refactor the existing pages
onto it, fix the trail page's UX, and add an index page. Future image-vs-image tests
become thin pages.

## Architecture

New shared zone consumed by thin `/test/*` pages:

```
src/lib/shared/parity/
  image-diff.ts          pure pixel math + canvas wrappers (unit-tested)
  parity-types.ts        ParityRow / ParityCell / ParityProgress / ParityVerdict / ParityRun
  ParityHarness.svelte   reusable UI shell
src/routes/test/parity/+page.svelte   index listing every parity test
```

## Component 1 — `image-diff.ts`

Split a **pure RGBA-buffer core** (unit-testable without a DOM canvas) from thin **canvas
wrappers**. Consolidates the logic currently duplicated in both parity pages.

```ts
export const AA_TOLERANCE = 8;

// Pure — operate on RGBA Uint8ClampedArray buffers.
export function diffBuffers(
  a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number,
  tol?: number,
): { diffPct: number; maxDelta: number };

export interface BodyDiffOptions { tol?: number; edgeLumaThresh?: number; edgeDilate?: number; }
export function bodyDiffBuffers(
  a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number,
  opts?: BodyDiffOptions,
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number };

// Canvas wrappers — thin.
export function diff(
  refC: HTMLCanvasElement, decC: HTMLCanvasElement, w: number, h: number,
): { diffPct: number; maxDelta: number; heat: HTMLCanvasElement };

export function bodyDiff(
  refC: HTMLCanvasElement, decC: HTMLCanvasElement, w: number, h: number,
  opts?: BodyDiffOptions,
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number };

export function flattenToCanvas(
  data: Uint8ClampedArray, w: number, h: number,
): HTMLCanvasElement;            // RGBA composited over opaque black

export function normalizeToCanvas(
  src: CanvasImageSource, w: number, h: number,
): HTMLCanvasElement;            // draw any source at a fixed size
```

Defaults match today's inline constants: `AA_TOLERANCE = 8`, `edgeLumaThresh = 48`,
`edgeDilate = 2`. `bodyDiff*` is the edge-masked body comparison the trail page uses to
isolate codec edge fringe from true body divergence.

**Unit tests** (`tests/unit/parity/image-diff.test.ts`) on the pure `*Buffers` core:
- identical buffers → `diffPct === 0`, `maxDelta === 0`.
- a single-channel delta above tolerance → counted in `diffPct`, reported in `maxDelta`.
- a sub-tolerance delta → not counted.
- `bodyDiffBuffers` on a synthetic hard edge → the edge column is excluded (`edgePct > 0`,
  body excludes it).

## Component 2 — `parity-types.ts`

```ts
export interface ParityCell {
  label: string;                 // column caption, e.g. "offscreen pre-encode" / "DIFF"
  canvas: HTMLCanvasElement;
}

export interface ParityRow {
  id: string | number;           // frame index or sequence id (keyed in #each)
  title: string;                 // "frame 12 · t=0.200s" / "DJDJ — cosmic"
  cells: ParityCell[];           // images shown left→right, including diff heatmaps
  metrics: Record<string, number>;
  bad?: boolean;                 // exceeds threshold → row highlight
  error?: string;
}

export interface ParityProgress {
  phase: string;                 // "exporting" | "decoding" | "live pass" | "rendering"
  current?: number;
  total?: number;                // present ⇒ determinate bar; absent ⇒ indeterminate
  detail?: string;
}

export interface ParityGate { label: string; pass: boolean; detail: string; }

export interface ParityVerdict {
  verdict: "PASS" | "FAIL" | "";
  summary: string;               // headline metric line
  gates: ParityGate[];           // per-gate chips
  result: unknown;               // mirrored to window[`__${resultKey}`]
}

export interface ParityRunContext {
  onProgress(p: ParityProgress): void;
  addRow(row: ParityRow): void;  // pushes incrementally — rows render as they arrive
  signal: AbortSignal;           // aborts on unmount / re-run
}

export interface ParityRun {
  run(ctx: ParityRunContext): Promise<ParityVerdict>;
}
```

## Component 3 — `ParityHarness.svelte`

Owns all generic UI and state. The page supplies inputs and a run pipeline.

```svelte
<ParityHarness
  title={string}
  description={string}
  controls={Snippet}             {/* page inputs: word/res/fps, or mode toggle */}
  run={() => ParityRun}          {/* invoked on Run click; fresh run per click */}
  resultKey={string}             {/* window.__<resultKey> mirror for headless reads */}
/>
```

Harness responsibilities:
- **Run button + running state.** Disables inputs while running; supplies an `AbortController`
  whose signal is passed into `run(ctx)` and aborted on re-run / unmount.
- **Determinate progress bar** driven by `onProgress`. `total` present ⇒ a real
  `current/total` bar with the phase label; absent ⇒ an indeterminate pulse. This is the
  direct fix for "the bar doesn't move."
- **Verdict banner** with per-gate PASS/FAIL chips (`ParityVerdict.gates`).
- **Incrementally-growing grid.** `ctx.addRow(row)` appends; rows render as they arrive
  (no end-of-run dump). N columns generalize both layouts — a row is just
  `cells: {label, canvas}[]`, so card-back's trio and the trail quad-tych are the same
  component with different N.
- **Summary JSON `<pre>`** and `window["__" + resultKey] = verdict.result`.

The harness imports nothing page-specific. It never knows what is being diffed.

## Component 4 — page refactors

### `card-back-parity`
- `controls` snippet = the existing back/front mode toggle (button + `aria-checked`
  radiogroup — no checkboxes).
- `run()` builds a `ParityRun` that loops the selected sequences × themes, calls `addRow`
  per render with `cells = [old, new, diff]`, emits `onProgress({phase:"rendering",
  current, total})`, and returns a verdict gating on worst `diffPct`.
- Inline `diff`/`normalize` delete in favor of the lib. ~600 lines → ~150.

### `trail-export-parity`
- `controls` snippet = word / resolution / fps / codec inputs.
- `run()` runs the existing pipeline as explicit phases, each emitting `onProgress`:
  warmup (indeterminate "warming trail accumulator 3s") → export
  (`current/total` from the orchestrator's progress callback) → decode+diff
  (`current/total` over sampled frames) → live-reference pass (`current/total` over
  sampled frames). `addRow` per sampled frame with
  `cells = [offscreen pre-encode, live render, decoded MP4, encoder diff heatmap]`.
- Two gates returned: **encoder** (pre-encode vs decoded, edges masked,
  ≤ `PASS_DIFF_PCT` / Δ ≤ `PASS_MAX_DELTA`) and **live** (offscreen vs live, edges masked,
  ≤ `PASS_LIVE_DIFF_PCT` / Δ ≤ `PASS_LIVE_MAX_DELTA`). PASS requires both — unchanged
  semantics, now surfaced as two chips.
- Inline `diff`/`bodyDiff`/`flattenToCanvas` delete in favor of the lib. The frame→beat
  math (`timeToBeatLive`), the live-context lookup, the offscreen-vs-live drive, and the
  two gate thresholds stay — they are domain logic, not generic harness concerns.

### Trail UX fix — offscreen live engine
The live `AnimatorCanvas` must remain a **real registered engine instance** — the live
gate diffs the offscreen export against the actual on-screen engine, so a stubbed engine
would defeat the test. But it does not need to be *visible*. Mount it in an offscreen slot
(`position: fixed; left: -99999px; top: -99999px;` — the same technique
`card-back-parity` already uses for its old-DOM render). The viewer no longer watches it
play two steps then jump/freeze; only clean per-frame snapshots land in the result grid.
The engine still registers in the render-context registry (keyed off its canvas), so
`findLiveContext()`, `resize()`, `renderFrameSync()` all work unchanged.

## Component 5 — `/test/parity` index

A plain page listing every parity harness as a clickable link with a one-line
description. Future tests register by adding one row. No auto-discovery — a hardcoded
list is honest and zero-magic.

## Out of scope

- The production Download-Animation "don't leave the screen" mandala takeover overlay.
  That is real export UX, tracked separately; it is not part of this test-harness work.
- Encoder/codec changes, the offscreen export render path itself (already shipped),
  composite-grid mode.
- `worker-pictograph` — it has a diff but is not a parity page; leaving it untouched
  unless its refactor is trivial once the lib exists (optional follow-up, not required).

## Constraints

- Work on `main`; no branches.
- Active multi-agent git race: stage files by explicit name, commit path-limited
  (`git commit -m "..." -- <paths>`), never `git add -A`/`.`, never rewrite history.
- No `<input type="checkbox">`; button + toggle-indicator only.
- Reuse `PictographRenderer`/existing primitives; no hand-rolled UI where a primitive
  exists.
- Determinism bar for the trail test is unchanged: visual parity + same-machine
  reproducibility, not cross-GPU byte-identity.
