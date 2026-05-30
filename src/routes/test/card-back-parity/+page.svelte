<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { renderCardBack } from "$lib/features/choreo-card/services/card-back-dom-renderer";
  import { buildBackJob } from "$lib/features/choreo-card/services/card-back/card-back-job-builder";
  import { paintBackJob } from "$lib/features/choreo-card/services/card-back/card-back-raster";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { getImageComposer } from "$lib/shared/render/get-image-composer";
  import { getCompositionDispatcher } from "$lib/shared/render/get-composition-dispatcher";
  import { CompositionDispatcher } from "$lib/shared/render/services/composition-dispatcher";
  import { getCardAssetBundle } from "$lib/shared/render/services/get-card-asset-bundle";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import { onMount, onDestroy } from "svelte";

  // Logical MPC dimensions; both render paths end at scale-2 (1644x2244).
  const LOGICAL_W = 822;
  const LOGICAL_H = 1122;
  const LOGICAL_BLEED = 36;
  const SCALE = 2;
  const OUT_W = LOGICAL_W * SCALE; // 1644
  const OUT_H = LOGICAL_H * SCALE; // 2244

  // A pixel "differs" if any channel delta exceeds this anti-aliasing tolerance.
  const AA_TOLERANCE = 8;

  // Themes to exercise. cosmic is the default; ocean adds a second palette.
  const THEMES = ["cosmic", "ocean"] as const;

  interface ParityRow {
    label: string;
    theme: string;
    seqId: string;
    level: number | string;
    hasLoop: boolean;
    hasStartPos: boolean;
    diffPct: number; // % of pixels that differ
    maxDelta: number; // worst single-channel delta seen
    oldCanvas: HTMLCanvasElement;
    newCanvas: HTMLCanvasElement;
    diffCanvas: HTMLCanvasElement;
    error?: string;
  }

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let mode = $state<"back" | "front">("back");
  let status = $state("idle");
  let running = $state(false);
  let rows = $state<ParityRow[]>([]);
  let summaryJson = $state("{}");
  let loadError = $state<string | null>(null);

  let oldSlot: HTMLDivElement;

  onMount(async () => {
    try {
      await engine.initialize();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  });

  onDestroy(() => engine.destroy());

  /** Pick a representative subset spanning levels, loop/no-loop, startPos/no. */
  function selectSequences(all: SequenceData[]): SequenceData[] {
    const renderable = all.filter((s) => Array.isArray(s.steps) && s.steps.length > 0);
    const picked: SequenceData[] = [];
    const seen = new Set<string>();

    const want = (pred: (s: SequenceData) => boolean) => {
      const hit = renderable.find((s) => !seen.has(s.id) && pred(s));
      if (hit) {
        picked.push(hit);
        seen.add(hit.id);
      }
    };

    const lvl = (s: SequenceData) => s.level ?? 0;
    const hasLoop = (s: SequenceData) => !!s.isCircular || !!s.loopType;
    const hasStart = (s: SequenceData) => !!s.startPosition;

    // Matrix coverage
    want((s) => lvl(s) === 1 && !hasLoop(s) && hasStart(s));
    want((s) => lvl(s) === 1 && hasLoop(s));
    want((s) => lvl(s) === 2 && hasStart(s));
    want((s) => lvl(s) === 2 && hasLoop(s));
    want((s) => lvl(s) === 3 && hasStart(s));
    want((s) => lvl(s) === 3 && hasLoop(s));
    want((s) => !hasStart(s)); // explicit no-start-position case
    want((s) => hasLoop(s) && hasStart(s)); // loop + start together

    // Top up to ~8 with any remaining renderable sequences.
    for (const s of renderable) {
      if (picked.length >= 8) break;
      if (!seen.has(s.id)) {
        picked.push(s);
        seen.add(s.id);
      }
    }
    return picked;
  }

  /** Normalize any canvas to OUT_W x OUT_H (the DOM path may emit a different size). */
  function normalize(src: HTMLCanvasElement | OffscreenCanvas | ImageBitmap): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = OUT_W;
    out.height = OUT_H;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(src as CanvasImageSource, 0, 0, OUT_W, OUT_H);
    return out;
  }

  /** Compute % differing pixels + max channel delta + a red diff overlay. */
  function diff(
    oldC: HTMLCanvasElement,
    newC: HTMLCanvasElement,
  ): { diffPct: number; maxDelta: number; diffCanvas: HTMLCanvasElement } {
    const a = oldC.getContext("2d")!.getImageData(0, 0, OUT_W, OUT_H);
    const b = newC.getContext("2d")!.getImageData(0, 0, OUT_W, OUT_H);
    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = OUT_W;
    diffCanvas.height = OUT_H;
    const dctx = diffCanvas.getContext("2d")!;
    const out = dctx.createImageData(OUT_W, OUT_H);

    let differing = 0;
    let maxDelta = 0;
    const total = OUT_W * OUT_H;
    for (let i = 0; i < a.data.length; i += 4) {
      const dr = Math.abs(a.data[i]! - b.data[i]!);
      const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!);
      const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!);
      const da = Math.abs(a.data[i + 3]! - b.data[i + 3]!);
      const worst = Math.max(dr, dg, db, da);
      if (worst > maxDelta) maxDelta = worst;
      if (worst > AA_TOLERANCE) {
        differing++;
        out.data[i] = 255;
        out.data[i + 1] = 0;
        out.data[i + 2] = 0;
        out.data[i + 3] = 255;
      } else {
        // Show a faint grayscale of the original where pixels match.
        const g = (a.data[i]! + a.data[i + 1]! + a.data[i + 2]!) / 3;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = g * 0.4;
        out.data[i + 3] = 255;
      }
    }
    dctx.putImageData(out, 0, 0);
    return { diffPct: (differing / total) * 100, maxDelta, diffCanvas };
  }

  async function renderNew(seq: SequenceData, theme: string): Promise<HTMLCanvasElement> {
    const job = await buildBackJob(seq, {
      width: OUT_W,
      height: OUT_H,
      bleedPx: LOGICAL_BLEED * SCALE,
      theme,
    });
    return normalize(paintBackJob(job));
  }

  async function renderOld(seq: SequenceData, theme: string): Promise<HTMLCanvasElement> {
    const c = await renderCardBack(seq, {
      width: LOGICAL_W,
      height: LOGICAL_H,
      bleedPx: LOGICAL_BLEED,
      theme,
    });
    return normalize(c);
  }

  // FRONT compose options. Mirrors PrintCardRenderer.renderFront's composeOptions
  // for a generic card (lines 112-162), trimmed to the deck-independent fields so
  // the worker and main-thread paths receive byte-identical options. Content area
  // is the full harness output size for a clean full-card diff.
  function frontOptions(): Partial<SequenceExportOptions> {
    const contentW = OUT_W;
    const contentH = OUT_H;
    return {
      deckCard: { contentWidth: contentW, contentHeight: contentH },
      includeStartPosition: true,
      startPositionLayout: "row",
      addStepNumbers: true,
      addWord: true,
      addDifficultyLevel: false,
      stepSize: 300,
      stepScale: 1,
      margin: 0,
      format: "PNG",
      quality: 1,
      scale: 1,
      redVisible: true,
      blueVisible: true,
      addReversalSymbols: true,
      combinedGrids: false,
      showLoopGlyph: false,
      visibilityOverrides: {
        showTKA: true,
        showTnD: false,
        showElemental: false,
        showPositions: false,
        showReversals: true,
        showNonRadialPoints: false,
        showGrid: true,
        printMode: true,
        darkMode: false,
        handPointVisibility: "all",
      },
    };
  }

  // MAIN-THREAD front (the reference / "old" side for front mode).
  async function renderFrontMain(seq: SequenceData): Promise<HTMLCanvasElement> {
    const canvas = await getImageComposer().composeSequenceImage(seq, frontOptions());
    return normalize(canvas);
  }

  // WORKER front (the candidate / "new" side). Same options as the main-thread
  // path, so any pixel difference is purely worker-vs-main.
  async function renderFrontWorker(seq: SequenceData): Promise<HTMLCanvasElement> {
    const bmp = await getCompositionDispatcher().composeFrontBitmap(seq, frontOptions());
    return normalize(bmp);
  }

  async function run() {
    if (running) return;
    running = true;
    rows = [];
    status = "selecting sequences…";

    const selected = selectSequences([...engine.allSequences]);
    if (selected.length === 0) {
      status = "no renderable sequences found";
      running = false;
      summaryJson = JSON.stringify({ error: "no renderable sequences" }, null, 2);
      return;
    }

    // Front mode is theme-independent (the pictograph composite ignores card
    // theming), so iterate sequences once under a single pseudo-theme label.
    const themes: readonly string[] = mode === "front" ? ["front"] : THEMES;

    // Front mode needs the worker pool: probe it, then seed one asset bundle
    // (front render is theme-independent for the pictograph, so THEMES[0] is fine).
    if (mode === "front") {
      status = "probing worker support…";
      const ok = await CompositionDispatcher.probeWorkerSupport();
      if (!ok) {
        status = "worker probe failed — front mode needs the worker pool";
        running = false;
        summaryJson = JSON.stringify({ error: "worker probe failed" }, null, 2);
        return;
      }
      status = "building asset bundle…";
      const blue = PropType.STAFF, red = PropType.STAFF;
      const bundle = await getCardAssetBundle(selected, {
        bluePropType: blue,
        redPropType: red,
        theme: THEMES[0],
      });
      getCompositionDispatcher().setAssetBundle(bundle);
    }

    const results: ParityRow[] = [];
    let done = 0;
    const totalRuns = selected.length * themes.length;
    let oldTotalMs = 0, newTotalMs = 0;
    const perCardMs: { old: number; new: number; first: boolean }[] = [];

    for (const seq of selected) {
      for (const theme of themes) {
        status = `rendering ${seq.word ?? seq.name ?? seq.id} (${theme}) — ${++done}/${totalRuns}`;
        const lvl = seq.level ?? 0;
        try {
          const t0 = performance.now();
          const oldCanvas =
            mode === "front" ? await renderFrontMain(seq) : await renderOld(seq, theme);
          const t1 = performance.now();
          const newCanvas =
            mode === "front" ? await renderFrontWorker(seq) : await renderNew(seq, theme);
          const t2 = performance.now();
          oldTotalMs += t1 - t0; newTotalMs += t2 - t1;
          perCardMs.push({ old: Math.round(t1 - t0), new: Math.round(t2 - t1), first: done === 1 });
          const { diffPct, maxDelta, diffCanvas } = diff(oldCanvas, newCanvas);
          results.push({
            label: `${seq.word ?? seq.name ?? seq.id}`,
            theme,
            seqId: seq.id,
            level: lvl,
            hasLoop: !!seq.isCircular || !!seq.loopType,
            hasStartPos: !!seq.startPosition,
            diffPct,
            maxDelta,
            oldCanvas,
            newCanvas,
            diffCanvas,
          });
        } catch (err) {
          const blank = document.createElement("canvas");
          blank.width = OUT_W;
          blank.height = OUT_H;
          results.push({
            label: `${seq.word ?? seq.name ?? seq.id}`,
            theme,
            seqId: seq.id,
            level: lvl,
            hasLoop: !!seq.isCircular || !!seq.loopType,
            hasStartPos: !!seq.startPosition,
            diffPct: NaN,
            maxDelta: NaN,
            oldCanvas: blank,
            newCanvas: blank,
            diffCanvas: blank,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    rows = results;

    const valid = results.filter((r) => !r.error && !Number.isNaN(r.diffPct));
    const worst = valid.reduce((m, r) => Math.max(m, r.diffPct), 0);
    const maxDelta = valid.reduce((m, r) => Math.max(m, r.maxDelta), 0);
    const summary = {
      mode,
      count: results.length,
      themes,
      aaTolerance: AA_TOLERANCE,
      outputSize: { width: OUT_W, height: OUT_H },
      worstDiffPct: Number(worst.toFixed(4)),
      worstMaxDelta: maxDelta,
      perf: {
        oldTotalMs: Math.round(oldTotalMs),
        newTotalMs: Math.round(newTotalMs),
        oldAvgMs: Math.round(oldTotalMs / Math.max(1, results.length)),
        newAvgMs: Math.round(newTotalMs / Math.max(1, results.length)),
        // steady-state avg excluding the first (cold: renderer init + cache fill)
        newAvgMsWarm: Math.round(
          perCardMs.slice(1).reduce((s, p) => s + p.new, 0) / Math.max(1, perCardMs.length - 1),
        ),
        firstCardMs: perCardMs[0] ?? null,
      },
      errors: results.filter((r) => r.error).map((r) => ({ label: r.label, theme: r.theme, error: r.error })),
      rows: results.map((r) => ({
        label: r.label,
        theme: r.theme,
        seqId: r.seqId,
        level: r.level,
        hasLoop: r.hasLoop,
        hasStartPos: r.hasStartPos,
        diffPct: Number.isNaN(r.diffPct) ? null : Number(r.diffPct.toFixed(4)),
        maxDelta: Number.isNaN(r.maxDelta) ? null : r.maxDelta,
        error: r.error ?? null,
      })),
    };
    summaryJson = JSON.stringify(summary, null, 2);
    status = `done — worst diff ${worst.toFixed(3)}% across ${results.length} renders`;
    running = false;
  }

  function attach(node: HTMLDivElement, canvas: HTMLCanvasElement) {
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    node.appendChild(canvas);
    return {
      destroy() {
        if (canvas.parentNode === node) node.removeChild(canvas);
      },
    };
  }
</script>

<svelte:head>
  <title>Card Parity — {mode === "front" ? "Front Worker vs Main" : "Back Old DOM vs New BackJob"}</title>
</svelte:head>

<div class="page">
  <header>
    <h1>Card Parity Harness — {mode === "front" ? "Front (worker vs main)" : "Back (old vs new)"}</h1>
    {#if mode === "front"}
      <p>
        Renders representative card fronts via the MAIN-THREAD compose path and the WORKER
        pool compose path with identical options, then pixel-diffs them. AA tolerance:
        {AA_TOLERANCE} per channel. Output: {OUT_W}×{OUT_H}.
      </p>
    {:else}
      <p>
        Renders representative card backs via the OLD DOM screenshot path and the NEW BackJob
        paint path, then pixel-diffs them. AA tolerance: {AA_TOLERANCE} per channel. Output:
        {OUT_W}×{OUT_H}.
      </p>
    {/if}
    <div class="controls">
      <div class="mode-toggle" role="radiogroup" aria-label="Parity mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "back"}
          class:active={mode === "back"}
          disabled={running}
          onclick={() => (mode = "back")}
        >
          Back (old vs new)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "front"}
          class:active={mode === "front"}
          disabled={running}
          onclick={() => (mode = "front")}
        >
          Front (worker vs main)
        </button>
      </div>
      <button type="button" onclick={run} disabled={running || !!loadError}>
        {running ? "Running…" : "Run parity check"}
      </button>
      <span class="status">{loadError ? `load error: ${loadError}` : status}</span>
    </div>
  </header>

  <pre id="parity-summary">{summaryJson}</pre>

  {#if rows.length > 0}
    <table class="stats">
      <thead>
        <tr>
          <th>Sequence</th><th>Theme</th><th>Level</th><th>Loop</th><th>Start</th>
          <th>% diff</th><th>max Δ</th><th>Note</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r}
          <tr class:bad={r.error || (r.diffPct ?? 0) > 1}>
            <td>{r.label}</td>
            <td>{r.theme}</td>
            <td>{r.level}</td>
            <td>{r.hasLoop ? "yes" : "no"}</td>
            <td>{r.hasStartPos ? "yes" : "no"}</td>
            <td>{Number.isNaN(r.diffPct) ? "—" : r.diffPct.toFixed(3) + "%"}</td>
            <td>{Number.isNaN(r.maxDelta) ? "—" : r.maxDelta}</td>
            <td>{r.error ?? ""}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="grid">
      {#each rows as r}
        <div class="cell">
          <div class="cell-head">{r.label} — {r.theme} ({r.diffPct.toFixed(3)}%)</div>
          <div class="trio">
            <figure>
              <figcaption>{mode === "front" ? "MAIN (main thread)" : "OLD (DOM)"}</figcaption>
              <div use:attach={r.oldCanvas}></div>
            </figure>
            <figure>
              <figcaption>{mode === "front" ? "WORKER (pool)" : "NEW (BackJob)"}</figcaption>
              <div use:attach={r.newCanvas}></div>
            </figure>
            <figure><figcaption>DIFF (red = differs)</figcaption><div use:attach={r.diffCanvas}></div></figure>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div bind:this={oldSlot} class="offscreen"></div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #15151b;
    color: #ddd;
    padding: 24px;
    font-family: system-ui, sans-serif;
  }
  header h1 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #fff;
  }
  header p {
    margin: 0 0 12px;
    font-size: 13px;
    color: #999;
    max-width: 720px;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  button {
    padding: 10px 22px;
    border-radius: 8px;
    border: 1px solid rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.3);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .status {
    font-size: 13px;
    color: #8ab4f8;
  }
  .mode-toggle {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #2a2a33;
  }
  .mode-toggle button {
    padding: 8px 14px;
    font-size: 13px;
    background: transparent;
    border: 1px solid transparent;
  }
  .mode-toggle button.active {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.5);
  }
  #parity-summary {
    background: #0c0c10;
    border: 1px solid #2a2a33;
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    color: #b8c0cc;
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
  }
  table.stats {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 13px;
  }
  table.stats th,
  table.stats td {
    border: 1px solid #2a2a33;
    padding: 6px 10px;
    text-align: left;
  }
  table.stats th {
    background: #1d1d26;
    color: #fff;
  }
  tr.bad td {
    background: rgba(220, 38, 38, 0.18);
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .cell {
    border: 1px solid #2a2a33;
    border-radius: 8px;
    padding: 12px;
    background: #1a1a22;
  }
  .cell-head {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
  }
  .trio {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 11px;
    color: #999;
    margin-bottom: 4px;
  }
  .offscreen {
    position: fixed;
    left: -99999px;
    top: -99999px;
  }
</style>
