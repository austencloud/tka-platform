import type { Animal2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";
import { traceForward, traceBackward } from "./ribbon-trace";

type Vec2 = { x: number; y: number };

const AURA_STRIDE = 8;
const TAU = Math.PI * 2;

// The travelling undulation wave along the creature body.
const WAVENUMBER = 0.045;
const SLITHER_SPEED = 3.2;
const WHISKER_NODES = 6;

/**
 * A fixed-length creature whose head is the prop tip. Each tracked emitter owns
 * a chain of spine nodes held at a constant inter-node distance (a classic
 * distance-constraint / follow-the-leader chain), so the body length is fixed
 * even when the prop stops. A travelling sine wave applied at render time
 * undulates the body (the wag), ramped to zero at the head so it stays pinned
 * to the prop. Creature ornaments (snake tongue, dragon crest/horns/whiskers,
 * caterpillar bands/legs/antennae) layer on top of the shared body.
 */
export class Animal2DRenderer {
  private time = 0;
  private chains = new Map<string, Vec2[]>();
  private whiskerChains = new Map<string, [Vec2[], Vec2[]]>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1,
    loopDetected: boolean = false,
  ): void {
    this.time += dt;

    const present = new Map<string, EmitterTip>();
    for (const e of emitters) {
      if (!this.isEndEnabled(e.end, params)) continue;
      present.set(emitterId(e.propIndex, e.tipIndex), e);
    }

    const N = params.segmentCount;
    const segLen = (params.bodyLengthPx * scale) / (N - 1);

    // No lifetime fade: a chain whose head left the frame is gone immediately.
    for (const id of [...this.chains.keys()]) {
      if (!present.has(id)) {
        this.chains.delete(id);
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
        let chain = this.chains.get(id);
        if (!chain) {
          chain = new Array<Vec2>(N);
          for (let i = 0; i < N; i++) chain[i] = { x: tip.x, y: tip.y + segLen * i };
          this.chains.set(id, chain);
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

        this.drawCreature(ctx, params, chain, scale, id);
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private drawCreature(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
    chain: Vec2[],
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
      const wave = Math.sin(WAVENUMBER * s[i]! - SLITHER_SPEED * this.time) * ampPx * ramp;
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
      const half = baseHalf * bodyWidth(i / (N - 1));
      nx[i] = normalX;
      ny[i] = normalY;
      hw[i] = half;
      leftX[i] = cx[i]! + normalX * half;
      leftY[i] = cy[i]! + normalY * half;
      rightX[i] = cx[i]! - normalX * half;
      rightY[i] = cy[i]! - normalY * half;
    }

    // Caterpillar legs sit under the body fill — draw first so they emerge from
    // beneath the belly.
    if (params.creature === "caterpillar") {
      this.drawCaterpillarLegs(ctx, params, cx, cy, nx, ny, hw);
    }

    // Dragon dorsal crest sits under the body fill edge — draw first so the
    // spikes emerge from beneath the back.
    if (params.creature === "dragon") {
      this.drawDorsalCrest(ctx, params, cx, cy, nx, ny, hw);
    }

    // Layer A: emissive aura (ember palette only).
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
    // (ethereal) grade body→bodyAlt from head to tail.
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

    // Caterpillar segment banding sits on top of the fill.
    if (params.creature === "caterpillar") {
      this.drawCaterpillarBands(ctx, params, cx, cy, nx, ny, hw);
    }

    if (params.creature === "dragon") {
      this.drawWhiskers(ctx, params, chain, baseHalf, scale, id);
    }
    this.drawCreatureHead(ctx, params, cx, cy, baseHalf, scale, id);
  }

  /** Dragon dorsal crest — sawtooth spikes along the back ("+normal") side. */
  private drawDorsalCrest(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
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

  /** Caterpillar walking legs — short alternating nubs below each body segment. */
  private drawCaterpillarLegs(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
    cx: number[],
    cy: number[],
    nx: number[],
    ny: number[],
    hw: number[],
  ): void {
    const pal = params.resolvedPalette;
    const N = cx.length;
    ctx.globalAlpha = 0.85 * params.intensity;
    ctx.strokeStyle = pal.edge;
    ctx.lineCap = "round";
    for (let i = 4; i < N - 2; i += 3) {
      const h = hw[i]!;
      if (h < 1.5) continue;
      const legLen = h * 0.9;
      // Walking phase: legs on alternating segments swing fore/aft.
      const swing = Math.sin(this.time * 6 + i * 0.9) * 0.35;
      ctx.lineWidth = Math.max(1, h * 0.22);
      // Tangent (approx) for the fore/aft swing.
      const tx = cx[Math.min(N - 1, i + 1)]! - cx[Math.max(0, i - 1)]!;
      const ty = cy[Math.min(N - 1, i + 1)]! - cy[Math.max(0, i - 1)]!;
      const tl = Math.hypot(tx, ty) || 1;
      for (const side of [-1, 1]) {
        const bx = cx[i]! + nx[i]! * side * h;
        const by = cy[i]! + ny[i]! * side * h;
        const ex = bx + nx[i]! * side * legLen + (tx / tl) * legLen * swing;
        const ey = by + ny[i]! * side * legLen + (ty / tl) * legLen * swing;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Caterpillar segment banding — cross-body rings that read as body segments. */
  private drawCaterpillarBands(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
    cx: number[],
    cy: number[],
    nx: number[],
    ny: number[],
    hw: number[],
  ): void {
    const pal = params.resolvedPalette;
    const N = cx.length;
    ctx.globalAlpha = 0.28 * params.intensity;
    ctx.strokeStyle = pal.edge;
    ctx.lineCap = "round";
    for (let i = 4; i < N - 2; i += 3) {
      const h = hw[i]!;
      if (h < 1) continue;
      ctx.lineWidth = Math.max(1, h * 0.4);
      ctx.beginPath();
      ctx.moveTo(cx[i]! + nx[i]! * h, cy[i]! + ny[i]! * h);
      ctx.lineTo(cx[i]! - nx[i]! * h, cy[i]! - ny[i]! * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Dragon whiskers — two thin lag sub-chains streaming from the snout. */
  private drawWhiskers(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
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

  /** Head cap + eyes, plus snake tongue / dragon horns / caterpillar antennae. */
  private drawCreatureHead(
    ctx: CanvasRenderingContext2D,
    params: Animal2DParams,
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

    // Caterpillar antennae — two forward-curling feelers with knob tips.
    if (params.creature === "caterpillar") {
      ctx.globalAlpha = 0.9 * params.intensity;
      ctx.strokeStyle = pal.edge;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, headR * 0.18);
      for (const side of [-1, 1]) {
        const bx = headCx + hx * headR * 0.4 + perpX * side * headR * 0.35;
        const by = headCy + hy * headR * 0.4 + perpY * side * headR * 0.35;
        const ex = bx + hx * headR * 1.1 + perpX * side * headR * 0.6;
        const ey = by + hy * headR * 1.1 + perpY * side * headR * 0.6;
        const cxp = bx + hx * headR * 0.6 + perpX * side * headR * 0.9;
        const cyp = by + hy * headR * 0.6 + perpY * side * headR * 0.9;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cxp, cyp, ex, ey);
        ctx.stroke();
        ctx.fillStyle = pal.edge;
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(1.2, headR * 0.16), 0, TAU);
        ctx.fill();
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

    // Snake tongue flick — extends then retracts on a per-creature-desynced timer.
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

  private isEndEnabled(end: "A" | "B", params: Animal2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.chains.clear();
    this.whiskerChains.clear();
    this.time = 0;
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

/**
 * Body half-width profile along the creature. u = 0 (head) → 1 (tail). Narrow
 * snout ramps to a full-width neck by u≈0.06, then tapers smoothly to a point.
 */
function bodyWidth(u: number): number {
  if (u < 0.06) return 0.35 + (u / 0.06) * 0.65;
  const t = (u - 0.06) / 0.94;
  return Math.max(0, 1 - t * t);
}

/** Stable 0-1 hash of an emitter id, used to desync per-creature tongue flicks. */
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}
