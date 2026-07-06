import type { Silk2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";
import { traceForward, traceBackward } from "./ribbon-trace";

interface RibbonSample {
  x: number;
  y: number;
  t: number;
  speed: number;
}

type Vec2 = { x: number; y: number };

const MAX_SAMPLES = 300;
const SEGMENTS = 16;
const AURA_STRIDE = 8;
const TAU = Math.PI * 2;

// Serpent form: the travelling undulation wave.
const SERPENT_WAVENUMBER = 0.045;
const SERPENT_SLITHER_SPEED = 3.2;
const WHISKER_NODES = 6;

export class Silk2DRenderer {
  private time = 0;
  private tipTrails = new Map<string, RibbonSample[]>();
  private lastTipPos = new Map<string, { x: number; y: number }>();
  // Serpent form: per-emitter fixed-length spine + dragon whisker sub-chains.
  private serpentChains = new Map<string, Vec2[]>();
  private whiskerChains = new Map<string, [Vec2[], Vec2[]]>();

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

    if (params.form === "serpent") {
      this.renderSerpent(ctx, params, present, scale, loopDetected);
      return;
    }
    // Switching back to ribbon — drop any serpent spine state so it can't ghost.
    if (this.serpentChains.size > 0) this.serpentChains.clear();
    if (this.whiskerChains.size > 0) this.whiskerChains.clear();

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
      traceForward(ctx, leftX, leftY, iStart, iEnd, n);
      traceBackward(ctx, rightX, rightY, iStart, iEnd, n);
      ctx.closePath();
      ctx.fill();

      // Layer 3: Sheen highlight - thin Catmull-Rom stroke, left edge only
      ctx.globalAlpha = segAlpha * 0.3 * params.intensity;
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      traceForward(ctx, leftX, leftY, iStart, iEnd, n);
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

  // ── Serpent form ──────────────────────────────────────────────────────────

  /**
   * Fixed-length creature whose head is the prop tip. Each tracked emitter owns
   * a chain of spine nodes held at a constant inter-node distance (a classic
   * distance-constraint / follow-the-leader chain), so the body length is fixed
   * even when the prop stops. A travelling sine wave applied at render time
   * undulates the body (the wag), ramped to zero at the head so it stays pinned
   * to the prop.
   */
  private renderSerpent(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    present: Map<string, EmitterTip>,
    scale: number,
    loopDetected: boolean,
  ): void {
    const N = params.segmentCount;
    const segLen = (params.bodyLengthPx * scale) / (N - 1);

    // No lifetime fade: a chain whose head left the frame is gone immediately.
    for (const id of [...this.serpentChains.keys()]) {
      if (!present.has(id)) {
        this.serpentChains.delete(id);
        this.whiskerChains.delete(id);
      }
    }

    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const [id, tip] of present) {
        let chain = this.serpentChains.get(id);
        if (!chain) {
          chain = new Array<Vec2>(N);
          for (let i = 0; i < N; i++) chain[i] = { x: tip.x, y: tip.y + segLen * i };
          this.serpentChains.set(id, chain);
        }

        if (loopDetected) {
          // Tip teleports at the loop seam — snap the body straight behind the
          // head along its heading so it doesn't whip across the canvas.
          let hx = chain[0]!.x - chain[1]!.x;
          let hy = chain[0]!.y - chain[1]!.y;
          const hl = Math.hypot(hx, hy) || 1;
          hx /= hl;
          hy /= hl;
          for (let i = 0; i < N; i++) {
            chain[i]!.x = tip.x - hx * segLen * i;
            chain[i]!.y = tip.y - hy * segLen * i;
          }
          continue;
        }

        // Head rides the prop tip; body follows via per-node distance clamps.
        chain[0]!.x = tip.x;
        chain[0]!.y = tip.y;
        for (let i = 1; i < N; i++) {
          const prev = chain[i - 1]!;
          const cur = chain[i]!;
          const dx = cur.x - prev.x;
          const dy = cur.y - prev.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.0001) {
            const k = segLen / d;
            cur.x = prev.x + dx * k;
            cur.y = prev.y + dy * k;
          } else {
            cur.x = prev.x;
            cur.y = prev.y + segLen;
          }
        }

        this.drawSerpent(ctx, params, chain, segLen, scale, id);
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private drawSerpent(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    chain: Vec2[],
    segLen: number,
    scale: number,
    id: string,
  ): void {
    const N = chain.length;
    const pal = params.resolvedPalette;
    const baseHalf = params.baseHalfWidth * scale * params.intensity;
    const ampPx = params.slitherAmpPx * scale;

    // Cumulative arc-length along the rigid chain (drives the travelling wave).
    const s = new Array<number>(N);
    s[0] = 0;
    for (let i = 1; i < N; i++) {
      s[i] = s[i - 1]! + Math.hypot(chain[i]!.x - chain[i - 1]!.x, chain[i]!.y - chain[i - 1]!.y);
    }

    // Pass 1: slithered centreline. Head (i=0) gets zero wave so it stays pinned
    // to the prop tip; amplitude ramps toward the tail so the tail wags most.
    const cx = new Array<number>(N);
    const cy = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      const prev = chain[Math.max(0, i - 1)]!;
      const next = chain[Math.min(N - 1, i + 1)]!;
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const ramp = Math.pow(i / (N - 1), 1.3);
      const wave =
        Math.sin(SERPENT_WAVENUMBER * s[i]! - SERPENT_SLITHER_SPEED * this.time) * ampPx * ramp;
      cx[i] = chain[i]!.x + -ty * wave;
      cy[i] = chain[i]!.y + tx * wave;
    }

    // Pass 2: edges from the slithered centreline + the tapered width profile.
    const leftX = new Array<number>(N);
    const leftY = new Array<number>(N);
    const rightX = new Array<number>(N);
    const rightY = new Array<number>(N);
    const nx = new Array<number>(N);
    const ny = new Array<number>(N);
    const hw = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      let tx = cx[Math.min(N - 1, i + 1)]! - cx[Math.max(0, i - 1)]!;
      let ty = cy[Math.min(N - 1, i + 1)]! - cy[Math.max(0, i - 1)]!;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const normalX = -ty;
      const normalY = tx;
      const half = baseHalf * serpentWidth(i / (N - 1));
      nx[i] = normalX;
      ny[i] = normalY;
      hw[i] = half;
      leftX[i] = cx[i]! + normalX * half;
      leftY[i] = cy[i]! + normalY * half;
      rightX[i] = cx[i]! - normalX * half;
      rightY[i] = cy[i]! - normalY * half;
    }

    // Dragon dorsal crest sits under the body fill edge — draw first so the
    // spikes emerge from beneath the back.
    if (params.creature === "dragon") {
      this.drawDorsalCrest(ctx, params, cx, cy, nx, ny, hw);
    }

    // Layer A: emissive aura (ember / spirit palettes only).
    if (pal.emissive) {
      ctx.globalAlpha = 0.12 * params.intensity;
      for (let i = 0; i < N; i += AURA_STRIDE) {
        const r = hw[i]! * 3 + 2;
        const grad = ctx.createRadialGradient(cx[i]!, cy[i]!, 0, cx[i]!, cy[i]!, r);
        grad.addColorStop(0, pal.edge);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(cx[i]!, cy[i]!, r, 0, TAU);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Layer B: soft underpaint glow along the spine.
    ctx.globalAlpha = 0.18 * params.intensity;
    ctx.strokeStyle = pal.body;
    ctx.lineWidth = baseHalf * 2.0;
    ctx.beginPath();
    traceForward(ctx, cx, cy, 0, N - 1, N);
    ctx.stroke();

    // Layer C: body fill — closed Catmull-Rom polygon. hueShift palettes
    // (spirit) grade body→bodyAlt from head to tail.
    ctx.globalAlpha = 0.92 * params.intensity;
    if (pal.hueShift && pal.bodyAlt) {
      const grad = ctx.createLinearGradient(cx[0]!, cy[0]!, cx[N - 1]!, cy[N - 1]!);
      grad.addColorStop(0, pal.body);
      grad.addColorStop(1, pal.bodyAlt);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = pal.body;
    }
    ctx.beginPath();
    traceForward(ctx, leftX, leftY, 0, N - 1, N);
    traceBackward(ctx, rightX, rightY, 0, N - 1, N);
    ctx.closePath();
    ctx.fill();

    // Layer D: sheen highlight down the back edge.
    ctx.globalAlpha = 0.32 * params.intensity;
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    traceForward(ctx, leftX, leftY, 0, N - 1, N);
    ctx.stroke();

    if (params.creature === "dragon") {
      this.drawWhiskers(ctx, params, chain, baseHalf, scale, id);
    }
    this.drawSerpentHead(ctx, params, cx, cy, baseHalf, scale, id);
  }

  /** Dragon dorsal crest — sawtooth spikes along the back ("+normal") side. */
  private drawDorsalCrest(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    cx: number[],
    cy: number[],
    nx: number[],
    ny: number[],
    hw: number[],
  ): void {
    const pal = params.resolvedPalette;
    const N = cx.length;
    ctx.globalAlpha = 0.9 * params.intensity;
    ctx.fillStyle = pal.edge;
    for (let i = 3; i < N - 2; i += 3) {
      const h = hw[i]!;
      if (h < 1) continue;
      const baseAx = cx[i - 1]! + nx[i - 1]! * hw[i - 1]!;
      const baseAy = cy[i - 1]! + ny[i - 1]! * hw[i - 1]!;
      const baseBx = cx[i + 1]! + nx[i + 1]! * hw[i + 1]!;
      const baseBy = cy[i + 1]! + ny[i + 1]! * hw[i + 1]!;
      const spikeH = h * 1.3;
      const tipX = cx[i]! + nx[i]! * (h + spikeH);
      const tipY = cy[i]! + ny[i]! * (h + spikeH);
      ctx.beginPath();
      ctx.moveTo(baseAx, baseAy);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseBx, baseBy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Dragon whiskers — two thin lag sub-chains streaming from the snout. */
  private drawWhiskers(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    chain: Vec2[],
    baseHalf: number,
    scale: number,
    id: string,
  ): void {
    const pal = params.resolvedPalette;
    let hx = chain[0]!.x - chain[1]!.x;
    let hy = chain[0]!.y - chain[1]!.y;
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl;
    hy /= hl;
    const perpX = -hy;
    const perpY = hx;
    const headR = baseHalf * 1.5 + 2 * scale;
    const segLenW = headR * 0.55;

    let pair = this.whiskerChains.get(id);
    if (!pair) {
      pair = [new Array<Vec2>(WHISKER_NODES), new Array<Vec2>(WHISKER_NODES)] as [Vec2[], Vec2[]];
      for (let w = 0; w < 2; w++) {
        for (let i = 0; i < WHISKER_NODES; i++) pair[w]![i] = { x: chain[0]!.x, y: chain[0]!.y };
      }
      this.whiskerChains.set(id, pair);
    }

    ctx.globalAlpha = 0.85 * params.intensity;
    ctx.strokeStyle = pal.edge;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, headR * 0.16);
    for (let w = 0; w < 2; w++) {
      const side = w === 0 ? -1 : 1;
      const whisk = pair[w]!;
      whisk[0]!.x = chain[0]!.x + hx * headR * 1.0 + perpX * side * headR * 0.5;
      whisk[0]!.y = chain[0]!.y + hy * headR * 1.0 + perpY * side * headR * 0.5;
      for (let i = 1; i < WHISKER_NODES; i++) {
        const prev = whisk[i - 1]!;
        const cur = whisk[i]!;
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.0001) {
          const k = segLenW / d;
          cur.x = prev.x + dx * k;
          cur.y = prev.y + dy * k;
        } else {
          cur.x = prev.x - hx * segLenW;
          cur.y = prev.y - hy * segLenW;
        }
      }
      ctx.beginPath();
      ctx.moveTo(whisk[0]!.x, whisk[0]!.y);
      for (let i = 1; i < WHISKER_NODES; i++) ctx.lineTo(whisk[i]!.x, whisk[i]!.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Head cap + eyes, plus snake tongue / dragon horns. */
  private drawSerpentHead(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    cx: number[],
    cy: number[],
    baseHalf: number,
    scale: number,
    id: string,
  ): void {
    const pal = params.resolvedPalette;
    // Heading from the first two slithered centreline points so the head aligns
    // with the visible neck.
    let hx = cx[0]! - cx[1]!;
    let hy = cy[0]! - cy[1]!;
    const hl = Math.hypot(hx, hy) || 1;
    hx /= hl;
    hy /= hl;
    const perpX = -hy;
    const perpY = hx;

    const headR = baseHalf * 1.5 + 2 * scale;
    const headCx = cx[0]! + hx * headR * 0.2;
    const headCy = cy[0]! + hy * headR * 0.2;

    // Dragon horns behind the head fill.
    if (params.creature === "dragon") {
      ctx.globalAlpha = 0.95 * params.intensity;
      ctx.strokeStyle = pal.edge;
      ctx.lineCap = "round";
      ctx.lineWidth = headR * 0.5;
      for (const side of [-1, 1]) {
        const bx = headCx - hx * headR * 0.3 + perpX * side * headR * 0.55;
        const by = headCy - hy * headR * 0.3 + perpY * side * headR * 0.55;
        const mx = bx - hx * headR * 0.7 + perpX * side * headR * 0.2;
        const my = by - hy * headR * 0.7 + perpY * side * headR * 0.2;
        const ex = bx - hx * headR * 1.5 + perpX * side * headR * 0.7;
        const ey = by - hy * headR * 1.5 + perpY * side * headR * 0.7;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }
    }

    // Head fill — rounded, slightly elongated along the heading.
    ctx.globalAlpha = 0.96 * params.intensity;
    ctx.save();
    ctx.translate(headCx, headCy);
    ctx.rotate(Math.atan2(hy, hx));
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 1.25, headR * 0.95, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.3 * params.intensity;
    ctx.fillStyle = pal.edge;
    ctx.beginPath();
    ctx.ellipse(headR * 0.2, -headR * 0.3, headR * 0.6, headR * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Eyes.
    ctx.globalAlpha = 1;
    const eyeFwd = headR * 0.35;
    const eyePerp = headR * 0.5;
    const eyeR = headR * 0.3;
    for (const side of [-1, 1]) {
      const ex = headCx + hx * eyeFwd + perpX * side * eyePerp;
      const ey = headCy + hy * eyeFwd + perpY * side * eyePerp;
      ctx.fillStyle = "#fdfdf5";
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#101014";
      ctx.beginPath();
      ctx.arc(ex + hx * eyeR * 0.2, ey + hy * eyeR * 0.2, eyeR * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(ex - perpX * side * eyeR * 0.25, ey - perpY * side * eyeR * 0.25, eyeR * 0.2, 0, TAU);
      ctx.fill();
    }

    // Snake tongue flick — extends then retracts on a per-serpent-desynced timer.
    if (params.creature === "snake") {
      const period = 3.0;
      const dur = 0.5;
      const phase = (this.time + hashPhase(id) * period) % period;
      if (phase < dur) {
        const ext = Math.sin((phase / dur) * Math.PI) * headR * 2.0;
        if (ext > 0.5) {
          const rootX = headCx + hx * headR * 1.15;
          const rootY = headCy + hy * headR * 1.15;
          const forkX = rootX + hx * ext * 0.65;
          const forkY = rootY + hy * ext * 0.65;
          const tipX = rootX + hx * ext;
          const tipY = rootY + hy * ext;
          const spread = headR * 0.4;
          ctx.globalAlpha = 0.95 * params.intensity;
          ctx.strokeStyle = "#e0306a";
          ctx.lineWidth = Math.max(1.2, headR * 0.18);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(rootX, rootY);
          ctx.lineTo(forkX, forkY);
          ctx.moveTo(forkX, forkY);
          ctx.lineTo(tipX + perpX * spread, tipY + perpY * spread);
          ctx.moveTo(forkX, forkY);
          ctx.lineTo(tipX - perpX * spread, tipY - perpY * spread);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private isEndEnabled(end: "A" | "B", params: Silk2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.tipTrails.clear();
    this.lastTipPos.clear();
    this.serpentChains.clear();
    this.whiskerChains.clear();
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

/**
 * Serpent half-width profile along the body. u = 0 (head) → 1 (tail). Narrow
 * snout ramps to a full-width neck by u≈0.06, then tapers smoothly to a point.
 */
function serpentWidth(u: number): number {
  if (u < 0.06) return 0.35 + (u / 0.06) * 0.65;
  const t = (u - 0.06) / 0.94;
  return Math.max(0, 1 - t * t);
}

/** Stable 0-1 hash of an emitter id, used to desync per-serpent tongue flicks. */
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}
