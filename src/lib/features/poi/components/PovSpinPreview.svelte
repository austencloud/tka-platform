<!--
  PovSpinPreview.svelte — Spinning disc visualization of a StripPattern.

  Renders what the pattern looks like when the poi spins at a given RPM.
  Each radial slice is one frame column, each pixel along the radius is one LED.
  This is the same visualization used in Ignis Pixel Utility and Lighttoys Composer.

  The disc is rendered to an OffscreenCanvas once when the pattern changes,
  then the animated version rotates and re-composites at 60fps for the spin effect.
-->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const poi = getPoiContext();

  let canvasRef = $state<HTMLCanvasElement | null>(null);
  let playing = $state(true);
  let rpm = $state(120);
  let animFrameId = $state(0);

  // Pre-rendered disc image (static, rebuilt when pattern changes)
  let discCanvas: OffscreenCanvas | null = null;

  // Render the full disc to an offscreen canvas whenever the pattern changes
  $effect(() => {
    const pattern = poi.activePattern;
    if (!pattern) {
      discCanvas = null;
      return;
    }

    const size = 512;
    const oc = new OffscreenCanvas(size, size);
    const ctx = oc.getContext("2d")!;

    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = size / 2 - 4;
    const innerRadius = outerRadius * 0.08; // Small center hole like real poi

    const { ledCount, frameCount, frames } = pattern;

    // Draw each pixel as a tiny arc segment
    // Angular resolution: one slice per frame
    const angleStep = (Math.PI * 2) / frameCount;
    // Radial resolution: one ring per LED
    const radiusStep = (outerRadius - innerRadius) / ledCount;

    for (let f = 0; f < frameCount; f++) {
      const frame = frames[f]!;
      const startAngle = f * angleStep - Math.PI / 2; // Start from top
      const endAngle = startAngle + angleStep + 0.002; // Tiny overlap to prevent seams

      for (let led = 0; led < ledCount; led++) {
        const offset = led * 3;
        const r = frame.colors[offset]!;
        const g = frame.colors[offset + 1]!;
        const b = frame.colors[offset + 2]!;

        // Skip black pixels for performance
        if (r === 0 && g === 0 && b === 0) continue;

        const rInner = innerRadius + led * radiusStep;
        const rOuter = rInner + radiusStep + 0.5; // Slight overlap

        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, startAngle, endAngle);
        ctx.arc(cx, cy, rInner, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
    }

    discCanvas = oc;
  });

  // Animation loop: draw the disc (optionally rotating) to the visible canvas
  $effect(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let startTime = performance.now();
    let currentAngle = 0;

    function draw() {
      if (!canvas || !ctx) return;

      const now = performance.now();
      const dt = (now - startTime) / 1000;
      startTime = now;

      if (playing) {
        currentAngle += (rpm * Math.PI * 2) / 60 * dt;
      }

      // Match canvas pixel size to its CSS display size (avoid blurry scaling)
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayW = Math.round(rect.width * dpr);
      const displayH = Math.round(rect.height * dpr);
      if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width = displayW;
        canvas.height = displayH;
      }

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      if (discCanvas) {
        // Scale disc to fit the canvas with padding
        const drawSize = Math.min(w, h) * 0.92;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(currentAngle);
        ctx.drawImage(
          discCanvas,
          -drawSize / 2,
          -drawSize / 2,
          drawSize,
          drawSize,
        );
        ctx.restore();
      }

      // Center dot (hub)
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#333";
      ctx.fill();

      animFrameId = requestAnimationFrame(draw);
    }

    animFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  });

  function handleRpmChange(e: Event): void {
    rpm = parseInt((e.target as HTMLInputElement).value, 10);
  }
</script>

<div class="spin-preview">
  <div class="canvas-frame">
    <canvas
      bind:this={canvasRef}
      class="spin-canvas"
    ></canvas>
  </div>

  <div class="spin-controls">
    <button
      class="transport-btn"
      onclick={() => { playing = !playing; }}
      aria-label={playing ? "Pause" : "Play"}
    >
      <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <label class="rpm-control">
      <span class="rpm-label">RPM</span>
      <input
        type="range"
        min="10"
        max="600"
        step="10"
        value={rpm}
        oninput={handleRpmChange}
        class="rpm-slider"
      />
      <span class="rpm-value">{rpm}</span>
    </label>
  </div>
</div>

<style>
  .spin-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .canvas-frame {
    position: relative;
    background: #0a0a0a;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.1));
    overflow: hidden;
    width: 100%;
    padding-bottom: 100%; /* 1:1 aspect ratio via padding trick */
  }

  .spin-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .spin-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .transport-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--theme-stroke, rgba(255 255 255 / 0.15));
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255 255 255 / 0.05));
    color: var(--theme-text-primary, #e2e8f0);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: border-color 0.15s;
  }

  .transport-btn:hover {
    border-color: var(--theme-accent, #3b82f6);
  }

  .rpm-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .rpm-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
    min-width: 30px;
  }

  .rpm-slider {
    flex: 1;
    accent-color: var(--theme-accent, #3b82f6);
  }

  .rpm-value {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, #94a3b8);
    min-width: 30px;
    text-align: right;
  }
</style>
