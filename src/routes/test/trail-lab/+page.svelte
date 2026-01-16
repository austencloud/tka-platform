<!--
  Trail Lab - Direct Canvas Trail Testing

  Self-contained test page that renders trails directly to canvas.
  No animation infrastructure, no sequence loading, no errors.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";
  import {
    FadeStyle,
    TaperStyle,
    TrailEffect,
    TrailMode,
    TrailStyle,
    TrackingMode,
    type TrailSettings,
    type TrailPoint,
  } from "$lib/shared/animation-engine/domain/types/TrailTypes";

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let renderer: Canvas2DTrailRenderer;
  let animationId: number;

  // Trail settings - local state, directly controls rendering
  let effect = $state<TrailEffect>(TrailEffect.GLOW);
  let fadeStyle = $state<FadeStyle>(FadeStyle.EXPONENTIAL);
  let taperStyle = $state<TaperStyle>(TaperStyle.NONE);
  let lineWidth = $state(4);
  let maxOpacity = $state(0.95);
  let darkMode = $state(true);

  // Animation state
  let time = $state(0);
  const TRAIL_DURATION = 2500;

  // Generate spirograph-like trail points
  function generateTrailPoints(currentTime: number, color: "blue" | "red"): TrailPoint[] {
    const points: TrailPoint[] = [];
    const centerX = 200;
    const centerY = 200;

    // Spirograph parameters
    const R = 80; // Outer radius
    const r = color === "blue" ? 30 : 35; // Inner radius (different per color)
    const d = color === "blue" ? 60 : 55; // Drawing point distance
    const speed = color === "blue" ? 0.002 : 0.0018; // Rotation speed
    const offset = color === "blue" ? 0 : Math.PI; // Phase offset

    // Generate points going back in time
    for (let i = 0; i < 300; i++) {
      const age = i * 10; // 10ms apart
      const t = (currentTime - age) * speed + offset;

      const x = centerX + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = centerY + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);

      points.push({
        x,
        y,
        timestamp: currentTime - age,
        propIndex: color === "blue" ? 0 : 1,
        endType: 1,
      });
    }

    return points.reverse(); // Oldest first
  }

  function getTrailSettings(): TrailSettings {
    return {
      enabled: true,
      mode: TrailMode.FADE,
      style: TrailStyle.SMOOTH_LINE,
      effect,
      fadeStyle,
      taperStyle,
      fadeDurationMs: TRAIL_DURATION,
      maxPoints: 1000,
      lineWidth,
      glowEnabled: effect === TrailEffect.GLOW || effect === TrailEffect.NEON,
      glowBlur: 3,
      blueColor: "#2E3192",
      redColor: "#ED1C24",
      minOpacity: 0.1,
      maxOpacity,
      trackingMode: TrackingMode.RIGHT_END,
      hideProps: false,
      usePathCache: false,
      previewMode: false,
    };
  }

  function render() {
    if (!ctx || !renderer) return;

    time = performance.now();

    // Clear canvas
    ctx.fillStyle = darkMode ? "#0d0d1a" : "#f5f5f5";
    ctx.fillRect(0, 0, 400, 400);

    // Generate trail points
    const bluePoints = generateTrailPoints(time, "blue");
    const redPoints = generateTrailPoints(time, "red");

    // Render trails
    const settings = getTrailSettings();
    renderer.renderTrails(ctx, bluePoints, redPoints, settings, time, true, true);

    animationId = requestAnimationFrame(render);
  }

  onMount(() => {
    ctx = canvas.getContext("2d");
    renderer = new Canvas2DTrailRenderer();
    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  });
</script>

<svelte:head>
  <title>Trail Lab | TKA Scribe</title>
</svelte:head>

<div class="page" class:light={!darkMode}>
  <div class="main">
    <canvas bind:this={canvas} width="400" height="400"></canvas>

    <div class="controls">
      <h1>Trail Lab</h1>

      <div class="row">
        <span class="label">Effect</span>
        <div class="chips">
          <ChipToggle label="None" active={effect === TrailEffect.NONE} color="gray" onclick={() => effect = TrailEffect.NONE} />
          <ChipToggle label="Glow" active={effect === TrailEffect.GLOW} color="amber" onclick={() => effect = TrailEffect.GLOW} />
          <ChipToggle label="Neon" active={effect === TrailEffect.NEON} color="rose" onclick={() => effect = TrailEffect.NEON} />
        </div>
      </div>

      <div class="row">
        <span class="label">Fade</span>
        <div class="chips">
          <ChipToggle label="Linear" active={fadeStyle === FadeStyle.LINEAR} color="blue" onclick={() => fadeStyle = FadeStyle.LINEAR} />
          <ChipToggle label="Exponential" active={fadeStyle === FadeStyle.EXPONENTIAL} color="blue" onclick={() => fadeStyle = FadeStyle.EXPONENTIAL} />
        </div>
      </div>

      <div class="row">
        <span class="label">Taper</span>
        <div class="chips">
          <ChipToggle label="None" active={taperStyle === TaperStyle.NONE} color="emerald" onclick={() => taperStyle = TaperStyle.NONE} />
          <ChipToggle label="Tapered" active={taperStyle === TaperStyle.TAPERED} color="emerald" onclick={() => taperStyle = TaperStyle.TAPERED} />
        </div>
      </div>

      <div class="row">
        <span class="label">Width</span>
        <div class="chips">
          <ChipToggle label="Thin" active={lineWidth <= 2} color="default" onclick={() => lineWidth = 2} />
          <ChipToggle label="Medium" active={lineWidth > 2 && lineWidth <= 4} color="default" onclick={() => lineWidth = 3.5} />
          <ChipToggle label="Thick" active={lineWidth > 4} color="default" onclick={() => lineWidth = 6} />
        </div>
      </div>

      <div class="row">
        <span class="label">Opacity</span>
        <div class="chips">
          <ChipToggle label="Subtle" active={maxOpacity <= 0.6} color="cyan" onclick={() => maxOpacity = 0.5} />
          <ChipToggle label="Medium" active={maxOpacity > 0.6 && maxOpacity <= 0.85} color="cyan" onclick={() => maxOpacity = 0.75} />
          <ChipToggle label="Vivid" active={maxOpacity > 0.85} color="cyan" onclick={() => maxOpacity = 0.95} />
        </div>
      </div>

      <div class="row">
        <span class="label">Theme</span>
        <div class="chips">
          <ChipToggle label="Dark" icon="fa-moon" active={darkMode} color="cyan" onclick={() => darkMode = true} />
          <ChipToggle label="Light" icon="fa-sun" active={!darkMode} color="amber" onclick={() => darkMode = false} />
        </div>
      </div>

      <div class="debug">
        effect: {effect} | fade: {fadeStyle} | taper: {taperStyle} | width: {lineWidth} | opacity: {maxOpacity}
      </div>
    </div>
  </div>
</div>

<style>
  .page {
    height: 100vh;
    background: #0d0d1a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    box-sizing: border-box;
    transition: background 0.3s;
  }

  .page.light {
    background: #f5f5f5;
    color: #222;
  }

  .main {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
  }

  canvas {
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .page.light canvas {
    border-color: rgba(0, 0, 0, 0.1);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 280px;
  }

  h1 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem;
    font-weight: 600;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 50px;
    flex-shrink: 0;
  }

  .page.light .label {
    color: rgba(0, 0, 0, 0.5);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .debug {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.3);
    font-family: monospace;
  }

  .page.light .debug {
    border-color: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.4);
  }
</style>
