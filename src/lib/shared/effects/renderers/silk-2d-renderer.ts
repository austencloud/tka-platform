import type { Silk2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

interface RibbonSample {
  x: number;
  y: number;
  t: number;
  speed: number;
}

const MAX_SAMPLES = 300;
const SEGMENTS = 16;
const AURA_STRIDE = 8;
const TAU = Math.PI * 2;

export class Silk2DRenderer {
  private time = 0;
  private tipTrails = new Map<string, RibbonSample[]>();
  private lastTipPos = new Map<string, { x: number; y: number }>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1,
    loopDetected: boolean = false,
  ): void {
    this.time += dt;

    // Build the set of emitters present + tracking-enabled this frame. Layer
    // props (propIndex >= 2) flow through identically to the two base props.
    const present = new Map<string, EmitterTip>();
    for (const e of emitters) {
      if (!this.isEndEnabled(e.end, params)) continue;
      present.set(emitterId(e.propIndex, e.tipIndex), e);
    }

    // Iterate the union of (present ids) and (existing trail ids) so trails for
    // emitters that vanished this frame still age out instead of being pruned.
    const ids = new Set<string>(this.tipTrails.keys());
    for (const id of present.keys()) ids.add(id);

    for (const id of ids) {
      const tip = present.get(id);
      if (!tip) {
        // Emitter absent/disabled this frame. Preserve trail data so the ribbon
        // keeps rendering from existing samples and fades out naturally via
        // lifetimeSeconds; only delete the Map entry once empty. Clear
        // lastTipPos so speed isn't computed against a stale pos.
        const trail = this.tipTrails.get(id);
        if (trail) {
          const cutoff = this.time - params.lifetimeSeconds;
          while (trail.length > 0 && trail[0]!.t < cutoff) trail.shift();
          if (trail.length === 0) {
            this.tipTrails.delete(id);
          }
        }
        this.lastTipPos.delete(id);
        continue;
      }

      let trail = this.tipTrails.get(id);
      if (!trail) {
        trail = [];
        this.tipTrails.set(id, trail);
      }

      if (loopDetected) {
        // On a seamless loop boundary, the tip position teleports from
        // end-of-sequence back to start. Skip recording this frame's sample
        // to avoid a velocity spike and visible ribbon discontinuity.
        // Update lastTipPos so the next frame computes speed normally.
        this.lastTipPos.set(id, { x: tip.x, y: tip.y });
        continue;
      }

      const last = this.lastTipPos.get(id);
      let speed = 0;
      if (last && dt > 0) {
        speed = Math.hypot(tip.x - last.x, tip.y - last.y) / dt;
        speed /= 60 * scale;
      }

      trail.push({ x: tip.x, y: tip.y, t: this.time, speed });
      const cutoff = this.time - params.lifetimeSeconds;
      while (trail.length > 0 && trail[0]!.t < cutoff) trail.shift();
      if (trail.length > MAX_SAMPLES) trail.splice(0, trail.length - MAX_SAMPLES);

      if (last) {
        last.x = tip.x;
        last.y = tip.y;
      } else {
        this.lastTipPos.set(id, { x: tip.x, y: tip.y });
      }
    }

    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const trail of this.tipTrails.values()) {
        if (trail.length < 3) continue;
        this.drawRibbon(ctx, params, trail, scale);
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private drawRibbon(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    trail: RibbonSample[],
    scale: number,
  ): void {
    const n = trail.length;
    const leftX: number[] = new Array(n);
    const leftY: number[] = new Array(n);
    const rightX: number[] = new Array(n);
    const rightY: number[] = new Array(n);
    const halfWidths: number[] = new Array(n);

    for (let i = 0; i < n; i++) {
      const s = trail[i]!;
      const prev = trail[Math.max(0, i - 1)]!;
      const next = trail[Math.min(n - 1, i + 1)]!;
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tLen = Math.hypot(tx, ty);
      if (tLen > 0.001) {
        tx /= tLen;
        ty /= tLen;
      }

      const px = -ty;
      const py = tx;

      const speedFrac = Math.min(
        1,
        params.motionReferenceSpeed > 0 ? s.speed / params.motionReferenceSpeed : 0,
      );
      let hw =
        params.baseHalfWidth * scale * params.intensity * (1 - speedFrac * params.tautness);
      if (hw < 1) hw = 1;
      halfWidths[i] = hw;

      const freqMul = 0.5 + speedFrac * 1.5;
      const f1 = Math.sin(i * 0.3 * freqMul + this.time * 4.0) * params.flutter * 8 * scale;
      const f2 = Math.sin(i * 0.17 * freqMul + this.time * 2.3) * params.flutter * 5 * scale;
      const flutter = f1 + f2;

      leftX[i] = s.x + px * (hw + flutter);
      leftY[i] = s.y + py * (hw + flutter);
      rightX[i] = s.x - px * (hw + flutter);
      rightY[i] = s.y - py * (hw + flutter);
    }

    const pal = params.resolvedPalette;
    const lifetime = params.lifetimeSeconds;
    const now = this.time;

    for (let seg = 0; seg < SEGMENTS; seg++) {
      const iStart = Math.floor((seg * (n - 1)) / SEGMENTS);
      const iEnd = Math.floor(((seg + 1) * (n - 1)) / SEGMENTS);
      if (iEnd - iStart < 2) continue;

      const midIdx = (iStart + iEnd) >> 1;
      const midAge = now - trail[midIdx]!.t;
      const ageFrac = Math.min(1, midAge / lifetime);
      const segAlpha = 1 - ageFrac * ageFrac;
      if (segAlpha <= 0.01) continue;

      const posFrac = midIdx / (n - 1);
      const bodyColor =
        pal.hueShift && pal.bodyAlt ? lerpHex(pal.body, pal.bodyAlt, posFrac) : pal.body;
      const edgeColor =
        pal.hueShift && pal.edgeAlt ? lerpHex(pal.edge, pal.edgeAlt, posFrac) : pal.edge;

      // Layer 0: Ember aura glow (emissive only)
      if (pal.emissive) {
        ctx.globalAlpha = segAlpha * 0.15 * params.intensity;
        for (let i = iStart; i <= iEnd; i += AURA_STRIDE) {
          const s = trail[i]!;
          const radius = halfWidths[i]! * 3;
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius);
          grad.addColorStop(0, edgeColor);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, TAU);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Layer 1: Glow underpaint - thick soft stroke along spine
      ctx.globalAlpha = segAlpha * 0.15 * params.intensity;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = params.baseHalfWidth * scale * 2.5;
      ctx.beginPath();
      this.traceSpine(ctx, leftX, leftY, rightX, rightY, iStart, iEnd, n);
      ctx.stroke();

      // Layer 2: Body fill - closed polygon with Catmull-Rom edges
      ctx.globalAlpha = segAlpha * 0.7 * params.intensity;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      this.traceForward(ctx, leftX, leftY, iStart, iEnd, n);
      this.traceBackward(ctx, rightX, rightY, iStart, iEnd, n);
      ctx.closePath();
      ctx.fill();

      // Layer 3: Sheen highlight - thin Catmull-Rom stroke, left edge only
      ctx.globalAlpha = segAlpha * 0.3 * params.intensity;
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      this.traceForward(ctx, leftX, leftY, iStart, iEnd, n);
      ctx.stroke();
    }
  }

  /** Catmull-Rom spline along spine (midpoint of left/right edges). */
  private traceSpine(
    ctx: CanvasRenderingContext2D,
    lx: number[],
    ly: number[],
    rx: number[],
    ry: number[],
    start: number,
    end: number,
    n: number,
  ): void {
    ctx.moveTo((lx[start]! + rx[start]!) / 2, (ly[start]! + ry[start]!) / 2);
    for (let i = start + 1; i <= end; i++) {
      const i0 = Math.max(0, i - 2);
      const i1 = i - 1;
      const i3 = Math.min(n - 1, i + 1);
      const sx = (k: number) => (lx[k]! + rx[k]!) / 2;
      const sy = (k: number) => (ly[k]! + ry[k]!) / 2;
      ctx.bezierCurveTo(
        sx(i1) + (sx(i) - sx(i0)) / 6,
        sy(i1) + (sy(i) - sy(i0)) / 6,
        sx(i) - (sx(i3) - sx(i1)) / 6,
        sy(i) - (sy(i3) - sy(i1)) / 6,
        sx(i),
        sy(i),
      );
    }
  }

  /** Catmull-Rom spline forward through edge array. Starts with moveTo. */
  private traceForward(
    ctx: CanvasRenderingContext2D,
    x: number[],
    y: number[],
    start: number,
    end: number,
    n: number,
  ): void {
    ctx.moveTo(x[start]!, y[start]!);
    for (let i = start + 1; i <= end; i++) {
      const i0 = Math.max(0, i - 2);
      const i1 = i - 1;
      const i3 = Math.min(n - 1, i + 1);
      ctx.bezierCurveTo(
        x[i1]! + (x[i]! - x[i0]!) / 6,
        y[i1]! + (y[i]! - y[i0]!) / 6,
        x[i]! - (x[i3]! - x[i1]!) / 6,
        y[i]! - (y[i3]! - y[i1]!) / 6,
        x[i]!,
        y[i]!,
      );
    }
  }

  /** Catmull-Rom spline backward through edge array. Continues current path (no moveTo). */
  private traceBackward(
    ctx: CanvasRenderingContext2D,
    x: number[],
    y: number[],
    start: number,
    end: number,
    n: number,
  ): void {
    ctx.lineTo(x[end]!, y[end]!);
    for (let i = end - 1; i >= start; i--) {
      const i0 = Math.min(n - 1, i + 2);
      const i1 = i + 1;
      const i3 = Math.max(0, i - 1);
      ctx.bezierCurveTo(
        x[i1]! + (x[i]! - x[i0]!) / 6,
        y[i1]! + (y[i]! - y[i0]!) / 6,
        x[i]! - (x[i3]! - x[i1]!) / 6,
        y[i]! - (y[i3]! - y[i1]!) / 6,
        x[i]!,
        y[i]!,
      );
    }
  }

  private isEndEnabled(end: "A" | "B", params: Silk2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.tipTrails.clear();
    this.lastTipPos.clear();
    this.time = 0;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace(/^#/, "");
  const norm =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s.slice(0, 6);
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
