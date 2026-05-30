<script lang="ts">
  // FOCUSED PROOF: render ONE pictograph in the clean pictograph-render.worker,
  // seeded with main-thread-decoded SVGs, vs the same pictograph rendered on the
  // main thread. If the worker cell renders clean (not an Error square), the
  // worker-pool capability is proven and the rest is assembly.

  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/PreparedPictographData";
  import type { LayerRenderOptions, LayerVisibility } from "$lib/shared/render/services/types";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import { getCardAssetBundle } from "$lib/shared/render/services/get-card-asset-bundle";
  import { bundleTransferables, type AssetBundle } from "$lib/shared/render/services/card-asset-bundle";
  import { getLayerCompositor } from "$lib/shared/render/get-layer-compositor";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { createPictographWorker } from "$lib/shared/render/workers/create-pictograph-worker";
  import type { WorkerInMessage, WorkerOutMessage } from "$lib/shared/render/workers/pictograph-render.worker";
  import { getCardFrontWorkerPool } from "$lib/shared/render/services/card-front-worker-pool";
  import { composeCardFrontParallel } from "$lib/shared/render/services/compose-card-front-parallel";
  import { getImageComposer } from "$lib/shared/render/get-image-composer";
  import { computeCardFrontLayout } from "$lib/shared/render/services/card-front-assembler";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { buildCanonicalCardVisibility } from "$lib/features/choreo-card/domain/canonical-card-visibility";
  import { onMount, onDestroy } from "svelte";

  const SIZE = 600; // big single-cell render
  const CARD_W = 822, CARD_H = 1122; // full-card front dimensions

  const engine = createBrowseEngine({ persistKey: null, minColumns: 2, initialColumns: 3 });

  let status = $state("idle");
  let running = $state(false);
  let loadError = $state<string | null>(null);
  let info = $state("");

  let mainSlot: HTMLDivElement;
  let workerSlot: HTMLDivElement;
  let diffSlot: HTMLDivElement;

  // Full-card front parity proof state.
  let cardStatus = $state("idle");
  let cardRunning = $state(false);
  let cardInfo = $state("");
  let cardMainSlot: HTMLDivElement;
  let cardParallelSlot: HTMLDivElement;
  let cardDiffSlot: HTMLDivElement;
  // TnD element drives the accent-color tint + element footer on the full card.
  // 3 = Split-Opp / fire — a vivid orange, easy to eyeball.
  let selectedElementIdx = $state(3);

  onMount(async () => {
    try {
      await engine.initialize();
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    }
  });
  onDestroy(() => engine.destroy());

  function pickStep(): { seq: SequenceData; step: StepData } | null {
    for (const seq of engine.allSequences) {
      if (Array.isArray(seq.steps) && seq.steps.length > 0) {
        // First step with a letter (a real pictograph, not a bare start pos).
        const step = seq.steps.find((s) => s.letter) ?? seq.steps[0];
        if (step) return { seq, step };
      }
    }
    return null;
  }

  function layerOptions(): LayerRenderOptions {
    return {
      size: SIZE,
      darkMode: false,
      showNonRadialPoints: false,
      handPointVisibility: "all",
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      showBlueMotion: true,
      showRedMotion: true,
      showPositions: false,
      handPathMode: false,
    };
  }
  function layerVisibility(): LayerVisibility {
    return { showTKA: true, showReversals: true };
  }

  async function prepareStep(step: StepData): Promise<PreparedPictographData> {
    const { pictographPreparer } = await import(
      "$lib/shared/pictograph/shared/services/pictograph-preparer"
    );
    return pictographPreparer.prepareSingle(step, {
      themeMode: "light",
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      handPathMode: false,
      showBlueMotion: true,
      showRedMotion: true,
    });
  }

  function renderOnWorker(
    bundle: AssetBundle,
    prepared: PreparedPictographData,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const worker = createPictographWorker();
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("worker timeout (15s)"));
      }, 15000);

      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(`worker module error: ${e.message}`));
      };

      worker.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
        const m = ev.data;
        if (m.type === "seed-done") {
          // structured-clone the prepared data (matches WorkerRenderPool).
          const renderMsg: WorkerInMessage = JSON.parse(
            JSON.stringify({
              type: "render",
              id: 1,
              preparedData: prepared,
              options: layerOptions(),
              visibility: layerVisibility(),
              stepNumber: 1,
            }),
          );
          worker.postMessage(renderMsg);
        } else if (m.type === "render-result") {
          clearTimeout(timeout);
          worker.terminate();
          resolve(m.blob);
        } else if (m.type === "error") {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(m.message));
        }
      };

      // Seed the worker with pre-decoded SVGs (transfer the bitmaps).
      const seedMsg: WorkerInMessage = { type: "seed", bundle };
      worker.postMessage(seedMsg, bundleTransferables(bundle));
    });
  }

  function show(node: HTMLDivElement, canvas: HTMLCanvasElement) {
    node.replaceChildren();
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.imageRendering = "pixelated";
    node.appendChild(canvas);
  }

  function toCanvas(src: CanvasImageSource): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    c.getContext("2d")!.drawImage(src, 0, 0, SIZE, SIZE);
    return c;
  }

  function diffCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement): { pct: number; canvas: HTMLCanvasElement } {
    const da = a.getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
    const db = b.getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
    const out = document.createElement("canvas");
    out.width = SIZE;
    out.height = SIZE;
    const octx = out.getContext("2d")!;
    const od = octx.createImageData(SIZE, SIZE);
    let differ = 0;
    const total = SIZE * SIZE;
    for (let i = 0; i < da.data.length; i += 4) {
      const w = Math.max(
        Math.abs(da.data[i]! - db.data[i]!),
        Math.abs(da.data[i + 1]! - db.data[i + 1]!),
        Math.abs(da.data[i + 2]! - db.data[i + 2]!),
        Math.abs(da.data[i + 3]! - db.data[i + 3]!),
      );
      if (w > 8) {
        differ++;
        od.data[i] = 255; od.data[i + 3] = 255;
      } else {
        const g = (da.data[i]! + da.data[i + 1]! + da.data[i + 2]!) / 3;
        od.data[i] = od.data[i + 1] = od.data[i + 2] = g * 0.4;
        od.data[i + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    return { pct: (differ / total) * 100, canvas: out };
  }

  async function run() {
    if (running) return;
    running = true;
    info = "";
    try {
      status = "picking a pictograph…";
      const picked = pickStep();
      if (!picked) throw new Error("no renderable sequence/step found");
      const { seq, step } = picked;

      status = "preparing (main thread)…";
      const prepared = await prepareStep(step);

      status = "building asset bundle (main-thread decode)…";
      const bundle = await getCardAssetBundle([seq], {
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        theme: "front",
      });

      status = "rendering on MAIN thread (reference)…";
      const mainResult = await getLayerCompositor().compose(
        prepared,
        layerOptions(),
        layerVisibility(),
        1,
      );
      const mainCanvas = toCanvas(mainResult.canvas as CanvasImageSource);
      show(mainSlot, mainCanvas);

      status = "rendering on WORKER (seeded)…";
      const blob = await renderOnWorker(bundle, prepared);
      const bmp = await createImageBitmap(blob);
      const workerCanvas = toCanvas(bmp);
      show(workerSlot, workerCanvas);

      const { pct, canvas: dc } = diffCanvases(mainCanvas, workerCanvas);
      show(diffSlot, dc);

      info = JSON.stringify(
        {
          sequence: seq.word ?? seq.name ?? seq.id,
          letter: step.letter ?? null,
          bundleKeys: bundle.keys.length,
          bundleBitmaps: bundle.bitmaps.length,
          diffPct: Number(pct.toFixed(4)),
        },
        null,
        2,
      );
      status = `done — worker vs main diff ${pct.toFixed(3)}%`;
    } catch (err) {
      status = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
      info = status;
    } finally {
      running = false;
    }
  }

  // --- FULL CARD front parity (parallel worker pool vs main thread) -----------

  // Normalize any RenderCanvas / bitmap to a CARD_W x CARD_H HTMLCanvasElement.
  function toCardCanvas(src: CanvasImageSource): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = CARD_W;
    c.height = CARD_H;
    c.getContext("2d")!.drawImage(src, 0, 0, CARD_W, CARD_H);
    return c;
  }

  // Generalized diff: counts pixels that differ beyond threshold over the full
  // w x h frame, plus (separately) the differing pixels within the header band
  // (rows where y < headerH) and the footer band (rows where y >= h - footerH).
  // Returns all three percentages plus a red-overlay canvas.
  function diffCard(
    a: HTMLCanvasElement,
    b: HTMLCanvasElement,
    w: number,
    h: number,
    headerH: number,
    footerH: number,
  ): { pct: number; headerPct: number; footerPct: number; canvas: HTMLCanvasElement } {
    const da = a.getContext("2d")!.getImageData(0, 0, w, h);
    const db = b.getContext("2d")!.getImageData(0, 0, w, h);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d")!;
    const od = octx.createImageData(w, h);
    let differ = 0;
    let headerDiffer = 0;
    let footerDiffer = 0;
    const headerTotal = Math.max(0, Math.min(headerH, h)) * w;
    const footerTotal = Math.max(0, Math.min(footerH, h)) * w;
    const footerStartY = h - footerH;
    const total = w * h;
    for (let i = 0; i < da.data.length; i += 4) {
      const py = Math.floor(i / 4 / w);
      const wgt = Math.max(
        Math.abs(da.data[i]! - db.data[i]!),
        Math.abs(da.data[i + 1]! - db.data[i + 1]!),
        Math.abs(da.data[i + 2]! - db.data[i + 2]!),
        Math.abs(da.data[i + 3]! - db.data[i + 3]!),
      );
      if (wgt > 8) {
        differ++;
        if (py < headerH) headerDiffer++;
        if (py >= footerStartY) footerDiffer++;
        od.data[i] = 255; od.data[i + 3] = 255;
      } else {
        const g = (da.data[i]! + da.data[i + 1]! + da.data[i + 2]!) / 3;
        od.data[i] = od.data[i + 1] = od.data[i + 2] = g * 0.4;
        od.data[i + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    return {
      pct: (differ / total) * 100,
      headerPct: headerTotal > 0 ? (headerDiffer / headerTotal) * 100 : 0,
      footerPct: footerTotal > 0 ? (footerDiffer / footerTotal) * 100 : 0,
      canvas: out,
    };
  }

  async function runFullCard() {
    if (cardRunning) return;
    cardRunning = true;
    cardInfo = "";
    try {
      cardStatus = "picking a sequence…";
      const seq = engine.allSequences.find(
        (s) => Array.isArray(s.steps) && s.steps.length > 0,
      );
      if (!seq) {
        cardStatus = "no renderable sequence found";
        return;
      }

      // Mirror PrintCardRenderer.renderFront: a REAL TnD choreo-card with the
      // element accent-color tint + element footer, so the parallel render is
      // verified against the full card look (not a stripped-down one).
      const tnd = TND_ELEMENTS[selectedElementIdx]!;
      const canonical = buildCanonicalCardVisibility({
        tndElement: tnd,
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });
      const leftLabel = "Austen";
      const rightLabel = "TKA";
      const notes = tnd.name;
      const frontOptions = {
        deckCard: { contentWidth: CARD_W, contentHeight: CARD_H },
        includeStartPosition: true,
        startPositionLayout: "row",
        addStepNumbers: true,
        addWord: canonical.addWord,
        addDifficultyLevel: false,
        stepSize: 300, stepScale: 1, margin: 0, format: "PNG", quality: 1, scale: 1,
        redVisible: true, blueVisible: true, addReversalSymbols: true, combinedGrids: false,
        showLoopGlyph: false,
        bluePropTypeOverride: PropType.STAFF,
        redPropTypeOverride: PropType.STAFF,
        accentColor: tnd.accentColor,
        accentTintOpacity: tnd.cardTintOpacity,
        showCreatorName: !!leftLabel,
        showNotes: !!(notes || leftLabel || rightLabel || tnd.iconPath),
        showBirthday: false,
        leftLabel, rightLabel, notes,
        iconPath: tnd.iconPath,
        userName: "Austen",
        exportDate: new Date().toISOString(),
        visibilityOverrides: {
          ...canonical.visibilityOverrides,
          showMandala: false,
          showQRCode: false,
        },
      } as Partial<SequenceExportOptions>;

      cardStatus = "seeding worker pool…";
      const pool = getCardFrontWorkerPool();
      await pool.seedForDeck(
        [seq],
        { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, theme: "front" },
        "fullcard-proof",
      );
      if (!pool.isReady()) {
        cardStatus = "pool not ready (no OffscreenCanvas?)";
        return;
      }

      cardStatus = "rendering MAIN card (reference)…";
      const mainCanvas = await getImageComposer().composeSequenceImage(seq, frontOptions);
      const mainCard = toCardCanvas(mainCanvas as CanvasImageSource);
      show(cardMainSlot, mainCard);

      cardStatus = "rendering PARALLEL card (worker pool)…";
      const parallelCanvas = await composeCardFrontParallel(seq, frontOptions, pool);
      const parallelCard = toCardCanvas(parallelCanvas as CanvasImageSource);
      show(cardParallelSlot, parallelCard);

      // Header + footer heights come from the same layout the renderers use.
      const visibility = await getImageComposer().resolveVisibilitySettings(frontOptions);
      const layout = computeCardFrontLayout(seq, frontOptions, visibility);
      const headerH = layout.headerHeight;
      const footerH = layout.footerHeight;

      const { pct, headerPct, footerPct, canvas: dc } = diffCard(
        mainCard, parallelCard, CARD_W, CARD_H, headerH, footerH,
      );
      show(cardDiffSlot, dc);

      cardInfo = JSON.stringify(
        {
          sequence: seq.word ?? seq.id,
          element: tnd.name,
          accentColor: tnd.accentColor,
          cards: 1,
          overallDiffPct: Number(pct.toFixed(4)),
          headerDiffPct: Number(headerPct.toFixed(4)),
          footerDiffPct: Number(footerPct.toFixed(4)),
          headerHeight: headerH,
          footerHeight: footerH,
          cardSize: { w: CARD_W, h: CARD_H },
        },
        null,
        2,
      );
      cardStatus = `full card done — overall ${pct.toFixed(3)}% / header ${headerPct.toFixed(3)}% / footer ${footerPct.toFixed(3)}%`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      cardStatus = "FULL CARD FAILED: " + msg;
      cardInfo = msg;
    } finally {
      cardRunning = false;
    }
  }
</script>

<svelte:head><title>Worker Pictograph Proof</title></svelte:head>

<div class="page">
  <h1>Single Pictograph — Worker (seeded) vs Main</h1>
  <p>
    Renders ONE pictograph through the clean <code>pictograph-render.worker</code>, seeded with
    main-thread-decoded SVGs (AssetBundle), and diffs it against the main-thread
    <code>LayerCompositor</code>. Goal: worker cell renders clean, not an Error square.
  </p>
  <div class="controls">
    <button type="button" onclick={run} disabled={running || !!loadError}>
      {running ? "Running…" : "Render one pictograph in worker"}
    </button>
    <span class="status">{loadError ? `load error: ${loadError}` : status}</span>
  </div>

  {#if info}<pre>{info}</pre>{/if}

  <div class="trio">
    <figure><figcaption>MAIN (LayerCompositor)</figcaption><div bind:this={mainSlot} class="slot"></div></figure>
    <figure><figcaption>WORKER (seeded)</figcaption><div bind:this={workerSlot} class="slot"></div></figure>
    <figure><figcaption>DIFF (red = differs)</figcaption><div bind:this={diffSlot} class="slot"></div></figure>
  </div>

  <hr />

  <h1>Full Card Front — Parallel (worker pool) vs Main</h1>
  <p>
    Renders an ENTIRE card front (header TKA glyphs, start position, all step
    cells, chrome) through <code>composeCardFrontParallel</code> (worker pool) and
    diffs it against the main-thread <code>ImageComposer.composeSequenceImage</code>.
    Reports overall diff plus header-band and footer-band diffs so the TKA word
    glyphs AND the element footer are verified specifically. Uses a REAL TnD
    element so the accent-color tint + element footer are exercised on both the
    main and parallel paths.
  </p>
  <div class="elements">
    <span class="elabel">Element:</span>
    {#each TND_ELEMENTS as el, i (el.familyId)}
      <button
        type="button"
        class="el"
        class:active={i === selectedElementIdx}
        style:--accent={el.accentColor}
        onclick={() => (selectedElementIdx = i)}
        disabled={cardRunning}
      >{el.name}</button>
    {/each}
  </div>
  <div class="controls">
    <button type="button" onclick={runFullCard} disabled={cardRunning || !!loadError}>
      {cardRunning ? "Running…" : "Render FULL CARD (parallel vs main)"}
    </button>
    <span class="status">{loadError ? `load error: ${loadError}` : cardStatus}</span>
  </div>

  {#if cardInfo}<pre>{cardInfo}</pre>{/if}

  <div class="trio">
    <figure><figcaption>MAIN CARD (composeSequenceImage)</figcaption><div bind:this={cardMainSlot} class="slot"></div></figure>
    <figure><figcaption>PARALLEL CARD (worker pool)</figcaption><div bind:this={cardParallelSlot} class="slot"></div></figure>
    <figure><figcaption>DIFF (red = differs)</figcaption><div bind:this={cardDiffSlot} class="slot"></div></figure>
  </div>
</div>

<style>
  .page { min-height: 100vh; background: #15151b; color: #ddd; padding: 24px; font-family: system-ui, sans-serif; }
  h1 { font-size: 20px; color: #fff; margin: 0 0 8px; }
  p { font-size: 13px; color: #999; max-width: 760px; }
  code { color: #8ab4f8; }
  .controls { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
  button { padding: 10px 22px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.5); background: rgba(99,102,241,0.3); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  .status { font-size: 13px; color: #8ab4f8; }
  .elements { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; }
  .elabel { font-size: 13px; color: #999; }
  .el { padding: 6px 14px; font-size: 13px; border-radius: 8px; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); color: #eee; }
  .el.active { background: var(--accent); color: #111; font-weight: 700; }
  .el:disabled { opacity: 0.5; cursor: default; }
  pre { background: #0c0c10; border: 1px solid #2a2a33; border-radius: 8px; padding: 12px; font-size: 12px; color: #b8c0cc; white-space: pre-wrap; }
  .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #999; margin-bottom: 6px; }
  .slot { background: #fff; border: 1px solid #2a2a33; border-radius: 6px; min-height: 120px; }
  hr { border: none; border-top: 1px solid #2a2a33; margin: 32px 0 8px; }
</style>
