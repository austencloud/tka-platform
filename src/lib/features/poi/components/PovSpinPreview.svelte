<!--
  PovSpinPreview.svelte — Spinning POV simulation of a StripPattern.

  Simulates real persistence-of-vision physics: a single staff line sweeps
  around the circle, and the trail of light fades behind it. Your eye
  integrates the fading trail into the full image — just like watching
  a pixel poi performer in a dark room.

  The disc image (all frames mapped to angles) is pre-rendered once.
  Each animation frame, only the persistence window is drawn — a wedge
  from the staff's current angle backwards, with alpha fading from
  bright (leading edge) to black (trailing edge).
-->
<script lang="ts">
  import { getPoiContext } from "../context/poi-context";

  const poi = getPoiContext();

  let canvasRef = $state<HTMLCanvasElement | null>(null);
  let playing = $state(true);
  let rpm = $state(120);
  let showFullDisc = $state(false);
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
    const innerRadius = outerRadius * 0.08;

    const { ledCount, frameCount, frames } = pattern;
    const angleStep = (Math.PI * 2) / frameCount;
    const radiusStep = (outerRadius - innerRadius) / ledCount;

    for (let f = 0; f < frameCount; f++) {
      const frame = frames[f]!;
      const startAngle = f * angleStep - Math.PI / 2;
      const endAngle = startAngle + angleStep + 0.002;

      for (let led = 0; led < ledCount; led++) {
        const offset = led * 3;
        const r = frame.colors[offset]!;
        const g = frame.colors[offset + 1]!;
        const b = frame.colors[offset + 2]!;

        if (r === 0 && g === 0 && b === 0) continue;

        const rInner = innerRadius + led * radiusStep;
        const rOuter = rInner + radiusStep + 0.5;

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

  /** Number of wedge segments to draw in the persistence trail */
  const TRAIL_SEGMENTS = 40;

  // Animation loop
  $effect(() => {
    const canvas = canvasRef;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let prevTime = performance.now();
    let staffAngle = 0;

    function draw() {
      if (!canvas || !ctx) return;

      const now = performance.now();
      const dt = (now - prevTime) / 1000;
      prevTime = now;

      if (playing) {
        staffAngle += (rpm * Math.PI * 2) / 60 * dt;
      }

      // Sync canvas pixels to display size
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
      const cx = w / 2;
      const cy = h / 2;
      const drawRadius = Math.min(w, h) * 0.46;

      // Black background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);

      if (!discCanvas) {
        animFrameId = requestAnimationFrame(draw);
        return;
      }

      if (showFullDisc) {
        // Static mode: show full disc without fade
        ctx.save();
        ctx.translate(cx, cy);
        ctx.drawImage(discCanvas, -drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);
        ctx.restore();
      } else {
        // POV mode: persistence window sweeps around the fixed disc.
        // The staff is at staffAngle. The trail extends backwards.
        // persistenceArc = how much of the circle is visible based on
        // how long light persists vs how fast the staff is spinning.
        const rps = rpm / 60; // rotations per second
        const persistence = poi.persistenceDuration;
        // What fraction of a full rotation does the persistence cover?
        // At 120 RPM (2 rps) with 120ms persistence: 2 * 0.12 = 0.24 of the circle
        const persistenceFraction = Math.min(rps * persistence, 1.0);
        const persistenceArc = persistenceFraction * Math.PI * 2;

        const segmentArc = persistenceArc / TRAIL_SEGMENTS;

        // Draw trail segments from oldest (faintest) to newest (brightest)
        // so newer segments paint over older ones
        for (let i = TRAIL_SEGMENTS - 1; i >= 0; i--) {
          // Alpha: 1.0 at leading edge (i=0), fading to 0 at trailing edge
          const t = i / TRAIL_SEGMENTS;
          // Quadratic fade feels more natural than linear
          const alpha = (1.0 - t) * (1.0 - t);

          if (alpha < 0.01) continue;

          // This segment's angular range on the fixed disc
          const segEnd = staffAngle - i * segmentArc;
          const segStart = segEnd - segmentArc;

          ctx.save();
          ctx.globalAlpha = alpha;

          // Clip to this wedge
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, drawRadius + 2, segStart, segEnd);
          ctx.closePath();
          ctx.clip();

          // Draw the full disc (only the clipped wedge is visible)
          ctx.drawImage(
            discCanvas,
            cx - drawRadius, cy - drawRadius,
            drawRadius * 2, drawRadius * 2,
          );

          ctx.restore();
        }

        // Pixel poi staff: render each LED as a glowing segment along the radius
        const pattern = poi.activePattern;
        if (pattern) {
          const innerR = drawRadius * 0.08;
          const stripLength = drawRadius - innerR;
          const { ledCount, frameCount, frames } = pattern;

          // Which frame is at this angle?
          const normalizedAngle = ((staffAngle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const frameIdx = Math.floor((normalizedAngle / (Math.PI * 2)) * frameCount) % frameCount;
          const frame = frames[frameIdx]!;

          // LED segment dimensions
          const segLength = stripLength / ledCount;
          const staffWidth = Math.max(4 * dpr, drawRadius * 0.025);
          const cosA = Math.cos(staffAngle);
          const sinA = Math.sin(staffAngle);
          // Perpendicular direction for width
          const perpX = -sinA;
          const perpY = cosA;
          const halfW = staffWidth / 2;

          for (let led = 0; led < ledCount; led++) {
            const offset = led * 3;
            const r = frame.colors[offset]!;
            const g = frame.colors[offset + 1]!;
            const b = frame.colors[offset + 2]!;

            const rStart = innerR + led * segLength;
            const rEnd = rStart + segLength;

            // Glow: draw a wider, semi-transparent version first
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath();
            const glowW = halfW * 2.5;
            ctx.moveTo(cx + cosA * rStart - perpX * glowW, cy + sinA * rStart - perpY * glowW);
            ctx.lineTo(cx + cosA * rEnd - perpX * glowW, cy + sinA * rEnd - perpY * glowW);
            ctx.lineTo(cx + cosA * rEnd + perpX * glowW, cy + sinA * rEnd + perpY * glowW);
            ctx.lineTo(cx + cosA * rStart + perpX * glowW, cy + sinA * rStart + perpY * glowW);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Core: bright center
            ctx.fillStyle = `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`;
            ctx.beginPath();
            ctx.moveTo(cx + cosA * rStart - perpX * halfW, cy + sinA * rStart - perpY * halfW);
            ctx.lineTo(cx + cosA * rEnd - perpX * halfW, cy + sinA * rEnd - perpY * halfW);
            ctx.lineTo(cx + cosA * rEnd + perpX * halfW, cy + sinA * rEnd + perpY * halfW);
            ctx.lineTo(cx + cosA * rStart + perpX * halfW, cy + sinA * rStart + perpY * halfW);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // Center hub
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = showFullDisc ? "#333" : "#555";
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

  function handlePersistenceChange(e: Event): void {
    const value = parseFloat((e.target as HTMLInputElement).value);
    poi.setPersistenceDuration(value);
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

    <button
      class="transport-btn"
      class:active={showFullDisc}
      onclick={() => { showFullDisc = !showFullDisc; }}
      aria-label={showFullDisc ? "POV mode" : "Full disc"}
      title={showFullDisc ? "Switch to POV simulation" : "Show full pattern disc"}
    >
      <i class="fas {showFullDisc ? 'fa-eye' : 'fa-compact-disc'}" aria-hidden="true"></i>
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

  <div class="spin-controls">
    <label class="rpm-control">
      <span class="rpm-label">Trail</span>
      <input
        type="range"
        min="0.03"
        max="1.0"
        step="0.01"
        value={poi.persistenceDuration}
        oninput={handlePersistenceChange}
        class="rpm-slider"
      />
      <span class="rpm-value">{Math.round(poi.persistenceDuration * 1000)}ms</span>
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

  .transport-btn.active {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
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
