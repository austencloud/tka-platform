<script lang="ts">
  /**
   * Render Graph - Phase 1 parity harness.
   *
   * Two identical motion paths rendered side-by-side:
   *   LEFT  = Canvas2D (real Canvas2DTrailRenderer + destination-out fade,
   *           the exact pipeline the production AnimatorCanvas uses today)
   *   RIGHT = WebGL2Backend (new render-graph pipeline, ping-pong FBO +
   *           soft-edge shader + halo glow)
   *
   * Same TrailsIntent drives both. If WebGL2 wins on FPS AND looks as
   * good or better than Canvas2D, Phase 1 ships into AnimationRenderLoop
   * behind a flag. Otherwise the shader needs more work.
   */
  import { onMount, onDestroy } from "svelte";
  import { createBackend } from "$lib/shared/render-graph/services/backend-factory";
  import type { RenderBackend } from "$lib/shared/render-graph/domain/backend";
  import type { FrameGraph } from "$lib/shared/render-graph/domain/frame-graph";
  import { Z_ORDER } from "$lib/shared/render-graph/domain/render-pass";
  import { toTrailPassPayload } from "$lib/shared/render-graph/translators/trail-translator";
  import type { TrailsIntent } from "$lib/shared/effects/domain/effects-config";
  import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
  import {
    TrailMode,
    TrailEffect,
    TrackingMode,
    type TrailPoint,
    type TrailSettings,
  } from "$lib/shared/animation-engine/domain/types/trail-types";

  const CANVAS_SIZE = 500;

  let webglCanvasEl!: HTMLCanvasElement;
  let canvas2dEl!: HTMLCanvasElement;

  let backend: RenderBackend | null = null;
  let canvas2dCtx: CanvasRenderingContext2D | null = null;
  const trailRenderer = new Canvas2DTrailRenderer();
  /** Counter for smoothAlphaDecay on the Canvas2D side - mirrors
   *  TrailOverlayCanvas so rgba8 1/255 floor pixels get kicked to zero. */
  let canvas2dDecayCounter = 0;
  const CANVAS2D_DECAY_INTERVAL = 10;
  const CANVAS2D_DECAY_STEP = 20;

  let rafHandle = 0;
  let startTime = 0;
  let previousFrameTime = -1;

  let webglStatus = $state("initializing…");
  let webglLastFrameMs = $state(0);
  let canvas2dLastFrameMs = $state(0);
  const webglFpsWindow: number[] = [];
  const canvas2dFpsWindow: number[] = [];
  let webglFps = $state(0);
  let canvas2dFps = $state(0);

  let intent = $state<TrailsIntent>({
    trackingMode: "both_ends",
    thickness: 4,
    brightness: 0.9,
    blueColor: "#4ecdc4",
    redColor: "#ff6b6b",
    rainbow: false,
  });

  /** Stress-test controls. Scale tips and path length independently. */
  let tipCount = $state(2);
  let pointsPerTip = $state(20);

  // Last N positions per tip - shared across both renderers so they
  // see identical input. NDC for the WebGL2 path; pixel-space for Canvas2D.
  const pathNDC = new Map<string, Array<[number, number]>>();
  const pathPixels = new Map<string, TrailPoint[]>();

  onMount(async () => {
    webglCanvasEl.width = CANVAS_SIZE;
    webglCanvasEl.height = CANVAS_SIZE;
    canvas2dEl.width = CANVAS_SIZE;
    canvas2dEl.height = CANVAS_SIZE;

    canvas2dCtx = canvas2dEl.getContext("2d", { willReadFrequently: true });

    try {
      backend = await createBackend(webglCanvasEl);
      webglStatus = `backend ready: ${backend.kind}`;
    } catch (e) {
      webglStatus = `init failed: ${(e as Error).message}`;
      return;
    }

    startTime = performance.now();
    loop(startTime);
  });

  onDestroy(() => {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    backend?.dispose();
    backend = null;
  });

  function loop(time: number) {
    rafHandle = requestAnimationFrame(loop);

    const elapsed = (time - startTime) / 1000;
    const dt = previousFrameTime < 0 ? 1 / 60 : (time - previousFrameTime) / 1000;
    previousFrameTime = time;

    for (let i = 0; i < tipCount; i += 1) {
      const phase = (i / tipCount) * Math.PI * 2;
      advancePath(tipIdFor(i), tipPath(elapsed, phase), time);
    }

    const webglStart = performance.now();
    renderWebGL(time, elapsed);
    webglLastFrameMs = performance.now() - webglStart;

    const canvas2dStart = performance.now();
    renderCanvas2D(time, dt);
    canvas2dLastFrameMs = performance.now() - canvas2dStart;

    webglFpsWindow.push(time);
    while (webglFpsWindow.length > 0 && webglFpsWindow[0]! < time - 1000) webglFpsWindow.shift();
    webglFps = webglFpsWindow.length;

    canvas2dFpsWindow.push(time);
    while (canvas2dFpsWindow.length > 0 && canvas2dFpsWindow[0]! < time - 1000) canvas2dFpsWindow.shift();
    canvas2dFps = canvas2dFpsWindow.length;
  }

  /** Lissajous-ish path. Returns NDC (-1..1) position at time `t`. */
  function tipPath(t: number, phase: number): [number, number] {
    const x = 0.7 * Math.cos(t * 1.3 + phase);
    const y = 0.55 * Math.sin(t * 1.9 + phase * 0.7);
    return [x, y];
  }

  function tipIdFor(i: number): string {
    if (i === 0) return "blue";
    if (i === 1) return "red";
    return `tip-${i}`;
  }

  function advancePath(tipId: string, ndc: [number, number], timestamp: number) {
    // NDC ring for WebGL2.
    let ring = pathNDC.get(tipId);
    if (!ring) {
      ring = [];
      pathNDC.set(tipId, ring);
    }
    ring.push(ndc);
    if (ring.length > pointsPerTip) ring.splice(0, ring.length - pointsPerTip);

    // Pixel ring for Canvas2D.
    let pxRing = pathPixels.get(tipId);
    if (!pxRing) {
      pxRing = [];
      pathPixels.set(tipId, pxRing);
    }
    pxRing.push({
      x: ((ndc[0] + 1) * 0.5) * CANVAS_SIZE,
      y: ((1 - ndc[1]) * 0.5) * CANVAS_SIZE, // y flip: NDC y-up, canvas y-down
      timestamp,
      propIndex: tipId === "red" ? 1 : 0,
      tipIndex: 0,
    });
    if (pxRing.length > pointsPerTip) pxRing.splice(0, pxRing.length - pointsPerTip);
  }

  function renderWebGL(time: number, elapsed: number) {
    if (!backend) return;
    const tips: Array<{ tipId: string; path: Array<[number, number]> }> = [];
    for (let i = 0; i < tipCount; i += 1) {
      const id = tipIdFor(i);
      tips.push({ tipId: id, path: pathNDC.get(id) ?? [] });
    }
    const graph: FrameGraph = {
      passes: [
        {
          kind: "trail",
          order: Z_ORDER.TRAIL,
          target: "scene",
          payload: toTrailPassPayload(intent, { tips, elapsedSeconds: elapsed }),
        },
      ],
      targets: {
        scene: { width: CANVAS_SIZE, height: CANVAS_SIZE, format: "rgba8" },
      },
    };
    backend.executeFrame(graph, time);
  }

  function renderCanvas2D(time: number, dt: number) {
    const ctx = canvas2dCtx;
    if (!ctx) return;

    // 1. Fade existing pixels - matches TrailOverlayCanvas.renderFrame.
    const fadeDurationMs = 1200;
    const safeDuration = Math.max(fadeDurationMs, 16.67);
    const framesForFullFade = safeDuration / 16.67;
    const baseFade = 3.5 / framesForFullFade;
    const fadeAmount = 1 - Math.pow(1 - baseFade, (dt * 1000) / 16.67);

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = fadeAmount;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();

    // 1b. Kick-to-zero pass - matches TrailOverlayCanvas.smoothAlphaDecay.
    // Canvas2D destination-out can't round below 1/255 alpha due to 8-bit
    // integer rounding, leaving a permanent ghost trail. Subtracting a
    // small constant from near-zero pixels every N frames kills it.
    canvas2dDecayCounter += 1;
    if (canvas2dDecayCounter >= CANVAS2D_DECAY_INTERVAL) {
      canvas2dDecayCounter = 0;
      const img = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const data = img.data;
      const threshold = CANVAS2D_DECAY_STEP + 10;
      let dirty = false;
      for (let i = 3; i < data.length; i += 4) {
        const a = data[i]!;
        if (a > 0 && a <= threshold) {
          data[i] = Math.max(0, a - CANVAS2D_DECAY_STEP);
          dirty = true;
        }
      }
      if (dirty) ctx.putImageData(img, 0, 0);
    }

    // 2. Draw current leading edge using the real Canvas2DTrailRenderer.
    const baseSettings: TrailSettings = {
      mode: TrailMode.FADE,
      effect: TrailEffect.GLOW,
      fadeDurationMs,
      maxPoints: pointsPerTip,
      lineWidth: Math.max(3.5, intent.thickness),
      glowBlur: 3,
      blueColor: colorFor("blue", time),
      redColor: colorFor("red", time),
      additionalLayerColors: [],
      minOpacity: intent.brightness * 0.3,
      maxOpacity: intent.brightness,
      trackingMode: TrackingMode.BOTH_ENDS,
      hideProps: false,
      usePathCache: false,
      previewMode: false,
      tailLength: 20,
    };

    // Pairs: tips 0/1 use blue/red hues, subsequent tips cycle the hue wheel.
    for (let i = 0; i < tipCount; i += 2) {
      const leftId = tipIdFor(i);
      const rightId = i + 1 < tipCount ? tipIdFor(i + 1) : null;
      const leftRing = pathPixels.get(leftId) ?? [];
      const rightRing = rightId ? (pathPixels.get(rightId) ?? []) : [];
      const settings = {
        ...baseSettings,
        blueColor: colorForIndex(i, time),
        redColor: rightId ? colorForIndex(i + 1, time) : baseSettings.redColor,
      };
      trailRenderer.renderTrails(
        ctx,
        leftRing,
        rightRing,
        settings,
        time,
        leftRing.length >= 2,
        rightRing.length >= 2,
        CANVAS_SIZE,
      );
    }
  }

  function colorForIndex(i: number, time: number): string {
    if (i === 0) return colorFor("blue", time);
    if (i === 1) return colorFor("red", time);
    const h = ((i * 0.17) + (time - startTime) / 1000 * 0.05) % 1;
    const [r, g, b] = hsvToRgb(h, 0.8, 1);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function colorFor(tipId: string, time: number): string {
    if (intent.rainbow) {
      const elapsed = (time - startTime) / 1000;
      const hueOffset = tipId === "red" ? 0.33 : 0;
      const h = (elapsed * 0.15 + hueOffset) % 1;
      const [r, g, b] = hsvToRgb(h, 0.85, 1);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    return tipId === "red" ? intent.redColor : intent.blueColor;
  }

  function toHex(v: number): string {
    return Math.round(v * 255).toString(16).padStart(2, "0");
  }

  function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      default: return [v, p, q];
    }
  }

  function reset() {
    pathNDC.clear();
    pathPixels.clear();
    if (canvas2dCtx) canvas2dCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    backend?.dispose();
    (async () => {
      backend = await createBackend(webglCanvasEl);
      webglStatus = `backend ready: ${backend.kind}`;
    })();
  }
</script>

<svelte:head>
  <title>Render Graph - Phase 1 parity</title>
</svelte:head>

<div class="page">
  <header>
    <h1>Trails - parity gate</h1>
    <p class="sub">
      Same lissajous path fed to both pipelines. Intent controls on the right
      apply to both. Judge visually: does the WebGL2 side look as good as the
      Canvas2D side? FPS numbers tell you the perf tradeoff.
    </p>
  </header>

  <div class="stage">
    <figure>
      <figcaption>
        Canvas2D
        <span class="stat">{canvas2dFps} fps · {canvas2dLastFrameMs.toFixed(2)} ms/frame</span>
      </figcaption>
      <canvas bind:this={canvas2dEl} width={CANVAS_SIZE} height={CANVAS_SIZE}></canvas>
    </figure>

    <figure>
      <figcaption>
        WebGL2 (render-graph)
        <span class="stat">{webglFps} fps · {webglLastFrameMs.toFixed(2)} ms/frame</span>
      </figcaption>
      <canvas bind:this={webglCanvasEl} width={CANVAS_SIZE} height={CANVAS_SIZE}></canvas>
    </figure>

    <aside class="panel">
      <dl class="meta">
        <dt>status</dt><dd>{webglStatus}</dd>
      </dl>

      <fieldset>
        <legend>TrailsIntent</legend>
        <label>
          thickness <output>{intent.thickness}</output>
          <input type="range" min="1" max="12" step="1" bind:value={intent.thickness} />
        </label>
        <label>
          brightness <output>{intent.brightness.toFixed(2)}</output>
          <input type="range" min="0.3" max="1" step="0.01" bind:value={intent.brightness} />
        </label>
        <label>blue <input type="color" bind:value={intent.blueColor} /></label>
        <label>red <input type="color" bind:value={intent.redColor} /></label>
        <label class="inline">
          <input type="checkbox" bind:checked={intent.rainbow} />
          rainbow
        </label>
        <button type="button" onclick={reset}>reset trails</button>
      </fieldset>

      <fieldset>
        <legend>stress test</legend>
        <label>
          tip count <output>{tipCount}</output>
          <input type="range" min="1" max="64" step="1" bind:value={tipCount} />
        </label>
        <label>
          points / tip <output>{pointsPerTip}</output>
          <input type="range" min="10" max="2000" step="10" bind:value={pointsPerTip} />
        </label>
        <dl class="meta">
          <dt>total points</dt><dd>{tipCount * pointsPerTip}</dd>
        </dl>
        <div class="presets">
          <button type="button" onclick={() => { tipCount = 2; pointsPerTip = 20; reset(); }}>baseline</button>
          <button type="button" onclick={() => { tipCount = 8; pointsPerTip = 150; reset(); }}>medium</button>
          <button type="button" onclick={() => { tipCount = 16; pointsPerTip = 500; reset(); }}>heavy</button>
          <button type="button" onclick={() => { tipCount = 32; pointsPerTip = 1500; reset(); }}>brutal</button>
        </div>
      </fieldset>
    </aside>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #0b0f14;
    color: #e8edf2;
    font-family: system-ui, sans-serif;
    padding: 1.5rem;
  }
  header {
    max-width: 1280px;
    margin: 0 auto 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  .sub {
    color: #8a9ba8;
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
    max-width: 700px;
  }
  .stage {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: auto auto 240px;
    gap: 1rem;
    align-items: start;
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 0.85rem;
    color: #aab7c3;
    padding-bottom: 0.25rem;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .stat {
    color: #7ec3d4;
    font-variant-numeric: tabular-nums;
  }
  canvas {
    background: #000;
    border: 1px solid #1e2a36;
    border-radius: 6px;
    display: block;
  }
  .panel {
    background: #141c25;
    border: 1px solid #1e2a36;
    border-radius: 6px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.75rem;
    margin: 0;
    font-size: 0.85rem;
  }
  .meta dt { color: #8a9ba8; }
  .meta dd { margin: 0; }
  fieldset {
    border: 1px solid #1e2a36;
    border-radius: 4px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  legend {
    padding: 0 0.5rem;
    color: #8a9ba8;
    font-size: 0.85rem;
  }
  label {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    gap: 0.25rem;
  }
  label.inline {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  output {
    color: #7ec3d4;
    font-variant-numeric: tabular-nums;
  }
  button {
    background: #1c2834;
    color: #e8edf2;
    border: 1px solid #2a3a4a;
    border-radius: 4px;
    padding: 0.5rem;
    cursor: pointer;
  }
  button:hover { background: #243240; }
  .presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
  }
  .presets button {
    padding: 0.35rem;
    font-size: 0.75rem;
  }
</style>
