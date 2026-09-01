import type { Zap2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

type Pt = { x: number; y: number };

/** px/frame tip speed that maps to full discharge energy. */
const REF_SPEED = 18;

/**
 * One discharge circuit: a bolt arcs between the left prop's end (A) and the
 * matching right prop's same end (B). Base props pair left 0 ↔ right 1; tunnel
 * layers pair blue `2li` ↔ red `2li+1` at the same end, so every kaleidoscope
 * copy gets its own bolt.
 */
interface ZapBolt {
  A: Pt;
  B: Pt;
  energy: number;
}

/** One discharge node (a single tip) for the web mesh + terminal glows. */
interface ZapNode {
  p: Pt;
  isLeft: boolean;
  speed: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Electric-discharge renderer for the Canvas2D backend. Three selectable styles
 * via `params.style`, all reacting to per-frame tip velocity (energy ∝ speed -
 * faster spinning means brighter, branchier, more frequent discharge):
 *
 *   - "branching": forking storm bolts between each blue↔red tip pair, with a
 *     stepped-leader white core, colored corona, multi-strike flicker, and
 *     speed-driven forks. The default.
 *   - "plasma": thick sustained wobbling plasma conduits + a pool of sputter
 *     sparks shedding off the arc (Tesla-coil look).
 *   - "web": a live mesh across every visible tip with charge pulses travelling
 *     the edges; same-prop edges in that prop's color, cross-prop in violet.
 *
 * Geometry is regenerated fresh every frame anchored to the current tip
 * positions (the old renderer cached arcs for several frames and visibly lagged
 * moving props). Math.random drives jitter/flicker, matching the old behavior -
 * zap was never frame-deterministic.
 */
export class Zap2DRenderer {
  private frameCount = 0;
  private prevTip = new Map<string, Pt>();
  private sparks: Spark[] = [];
  private static readonly MAX_SPARKS = 400;
  private webPulse = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    emitters: EmitterTip[],
    scale: number = 1
  ): void {
    this.frameCount++;

    // Per-emitter speed (px/frame) from the previous frame's positions. Read
    // before prevTip is updated so velocity reflects the step into this frame.
    const speed = new Map<string, number>();
    for (const e of emitters) {
      speed.set(
        emitterId(e.propIndex, e.tipIndex),
        this.speedOf(emitterId(e.propIndex, e.tipIndex), e)
      );
    }

    // Build the circuit bolts: blue prop end ↔ red prop same-end, per family
    // layer (familyLayer = floor(propIndex/2)). Covers base + every layer.
    const byKey = new Map<string, EmitterTip>();
    for (const e of emitters) byKey.set(`${e.propIndex}:${e.tipIndex}`, e);
    const bolts: ZapBolt[] = [];
    for (const e of emitters) {
      if (e.propIndex % 2 !== 0) continue; // blue side drives the pairing
      const red = byKey.get(`${e.propIndex + 1}:${e.tipIndex}`);
      if (!red) continue;
      const sa = speed.get(emitterId(e.propIndex, e.tipIndex)) ?? 0;
      const sb = speed.get(emitterId(red.propIndex, red.tipIndex)) ?? 0;
      bolts.push({
        A: { x: e.x, y: e.y },
        B: { x: red.x, y: red.y },
        energy: clamp01((sa + sb) / (2 * REF_SPEED)),
      });
    }

    const nodes: ZapNode[] = emitters.map((e) => ({
      p: { x: e.x, y: e.y },
      isLeft: e.propIndex % 2 === 0,
      speed: speed.get(emitterId(e.propIndex, e.tipIndex)) ?? 0,
    }));

    const style = params.style ?? "branching";
    if (style === "plasma") {
      this.drawPlasma(ctx, params, bolts, scale);
    } else if (style === "web") {
      this.drawWeb(ctx, params, nodes, scale);
    } else {
      this.drawBranching(ctx, params, bolts, scale);
    }

    // Remember positions for next frame's velocity; prune vanished emitters.
    const seen = new Set<string>();
    for (const e of emitters) {
      const id = emitterId(e.propIndex, e.tipIndex);
      seen.add(id);
      this.prevTip.set(id, { x: e.x, y: e.y });
    }
    for (const id of this.prevTip.keys())
      if (!seen.has(id)) this.prevTip.delete(id);
  }

  dispose(): void {
    this.frameCount = 0;
    this.prevTip.clear();
    this.sparks = [];
    this.webPulse = 0;
  }

  private speedOf(id: string, p: Pt): number {
    const prev = this.prevTip.get(id);
    return prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
  }

  // ── Style ①: branching storm lightning ─────────────────────────────

  private drawBranching(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    bolts: ZapBolt[],
    scale: number
  ): void {
    // Strike flicker: bolts fire bright in a window each `regenEvery` frames,
    // dim between. Higher frequency = shorter gaps = more strobing.
    const regenEvery = Math.max(
      1,
      Math.round(60 / Math.max(0.1, params.frequency))
    );
    const inStrike =
      this.frameCount % regenEvery < Math.max(1, regenEvery * 0.4);
    const strike = inStrike ? 1 : 0.35;
    // Path-roughness factor: jitter 0.5 ≈ the original look, 0 = nearly straight,
    // 1 = wild forks.
    const jf = 0.35 + params.jitter * 1.3;

    for (const bolt of bolts) {
      const { A, B, energy } = bolt;
      const dist = Math.hypot(B.x - A.x, B.y - A.y);
      const strikes = 1 + Math.round(energy * 2); // multi-strike on fast swings
      const grad = this.pairGradient(ctx, A, B, params);

      for (let s = 0; s < strikes; s++) {
        const alpha = clamp01(params.intensity * strike * rnd(0.7, 1));
        const pts: Pt[] = [{ x: A.x, y: A.y }];
        this.jag(A, B, Math.min(dist * 0.28, 70) * jf, pts);
        this.strokeBolt(
          ctx,
          pts,
          params.lineWidth,
          params.glowBlur,
          params.leftColor,
          grad,
          alpha,
          scale
        );

        // Forks: count from the branching param plus motion energy.
        const branches = Math.round(params.branching * 3 + energy * 3);
        for (let k = 0; k < branches; k++) {
          const idx = 1 + ((Math.random() * (pts.length - 2)) | 0);
          const o = pts[idx] ?? pts[0]!;
          const ang = Math.atan2(o.y - A.y, o.x - A.x) + rnd(-0.9, 0.9);
          const len = dist * rnd(0.12, 0.32);
          const end = {
            x: o.x + Math.cos(ang) * len,
            y: o.y + Math.sin(ang) * len,
          };
          const bp: Pt[] = [{ x: o.x, y: o.y }];
          this.jag(o, end, Math.min(len * 0.3, 28) * jf, bp);
          this.strokeBolt(
            ctx,
            bp,
            params.lineWidth * 0.6,
            params.glowBlur * 0.7,
            params.leftColor,
            grad,
            alpha * 0.6,
            scale
          );
        }
      }

      this.terminal(ctx, A, params.leftColor, scale);
      this.terminal(ctx, B, params.rightColor, scale);
    }
  }

  // ── Style ②: Tesla-coil plasma ──────────────────────────────────────

  private drawPlasma(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    bolts: ZapBolt[],
    scale: number
  ): void {
    // Smooth temporal phase (frame-driven). wobbleRate maps 0..1 → calm..lively;
    // even at 1 it's a controlled undulation, never the old per-frame strobe.
    const tBase = this.frameCount * (0.02 + params.wobbleRate * 0.22);

    for (let bi = 0; bi < bolts.length; bi++) {
      const { A, B, energy } = bolts[bi]!;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = -dy / len; // unit vector perpendicular to the bolt axis
      const perpY = dx / len;
      const midX = (A.x + B.x) / 2;
      const midY = (A.y + B.y) / 2;
      const amp = params.wobbleAmount * (10 + energy * 26) * scale;

      // 3 overlapping wobbling conduits: bright white core + colored sheaths.
      for (let layer = 0; layer < 3; layer++) {
        // Per-bolt + per-layer phase offsets so bolts decorrelate and the three
        // conduits braid rather than overlap. Bow is a smooth two-octave sine
        // displaced perpendicular to the axis; jitter feeds the crackle octave.
        const phase = tBase + bi * 1.7 + layer * 2.3;
        const bow =
          Math.sin(phase) * amp +
          Math.sin(phase * 1.9 + 0.6) * amp * 0.35 * (0.5 + params.jitter);
        const mx = midX + perpX * bow;
        const my = midY + perpY * bow;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = (params.glowBlur * 2 - layer * 8) * scale;
        // A is always the blue-prop end of the bolt → leftColor sheath.
        ctx.shadowColor = layer === 0 ? "#cfe0ff" : params.leftColor;
        ctx.strokeStyle = layer === 0 ? "#ffffff" : ctx.shadowColor;
        ctx.globalAlpha = (layer === 0 ? 0.9 : 0.45) * params.intensity;
        ctx.lineWidth =
          (layer === 0
            ? params.lineWidth * 1.6
            : params.lineWidth * (5 - layer)) * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(mx, my, B.x, B.y);
        ctx.stroke();
        ctx.restore();
      }

      // Shed sputter sparks along the conduit (denser at high energy).
      const n = 1 + Math.round(energy * 4);
      for (let i = 0; i < n; i++) {
        if (this.sparks.length >= Zap2DRenderer.MAX_SPARKS) break;
        const f = Math.random();
        this.sparks.push({
          x: A.x + (B.x - A.x) * f,
          y: A.y + (B.y - A.y) * f,
          vx: rnd(-2, 2) * scale,
          vy: rnd(-2.5, 1) * scale,
          life: 1,
          color: i % 2 === 0 ? params.leftColor : params.rightColor,
        });
      }

      this.terminal(ctx, A, params.leftColor, scale);
      this.terminal(ctx, B, params.rightColor, scale);
    }

    this.updateSparks(ctx, scale);
  }

  private updateSparks(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.12 * scale; // gravity
      s.life -= 0.05;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255,255,255,${clamp01(s.life)})`;
      ctx.shadowBlur = 8 * scale;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Style ③: electric web / field ───────────────────────────────────

  private drawWeb(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    nodes: ZapNode[],
    scale: number
  ): void {
    const maxSpeed = nodes.reduce((m, n) => Math.max(m, n.speed), 0);
    const energy = clamp01(maxSpeed / REF_SPEED);
    this.webPulse = (this.webPulse + 0.012 + energy * 0.03) % 1;
    const jf = 0.35 + params.jitter * 1.3; // edge-roughness, jitter 0.5 ≈ original

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i]!.p;
        const B = nodes[j]!.p;
        const dist = Math.hypot(B.x - A.x, B.y - A.y);

        const sameProp = nodes[i]!.isLeft === nodes[j]!.isLeft;
        const col = sameProp
          ? nodes[i]!.isLeft
            ? params.leftColor
            : params.rightColor
          : "#9d7bff";

        const pts: Pt[] = [{ x: A.x, y: A.y }];
        this.jag(A, B, Math.min(dist * 0.18, 34) * jf, pts);
        const width = sameProp
          ? params.lineWidth * 0.8
          : params.lineWidth * 0.55;
        const alpha = clamp01(params.intensity * (sameProp ? 0.8 : 0.5));
        this.strokeBolt(
          ctx,
          pts,
          width,
          params.glowBlur * 0.7,
          col,
          null,
          alpha,
          scale
        );

        // Charge dot travelling the edge.
        const f = (this.webPulse + (i * 0.13 + j * 0.07)) % 1;
        const cx = A.x + (B.x - A.x) * f;
        const cy = A.y + (B.y - A.y) * f;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 12 * scale;
        ctx.shadowColor = col;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.4 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (const n of nodes)
      this.terminal(
        ctx,
        n.p,
        n.isLeft ? params.leftColor : params.rightColor,
        scale
      );
  }

  // ── Shared drawing primitives ───────────────────────────────────────

  /** Midpoint-displacement jagged path. Appends interior + end points to `out`. */
  private jag(a: Pt, b: Pt, displace: number, out: Pt[]): void {
    if (displace < 4) {
      out.push({ x: b.x, y: b.y });
      return;
    }
    const m = {
      x: (a.x + b.x) / 2 + rnd(-1, 1) * displace,
      y: (a.y + b.y) / 2 + rnd(-1, 1) * displace,
    };
    this.jag(a, m, displace / 2, out);
    this.jag(m, b, displace / 2, out);
  }

  private pairGradient(
    ctx: CanvasRenderingContext2D,
    a: Pt,
    b: Pt,
    params: Zap2DParams
  ): CanvasGradient | null {
    if (params.leftColor === params.rightColor) return null;
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, params.leftColor);
    g.addColorStop(1, params.rightColor);
    return g;
  }

  /** Two-pass stroke: colored glow halo + white-hot core. */
  private strokeBolt(
    ctx: CanvasRenderingContext2D,
    pts: Pt[],
    width: number,
    glow: number,
    glowColor: string,
    gradient: CanvasGradient | null,
    alpha: number,
    scale: number
  ): void {
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Glow pass.
    ctx.shadowBlur = glow * scale;
    ctx.shadowColor = glowColor;
    ctx.strokeStyle = gradient ?? glowColor;
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = width * 2 * scale;
    this.trace(ctx, pts);
    ctx.stroke();

    // Hot core.
    ctx.shadowBlur = glow * 0.4 * scale;
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width * scale;
    this.trace(ctx, pts);
    ctx.stroke();

    ctx.restore();
  }

  private trace(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }

  /** Soft radiant glow at a tip terminal. */
  private terminal(
    ctx: CanvasRenderingContext2D,
    p: Pt,
    color: string,
    scale: number
  ): void {
    const r = 22 * scale;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.3, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.restore();
  }
}
