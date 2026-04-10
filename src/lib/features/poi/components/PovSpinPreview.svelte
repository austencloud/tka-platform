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
  import ScrubValue from "./ScrubValue.svelte";

  const poi = getPoiContext();

  let canvasRef = $state<HTMLCanvasElement | null>(null);
  let playing = $state(true);
  let animFrameId = $state(0);

  // rpm and showFullDisc are persisted in poi state
  const rpm = $derived(poi.rpm);
  const showFullDisc = $derived(poi.showFullDisc);

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
    const innerRadius = outerRadius * 0.15; // Hub matches real poi hardware

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
  const TRAIL_SEGMENTS = 64;

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
        // Static mode: subtle ambient glow behind the disc
        const ambientGlow = ctx.createRadialGradient(cx, cy, drawRadius * 0.8, cx, cy, drawRadius * 1.15);
        ambientGlow.addColorStop(0, "rgba(100, 180, 255, 0.06)");
        ambientGlow.addColorStop(1, "transparent");
        ctx.fillStyle = ambientGlow;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.drawImage(discCanvas, -drawRadius, -drawRadius, drawRadius * 2, drawRadius * 2);
        ctx.restore();
      } else {
        // POV mode: persistence window sweeps around the fixed disc.
        const rps = rpm / 60;
        const persistence = poi.persistenceDuration;
        const persistenceFraction = Math.min(rps * persistence, 1.0);
        const persistenceArc = persistenceFraction * Math.PI * 2;
        const segmentArc = persistenceArc / TRAIL_SEGMENTS;

        // Bloom layer: faint, slightly larger copy of the trail for glow
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.filter = `blur(${Math.round(drawRadius * 0.02)}px)`;
        for (let i = TRAIL_SEGMENTS - 1; i >= 0; i--) {
          const t = i / TRAIL_SEGMENTS;
          const alpha = (1.0 - t) * (1.0 - t);
          if (alpha < 0.05) continue;

          const segEnd = staffAngle - i * segmentArc;
          const segStart = segEnd - segmentArc;

          ctx.save();
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, drawRadius * 1.04, segStart, segEnd);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(discCanvas, cx - drawRadius, cy - drawRadius, drawRadius * 2, drawRadius * 2);
          ctx.restore();
        }
        ctx.restore();

        // Main trail segments with fade
        for (let i = TRAIL_SEGMENTS - 1; i >= 0; i--) {
          const t = i / TRAIL_SEGMENTS;
          const alpha = (1.0 - t) * (1.0 - t);
          if (alpha < 0.01) continue;

          const segEnd = staffAngle - i * segmentArc;
          const segStart = segEnd - segmentArc;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, drawRadius + 2, segStart, segEnd);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(discCanvas, cx - drawRadius, cy - drawRadius, drawRadius * 2, drawRadius * 2);
          ctx.restore();
        }

        // Pixel poi staff: glowing LED strip along the radius
        const pattern = poi.activePattern;
        if (pattern) {
          const innerR = drawRadius * 0.15;
          const stripLength = drawRadius - innerR;
          const { ledCount, frameCount, frames } = pattern;

          const normalizedAngle = ((staffAngle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const frameIdx = Math.floor((normalizedAngle / (Math.PI * 2)) * frameCount) % frameCount;
          const frame = frames[frameIdx]!;

          const segLength = stripLength / ledCount;
          const staffWidth = Math.max(4 * dpr, drawRadius * 0.025);
          const cosA = Math.cos(staffAngle);
          const sinA = Math.sin(staffAngle);
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

            // Outer glow halo
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            const glowW = halfW * 3;
            ctx.beginPath();
            ctx.moveTo(cx + cosA * rStart - perpX * glowW, cy + sinA * rStart - perpY * glowW);
            ctx.lineTo(cx + cosA * rEnd - perpX * glowW, cy + sinA * rEnd - perpY * glowW);
            ctx.lineTo(cx + cosA * rEnd + perpX * glowW, cy + sinA * rEnd + perpY * glowW);
            ctx.lineTo(cx + cosA * rStart + perpX * glowW, cy + sinA * rStart + perpY * glowW);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Bright core
            const coreR = Math.min(255, r + 50);
            const coreG = Math.min(255, g + 50);
            const coreB = Math.min(255, b + 50);
            ctx.fillStyle = `rgb(${coreR},${coreG},${coreB})`;
            ctx.beginPath();
            ctx.moveTo(cx + cosA * rStart - perpX * halfW, cy + sinA * rStart - perpY * halfW);
            ctx.lineTo(cx + cosA * rEnd - perpX * halfW, cy + sinA * rEnd - perpY * halfW);
            ctx.lineTo(cx + cosA * rEnd + perpX * halfW, cy + sinA * rEnd + perpY * halfW);
            ctx.lineTo(cx + cosA * rStart + perpX * halfW, cy + sinA * rStart + perpY * halfW);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Outer rim glow — faint ring at the disc edge
        const rimGlow = ctx.createRadialGradient(cx, cy, drawRadius * 0.92, cx, cy, drawRadius * 1.08);
        rimGlow.addColorStop(0, "transparent");
        rimGlow.addColorStop(0.5, "rgba(120, 180, 255, 0.04)");
        rimGlow.addColorStop(1, "transparent");
        ctx.fillStyle = rimGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, drawRadius * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center hub — dark disc matching real poi hardware
      const hubRadius = drawRadius * 0.15;
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a0a";
      ctx.fill();
      // Subtle rim on the hub
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      animFrameId = requestAnimationFrame(draw);
    }

    animFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  });

</script>

<div class="spin-preview">
  <div class="canvas-frame">
    <canvas
      bind:this={canvasRef}
      class="spin-canvas"
    ></canvas>
  </div>

  <div class="controls-bar">
    <button
      class="icon-btn"
      onclick={() => { playing = !playing; }}
      aria-label={playing ? "Pause" : "Play"}
    >
      <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <button
      class="icon-btn"
      class:active={showFullDisc}
      onclick={() => { poi.setShowFullDisc(!showFullDisc); }}
      aria-label={showFullDisc ? "POV mode" : "Full disc"}
      title={showFullDisc ? "Switch to POV simulation" : "Show full pattern disc"}
    >
      <i class="fas {showFullDisc ? 'fa-eye' : 'fa-compact-disc'}" aria-hidden="true"></i>
    </button>

    <ScrubValue
      label="Spin"
      value={rpm}
      min={10}
      max={600}
      step={5}
      unit=" rpm"
      onchange={(v) => { poi.setRpm(Math.round(v)); }}
    />

    <ScrubValue
      label="Trail"
      value={poi.persistenceDuration * 1000}
      min={30}
      max={1000}
      step={5}
      unit="ms"
      format={(v) => String(Math.round(v))}
      onchange={(v) => poi.setPersistenceDuration(v / 1000)}
    />
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
    background: #050508;
    border-radius: 12px;
    border: 1px solid rgba(100, 160, 255, 0.12);
    overflow: hidden;
    width: 100%;
    padding-bottom: 100%;
    box-shadow: 0 0 20px rgba(80, 140, 255, 0.06), inset 0 0 30px rgba(0, 0, 0, 0.4);
  }

  .spin-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .controls-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-btn {
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
    flex-shrink: 0;
  }

  .icon-btn:hover {
    border-color: var(--theme-accent, #3b82f6);
  }

  .icon-btn.active {
    border-color: var(--theme-accent, #3b82f6);
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
  }

</style>
