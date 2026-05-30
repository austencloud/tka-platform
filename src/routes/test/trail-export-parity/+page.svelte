<script lang="ts">
  /**
   * Trail Export Parity Test
   *
   * Automated proof that the exported MP4's trails match the live render.
   *
   * Pipeline per run:
   *   1. Mount the live 2D animation engine (AnimatorCanvas) on a square canvas
   *      with TRAILS enabled, header/glyph/progress hidden (pure trails frame).
   *   2. Run the REAL video export (VideoExportOrchestrator) on it. A parity
   *      hook in the orchestrator stashes a copy of the PRE-ENCODE composite
   *      (window.__tka_parity_capture) for a strided sample of frames.
   *   3. Decode the finished MP4 with mediabunny (VideoSampleSink) and pull the
   *      decoded frame at each sampled timestamp.
   *   4. Diff decoded-vs-preencode per frame: %pixels over tolerance + max
   *      channel delta + red heatmap. The pre-encode composite was already
   *      proven pixel-perfect against the live canvas, so this isolates pure
   *      ENCODER fidelity.
   *
   * Both sides are flattened over opaque black first — H.264 has no alpha, so
   * the decoded frame is opaque; flattening the pre-encode the same way is the
   * apples-to-apples comparison.
   *
   * Result is mirrored to window.__trailParityResult for headless inspection.
   */
  import { onMount, onDestroy } from "svelte";
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { getSequenceRepository } from "$lib/shared/create/getSequenceRepository";
  import { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import { getPropInterpolator } from "$lib/shared/animation-engine/getPropInterpolator";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
  import { getVideoExportOrchestrator } from "$lib/shared/animation-engine/getVideoExportOrchestrator";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { Input, BufferSource, ALL_FORMATS, VideoSampleSink } from "mediabunny";

  // ---- Tunables ----------------------------------------------------------
  const AA_TOLERANCE = 8; // per-channel delta below which a pixel "matches"
  // Bit-exact parity vs a lossy codec is impossible — residual lives on hard
  // edges (H.264 4:2:0 chroma). The meaningful test is BODY parity: diff only
  // the interior with high-contrast edges masked out. Near-zero here proves the
  // trail/prop body is clean and the residual is purely codec edge fringe.
  const PASS_MAX_DELTA = 32; // body channel delta (edges excluded)
  const PASS_DIFF_PCT = 0.5; // body % pixels over tolerance (edges excluded)

  let word = $state("DJDJ");
  let resolution = $state<720 | 1080 | 2160>(1080);
  let fps = $state(50);
  let codec = $state<"h264" | "av1">("av1");
  let status = $state("idle");
  let running = $state(false);
  let canvas: HTMLCanvasElement | null = null;
  let engineReady = $state(false);

  type FrameRow = {
    index: number;
    timeSec: number;
    diffPct: number;
    maxDelta: number;
    percDiffPct: number;
    percMaxDelta: number;
    ref: HTMLCanvasElement;
    dec: HTMLCanvasElement;
    heat: HTMLCanvasElement;
  };
  let rows = $state<FrameRow[]>([]);
  let verdict = $state<"" | "PASS" | "FAIL">("");
  let worstDiffPct = $state(0); // full-res, edge-inclusive (informational)
  let worstMaxDelta = $state(0);
  let worstPercDiffPct = $state(0); // downscaled, body-only (verdict driver)
  let worstPercMaxDelta = $state(0);

  // Per-instance playback stack (mirrors InlineAnimationPlayer).
  const animationState = createAnimationPanelState();
  // Effects config drives trail rendering. setActiveEffect("trails") populates
  // tipEffectMap {"*":{effect:"trails"}} — WITHOUT this the renderer filters
  // every tip and no trail is drawn. Passing it to AnimatorCanvas also wires it
  // into the global visibility manager (CanvasSurface), so the export path's
  // applyEffectOverrides finds the same config.
  const effectsConfigState = createEffectsConfigState();
  // Activate trails + wire the config into the global VM SYNCHRONOUSLY at script
  // init, BEFORE AnimatorCanvas mounts. If trails aren't active when the engine
  // initializes, the trail capturer/overlay aren't created, getRenderContext
  // returns null, and the canvas never registers in the render-context registry
  // — which means the export's resize + trail-reset (keyed off liveContext)
  // would silently no-op (production wires this pre-init; the bare test page
  // must match).
  effectsConfigState.setActiveEffect("trails");
  {
    const vm = getAnimationVisibilityManager();
    vm.effectsConfigState = effectsConfigState;
    vm.setActiveEffect("trails");
    vm.setVisibility("wordHeader", false);
    vm.setVisibility("progressBar", false);
    vm.setVisibility("tkaGlyph", false);
    vm.setVisibility("stepNumbers", false);
    vm.setVisibility("pathLines", false);
  }
  let playbackController: AnimationPlaybackController | null = null;
  let loadedSequence: SequenceData | null = null;

  // Live canvas reactive inputs derived from playback state.
  let currentLetter = $derived.by(() => {
    const seq = animationState.sequenceData;
    if (!seq?.steps?.length) return null;
    const idx = Math.min(
      Math.max(0, Math.floor(animationState.currentStep) - 1),
      seq.steps.length - 1
    );
    return seq.steps[idx]?.letter ?? null;
  });
  let currentStepData = $derived.by(() => {
    const seq = animationState.sequenceData;
    if (!seq?.steps?.length) return null;
    if (animationState.currentStep < 1 && seq.startPosition)
      return seq.startPosition;
    const idx = Math.min(
      Math.max(0, Math.floor(animationState.currentStep) - 1),
      seq.steps.length - 1
    );
    return seq.steps[idx] ?? null;
  });
  let gridMode = $derived(animationState.sequenceData?.gridMode);

  onMount(() => {
    const propInterpolator = getPropInterpolator();
    const stateManager = new AnimationStateManager();
    const loop = new AnimationLoop();
    const orchestrator = new SequenceAnimationOrchestrator(
      stateManager,
      propInterpolator
    );
    playbackController = new AnimationPlaybackController(orchestrator, loop);
    // Trails + chrome-hiding configured synchronously at script init (above).
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  const hasMotion = (s: SequenceData | null | undefined): s is SequenceData =>
    !!s &&
    Array.isArray(s.steps) &&
    s.steps.length > 0 &&
    s.steps.some((st) => st?.motions?.blue && st?.motions?.red);

  async function loadSequence(): Promise<boolean> {
    const wanted = word.trim();
    status = `loading sequence "${wanted}"…`;
    const repo = getSequenceRepository();
    const loader = new PublicSequencesLoader();

    // 1) Exact word: gallery repo, then public loader by word.
    let seq = await repo.getSequence(wanted).catch(() => null);
    if (!hasMotion(seq)) {
      seq = await loader.loadFullSequenceData(wanted).catch(() => null);
    }

    // 2) Fallback: scan public sequences and pick the one with the MOST steps —
    //    more steps = more prop travel = the big sweeping trails we need to test.
    //    (The previous "first match" grabbed a near-static sequence with no
    //    real ribbons, which is exactly what made the last run meaningless.)
    if (!hasMotion(seq)) {
      status = `"${wanted}" not found — scanning public for a high-motion sequence…`;
      const meta = await loader.loadSequenceMetadata();
      let best: SequenceData | null = null;
      let bestSteps = 0;
      for (const m of meta.slice(0, 30)) {
        const full = await loader.loadFullSequenceData(m.word).catch(() => null);
        if (hasMotion(full) && full.steps.length > bestSteps) {
          best = full;
          bestSteps = full.steps.length;
        }
      }
      if (best) {
        seq = best;
        word = best.word ?? best.name ?? word;
      }
    }

    if (!hasMotion(seq)) {
      status = `no sequence with motion data available`;
      return false;
    }
    loadedSequence = seq;
    const ok = playbackController!.initialize(seq, animationState);
    if (!ok) {
      status = "playback init failed";
      return false;
    }
    // Let the live engine mount + warm up its trail accumulator.
    await raf();
    await raf();
    await raf();
    return true;
  }

  function raf(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  // Flatten an RGBA buffer over opaque black into a fresh canvas — mirrors
  // exactly what the H.264 encoder receives (alpha dropped over black).
  function flattenToCanvas(
    data: Uint8ClampedArray,
    w: number,
    h: number
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

  // Body-only diff: exclude high-contrast EDGES of the reference (where H.264
  // 4:2:0 always fringes, irreducibly) and measure divergence on the remaining
  // interior — the trail/prop BODY. Near-zero here = body parity is exact and
  // the only residual is codec edge fringe.
  const EDGE_LUMA_THRESH = 48; // neighbor luma jump that marks an edge
  const EDGE_DILATE = 2; // px halo around edges to also exclude

  function bodyDiff(
    refC: HTMLCanvasElement,
    decC: HTMLCanvasElement,
    w: number,
    h: number
  ): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number } {
    const a = refC.getContext("2d")!.getImageData(0, 0, w, h).data;
    const b = decC.getContext("2d")!.getImageData(0, 0, w, h).data;
    const n = w * h;
    const luma = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      luma[p] = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
    }
    // Edge bitmap from reference luma (4-neighbour gradient).
    let edge = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const l = luma[p]!;
        let isEdge = 0;
        if (x > 0 && Math.abs(l - luma[p - 1]!) > EDGE_LUMA_THRESH) isEdge = 1;
        else if (x < w - 1 && Math.abs(l - luma[p + 1]!) > EDGE_LUMA_THRESH) isEdge = 1;
        else if (y > 0 && Math.abs(l - luma[p - w]!) > EDGE_LUMA_THRESH) isEdge = 1;
        else if (y < h - 1 && Math.abs(l - luma[p + w]!) > EDGE_LUMA_THRESH) isEdge = 1;
        edge[p] = isEdge;
      }
    }
    // Dilate the edge mask by EDGE_DILATE px (separable 4-neighbour passes).
    for (let d = 0; d < EDGE_DILATE; d++) {
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
      const dr = Math.abs(a[i]! - b[i]!);
      const dg = Math.abs(a[i + 1]! - b[i + 1]!);
      const db = Math.abs(a[i + 2]! - b[i + 2]!);
      const worst = Math.max(dr, dg, db);
      if (worst > bodyMaxDelta) bodyMaxDelta = worst;
      if (worst > AA_TOLERANCE) differing++;
    }
    return {
      bodyDiffPct: bodyCount ? (differing / bodyCount) * 100 : 0,
      bodyMaxDelta,
      edgePct: (edgeCount / n) * 100,
    };
  }

  function diff(
    refC: HTMLCanvasElement,
    decC: HTMLCanvasElement,
    w: number,
    h: number
  ): { diffPct: number; maxDelta: number; heat: HTMLCanvasElement } {
    const a = refC.getContext("2d")!.getImageData(0, 0, w, h);
    const b = decC.getContext("2d")!.getImageData(0, 0, w, h);
    const heat = document.createElement("canvas");
    heat.width = w;
    heat.height = h;
    const hctx = heat.getContext("2d")!;
    const out = hctx.createImageData(w, h);

    let differing = 0;
    let maxDelta = 0;
    const total = w * h;
    for (let i = 0; i < a.data.length; i += 4) {
      const dr = Math.abs(a.data[i]! - b.data[i]!);
      const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!);
      const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!);
      const worst = Math.max(dr, dg, db);
      if (worst > maxDelta) maxDelta = worst;
      if (worst > AA_TOLERANCE) {
        differing++;
        out.data[i] = 255;
        out.data[i + 1] = 0;
        out.data[i + 2] = 0;
        out.data[i + 3] = 255;
      } else {
        const g = (a.data[i]! + a.data[i + 1]! + a.data[i + 2]!) / 3;
        out.data[i] = out.data[i + 1] = out.data[i + 2] = g * 0.4;
        out.data[i + 3] = 255;
      }
    }
    hctx.putImageData(out, 0, 0);
    return { diffPct: (differing / total) * 100, maxDelta, heat };
  }

  async function run() {
    if (running) return;
    running = true;
    rows = [];
    verdict = "";
    worstDiffPct = 0;
    worstMaxDelta = 0;
    worstPercDiffPct = 0;
    worstPercMaxDelta = 0;
    (window as unknown as Record<string, unknown>).__trailParityResult =
      undefined;

    try {
      if (!(await loadSequence())) return;

      // Warm the trail accumulator the way a real user does — play and LOOP for
      // a few seconds so the buffer holds a full ribbon (and a loop seam) before
      // export. This reproduces the "stub already attached at frame 0" bug and
      // verifies the export-start trail reset actually wipes it.
      animationState.setShouldLoop(true);
      playbackController!.togglePlayback();
      status = "warming trail accumulator (play + loop 3s)…";
      await new Promise((r) => setTimeout(r, 3000));
      if (animationState.isPlaying) playbackController!.togglePlayback();
      await raf();

      // Silence the orchestrator's DEV PNG dump during parity runs.
      (window as unknown as Record<string, unknown>).__tka_export_frame_dump =
        -1;

      // Arm the pre-encode capture: every Nth frame, cap the count.
      const stride = Math.max(1, Math.round(fps / 3));
      const capture = { stride, max: 16, captured: {} as Record<number, { w: number; h: number; data: Uint8ClampedArray }> };
      (window as unknown as Record<string, unknown>).__tka_parity_capture =
        capture;

      status = "exporting (driving live engine + encoding)…";
      const orchestrator = getVideoExportOrchestrator();
      const blob = await orchestrator.executeExport(
        canvas!,
        playbackController!,
        animationState,
        (p) => {
          if (p.stage === "capturing" && p.totalFrames)
            status = `capturing ${p.currentFrame}/${p.totalFrames}…`;
          else status = `export: ${p.stage}`;
        },
        {
          format: "mp4",
          codec,
          resolution,
          fps,
          loopCount: 1,
          effectOverrides: { trails: true },
          includeAnimationStartPosition: true,
          includeEndHold: true,
        }
      );

      const captured = capture.captured;
      const indices = Object.keys(captured)
        .map(Number)
        .sort((a, b) => a - b);
      if (indices.length === 0) {
        status = "no frames captured — export produced 0 sampled frames";
        return;
      }

      status = `decoding MP4 (${(blob.size / 1e6).toFixed(1)} MB) and diffing ${indices.length} frames…`;
      const buf = await blob.arrayBuffer();
      const input = new Input({
        formats: ALL_FORMATS,
        source: new BufferSource(buf),
      });
      const track = await input.getPrimaryVideoTrack();
      if (!track) {
        status = "decode failed: no video track in MP4";
        return;
      }
      const sink = new VideoSampleSink(track);

      const newRows: FrameRow[] = [];
      for (const idx of indices) {
        const cap = captured[idx]!;
        const timeSec = idx / fps;
        const sample = await sink.getSample(timeSec);
        if (!sample) continue;

        const ref = flattenToCanvas(cap.data, cap.w, cap.h);

        const dec = document.createElement("canvas");
        dec.width = cap.w;
        dec.height = cap.h;
        const dctx = dec.getContext("2d")!;
        dctx.fillStyle = "#000";
        dctx.fillRect(0, 0, cap.w, cap.h);
        // Draw decoded frame scaled to the reference size (1:1 when dims match).
        dctx.drawImage(sample.toCanvasImageSource(), 0, 0, cap.w, cap.h);
        sample.close();

        const { diffPct, maxDelta, heat } = diff(ref, dec, cap.w, cap.h);
        // Body-only diff (edges excluded) — the verdict driver.
        const body = bodyDiff(ref, dec, cap.w, cap.h);
        worstDiffPct = Math.max(worstDiffPct, diffPct);
        worstMaxDelta = Math.max(worstMaxDelta, maxDelta);
        worstPercDiffPct = Math.max(worstPercDiffPct, body.bodyDiffPct);
        worstPercMaxDelta = Math.max(worstPercMaxDelta, body.bodyMaxDelta);
        newRows.push({
          index: idx,
          timeSec,
          diffPct,
          maxDelta,
          percDiffPct: body.bodyDiffPct,
          percMaxDelta: body.bodyMaxDelta,
          ref,
          dec,
          heat,
        });
        rows = [...newRows];
      }

      input.dispose();

      verdict =
        worstPercDiffPct <= PASS_DIFF_PCT && worstPercMaxDelta <= PASS_MAX_DELTA
          ? "PASS"
          : "FAIL";
      status =
        `done — ${verdict} | body(edges masked) diff ${worstPercDiffPct.toFixed(3)}% Δ${worstPercMaxDelta} | ` +
        `full-res(edge-incl) diff ${worstDiffPct.toFixed(3)}% Δ${worstMaxDelta}`;

      (window as unknown as Record<string, unknown>).__trailParityResult = {
        word,
        resolution,
        fps,
        codec,
        verdict,
        perceptual: {
          worstDiffPct: worstPercDiffPct,
          worstMaxDelta: worstPercMaxDelta,
        },
        fullRes: { worstDiffPct, worstMaxDelta },
        frames: newRows.map((r) => ({
          index: r.index,
          timeSec: r.timeSec,
          diffPct: r.diffPct,
          maxDelta: r.maxDelta,
          percDiffPct: r.percDiffPct,
          percMaxDelta: r.percMaxDelta,
        })),
      };
    } catch (err) {
      status = "error: " + (err instanceof Error ? err.message : String(err));
      console.error("[trail-parity]", err);
    } finally {
      (window as unknown as Record<string, unknown>).__tka_parity_capture =
        undefined;
      running = false;
    }
  }
</script>

<svelte:head><title>Trail Export Parity</title></svelte:head>

<div class="page">
  <h1>Trail Export Parity</h1>
  <p class="sub">
    Live render → real MP4 export → decode → pixel-diff decoded vs pre-encode.
    Isolates encoder fidelity. PASS gate: worst Δ ≤ {PASS_MAX_DELTA}, worst diff
    ≤ {PASS_DIFF_PCT}%.
  </p>

  <div class="controls">
    <label>Word <input bind:value={word} disabled={running} /></label>
    <label>
      Res
      <select bind:value={resolution} disabled={running}>
        <option value={720}>720</option>
        <option value={1080}>1080</option>
        <option value={2160}>2160 (4K)</option>
      </select>
    </label>
    <label>FPS <input type="number" bind:value={fps} min="10" max="60" disabled={running} /></label>
    <label>
      Codec
      <select bind:value={codec} disabled={running}>
        <option value="h264">H.264 (4:2:0)</option>
        <option value="av1">AV1 (4:4:4)</option>
      </select>
    </label>
    <button onclick={run} disabled={running || !engineReady}>
      {running ? "running…" : "Run parity"}
    </button>
  </div>

  <div class="status" class:run={running}>{status}</div>

  {#if verdict}
    <div class="verdict" class:pass={verdict === "PASS"} class:fail={verdict === "FAIL"}>
      {verdict} — body (edges masked) {worstPercDiffPct.toFixed(3)}% · Δ{worstPercMaxDelta}
      <span class="sub2">
        full-res (edge-inclusive): {worstDiffPct.toFixed(3)}% · Δ{worstMaxDelta}
      </span>
    </div>
  {/if}

  <!-- Live engine. Kept small on-screen; export drives it to output res. -->
  <div class="live">
    <span class="cap">live engine (trails)</span>
    <div class="live-box">
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
        onCanvasReady={(c) => {
          canvas = c;
          engineReady = !!c;
        }}
      />
    </div>
  </div>

  {#each rows as r (r.index)}
    <div class="frame">
      <div class="frame-head">
        frame {r.index} · t={r.timeSec.toFixed(3)}s · body {r.percDiffPct.toFixed(3)}% Δ{r.percMaxDelta}
        · full-res {r.diffPct.toFixed(3)}% Δ{r.maxDelta}
      </div>
      <div class="triptych">
        <figure><img src={r.ref.toDataURL()} alt="pre-encode" /><figcaption>pre-encode</figcaption></figure>
        <figure><img src={r.dec.toDataURL()} alt="decoded" /><figcaption>decoded MP4</figcaption></figure>
        <figure><img src={r.heat.toDataURL()} alt="diff" /><figcaption>diff (red = Δ&gt;{AA_TOLERANCE})</figcaption></figure>
      </div>
    </div>
  {/each}
</div>

<style>
  .page {
    padding: 20px;
    background: #0d0d14;
    color: #eee;
    min-height: 100vh;
    font-family: system-ui, sans-serif;
  }
  h1 { margin: 0 0 4px; }
  .sub { color: #8a8aa0; margin: 0 0 16px; max-width: 60ch; font-size: 13px; }
  .controls { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  input, select {
    background: #1c1c2e; color: #fff; border: 1px solid #444;
    border-radius: 6px; padding: 6px 8px; font-size: 14px;
  }
  label input:not([type]) { width: 120px; }
  input[type="number"] { width: 64px; }
  button {
    background: #4c6ef5; color: #fff; border: none; border-radius: 6px;
    padding: 8px 18px; font-size: 14px; cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .status {
    font-family: monospace; font-size: 13px; padding: 8px 12px;
    background: #15152a; border-radius: 6px; margin-bottom: 12px;
  }
  .status.run { color: #ffd43b; }
  .verdict { font-weight: 700; font-size: 18px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }
  .verdict.pass { background: #133a1f; color: #51cf66; }
  .verdict.fail { background: #3a1313; color: #ff6b6b; }
  .verdict .sub2 { display: block; font-weight: 400; font-size: 12px; color: #9a9ab0; margin-top: 4px; }
  .live { margin-bottom: 18px; }
  .cap { font-size: 12px; color: #8a8aa0; }
  .live-box { width: 320px; height: 320px; background: #000; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
  .frame { margin-bottom: 18px; border: 1px solid #2a2a40; border-radius: 8px; padding: 10px; background: #11111f; }
  .frame-head { font-family: monospace; font-size: 12px; color: #b0b0c8; margin-bottom: 8px; }
  .triptych { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; }
  figure img { width: 280px; height: 280px; display: block; border: 1px solid #333; background: #000; }
  figcaption { font-size: 11px; color: #888; margin-top: 4px; text-align: center; }
</style>
