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
  import { getPropInterpolator } from "$lib/shared/animation-engine/getPropInterpolator";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
  import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
  import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
  import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
  import { getVideoExportOrchestrator } from "$lib/shared/animation-engine/getVideoExportOrchestrator";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { Input, BufferSource, ALL_FORMATS, VideoSampleSink } from "mediabunny";

  // ---- Tunables ----------------------------------------------------------
  const AA_TOLERANCE = 8; // per-channel delta below which a pixel "matches"
  // PASS gate. H.264 is lossy so 0 is impossible; these are perceptual bars.
  const PASS_MAX_DELTA = 40;
  const PASS_DIFF_PCT = 2.0;

  let word = $state("DJDJ");
  let resolution = $state<720 | 1080 | 2160>(1080);
  let fps = $state(50);
  let status = $state("idle");
  let running = $state(false);
  let canvas: HTMLCanvasElement | null = null;
  let engineReady = $state(false);

  type FrameRow = {
    index: number;
    timeSec: number;
    diffPct: number;
    maxDelta: number;
    ref: HTMLCanvasElement;
    dec: HTMLCanvasElement;
    heat: HTMLCanvasElement;
  };
  let rows = $state<FrameRow[]>([]);
  let verdict = $state<"" | "PASS" | "FAIL">("");
  let worstDiffPct = $state(0);
  let worstMaxDelta = $state(0);

  // Per-instance playback stack (mirrors InlineAnimationPlayer).
  const animationState = createAnimationPanelState();
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

    // Pure trails: trails effect on, all chrome off (square frame).
    const vm = getAnimationVisibilityManager();
    vm.setActiveEffect("trails");
    vm.setVisibility("wordHeader", false);
    vm.setVisibility("progressBar", false);
    vm.setVisibility("tkaGlyph", false);
    vm.setVisibility("stepNumbers", false);
    vm.setVisibility("pathLines", false);
  });

  onDestroy(() => {
    playbackController?.dispose();
    animationState.dispose();
  });

  async function loadSequence(): Promise<boolean> {
    status = `loading sequence "${word}"…`;
    const repo = getSequenceRepository();
    const seq = await repo.getSequence(word.trim());
    const hasMotion =
      seq &&
      Array.isArray(seq.steps) &&
      seq.steps.length > 0 &&
      seq.steps.some((s) => s?.motions?.blue && s?.motions?.red);
    if (!seq || !hasMotion) {
      status = `sequence "${word}" not found or has no motion data`;
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
    (window as unknown as Record<string, unknown>).__trailParityResult =
      undefined;

    try {
      if (!(await loadSequence())) return;

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
        worstDiffPct = Math.max(worstDiffPct, diffPct);
        worstMaxDelta = Math.max(worstMaxDelta, maxDelta);
        newRows.push({ index: idx, timeSec, diffPct, maxDelta, ref, dec, heat });
        rows = [...newRows];
      }

      input.dispose();

      verdict =
        worstDiffPct <= PASS_DIFF_PCT && worstMaxDelta <= PASS_MAX_DELTA
          ? "PASS"
          : "FAIL";
      status = `done — verdict ${verdict} | worst diff ${worstDiffPct.toFixed(3)}% | worst Δ ${worstMaxDelta}`;

      (window as unknown as Record<string, unknown>).__trailParityResult = {
        word,
        resolution,
        fps,
        verdict,
        worstDiffPct,
        worstMaxDelta,
        frames: newRows.map((r) => ({
          index: r.index,
          timeSec: r.timeSec,
          diffPct: r.diffPct,
          maxDelta: r.maxDelta,
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
    <button onclick={run} disabled={running || !engineReady}>
      {running ? "running…" : "Run parity"}
    </button>
  </div>

  <div class="status" class:run={running}>{status}</div>

  {#if verdict}
    <div class="verdict" class:pass={verdict === "PASS"} class:fail={verdict === "FAIL"}>
      {verdict} — worst diff {worstDiffPct.toFixed(3)}% · worst channel Δ {worstMaxDelta}
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
        frame {r.index} · t={r.timeSec.toFixed(3)}s ·
        diff {r.diffPct.toFixed(3)}% · Δ {r.maxDelta}
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
