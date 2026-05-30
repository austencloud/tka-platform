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
  import { getImageComposer } from "$lib/shared/render/get-image-composer";
  import { computeCardFrontLayout } from "$lib/shared/render/services/card-front-assembler";
  import { getQRCellScale } from "$lib/shared/qr/qr-cell-scale";
  import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { buildCanonicalCardVisibility } from "$lib/features/choreo-card/domain/canonical-card-visibility";
  import { wrapContentInCardFrame } from "$lib/features/choreo-card/services/card-front-frame";
  import { getPictographKeyHasher } from "$lib/shared/render/get-pictograph-key-hasher";
  import { getLayerCompositor as getLayerCompositorSingleton } from "$lib/shared/render/get-layer-compositor";
  import { clearSvgImageCache } from "$lib/shared/render/services/svg-image-cache";
  import {
    assemblyProbe,
    resetAssemblyProbe,
    snapshotAssemblyProbe,
  } from "$lib/shared/render/services/__assembly-perf-probe";
  import { onMount, onDestroy } from "svelte";

  const SIZE = 600; // big single-cell render
  const CARD_W = 822, CARD_H = 1122; // full-card front dimensions
  // Colored frame thickness, mirrors PrintCardRenderer/card-front-frame:
  // border = round(36 * 1.3) = 47. Content insets by this on every side.
  const CARD_BLEED = 36;
  const CARD_BORDER = Math.round(CARD_BLEED * 1.3); // 47
  const CONTENT_W = CARD_W - CARD_BORDER * 2; // 728
  const CONTENT_H = CARD_H - CARD_BORDER * 2; // 1028

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
  // Framed (full 822x1122 card with colored border + glow) views for eyeballing.
  let cardMainFramedSlot: HTMLDivElement;
  let cardParallelFramedSlot: HTMLDivElement;
  // TnD element drives the accent-color tint + element footer on the full card.
  // 3 = Split-Opp / fire — a vivid orange, easy to eyeball.
  let selectedElementIdx = $state(3);

  // Deck wall-time benchmark state.
  let deckTiming = $state(false);
  let deckStatus = $state("idle");
  let deckResult = $state<string | null>(null);

  // Cold-deck profiler state (dedup analysis + assembly phase breakdown).
  let profiling = $state(false);
  let profileStatus = $state("idle");
  let profileResult = $state<string | null>(null);

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

  // A rectangular region of the card, in card-pixel coordinates, over which to
  // compute a localized diff percentage (used for the QR cell band).
  type Rect = { x: number; y: number; w: number; h: number };

  // Generalized diff: counts pixels that differ beyond threshold over the full
  // w x h frame, plus (separately) the differing pixels within the header band
  // (rows where y < headerH), the footer band (rows where y >= h - footerH), and
  // an optional QR rect. Returns all percentages plus a red-overlay canvas.
  function diffCard(
    a: HTMLCanvasElement,
    b: HTMLCanvasElement,
    w: number,
    h: number,
    headerH: number,
    footerH: number,
    qrRect: Rect | null,
  ): { pct: number; headerPct: number; footerPct: number; qrPct: number; canvas: HTMLCanvasElement } {
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
    let qrDiffer = 0;
    const headerTotal = Math.max(0, Math.min(headerH, h)) * w;
    const footerTotal = Math.max(0, Math.min(footerH, h)) * w;
    const footerStartY = h - footerH;
    const total = w * h;
    // Clamp the QR rect into the frame so the per-pixel test is bounds-safe.
    const qx0 = qrRect ? Math.max(0, Math.floor(qrRect.x)) : 0;
    const qy0 = qrRect ? Math.max(0, Math.floor(qrRect.y)) : 0;
    const qx1 = qrRect ? Math.min(w, Math.ceil(qrRect.x + qrRect.w)) : 0;
    const qy1 = qrRect ? Math.min(h, Math.ceil(qrRect.y + qrRect.h)) : 0;
    const qrTotal = qrRect ? Math.max(0, qx1 - qx0) * Math.max(0, qy1 - qy0) : 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const px = (i / 4) % w;
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
        if (qrRect && px >= qx0 && px < qx1 && py >= qy0 && py < qy1) qrDiffer++;
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
      qrPct: qrTotal > 0 ? (qrDiffer / qrTotal) * 100 : 0,
      canvas: out,
    };
  }

  // Shared by runFullCard AND timeDeck so both render the EXACT same card shape.
  // Mirrors PrintCardRenderer.renderFront: a REAL TnD choreo-card with the
  // element accent-color tint + element footer + QR. Built per-sequence.
  function buildFrontOptions(): Partial<SequenceExportOptions> {
    const tnd = TND_ELEMENTS[selectedElementIdx]!;
    const canonical = buildCanonicalCardVisibility({
      tndElement: tnd,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
    });
    const leftLabel = "Austen";
    const rightLabel = "TKA";
    const notes = tnd.name;
    return {
      deckCard: { contentWidth: CONTENT_W, contentHeight: CONTENT_H },
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
      // deckId is the QR payload — required for the QR to resolve.
      deckId: "parity-proof",
      showCreatorName: !!leftLabel,
      showNotes: !!(notes || leftLabel || rightLabel || tnd.iconPath),
      showBirthday: false,
      leftLabel, rightLabel, notes,
      iconPath: tnd.iconPath,
      userName: "Austen",
      exportDate: new Date().toISOString(),
      visibilityOverrides: {
        ...canonical.visibilityOverrides,
        // Mandala off so the QR lands in a clear empty cell (isolating QR here).
        showMandala: false,
        showQRCode: true,
      },
    } as Partial<SequenceExportOptions>;
  }

  // Defensively wire the QR generator onto the singleton composer. In prod this
  // is registered at app boot (deferred-registrations.ts), but this test route
  // may render before that runs. getQRCodeGenerator is a browser-only singleton,
  // so this is safe and idempotent. Shared by runFullCard + timeDeck.
  async function ensureQRWired() {
    const composer = getImageComposer();
    try {
      const { getQRCodeGenerator } = await import("$lib/shared/qr/getQRCodeGenerator");
      (composer as unknown as { setQRCodeGenerator: (g: unknown) => void }).setQRCodeGenerator(
        getQRCodeGenerator(),
      );
    } catch (e) {
      console.warn("[harness] QR generator wiring failed:", e);
    }
  }

  async function runFullCard() {
    if (cardRunning) return;
    cardRunning = true;
    cardInfo = "";
    try {
      cardStatus = "picking a sequence…";
      // QR only draws into an EMPTY grid cell (findEmptyCellForQR). Prefer a
      // SHORT sequence so the step grid has at least one free cell for the QR.
      const seq =
        engine.allSequences.find(
          (s) => Array.isArray(s.steps) && s.steps.length > 0 && s.steps.length <= 6,
        ) ??
        engine.allSequences.find(
          (s) => Array.isArray(s.steps) && s.steps.length > 0,
        );
      if (!seq) {
        cardStatus = "no renderable sequence found";
        return;
      }

      await ensureQRWired();
      const composer = getImageComposer();

      // Mirror PrintCardRenderer.renderFront: a REAL TnD choreo-card with the
      // element accent-color tint + element footer, so the parallel render is
      // verified against the full card look (not a stripped-down one).
      const tnd = TND_ELEMENTS[selectedElementIdx]!;
      const frontOptions = buildFrontOptions();

      cardStatus = "seeding worker pool…";
      const pool = getCardFrontWorkerPool();
      // force=true: the parallel front flag (PARALLEL_FRONT_ENABLED) is OFF in
      // production, so the harness force-seeds to exercise the worker path
      // WITHOUT enabling it for real renders.
      await pool.seedForDeck(
        [seq],
        { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, theme: "front" },
        "fullcard-proof",
        true,
      );
      if (!pool.isSeeded()) {
        cardStatus = "pool not seeded (no OffscreenCanvas?)";
        return;
      }

      cardStatus = "rendering MAIN card (reference)…";
      const mainCanvas = await composer.composeSequenceImage(seq, frontOptions);
      const mainCard = toCardCanvas(mainCanvas as CanvasImageSource);
      show(cardMainSlot, mainCard);

      cardStatus = "rendering PARALLEL card (full-card worker)…";
      // Full-card-in-worker path: build the plain-data FrontJob on the main
      // thread, then composeFront paints the entire card in one worker
      // round-trip and transfers the assembled ImageBitmap back.
      const { buildFrontJob } = await import("$lib/shared/render/services/build-front-job");
      const job = await buildFrontJob(seq, frontOptions);
      const bitmap = await pool.composeFront(job);
      const parallelContent = document.createElement("canvas");
      parallelContent.width = bitmap.width;
      parallelContent.height = bitmap.height;
      parallelContent.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const parallelCanvas = parallelContent;
      const parallelCard = toCardCanvas(parallelCanvas as CanvasImageSource);
      show(cardParallelSlot, parallelCard);

      // Wrap each raw content canvas in the production card frame (colored
      // border + glow + thicker inset), via the SAME helper PrintCardRenderer
      // uses, so the full framed card is visible. Border is identical on both
      // by construction — these panels are for eyeballing, not diffing.
      const mainFramed = wrapContentInCardFrame(mainCanvas as CanvasImageSource, {
        accent: tnd.accentColor,
        dark: tnd.darkComplement,
      });
      show(cardMainFramedSlot, mainFramed);
      const parallelFramed = wrapContentInCardFrame(parallelCanvas as CanvasImageSource, {
        accent: tnd.accentColor,
        dark: tnd.darkComplement,
      });
      show(cardParallelFramedSlot, parallelFramed);

      // Header + footer heights come from the same layout the renderers use.
      const visibility = await composer.resolveVisibilitySettings(frontOptions);
      const layout = computeCardFrontLayout(seq, frontOptions, visibility);
      // diffCard works in CARD_W x CARD_H space; layout is in canvas space, so
      // scale header/footer bands (and the QR rect below) by the same ratio
      // toCardCanvas uses to normalize each canvas.
      const sx = CARD_W / layout.canvasWidth;
      const sy = CARD_H / layout.canvasHeight;
      const headerH = layout.headerHeight * sy;
      const footerH = layout.footerHeight * sy;

      // QR-cell band: derive the rect EXACTLY as build-front-job/paint-front-job
      // place it. The QR backing fill covers the full empty grid cell at
      // (cell.col*stepSize + gridOffsetX, cell.row*stepSize + gridOffsetY),
      // stepSize x stepSize. job.qr is null when no empty cell / QR disabled.
      let qrRect: Rect | null = null;
      let qrMode: "exact-cell-rect" | "absent" = "absent";
      if (job.qr) {
        const { stepSize, gridOffsetX, gridOffsetY } = layout;
        const cellX = job.qr.cell.col * stepSize + gridOffsetX;
        const cellY = job.qr.cell.row * stepSize + gridOffsetY;
        qrRect = { x: cellX * sx, y: cellY * sy, w: stepSize * sx, h: stepSize * sy };
        qrMode = "exact-cell-rect";
      }

      const { pct, headerPct, footerPct, qrPct, canvas: dc } = diffCard(
        mainCard, parallelCard, CARD_W, CARD_H, headerH, footerH, qrRect,
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
          qrDiffPct: Number(qrPct.toFixed(4)),
          qrDiffMode: qrMode,
          // qr-cell-scale is constant (0.80) — recorded so the rect can be
          // understood: the band is the FULL cell (incl. backing fill), not just
          // the inset QR square, matching paint-front-job's fillRect region.
          qrCellScale: getQRCellScale(0),
          headerHeight: Number(headerH.toFixed(1)),
          footerHeight: Number(footerH.toFixed(1)),
          cardSize: { w: CARD_W, h: CARD_H },
        },
        null,
        2,
      );
      cardStatus = `full card done — overall ${pct.toFixed(3)}% / header ${headerPct.toFixed(3)}% / footer ${footerPct.toFixed(3)}% / qr ${qrPct.toFixed(3)}%`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      cardStatus = "FULL CARD FAILED: " + msg;
      cardInfo = msg;
    } finally {
      cardRunning = false;
    }
  }

  // --- DECK WALL-TIME BENCHMARK (parallel worker pool vs main thread) ---------
  //
  // Measures the multicore speedup of rendering a whole deck's worth of card
  // fronts. Both paths render the SAME ~24 cards with the SAME bounded-concurrency
  // lane model (matching PrintPreviewPages.renderAll's ~8 lanes) so the only
  // variable is where the raster work runs: across pool workers (parallel) vs on
  // the main thread (main). Wall-time via performance.now() deltas.

  const BENCH_CARDS = 24;
  const BENCH_LANES = 8; // matches PrintPreviewPages RENDER_CONCURRENCY ceiling

  // Run `task(item)` over `items` with `laneCount` concurrent lanes sharing a
  // single cursor — the SAME shape as PrintPreviewPages.renderAll. Used for both
  // the parallel and main paths so the comparison is fair (identical overlap).
  async function runLanes<T>(items: T[], laneCount: number, task: (item: T) => Promise<unknown>) {
    let next = 0;
    const lane = async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        await task(items[i]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(laneCount, items.length) }, () => lane()));
  }

  async function timeDeck() {
    if (deckTiming) return;
    deckTiming = true;
    deckResult = null;
    try {
      deckStatus = "picking sequences…";
      // Prefer real distinct short sequences (short = QR lands in an empty cell);
      // fall back to any with steps. Replicate up to BENCH_CARDS — wall-time is the
      // goal, so a representative batch padded by repetition is fine.
      const pool0 = engine.allSequences.filter(
        (s) => Array.isArray(s.steps) && s.steps.length > 0 && s.steps.length <= 6,
      );
      const source = pool0.length > 0
        ? pool0
        : engine.allSequences.filter((s) => Array.isArray(s.steps) && s.steps.length > 0);
      if (source.length === 0) {
        deckStatus = "no renderable sequences found";
        return;
      }
      const seqs: SequenceData[] = Array.from(
        { length: BENCH_CARDS },
        (_, i) => source[i % source.length]!,
      );

      await ensureQRWired();
      const composer = getImageComposer();
      // Same card shape as runFullCard, per sequence.
      const frontOptions = buildFrontOptions();
      const tnd = TND_ELEMENTS[selectedElementIdx]!;
      const theme = "front" as const;

      deckStatus = "seeding worker pool (once for the batch)…";
      const pool = getCardFrontWorkerPool();
      // force=true: seed despite PARALLEL_FRONT_ENABLED being off (harness only).
      // Time the seed so seedMs is reported alongside the render wall-times.
      const seedT0 = performance.now();
      await pool.seedForDeck(
        seqs,
        { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, theme },
        "bench",
        true,
      );
      const seedMs = performance.now() - seedT0;
      const poolReady = pool.isSeeded();
      if (!poolReady) {
        deckStatus = "worker pool unavailable (no OffscreenCanvas) — skipping parallel run";
      }

      // Full-card-in-worker render: build the FrontJob on the main thread, then
      // composeFront paints the whole card in one worker round-trip. One job per
      // card. (buildFrontJob is imported once; the closure reuses it per card.)
      const { buildFrontJob } = await import("$lib/shared/render/services/build-front-job");
      const renderParallel = async (s: SequenceData) => {
        const job = await buildFrontJob(s, frontOptions);
        const bmp = await pool.composeFront(job);
        bmp.close?.(); // discard — we only measure wall-time here
      };

      // Warm-up (intentional): render 1-2 cards each way and discard so neither
      // timed window pays cold-cache cost (first-call asset decode, worker spin-up,
      // composer scratch alloc). Results are thrown away.
      deckStatus = "warming up…";
      const warm = seqs.slice(0, 2);
      if (poolReady) {
        await runLanes(warm, BENCH_LANES, renderParallel);
      }
      await runLanes(warm, BENCH_LANES, (s) => composer.composeSequenceImage(s, frontOptions));

      // PARALLEL run: render ALL seqs through the worker pool with BENCH_LANES
      // concurrent lanes so the pool's workers stay saturated across cores.
      let parallelMs = 0;
      if (poolReady) {
        deckStatus = "timing PARALLEL run…";
        const t0 = performance.now();
        await runLanes(seqs, BENCH_LANES, renderParallel);
        parallelMs = performance.now() - t0;
      }

      // MAIN run: same lane shape on the main thread. Main-thread async still
      // overlaps the awaits (asset/blob decode), so the concurrency shape is fair.
      deckStatus = "timing MAIN run…";
      const t1 = performance.now();
      await runLanes(seqs, BENCH_LANES, (s) => composer.composeSequenceImage(s, frontOptions));
      const mainMs = performance.now() - t1;

      deckResult = JSON.stringify(
        poolReady
          ? {
              cards: seqs.length,
              cores: navigator.hardwareConcurrency,
              parallelMs: Math.round(parallelMs),
              mainMs: Math.round(mainMs),
              speedup: +(mainMs / parallelMs).toFixed(2),
              seedMs: Math.round(seedMs),
            }
          : {
              cards: seqs.length,
              cores: navigator.hardwareConcurrency,
              parallelMs: null,
              mainMs: Math.round(mainMs),
              speedup: null,
              seedMs: Math.round(seedMs),
              note: "worker pool unavailable (no OffscreenCanvas) — parallel run skipped",
            },
        null,
        2,
      );
      deckStatus = poolReady
        ? `deck timed — ${tnd.name}: parallel ${Math.round(parallelMs)}ms vs main ${Math.round(mainMs)}ms (${+(mainMs / parallelMs).toFixed(2)}x)`
        : `deck timed (main only) — ${Math.round(mainMs)}ms; parallel skipped`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deckStatus = "DECK TIMING FAILED: " + msg;
      deckResult = msg;
    } finally {
      deckTiming = false;
    }
  }

  // --- COLD-DECK PROFILER (dedup analysis + assembly phase breakdown) ---------
  //
  // Drives the caching-rebuild decision. Two outputs:
  //   1. Dedup analysis (NO render): derive the pictograph content key for every
  //      cell across all cards and count distinct vs total. Plus distinct words,
  //      loop signatures, and QR payloads per card. These ratios quantify how
  //      much persistent caching can eliminate.
  //   2. Cold phase timing: clear ALL caches, render every card cold via the
  //      production composeSequenceImage path, and read the assembly probe to see
  //      where the time went (decode / cell / qr / mandala / header / footer /
  //      border / composite). A warm second pass shows the cold-vs-warm gap.

  const PROFILE_CARDS = 36;

  // Mirror the renderer's per-cell key derivation EXACTLY:
  // renderPictographAt builds finalVisibilitySettings = { ...resolvedVisibility,
  // bluePropType: effectiveBlue ?? resolved.blue, redPropType: effectiveRed ??
  // resolved.red } and applies the prop override onto the step's motions, then
  // (legacy path) calls keyHasher.deriveKey(stepData, finalVisibilitySettings).
  // We reproduce that input shape so the dedup count matches what a content cache
  // keyed on deriveKey would actually collapse.
  function applyPropOverrideToStep(
    step: StepData,
    blueProp?: PropType,
    redProp?: PropType,
  ): StepData {
    if (!blueProp && !redProp) return step;
    return {
      ...step,
      motions: {
        blue:
          step.motions.blue && blueProp
            ? { ...step.motions.blue, propType: blueProp }
            : step.motions.blue,
        red:
          step.motions.red && redProp
            ? { ...step.motions.red, propType: redProp }
            : step.motions.red,
      },
    } as StepData;
  }

  async function clearAllRenderCaches() {
    // SVG decode cache (grids, letters, turn numbers, arrows/props decode source).
    clearSvgImageCache();
    // LayerCompositor base/gridPoints/tka/reversal canvas caches (the dominant
    // per-cell redundancy eliminator).
    getLayerCompositorSingleton().clearCache();
    // ImageComposer memory + IndexedDB blob caches (legacy raster path + L1/L2).
    const composer = getImageComposer();
    await composer.clearCache(true);
    // NOTE: GlyphCache (header glyph data-URL cache) exposes no clear() method,
    // so header-glyph decode is already warm on first render. Its cost still
    // shows up under headerMs (renderWordHeader), just not as a cold decode.
  }

  async function profileColdDeck() {
    if (profiling) return;
    profiling = true;
    profileResult = null;
    try {
      profileStatus = "picking sequences…";
      const source = engine.allSequences.filter(
        (s) => Array.isArray(s.steps) && s.steps.length > 0,
      );
      if (source.length === 0) {
        profileStatus = "no renderable sequences found";
        return;
      }
      // Up to PROFILE_CARDS distinct sequences; report the actual count used.
      const seqs: SequenceData[] = source.slice(0, PROFILE_CARDS);

      await ensureQRWired();
      const composer = getImageComposer();
      const frontOptions = buildFrontOptions();

      // Resolve visibility ONCE the way the renderer does, then merge the
      // effective prop overrides per cell so the key matches the render path.
      const visibility = await composer.resolveVisibilitySettings(frontOptions);
      const effectiveBlue =
        frontOptions.bluePropTypeOverride ?? frontOptions.propTypeOverride;
      const effectiveRed =
        frontOptions.redPropTypeOverride ?? frontOptions.propTypeOverride;
      const cellVisibility = {
        ...visibility,
        bluePropType: effectiveBlue ?? visibility.bluePropType,
        redPropType: effectiveRed ?? visibility.redPropType,
      };

      // --- 1. DEDUP ANALYSIS (no render) -------------------------------------
      profileStatus = "deriving dedup keys (no render)…";
      const hasher = getPictographKeyHasher();
      const pictographKeys = new Set<string>();
      const words = new Set<string>();
      const loopSignatures = new Set<string>();
      const qrPayloads = new Set<string>();
      let totalCells = 0;

      for (const seq of seqs) {
        // Start position cell (composeSequenceImage renders it when
        // includeStartPosition is set), derived from the first step when the
        // sequence carries no explicit start position — mirrors the renderer.
        const cells: StepData[] = [];
        if (frontOptions.includeStartPosition) {
          const sp =
            (seq.startPosition as unknown as StepData | undefined) ??
            (seq.steps[0]
              ? ({ ...seq.steps[0], letter: undefined } as unknown as StepData)
              : undefined);
          if (sp) cells.push(sp);
        }
        for (const step of seq.steps) cells.push(step);

        for (const cell of cells) {
          const withProp = applyPropOverrideToStep(cell, effectiveBlue, effectiveRed);
          const key = hasher.deriveKey(withProp, cellVisibility);
          pictographKeys.add(key);
          totalCells++;
        }

        // Header word: same simplified word the header renders.
        const rawWord =
          seq.word ||
          seq.steps.filter((s) => s.letter).map((s) => s.letter).join("");
        words.add(rawWord);

        // Loop signature: the mandala/header-driving signal is the loop type.
        loopSignatures.add(String(seq.loopType ?? "none"));

        // QR payload: the QR encodes the sequence (deckId is constant in this
        // harness, so the per-card payload distinction is the sequence identity).
        qrPayloads.add(String(seq.id ?? seq.word ?? seq.name ?? ""));
      }

      const cards = seqs.length;
      const distinctPictographs = pictographKeys.size;
      const pictographDedupRatio = distinctPictographs / Math.max(1, totalCells);

      // --- 2. COLD PHASE TIMING ----------------------------------------------
      profileStatus = "clearing ALL caches for cold render…";
      await clearAllRenderCaches();

      profileStatus = "rendering deck COLD (assembly probe on)…";
      assemblyProbe.enabled = true;
      resetAssemblyProbe();
      const coldT0 = performance.now();
      for (const seq of seqs) {
        await composer.composeSequenceImage(seq, frontOptions);
      }
      const coldTotalMs = performance.now() - coldT0;
      const phase = snapshotAssemblyProbe();
      assemblyProbe.enabled = false;

      // --- 3. WARM SECOND PASS (caches now warm) -----------------------------
      profileStatus = "rendering deck WARM (caches hot)…";
      const warmT0 = performance.now();
      for (const seq of seqs) {
        await composer.composeSequenceImage(seq, frontOptions);
      }
      const warmTotalMs = performance.now() - warmT0;

      const pct = (ms: number) =>
        Number(((ms / Math.max(0.0001, coldTotalMs)) * 100).toFixed(2));

      profileResult = JSON.stringify(
        {
          cards,
          totalCells,
          distinctPictographs,
          pictographDedupRatio: Number(pictographDedupRatio.toFixed(4)),
          distinctWords: words.size,
          distinctWordsPerCard: Number((words.size / Math.max(1, cards)).toFixed(4)),
          distinctLoopSignatures: loopSignatures.size,
          distinctLoopSignaturesPerCard: Number(
            (loopSignatures.size / Math.max(1, cards)).toFixed(4),
          ),
          distinctQrPayloads: qrPayloads.size,
          distinctQrPayloadsPerCard: Number(
            (qrPayloads.size / Math.max(1, cards)).toFixed(4),
          ),
          coldTotalMs: Math.round(coldTotalMs),
          coldPerCardMs: Number((coldTotalMs / Math.max(1, cards)).toFixed(2)),
          warmTotalMs: Math.round(warmTotalMs),
          warmPerCardMs: Number((warmTotalMs / Math.max(1, cards)).toFixed(2)),
          phaseBreakdownMs: {
            decode: Math.round(phase.decodeMs),
            cell: Math.round(phase.cellMs),
            qr: Math.round(phase.qrMs),
            mandala: Math.round(phase.mandalaMs),
            header: Math.round(phase.headerMs),
            footer: Math.round(phase.footerMs),
            border: Math.round(phase.borderMs),
            composite: Math.round(phase.compositeMs),
          },
          phaseBreakdownPct: {
            decode: pct(phase.decodeMs),
            cell: pct(phase.cellMs),
            qr: pct(phase.qrMs),
            mandala: pct(phase.mandalaMs),
            header: pct(phase.headerMs),
            footer: pct(phase.footerMs),
            border: pct(phase.borderMs),
            composite: pct(phase.compositeMs),
          },
          cellCount: phase.cellCount,
        },
        null,
        2,
      );
      profileStatus = `cold deck profiled — ${cards} cards, dedup ${(
        pictographDedupRatio * 100
      ).toFixed(1)}% distinct, cold ${Math.round(coldTotalMs)}ms vs warm ${Math.round(
        warmTotalMs,
      )}ms`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      profileStatus = "PROFILE FAILED: " + msg;
      profileResult = msg;
      // Ensure the probe never stays enabled after a failure.
      assemblyProbe.enabled = false;
    } finally {
      profiling = false;
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
    cells, chrome) via the full-card-in-worker path
    (<code>buildFrontJob</code> on the main thread →
    <code>CardFrontWorkerPool.composeFront</code> in a worker) and diffs it against
    the main-thread <code>ImageComposer.composeSequenceImage</code>. Reports overall
    diff plus header-band, footer-band, and QR-cell-band diffs so the TKA word
    glyphs, the element footer, AND the QR are verified specifically. Uses a REAL
    TnD element so the accent-color tint + element footer are exercised on both
    the main and worker paths. The pool is FORCE-seeded (the parallel front flag
    stays off in production).
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

  <p>
    Below: the SAME content wrapped in the production card frame
    (<code>wrapContentInCardFrame</code>) — colored stripe border + edge glow +
    thicker inset, with footer + cells. The border is identical on both by
    construction, so these are for visual eyeballing only (not diffed).
  </p>
  <div class="duo">
    <figure><figcaption>MAIN (framed)</figcaption><div bind:this={cardMainFramedSlot} class="slot"></div></figure>
    <figure><figcaption>PARALLEL (framed)</figcaption><div bind:this={cardParallelFramedSlot} class="slot"></div></figure>
  </div>

  <hr />

  <h1>Deck Wall-Time Benchmark — Parallel Pool vs Main Thread</h1>
  <p>
    Renders a deck's worth of card fronts ({BENCH_CARDS} cards) BOTH ways and
    measures wall-time. The worker pool is force-seeded once for the batch
    (<code>seedMs</code>), then all cards render via the full-card-in-worker path
    (<code>buildFrontJob</code> → <code>composeFront</code>, one job per card)
    across {BENCH_LANES} concurrent lanes (matching
    <code>PrintPreviewPages.renderAll</code>). The main path uses the SAME lane
    shape via <code>composeSequenceImage</code> so the only variable is where
    raster work runs. Speedup = mainMs / parallelMs.
  </p>
  <div class="controls">
    <button type="button" onclick={timeDeck} disabled={deckTiming || !!loadError}>
      {deckTiming ? "Timing…" : "Time deck (parallel vs main)"}
    </button>
    <span class="status">{loadError ? `load error: ${loadError}` : deckStatus}</span>
  </div>

  {#if deckResult}<pre>{deckResult}</pre>{/if}

  <hr />

  <h1>Cold-Deck Profiler — Dedup Ratios + Assembly Phase Breakdown</h1>
  <p>
    Measurement instrumentation for the caching-rebuild decision. First derives
    the pictograph content key (<code>PictographKeyHasher.deriveKey</code>, the
    same key the renderer's per-cell content cache would use) for every cell
    across {PROFILE_CARDS} cards to report how many distinct pictographs exist vs
    total cells — plus distinct words, loop signatures, and QR payloads per card.
    Then clears ALL render caches (SVG decode, LayerCompositor layers, pictograph
    memory + IndexedDB blob), renders the whole deck COLD through the production
    <code>composeSequenceImage</code> path with the assembly probe on, and reports
    where the time went per phase (decode / cell / qr / mandala / header / footer
    / border / composite). A warm second pass shows the cold-vs-warm gap — what
    persistent caching would save.
  </p>
  <div class="controls">
    <button type="button" onclick={profileColdDeck} disabled={profiling || !!loadError}>
      {profiling ? "Profiling…" : "Profile cold deck"}
    </button>
    <span class="status">{loadError ? `load error: ${loadError}` : profileStatus}</span>
  </div>

  {#if profileResult}<pre>{profileResult}</pre>{/if}
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
  .duo { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px; max-width: 760px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #999; margin-bottom: 6px; }
  .slot { background: #fff; border: 1px solid #2a2a33; border-radius: 6px; min-height: 120px; }
  hr { border: none; border-top: 1px solid #2a2a33; margin: 32px 0 8px; }
</style>
