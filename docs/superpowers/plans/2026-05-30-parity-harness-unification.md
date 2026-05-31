# Parity Harness Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated pixel-diff + parity-UI logic from the ad-hoc test pages into a unit-tested `image-diff` lib and a reusable `ParityHarness` component, then refactor `card-back-parity` and `trail-export-parity` onto them and add a `/test/parity` index.

**Architecture:** A pure RGBA-buffer diff core (`diffBuffers`/`bodyDiffBuffers`) with thin canvas wrappers, shared `parity-types.ts` contracts, and a `ParityHarness.svelte` shell that owns Run/progress/verdict/grid/JSON state while each page supplies only a `controls` snippet and a `run()` pipeline. Pages keep their domain logic (sequence loading, export orchestration, live-reference drive) and delegate everything generic.

**Tech Stack:** Svelte 5 (runes, snippets), TypeScript, Vitest (`tests/config/vitest.config.ts`), mediabunny (existing, trail page only).

---

## Constraints (every task)

- Work on `main`. No branches.
- Active multi-agent git race: stage files by explicit name; commit path-limited
  (`git commit -m "..." -- <paths>`). Never `git add -A`/`.`, never reset/rebase/amend/stash/rewrite history.
- End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- No `<input type="checkbox">` — button + toggle-indicator only.
- Inner loop: `npm run check:watch` / `npm run check:fast`. One full `npm run check` before the final commit, not per task.
- Tests run with: `npm test -- <path>` (vitest, config `tests/config/vitest.config.ts`).

---

## File Structure

- `src/lib/shared/parity/parity-types.ts` — shared contracts (types only).
- `src/lib/shared/parity/image-diff.ts` — pure buffer math + canvas wrappers + `AA_TOLERANCE`.
- `src/lib/shared/parity/ParityHarness.svelte` — reusable UI shell.
- `src/routes/test/parity/+page.svelte` — index page.
- `tests/unit/parity/image-diff.test.ts` — unit tests for the pure core.
- Modify: `src/routes/test/card-back-parity/+page.svelte` — refactor onto lib + harness.
- Modify: `src/routes/test/trail-export-parity/+page.svelte` — refactor onto lib + harness, offscreen live engine, phase progress.

---

## Task 1: Parity type contracts

**Files:**
- Create: `src/lib/shared/parity/parity-types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/shared/parity/parity-types.ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `parity-types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/parity/parity-types.ts
git commit -m "feat(parity): shared parity harness type contracts" -- src/lib/shared/parity/parity-types.ts
```

---

## Task 2: Pure diff core + unit tests (TDD)

**Files:**
- Create: `src/lib/shared/parity/image-diff.ts`
- Test: `tests/unit/parity/image-diff.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/parity/image-diff.test.ts
import { describe, it, expect } from "vitest";
import {
  AA_TOLERANCE,
  diffBuffers,
  bodyDiffBuffers,
} from "$lib/shared/parity/image-diff";

/** Build a w×h solid-color RGBA buffer. */
function solid(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  }
  return buf;
}

describe("diffBuffers", () => {
  it("reports zero for identical buffers", () => {
    const a = solid(4, 4, 10, 20, 30);
    const b = solid(4, 4, 10, 20, 30);
    const r = diffBuffers(a, b, 4, 4);
    expect(r.diffPct).toBe(0);
    expect(r.maxDelta).toBe(0);
  });

  it("counts a single-channel delta above tolerance", () => {
    const a = solid(2, 1, 0, 0, 0);
    const b = solid(2, 1, 0, 0, 0);
    b[0] = 100; // red of pixel 0 jumps 100 (> AA_TOLERANCE)
    const r = diffBuffers(a, b, 2, 1);
    expect(r.maxDelta).toBe(100);
    expect(r.diffPct).toBe(50); // 1 of 2 pixels differs
  });

  it("ignores a sub-tolerance delta", () => {
    const a = solid(2, 1, 50, 50, 50);
    const b = solid(2, 1, 50, 50, 50);
    b[0] = 50 + (AA_TOLERANCE - 1);
    const r = diffBuffers(a, b, 2, 1);
    expect(r.diffPct).toBe(0);
    expect(r.maxDelta).toBe(AA_TOLERANCE - 1);
  });
});

describe("bodyDiffBuffers", () => {
  it("excludes a synthetic hard edge from the body", () => {
    // 4×1 strip: black | black | white | white  → a hard edge at x=1→2.
    const w = 4, h = 1;
    const a = new Uint8ClampedArray(w * h * 4);
    const set = (buf: Uint8ClampedArray, x: number, v: number) => {
      const i = x * 4; buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
    };
    set(a, 0, 0); set(a, 1, 0); set(a, 2, 255); set(a, 3, 255);
    const b = a.slice();
    set(b, 0, 200); // body pixel (far from edge) diverges hard
    const r = bodyDiffBuffers(a, b, w, h, { edgeDilate: 1 });
    // The edge + its dilation are excluded; some body remains and catches x=0.
    expect(r.edgePct).toBeGreaterThan(0);
    expect(r.bodyMaxDelta).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/parity/image-diff.test.ts`
Expected: FAIL — `image-diff` has no exports yet (cannot resolve module / undefined functions).

- [ ] **Step 3: Implement the pure core**

```ts
// src/lib/shared/parity/image-diff.ts
/**
 * Image parity diff utilities. Pure RGBA-buffer math (unit-testable without a
 * DOM canvas) plus thin canvas wrappers used by the parity test pages. Extracted
 * from the inline copies in card-back-parity and trail-export-parity.
 */

/** Per-channel delta below which a pixel is considered a match (anti-aliasing). */
export const AA_TOLERANCE = 8;

/** Full-frame diff: % of pixels over tolerance + worst single-channel delta. */
export function diffBuffers(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  tol: number = AA_TOLERANCE,
): { diffPct: number; maxDelta: number } {
  const total = w * h;
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i]! - b[i]!);
    const dg = Math.abs(a[i + 1]! - b[i + 1]!);
    const db = Math.abs(a[i + 2]! - b[i + 2]!);
    const da = Math.abs(a[i + 3]! - b[i + 3]!);
    const worst = Math.max(dr, dg, db, da);
    if (worst > maxDelta) maxDelta = worst;
    if (worst > tol) differing++;
  }
  return { diffPct: total ? (differing / total) * 100 : 0, maxDelta };
}

export interface BodyDiffOptions {
  tol?: number;
  /** Neighbor luma jump that marks an edge in the reference. */
  edgeLumaThresh?: number;
  /** px halo dilated around detected edges to also exclude. */
  edgeDilate?: number;
}

/**
 * Body-only diff: exclude high-contrast EDGES of the reference (a) — where lossy
 * codecs always fringe — and measure divergence on the remaining interior. Near
 * zero ⇒ body parity is exact and residual is purely edge fringe.
 */
export function bodyDiffBuffers(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  opts: BodyDiffOptions = {},
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number } {
  const tol = opts.tol ?? AA_TOLERANCE;
  const edgeLumaThresh = opts.edgeLumaThresh ?? 48;
  const edgeDilate = opts.edgeDilate ?? 2;
  const n = w * h;

  const luma = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    luma[p] = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
  }

  let edge = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const l = luma[p]!;
      let isEdge = 0;
      if (x > 0 && Math.abs(l - luma[p - 1]!) > edgeLumaThresh) isEdge = 1;
      else if (x < w - 1 && Math.abs(l - luma[p + 1]!) > edgeLumaThresh) isEdge = 1;
      else if (y > 0 && Math.abs(l - luma[p - w]!) > edgeLumaThresh) isEdge = 1;
      else if (y < h - 1 && Math.abs(l - luma[p + w]!) > edgeLumaThresh) isEdge = 1;
      edge[p] = isEdge;
    }
  }

  for (let d = 0; d < edgeDilate; d++) {
    const next = new Uint8Array(edge);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (edge[p]) continue;
        if (
          (x > 0 && edge[p - 1]) ||
          (x < w - 1 && edge[p + 1]) ||
          (y > 0 && edge[p - w]) ||
          (y < h - 1 && edge[p + w])
        )
          next[p] = 1;
      }
    }
    edge = next;
  }

  let edgeCount = 0;
  let bodyCount = 0;
  let differing = 0;
  let bodyMaxDelta = 0;
  for (let p = 0; p < n; p++) {
    if (edge[p]) {
      edgeCount++;
      continue;
    }
    bodyCount++;
    const i = p * 4;
    const worst = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
    );
    if (worst > bodyMaxDelta) bodyMaxDelta = worst;
    if (worst > tol) differing++;
  }
  return {
    bodyDiffPct: bodyCount ? (differing / bodyCount) * 100 : 0,
    bodyMaxDelta,
    edgePct: (edgeCount / n) * 100,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/parity/image-diff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/parity/image-diff.ts tests/unit/parity/image-diff.test.ts
git commit -m "feat(parity): pure diff core + unit tests" -- src/lib/shared/parity/image-diff.ts tests/unit/parity/image-diff.test.ts
```

---

## Task 3: Canvas wrappers on the diff core

**Files:**
- Modify: `src/lib/shared/parity/image-diff.ts` (append wrappers)

- [ ] **Step 1: Append the canvas wrappers**

Add to the bottom of `src/lib/shared/parity/image-diff.ts`:

```ts
// ── Canvas wrappers ─────────────────────────────────────────────────────────

function ctxData(c: HTMLCanvasElement, w: number, h: number): Uint8ClampedArray {
  return c.getContext("2d")!.getImageData(0, 0, w, h).data;
}

/** Full-frame diff + a red heatmap canvas (red where Δ > tolerance). */
export function diff(
  refC: HTMLCanvasElement,
  decC: HTMLCanvasElement,
  w: number,
  h: number,
): { diffPct: number; maxDelta: number; heat: HTMLCanvasElement } {
  const a = ctxData(refC, w, h);
  const b = ctxData(decC, w, h);
  const { diffPct, maxDelta } = diffBuffers(a, b, w, h);

  const heat = document.createElement("canvas");
  heat.width = w;
  heat.height = h;
  const hctx = heat.getContext("2d")!;
  const out = hctx.createImageData(w, h);
  for (let i = 0; i < a.length; i += 4) {
    const worst = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
    );
    if (worst > AA_TOLERANCE) {
      out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 0; out.data[i + 3] = 255;
    } else {
      const g = (a[i]! + a[i + 1]! + a[i + 2]!) / 3;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = g * 0.4;
      out.data[i + 3] = 255;
    }
  }
  hctx.putImageData(out, 0, 0);
  return { diffPct, maxDelta, heat };
}

/** Edge-masked body diff on two canvases. */
export function bodyDiff(
  refC: HTMLCanvasElement,
  decC: HTMLCanvasElement,
  w: number,
  h: number,
  opts?: BodyDiffOptions,
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number } {
  return bodyDiffBuffers(ctxData(refC, w, h), ctxData(decC, w, h), w, h, opts);
}

/** Composite an RGBA buffer over opaque black into a fresh canvas (mirrors the
 *  alpha-drop an H.264/AV1 encoder applies). */
export function flattenToCanvas(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d")!;
  const img = tctx.createImageData(w, h);
  img.data.set(data);
  tctx.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0); // source-over blends straight alpha over black
  return out;
}

/** Draw any image source onto a fresh w×h canvas (size normalization). */
export function normalizeToCanvas(
  src: CanvasImageSource,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `image-diff.ts`.

- [ ] **Step 3: Re-run the unit tests (still green — pure core unchanged)**

Run: `npm test -- tests/unit/parity/image-diff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/parity/image-diff.ts
git commit -m "feat(parity): canvas diff/flatten/normalize wrappers" -- src/lib/shared/parity/image-diff.ts
```

---

## Task 4: ParityHarness component

**Files:**
- Create: `src/lib/shared/parity/ParityHarness.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/shared/parity/ParityHarness.svelte -->
<script lang="ts">
  /**
   * Reusable parity test shell. Owns the generic UI/state — Run button, running
   * state, a determinate progress bar fed by onProgress, the verdict banner with
   * per-gate chips, an incrementally-growing N-column result grid, the summary
   * JSON block, and the window.__<resultKey> mirror. Pages supply only a controls
   * snippet and a run() that returns a ParityRun.
   */
  import type {
    ParityRun,
    ParityRow,
    ParityProgress,
    ParityVerdict,
  } from "./parity-types";
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    resultKey: string;
    controls?: Snippet;
    run: () => ParityRun;
  }
  let { title, description, resultKey, controls, run }: Props = $props();

  let running = $state(false);
  let rows = $state<ParityRow[]>([]);
  let progress = $state<ParityProgress | null>(null);
  let verdict = $state<ParityVerdict | null>(null);
  let abort: AbortController | null = null;

  function attach(node: HTMLDivElement, canvas: HTMLCanvasElement) {
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    node.appendChild(canvas);
    return {
      destroy() {
        if (canvas.parentNode === node) node.removeChild(canvas);
      },
    };
  }

  async function start() {
    if (running) return;
    abort?.abort();
    abort = new AbortController();
    running = true;
    rows = [];
    verdict = null;
    progress = { phase: "starting" };
    (window as unknown as Record<string, unknown>)["__" + resultKey] = undefined;
    try {
      const pipeline = run();
      const v = await pipeline.run({
        signal: abort.signal,
        onProgress: (p) => (progress = p),
        addRow: (r) => (rows = [...rows, r]),
      });
      verdict = v;
      (window as unknown as Record<string, unknown>)["__" + resultKey] = v.result;
    } catch (err) {
      verdict = {
        verdict: "FAIL",
        summary: "error: " + (err instanceof Error ? err.message : String(err)),
        gates: [],
        result: { error: String(err) },
      };
      console.error("[parity:" + resultKey + "]", err);
    } finally {
      running = false;
      progress = null;
    }
  }

  let pct = $derived(
    progress?.total ? Math.round(((progress.current ?? 0) / progress.total) * 100) : null,
  );
</script>

<div class="page">
  <h1>{title}</h1>
  <p class="sub">{description}</p>

  <div class="controls">
    {@render controls?.()}
    <button onclick={start} disabled={running}>{running ? "running…" : "Run parity"}</button>
  </div>

  {#if progress}
    <div class="progress">
      <div class="bar"><div class="fill" class:indeterminate={pct === null} style={pct !== null ? `width:${pct}%` : ""}></div></div>
      <span class="ptext">
        {progress.phase}{#if progress.total} {progress.current ?? 0}/{progress.total}{/if}{#if progress.detail} — {progress.detail}{/if}
      </span>
    </div>
  {/if}

  {#if verdict && verdict.verdict}
    <div class="verdict" class:pass={verdict.verdict === "PASS"} class:fail={verdict.verdict === "FAIL"}>
      <span class="v">{verdict.verdict}</span> — {verdict.summary}
      {#if verdict.gates.length}
        <div class="gates">
          {#each verdict.gates as g (g.label)}
            <span class="gate" class:gp={g.pass} class:gf={!g.pass}>{g.label}: {g.detail}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if verdict}
    <pre class="json" id="parity-summary">{JSON.stringify(verdict.result, null, 2)}</pre>
  {/if}

  {#each rows as r (r.id)}
    <div class="row" class:bad={r.bad || !!r.error}>
      <div class="row-head">
        {r.title}
        {#each Object.entries(r.metrics) as [k, v] (k)}<span class="metric">· {k} {typeof v === "number" ? v.toFixed(3) : v}</span>{/each}
        {#if r.error}<span class="err">· {r.error}</span>{/if}
      </div>
      <div class="cells">
        {#each r.cells as cell (cell.label)}
          <figure><div use:attach={cell.canvas}></div><figcaption>{cell.label}</figcaption></figure>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .page { padding: 20px; background: #0d0d14; color: #eee; min-height: 100vh; font-family: system-ui, sans-serif; }
  h1 { margin: 0 0 4px; }
  .sub { color: #8a8aa0; margin: 0 0 16px; max-width: 70ch; font-size: 13px; }
  .controls { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  button { background: #4c6ef5; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 14px; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .bar { flex: 1; height: 8px; background: #15152a; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: #4c6ef5; transition: width 0.2s ease; }
  .fill.indeterminate { width: 35%; animation: slide 1.1s ease-in-out infinite; }
  @keyframes slide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }
  .ptext { font-family: monospace; font-size: 12px; color: #ffd43b; white-space: nowrap; }
  .verdict { font-weight: 700; font-size: 18px; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
  .verdict.pass { background: #133a1f; color: #51cf66; }
  .verdict.fail { background: #3a1313; color: #ff6b6b; }
  .verdict .v { letter-spacing: 0.05em; }
  .gates { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .gate { font-weight: 600; font-size: 11px; padding: 3px 8px; border-radius: 5px; }
  .gate.gp { background: #133a1f; color: #51cf66; }
  .gate.gf { background: #3a1313; color: #ff6b6b; }
  .json { background: #0c0c10; border: 1px solid #2a2a33; border-radius: 8px; padding: 12px; font-size: 12px; color: #b8c0cc; max-height: 240px; overflow: auto; white-space: pre-wrap; margin-bottom: 16px; }
  .row { margin-bottom: 18px; border: 1px solid #2a2a40; border-radius: 8px; padding: 10px; background: #11111f; }
  .row.bad { border-color: #7a2a2a; background: #1a1113; }
  .row-head { font-family: monospace; font-size: 12px; color: #b0b0c8; margin-bottom: 8px; }
  .metric { color: #8a8aa0; }
  .err { color: #ff6b6b; }
  .cells { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; width: 280px; }
  figure :global(canvas) { width: 280px; height: auto; border: 1px solid #333; background: #000; }
  figcaption { font-size: 11px; color: #888; margin-top: 4px; text-align: center; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `ParityHarness.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/parity/ParityHarness.svelte
git commit -m "feat(parity): reusable ParityHarness shell" -- src/lib/shared/parity/ParityHarness.svelte
```

---

## Task 5: Refactor card-back-parity onto the harness

**Files:**
- Modify: `src/routes/test/card-back-parity/+page.svelte`

Goal: keep ALL existing domain logic (`selectSequences`, `renderOld`/`renderNew`/`renderFrontMain`/`renderFrontWorker`, `frontOptions`, the browse engine, worker probe + asset bundle seeding). Replace the inline `diff`/`normalize`, the bespoke controls/table/grid markup, and the `running`/`status`/`rows`/`summaryJson` UI plumbing with `ParityHarness` + the lib.

- [ ] **Step 1: Swap imports + delete the inline diff/normalize**

Replace the top imports block — add:

```ts
  import ParityHarness from "$lib/shared/parity/ParityHarness.svelte";
  import { diff, normalizeToCanvas, AA_TOLERANCE } from "$lib/shared/parity/image-diff";
  import type { ParityRun, ParityRow, ParityVerdict } from "$lib/shared/parity/parity-types";
```

Delete the local `AA_TOLERANCE` const, the local `normalize()` function, and the local `diff()` function. Replace `normalize(x)` call sites with `normalizeToCanvas(x as CanvasImageSource, OUT_W, OUT_H)`.

- [ ] **Step 2: Convert `run()` into a ParityRun factory**

Replace the component's `mode`/`status`/`running`/`rows`/`summaryJson` state and the whole `run()` function with a `mode` rune (still needed for the controls snippet) and a `makeRun()` that returns a `ParityRun`:

```ts
  let mode = $state<"back" | "front">("back");

  function makeRun(): ParityRun {
    const runMode = mode; // capture at click time
    return {
      async run(ctx) {
        const selected = selectSequences([...engine.allSequences]);
        if (selected.length === 0) {
          return { verdict: "FAIL", summary: "no renderable sequences", gates: [], result: { error: "no renderable sequences" } };
        }
        const themes: readonly string[] = runMode === "front" ? ["front"] : THEMES;

        if (runMode === "front") {
          ctx.onProgress({ phase: "probing worker support" });
          const ok = await CompositionDispatcher.probeWorkerSupport();
          if (!ok) return { verdict: "FAIL", summary: "worker probe failed", gates: [], result: { error: "worker probe failed" } };
          ctx.onProgress({ phase: "building asset bundle" });
          const bundle = await getCardAssetBundle(selected, {
            bluePropType: PropType.STAFF, redPropType: PropType.STAFF, theme: THEMES[0],
          });
          getCompositionDispatcher().setAssetBundle(bundle);
        }

        const total = selected.length * themes.length;
        let done = 0;
        let worst = 0;
        let worstMaxDelta = 0;
        const summaryRows: Record<string, unknown>[] = [];

        for (const seq of selected) {
          for (const theme of themes) {
            if (ctx.signal.aborted) break;
            const label = seq.word ?? seq.name ?? seq.id;
            ctx.onProgress({ phase: "rendering", current: ++done, total, detail: `${label} (${theme})` });
            const lvl = seq.level ?? 0;
            const hasLoop = !!seq.isCircular || !!seq.loopType;
            const hasStart = !!seq.startPosition;
            try {
              const oldCanvas = runMode === "front" ? await renderFrontMain(seq) : await renderOld(seq, theme);
              const newCanvas = runMode === "front" ? await renderFrontWorker(seq) : await renderNew(seq, theme);
              const d = diff(oldCanvas, newCanvas, OUT_W, OUT_H);
              worst = Math.max(worst, d.diffPct);
              worstMaxDelta = Math.max(worstMaxDelta, d.maxDelta);
              const row: ParityRow = {
                id: `${seq.id}:${theme}`,
                title: `${label} — ${theme}`,
                metrics: { "% diff": d.diffPct, "max Δ": d.maxDelta },
                bad: d.diffPct > 1,
                cells: [
                  { label: runMode === "front" ? "MAIN (main thread)" : "OLD (DOM)", canvas: oldCanvas },
                  { label: runMode === "front" ? "WORKER (pool)" : "NEW (BackJob)", canvas: newCanvas },
                  { label: "DIFF (red = differs)", canvas: d.heat },
                ],
              };
              ctx.addRow(row);
              summaryRows.push({ label, theme, seqId: seq.id, level: lvl, hasLoop, hasStartPos: hasStart, diffPct: Number(d.diffPct.toFixed(4)), maxDelta: d.maxDelta });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const blank = document.createElement("canvas"); blank.width = OUT_W; blank.height = OUT_H;
              ctx.addRow({ id: `${seq.id}:${theme}`, title: `${label} — ${theme}`, metrics: {}, error: msg, cells: [{ label: "ERROR", canvas: blank }] });
              summaryRows.push({ label, theme, seqId: seq.id, level: lvl, hasLoop, hasStartPos: hasStart, error: msg });
            }
          }
        }

        const verdict: ParityVerdict["verdict"] = worst <= 1 ? "PASS" : "FAIL";
        return {
          verdict,
          summary: `worst diff ${worst.toFixed(3)}% across ${summaryRows.length} renders`,
          gates: [{ label: "diff ≤ 1%", pass: worst <= 1, detail: `${worst.toFixed(3)}% · Δ${worstMaxDelta}` }],
          result: { mode: runMode, themes, aaTolerance: AA_TOLERANCE, outputSize: { width: OUT_W, height: OUT_H }, worstDiffPct: Number(worst.toFixed(4)), worstMaxDelta, rows: summaryRows },
        };
      },
    };
  }
```

- [ ] **Step 3: Replace the markup with the harness**

Replace the entire `<div class="page">…</div>` body (NOT the `<script>` or `<svelte:head>`) and the `<style>` block with:

```svelte
<ParityHarness
  title="Card Parity Harness"
  description={`Renders representative cards two ways and pixel-diffs them. AA tolerance ${AA_TOLERANCE}/channel. Output ${OUT_W}×${OUT_H}. Back mode: old DOM vs new BackJob. Front mode: worker pool vs main thread.`}
  resultKey="cardParityResult"
  run={makeRun}
>
  {#snippet controls()}
    <div class="mode-toggle" role="radiogroup" aria-label="Parity mode">
      <button type="button" role="radio" aria-checked={mode === "back"} class:active={mode === "back"} onclick={() => (mode = "back")}>Back (old vs new)</button>
      <button type="button" role="radio" aria-checked={mode === "front"} class:active={mode === "front"} onclick={() => (mode = "front")}>Front (worker vs main)</button>
    </div>
    {#if loadError}<span class="load-err">load error: {loadError}</span>{/if}
  {/snippet}
</ParityHarness>

<div bind:this={oldSlot} class="offscreen"></div>

<style>
  .mode-toggle { display: inline-flex; gap: 4px; padding: 4px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid #2a2a33; }
  .mode-toggle button { padding: 8px 14px; font-size: 13px; background: transparent; border: 1px solid transparent; color: #fff; border-radius: 8px; cursor: pointer; }
  .mode-toggle button.active { background: rgba(99,102,241,0.3); border-color: rgba(99,102,241,0.5); }
  .load-err { color: #ff6b6b; font-size: 13px; }
  .offscreen { position: fixed; left: -99999px; top: -99999px; }
</style>
```

Keep `oldSlot`, `engine`, `loadError`, `onMount`/`onDestroy` exactly as they are. Remove the now-unused `attach()` function (the harness has its own).

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `card-back-parity`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/card-back-parity/+page.svelte
git commit -m "refactor(parity): card-back-parity onto ParityHarness + lib" -- src/routes/test/card-back-parity/+page.svelte
```

---

## Task 6: Refactor trail-export-parity onto the harness

**Files:**
- Modify: `src/routes/test/trail-export-parity/+page.svelte`

Goal: keep ALL domain logic (sequence loading, warmup, the real `executeExport`, mediabunny decode, `timeToBeatLive`, `findLiveContext`, `compositeLiveToCanvas`, `renderLiveReference` and its deterministic `renderFrameSync` drive, the two gate thresholds). Replace inline `diff`/`bodyDiff`/`flattenToCanvas` with the lib, move the visible live engine offscreen, and route every phase through `onProgress` and each sampled frame through `addRow`.

- [ ] **Step 1: Swap imports + delete inline diff helpers**

Add imports:

```ts
  import ParityHarness from "$lib/shared/parity/ParityHarness.svelte";
  import { diff, bodyDiff, flattenToCanvas, AA_TOLERANCE } from "$lib/shared/parity/image-diff";
  import type { ParityRun, ParityRow, ParityVerdict } from "$lib/shared/parity/parity-types";
```

Delete the local `AA_TOLERANCE`, `flattenToCanvas`, `bodyDiff`, `diff`, and the `EDGE_LUMA_THRESH`/`EDGE_DILATE` consts. Keep `PASS_MAX_DELTA`, `PASS_DIFF_PCT`, `PASS_LIVE_MAX_DELTA`, `PASS_LIVE_DIFF_PCT`.

- [ ] **Step 2: Make `renderLiveReference` report progress**

Change its signature to accept the run context and emit per-frame progress. Replace the `for (let i = 0; i < totalFrames; i++)` loop header region so that after computing `playbackPosition` and rendering, it reports:

```ts
  async function renderLiveReference(
    size: number,
    sampledIndices: Set<number>,
    onProgress: (current: number, total: number) => void,
    signal: AbortSignal,
  ): Promise<Record<number, HTMLCanvasElement>> {
```

Inside the loop, after `liveCtx?.renderFrameSync(props, virtualTimeMs, stepSeconds);` add:

```ts
      if (signal.aborted) break;
      onProgress(i + 1, totalFrames);
```

Keep everything else in the function identical.

- [ ] **Step 3: Convert `run()` into a ParityRun factory**

Replace the entire `run()` function and the `word`/`resolution`/`fps`/`codec`/`status`/`running`/`rows`/`verdict`/`worst*` state with: keep `word`/`resolution`/`fps`/`codec` runes (controls need them), drop the rest, and add `makeRun()`:

```ts
  let word = $state("DJDJ");
  let resolution = $state<720 | 1080 | 2160>(1080);
  let fps = $state(60);
  let codec = $state<"h264" | "av1">("av1");

  function makeRun(): ParityRun {
    const cfg = { word: word.trim(), resolution, fps, codec };
    return {
      async run(ctx) {
        ctx.onProgress({ phase: "loading sequence", detail: cfg.word });
        if (!(await loadSequence())) {
          return { verdict: "FAIL", summary: "no sequence with motion data", gates: [], result: { error: "load failed" } };
        }

        // Warm the accumulator (indeterminate) — reproduces the warm-state bug the
        // export-start reset must wipe.
        animationState.setShouldLoop(true);
        playbackController!.togglePlayback();
        ctx.onProgress({ phase: "warming trail accumulator", detail: "play + loop 3s" });
        await new Promise((r) => setTimeout(r, 3000));
        if (animationState.isPlaying) playbackController!.togglePlayback();
        await raf();

        (window as unknown as Record<string, unknown>).__tka_export_frame_dump = -1;
        const stride = Math.max(1, Math.round(cfg.fps / 3));
        const capture = { stride, max: 16, captured: {} as Record<number, { w: number; h: number; data: Uint8ClampedArray }> };
        (window as unknown as Record<string, unknown>).__tka_parity_capture = capture;

        try {
          const orchestrator = getVideoExportOrchestrator();
          const blob = await orchestrator.executeExport(
            canvas!, playbackController!, animationState,
            (p) => {
              if (p.stage === "capturing" && p.totalFrames) ctx.onProgress({ phase: "exporting", current: p.currentFrame, total: p.totalFrames });
              else ctx.onProgress({ phase: "exporting", detail: p.stage });
            },
            { format: "mp4", codec: cfg.codec, resolution: cfg.resolution, fps: cfg.fps, loopCount: 1, effectOverrides: { trails: true }, includeAnimationStartPosition: true, includeEndHold: true },
          );

          const captured = capture.captured;
          const indices = Object.keys(captured).map(Number).sort((a, b) => a - b);
          if (indices.length === 0) {
            return { verdict: "FAIL", summary: "export produced 0 sampled frames", gates: [], result: { error: "no frames captured" } };
          }

          ctx.onProgress({ phase: "decoding MP4", detail: `${(blob.size / 1e6).toFixed(1)} MB` });
          const buf = await blob.arrayBuffer();
          const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(buf) });
          const track = await input.getPrimaryVideoTrack();
          if (!track) {
            input.dispose();
            return { verdict: "FAIL", summary: "no video track in MP4", gates: [], result: { error: "decode failed" } };
          }
          const sink = new VideoSampleSink(track);

          let worstDiffPct = 0, worstMaxDelta = 0, worstPercDiffPct = 0, worstPercMaxDelta = 0;
          const frameMeta: Record<number, { ref: HTMLCanvasElement; dec: HTMLCanvasElement; heat: HTMLCanvasElement; percDiffPct: number; percMaxDelta: number; diffPct: number; maxDelta: number }> = {};

          let decoded = 0;
          for (const idx of indices) {
            if (ctx.signal.aborted) break;
            const cap = captured[idx]!;
            const timeSec = idx / cfg.fps;
            ctx.onProgress({ phase: "decoding + diffing", current: ++decoded, total: indices.length });
            const sample = await sink.getSample(timeSec);
            if (!sample) continue;
            const ref = flattenToCanvas(cap.data, cap.w, cap.h);
            const dec = document.createElement("canvas");
            dec.width = cap.w; dec.height = cap.h;
            const dctx = dec.getContext("2d")!;
            dctx.fillStyle = "#000"; dctx.fillRect(0, 0, cap.w, cap.h);
            dctx.drawImage(sample.toCanvasImageSource(), 0, 0, cap.w, cap.h);
            sample.close();
            const d = diff(ref, dec, cap.w, cap.h);
            const body = bodyDiff(ref, dec, cap.w, cap.h);
            worstDiffPct = Math.max(worstDiffPct, d.diffPct);
            worstMaxDelta = Math.max(worstMaxDelta, d.maxDelta);
            worstPercDiffPct = Math.max(worstPercDiffPct, body.bodyDiffPct);
            worstPercMaxDelta = Math.max(worstPercMaxDelta, body.bodyMaxDelta);
            frameMeta[idx] = { ref, dec, heat: d.heat, percDiffPct: body.bodyDiffPct, percMaxDelta: body.bodyMaxDelta, diffPct: d.diffPct, maxDelta: d.maxDelta };
          }
          input.dispose();

          // LIVE-REFERENCE PASS — the real effect-fidelity gate.
          const firstCap = captured[indices[0]!]!;
          const liveSize = firstCap.w;
          const liveCtx = findLiveContext();
          const didResize = !!liveCtx;
          let liveRef: Record<number, HTMLCanvasElement> = {};
          let worstLiveDiffPct = 0, worstLiveMaxDelta = 0;
          try {
            liveCtx?.resize(liveSize);
            await raf();
            liveRef = await renderLiveReference(
              liveSize, new Set(indices),
              (c, t) => ctx.onProgress({ phase: "live-reference pass", current: c, total: t }),
              ctx.signal,
            );
          } finally {
            if (didResize) { liveCtx!.restoreSize(); await raf(); }
          }

          for (const idx of indices) {
            const meta = frameMeta[idx];
            if (!meta) continue;
            const live = liveRef[idx] ?? null;
            let liveDiffPct = 0, liveMaxDelta = 0;
            if (live) {
              const cap = captured[idx]!;
              const offscreenRef = flattenToCanvas(cap.data, cap.w, cap.h);
              const lb = bodyDiff(offscreenRef, live, cap.w, cap.h);
              liveDiffPct = lb.bodyDiffPct; liveMaxDelta = lb.bodyMaxDelta;
              worstLiveDiffPct = Math.max(worstLiveDiffPct, liveDiffPct);
              worstLiveMaxDelta = Math.max(worstLiveMaxDelta, liveMaxDelta);
            }
            const cells = [
              { label: "offscreen pre-encode", canvas: meta.ref },
              ...(live ? [{ label: "live render", canvas: live }] : []),
              { label: "decoded MP4", canvas: meta.dec },
              { label: `encoder diff (red Δ>${AA_TOLERANCE})`, canvas: meta.heat },
            ];
            const row: ParityRow = {
              id: idx,
              title: `frame ${idx} · t=${(idx / cfg.fps).toFixed(3)}s`,
              metrics: { "live %": liveDiffPct, "liveΔ": liveMaxDelta, "enc %": meta.percDiffPct, "encΔ": meta.percMaxDelta },
              bad: liveDiffPct > PASS_LIVE_DIFF_PCT || meta.percDiffPct > PASS_DIFF_PCT,
              cells,
            };
            ctx.addRow(row);
          }

          const encoderPass = worstPercDiffPct <= PASS_DIFF_PCT && worstPercMaxDelta <= PASS_MAX_DELTA;
          const livePass = worstLiveDiffPct <= PASS_LIVE_DIFF_PCT && worstLiveMaxDelta <= PASS_LIVE_MAX_DELTA;
          const verdict: ParityVerdict["verdict"] = encoderPass && livePass ? "PASS" : "FAIL";
          return {
            verdict,
            summary: `live ${worstLiveDiffPct.toFixed(3)}% Δ${worstLiveMaxDelta} · encoder ${worstPercDiffPct.toFixed(3)}% Δ${worstPercMaxDelta} · full-res ${worstDiffPct.toFixed(3)}% Δ${worstMaxDelta}`,
            gates: [
              { label: "live (offscreen vs live)", pass: livePass, detail: `${worstLiveDiffPct.toFixed(3)}% Δ${worstLiveMaxDelta} (≤${PASS_LIVE_DIFF_PCT}% Δ${PASS_LIVE_MAX_DELTA})` },
              { label: "encoder (pre-encode vs decoded)", pass: encoderPass, detail: `${worstPercDiffPct.toFixed(3)}% Δ${worstPercMaxDelta} (≤${PASS_DIFF_PCT}% Δ${PASS_MAX_DELTA})` },
            ],
            result: { word: cfg.word, resolution: cfg.resolution, fps: cfg.fps, codec: cfg.codec, verdict, encoderPass, livePass, live: { worstDiffPct: worstLiveDiffPct, worstMaxDelta: worstLiveMaxDelta }, perceptual: { worstDiffPct: worstPercDiffPct, worstMaxDelta: worstPercMaxDelta }, fullRes: { worstDiffPct, worstMaxDelta } },
          };
        } finally {
          (window as unknown as Record<string, unknown>).__tka_parity_capture = undefined;
        }
      },
    };
  }
```

- [ ] **Step 4: Move the live engine offscreen + swap markup to the harness**

Replace the `<div class="page">…</div>` body and `<style>` with the harness. The live `AnimatorCanvas` moves into an offscreen wrapper (`left:-99999px`) so it still registers a render context but is never visibly flailing:

```svelte
<ParityHarness
  title="Trail Export Parity"
  description={`Live render → real MP4 export → decode. Two gates: ENCODER (pre-encode vs decoded, edges masked, ≤${PASS_DIFF_PCT}% Δ${PASS_MAX_DELTA}) and LIVE (offscreen vs live engine at output res, edges masked, ≤${PASS_LIVE_DIFF_PCT}% Δ${PASS_LIVE_MAX_DELTA}). PASS requires both.`}
  resultKey="trailParityResult"
  run={makeRun}
>
  {#snippet controls()}
    <label>Word <input bind:value={word} /></label>
    <label>Res
      <select bind:value={resolution}>
        <option value={720}>720</option>
        <option value={1080}>1080</option>
        <option value={2160}>2160 (4K)</option>
      </select>
    </label>
    <label>FPS <input type="number" bind:value={fps} min="10" max="60" /></label>
    <label>Codec
      <select bind:value={codec}>
        <option value="h264">H.264 (4:2:0)</option>
        <option value="av1">AV1 (4:4:4)</option>
      </select>
    </label>
  {/snippet}
</ParityHarness>

<!-- Real registered live engine, kept OFFSCREEN: the live gate diffs against this
     actual instance, but the viewer shouldn't watch it warm up + jump. -->
<div class="offscreen">
  <AnimatorCanvas
    blueProp={animationState.bluePropState}
    redProp={animationState.redPropState}
    gridVisible={true}
    {gridMode}
    letter={currentLetter}
    stepData={currentStepData}
    sequenceData={animationState.sequenceData}
    isPlaying={animationState.isPlaying}
    trailSettings={animationSettings.trail}
    {effectsConfigState}
    virtualTime={animationState.virtualTime}
    hideTkaGlyph={true}
    hideStepNumbers={true}
    hideProgressBar={true}
    onCanvasReady={(c) => { canvas = c; }}
  />
</div>

<style>
  .offscreen { position: fixed; left: -99999px; top: -99999px; width: 320px; height: 320px; }
  :global(.controls label) { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #eee; }
  :global(.controls input), :global(.controls select) { background: #1c1c2e; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 6px 8px; font-size: 14px; }
  :global(.controls input[type="number"]) { width: 64px; }
</style>
```

Remove the now-unused `engineReady` state (the harness Run button no longer gates on it; the offscreen canvas readiness is implied by `loadSequence` awaiting raf). Keep `canvas`, `currentLetter`, `currentStepData`, `gridMode`, and all the onMount/onDestroy wiring.

- [ ] **Step 5: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `trail-export-parity`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/test/trail-export-parity/+page.svelte
git commit -m "refactor(parity): trail-export-parity onto ParityHarness, offscreen live engine, phase progress" -- src/routes/test/trail-export-parity/+page.svelte
```

---

## Task 7: Parity index page

**Files:**
- Create: `src/routes/test/parity/+page.svelte`

- [ ] **Step 1: Write the index**

```svelte
<!-- src/routes/test/parity/+page.svelte -->
<script lang="ts">
  /** Hardcoded index of every parity test harness. Add a row to register one. */
  const tests = [
    { href: "/test/trail-export-parity", title: "Trail Export Parity", desc: "Live render → real MP4 export → decode. Encoder + live-vs-offscreen gates." },
    { href: "/test/card-back-parity", title: "Card Parity", desc: "Card back (old DOM vs new BackJob) and front (worker pool vs main thread)." },
  ];
</script>

<svelte:head><title>Parity Tests</title></svelte:head>

<div class="page">
  <h1>Parity Tests</h1>
  <p class="sub">Image-vs-image render parity harnesses. Each runs two sources, pixel-diffs them, and reports a PASS/FAIL verdict.</p>
  <ul>
    {#each tests as t (t.href)}
      <li><a href={t.href}><span class="t">{t.title}</span><span class="d">{t.desc}</span></a></li>
    {/each}
  </ul>
</div>

<style>
  .page { padding: 24px; background: #0d0d14; color: #eee; min-height: 100vh; font-family: system-ui, sans-serif; }
  h1 { margin: 0 0 4px; }
  .sub { color: #8a8aa0; margin: 0 0 18px; max-width: 70ch; font-size: 13px; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; max-width: 720px; }
  a { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid #2a2a40; border-radius: 8px; background: #11111f; text-decoration: none; color: inherit; }
  a:hover { border-color: #4c6ef5; background: #15152a; }
  .t { font-weight: 600; font-size: 15px; color: #fff; }
  .d { font-size: 13px; color: #8a8aa0; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/test/parity/+page.svelte
git commit -m "feat(parity): /test/parity index page" -- src/routes/test/parity/+page.svelte
```

---

## Task 8: Full check + runtime verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck (capture once, grep many)**

Run: `npm run check > /tmp/parity-check.log 2>&1; grep -niE "parity|image-diff" /tmp/parity-check.log`
Expected: no errors referencing the new files. (Pre-existing unrelated errors in other files are out of scope — confirm the count matches the baseline before this work.)

- [ ] **Step 2: Run the new unit tests**

Run: `npm test -- tests/unit/parity/image-diff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Runtime verification (user-driven — record evidence)**

Per verification-protocol, the harness UX + diff parity are visual. Confirm in the browser at:
- [localhost:5173/test/parity](http://localhost:5173/test/parity) — index lists both tests, both links load.
- [localhost:5173/test/card-back-parity](http://localhost:5173/test/card-back-parity) — Run produces rows with a moving progress bar; verdict + gate chip show; no visual regression vs the old page.
- [localhost:5173/test/trail-export-parity](http://localhost:5173/test/trail-export-parity) — Run shows the progress bar advancing through warming → exporting → decoding → live pass; NO visible flailing live engine; rows show offscreen/live/decoded/diff; both gate chips show; verdict matches the pre-refactor numbers.

Evidence to capture: `window.__trailParityResult` and `window.__cardParityResult` after a run, plus a screenshot of each harness mid-run (progress bar visible) and post-run (verdict + grid).

- [ ] **Step 4: Final note**

Do not claim done without the Step 3 evidence. If a gate regresses vs the pre-refactor numbers, the refactor changed behavior — diff the run pipeline against the original inline `run()` before shipping.
```
