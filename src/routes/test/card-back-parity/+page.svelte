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
  import { buildOverridePlacementBundle } from "$lib/shared/render/services/override-placement-bundle";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import { onMount, onDestroy } from "svelte";
  import ParityHarness from "$lib/shared/parity/ParityHarness.svelte";
  import { diff, normalizeToCanvas, AA_TOLERANCE } from "$lib/shared/parity/image-diff";
  import type { ParityRun, ParityRow, ParityVerdict } from "$lib/shared/parity/parity-types";

  // Logical MPC dimensions; both render paths end at scale-2 (1644x2244).
  const LOGICAL_W = 822;
  const LOGICAL_H = 1122;
  const LOGICAL_BLEED = 36;
  const SCALE = 2;
  const OUT_W = LOGICAL_W * SCALE; // 1644
  const OUT_H = LOGICAL_H * SCALE; // 2244

  // Themes to exercise. cosmic is the default; ocean adds a second palette.
  const THEMES = ["cosmic", "ocean"] as const;

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let mode = $state<"back" | "front">("back");
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

  async function renderNew(seq: SequenceData, theme: string): Promise<HTMLCanvasElement> {
    const job = await buildBackJob(seq, {
      width: OUT_W,
      height: OUT_H,
      bleedPx: LOGICAL_BLEED * SCALE,
      theme,
    });
    return normalizeToCanvas(paintBackJob(job) as CanvasImageSource, OUT_W, OUT_H);
  }

  async function renderOld(seq: SequenceData, theme: string): Promise<HTMLCanvasElement> {
    const c = await renderCardBack(seq, {
      width: LOGICAL_W,
      height: LOGICAL_H,
      bleedPx: LOGICAL_BLEED,
      theme,
    });
    return normalizeToCanvas(c as CanvasImageSource, OUT_W, OUT_H);
  }

  // FRONT compose options. Mirrors PrintCardRenderer.renderFront's composeOptions
  // for a generic card, trimmed to the deck-independent fields so the worker and
  // main-thread paths receive byte-identical options.
  function frontOptions(): Partial<SequenceExportOptions> {
    return {
      deckCard: { contentWidth: OUT_W, contentHeight: OUT_H },
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
    return normalizeToCanvas(canvas as CanvasImageSource, OUT_W, OUT_H);
  }

  // WORKER front (the candidate / "new" side). Same options as the main-thread
  // path, so any pixel difference is purely worker-vs-main.
  async function renderFrontWorker(seq: SequenceData): Promise<HTMLCanvasElement> {
    const bmp = await getCompositionDispatcher().composeFrontBitmap(seq, frontOptions());
    return normalizeToCanvas(bmp as CanvasImageSource, OUT_W, OUT_H);
  }

  function makeRun(): ParityRun {
    const runMode = mode; // capture at click time
    return {
      async run(ctx) {
        const selected = selectSequences([...engine.allSequences]);
        if (selected.length === 0) {
          return {
            verdict: "FAIL",
            summary: "no renderable sequences",
            gates: [],
            result: { error: "no renderable sequences" },
          };
        }
        const themes: readonly string[] = runMode === "front" ? ["front"] : THEMES;

        if (runMode === "front") {
          ctx.onProgress({ phase: "probing worker support" });
          const ok = await CompositionDispatcher.probeWorkerSupport();
          if (!ok) {
            return {
              verdict: "FAIL",
              summary: "worker probe failed",
              gates: [],
              result: { error: "worker probe failed" },
            };
          }
          ctx.onProgress({ phase: "building asset bundle" });
          const bundle = await getCardAssetBundle(selected, {
            bluePropType: PropType.STAFF,
            redPropType: PropType.STAFF,
            theme: THEMES[0],
          });
          getCompositionDispatcher().setAssetBundle(bundle);
          // Snapshot whatever overrides the main thread has loaded so worker
          // placement resolution matches main pixel-for-pixel.
          getCompositionDispatcher().setOverrideBundle(buildOverridePlacementBundle());
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
              const oldCanvas =
                runMode === "front" ? await renderFrontMain(seq) : await renderOld(seq, theme);
              const newCanvas =
                runMode === "front" ? await renderFrontWorker(seq) : await renderNew(seq, theme);
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
              summaryRows.push({
                label,
                theme,
                seqId: seq.id,
                level: lvl,
                hasLoop,
                hasStartPos: hasStart,
                diffPct: Number(d.diffPct.toFixed(4)),
                maxDelta: d.maxDelta,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const blank = document.createElement("canvas");
              blank.width = OUT_W;
              blank.height = OUT_H;
              ctx.addRow({
                id: `${seq.id}:${theme}`,
                title: `${label} — ${theme}`,
                metrics: {},
                error: msg,
                cells: [{ label: "ERROR", canvas: blank }],
              });
              summaryRows.push({ label, theme, seqId: seq.id, level: lvl, hasLoop, hasStartPos: hasStart, error: msg });
            }
          }
        }

        const verdict: ParityVerdict["verdict"] = worst <= 1 ? "PASS" : "FAIL";
        return {
          verdict,
          summary: `worst diff ${worst.toFixed(3)}% across ${summaryRows.length} renders`,
          gates: [{ label: "diff ≤ 1%", pass: worst <= 1, detail: `${worst.toFixed(3)}% · Δ${worstMaxDelta}` }],
          result: {
            mode: runMode,
            themes,
            aaTolerance: AA_TOLERANCE,
            outputSize: { width: OUT_W, height: OUT_H },
            worstDiffPct: Number(worst.toFixed(4)),
            worstMaxDelta,
            rows: summaryRows,
          },
        };
      },
    };
  }
</script>

<svelte:head>
  <title>Card Parity — {mode === "front" ? "Front Worker vs Main" : "Back Old DOM vs New BackJob"}</title>
</svelte:head>

<ParityHarness
  title="Card Parity Harness"
  description={`Renders representative cards two ways and pixel-diffs them. AA tolerance ${AA_TOLERANCE}/channel. Output ${OUT_W}×${OUT_H}. Back mode: old DOM vs new BackJob. Front mode: worker pool vs main thread.`}
  resultKey="cardParityResult"
  run={makeRun}
>
  {#snippet controls()}
    <div class="mode-toggle" role="radiogroup" aria-label="Parity mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "back"}
        class:active={mode === "back"}
        onclick={() => (mode = "back")}
      >
        Back (old vs new)
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "front"}
        class:active={mode === "front"}
        onclick={() => (mode = "front")}
      >
        Front (worker vs main)
      </button>
    </div>
    {#if loadError}<span class="load-err">load error: {loadError}</span>{/if}
  {/snippet}
</ParityHarness>

<div bind:this={oldSlot} class="offscreen"></div>

<style>
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
    color: #fff;
    border-radius: 8px;
    cursor: pointer;
  }
  .mode-toggle button.active {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.5);
  }
  .load-err {
    color: #ff6b6b;
    font-size: 13px;
  }
  .offscreen {
    position: fixed;
    left: -99999px;
    top: -99999px;
  }
</style>
