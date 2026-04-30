import type { Zap2DParams } from "../translators/canvas2d-types";

export interface ZapTipInput {
  /** Blue prop tip position (canvas px). Null = not visible. */
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

interface CachedArc {
  path: Array<{ x: number; y: number }>;
  /** Color for the start endpoint of this arc (linear gradient). */
  startColor: string;
  /** Color for the end endpoint. Equal to startColor in crackle mode. */
  endColor: string;
}

/**
 * Procedural lightning renderer using midpoint displacement.
 * Regenerates arc paths at the user-specified frequency (Hz) to produce flicker.
 * 'arc' mode connects blue→red tip pairs, gradient leftColor → rightColor.
 * 'crackle' mode radiates short arcs outward from each tip in that hand's color.
 */
export class Zap2DRenderer {
  private frameCount = 0;
  private cachedArcs: CachedArc[] = [];

  /**
   * Draw one frame. Caller is responsible for clearing/composing the canvas
   * before/after. This renderer uses additive blending via ctx.shadowBlur.
   */
  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
    scale: number = 1,
  ): void {
    this.frameCount++;
    // params.frequency is regenerations per second at 60fps render cadence.
    // Clamp to ≥1 frame so frequency=60 means every frame, frequency=1 means once a second.
    const regenerateEveryFrames = Math.max(1, Math.round(60 / Math.max(0.1, params.frequency)));
    const needRegen = this.frameCount % regenerateEveryFrames === 0;

    const prevComposite = ctx.globalCompositeOperation;
    const prevShadowBlur = ctx.shadowBlur;
    const prevShadowColor = ctx.shadowColor;
    const prevStrokeStyle = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    const prevGlobalAlpha = ctx.globalAlpha;
    try {
      ctx.globalCompositeOperation = "lighter";

      if (params.mode === "arc") {
        // Arc mode: pair blueA↔redA and blueB↔redB. Gradient leftColor → rightColor.
        const pairs: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
        if (tips.bluePosA && tips.redPosA) pairs.push({ a: tips.bluePosA, b: tips.redPosA });
        if (tips.bluePosB && tips.redPosB) pairs.push({ a: tips.bluePosB, b: tips.redPosB });

        if (needRegen || this.cachedArcs.length !== pairs.length) {
          this.cachedArcs = pairs.map(({ a, b }) => ({
            path: this.generatePath(a, b, params, scale),
            startColor: params.leftColor,
            endColor: params.rightColor,
          }));
        }
        for (const arc of this.cachedArcs) {
          this.drawArc(ctx, arc, params, scale);
        }
      } else {
        // Crackle mode: each origin's spokes carry its own hand color.
        const origins: Array<{ pos: { x: number; y: number }; color: string }> = [];
        if (tips.bluePosA) origins.push({ pos: tips.bluePosA, color: params.leftColor });
        if (tips.bluePosB) origins.push({ pos: tips.bluePosB, color: params.leftColor });
        if (tips.redPosA) origins.push({ pos: tips.redPosA, color: params.rightColor });
        if (tips.redPosB) origins.push({ pos: tips.redPosB, color: params.rightColor });

        const CRACKLE_SPOKES = 3;
        const expectedLength = origins.length * CRACKLE_SPOKES;
        if (needRegen || this.cachedArcs.length !== expectedLength) {
          this.cachedArcs = origins.flatMap((o) => {
            return Array.from({ length: CRACKLE_SPOKES }).map(() => {
              const angle = Math.random() * Math.PI * 2;
              const len = (40 + params.intensity * 60) * scale;
              const end = {
                x: o.pos.x + Math.cos(angle) * len,
                y: o.pos.y + Math.sin(angle) * len,
              };
              return {
                path: this.generatePath(o.pos, end, params, scale),
                startColor: o.color,
                endColor: o.color,
              };
            });
          });
        }
        for (const arc of this.cachedArcs) {
          this.drawArc(ctx, arc, params, scale);
        }
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.shadowBlur = prevShadowBlur;
      ctx.shadowColor = prevShadowColor;
      ctx.strokeStyle = prevStrokeStyle;
      ctx.lineWidth = prevLineWidth;
      ctx.globalAlpha = prevGlobalAlpha;
    }
  }

  private generatePath(
    a: { x: number; y: number },
    b: { x: number; y: number },
    params: Zap2DParams,
    scale: number = 1,
  ): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [a, b];
    for (let iter = 0; iter < Math.log2(params.segments); iter++) {
      const next: typeof pts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const cur = pts[i]!;
        const nxt = pts[i + 1]!;
        next.push(cur);
        const mx = (cur.x + nxt.x) / 2;
        const my = (cur.y + nxt.y) / 2;
        const jitter = (params.jitterAmount * scale) / (iter + 1);
        next.push({
          x: mx + (Math.random() - 0.5) * jitter * 2,
          y: my + (Math.random() - 0.5) * jitter * 2,
        });
      }
      next.push(pts[pts.length - 1]!);
      pts.length = 0;
      pts.push(...next);
    }
    return pts;
  }

  private drawArc(
    ctx: CanvasRenderingContext2D,
    arc: CachedArc,
    params: Zap2DParams,
    scale: number = 1,
  ): void {
    const { path, startColor, endColor } = arc;
    if (path.length < 2) return;
    const first = path[0]!;
    const last = path[path.length - 1]!;

    // Build the per-arc gradient once per draw call.
    let stroke: string | CanvasGradient;
    if (startColor === endColor) {
      stroke = startColor;
    } else {
      const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
      grad.addColorStop(0, startColor);
      grad.addColorStop(1, endColor);
      stroke = grad;
    }

    // Glow pass - use the gradient (or solid). shadowColor needs a string.
    ctx.strokeStyle = stroke;
    ctx.shadowColor = startColor; // gradient halo isn't supported; pick start as approximation
    ctx.shadowBlur = params.glowBlur * scale;
    ctx.lineWidth = params.lineWidth * 2 * scale;
    ctx.globalAlpha = 0.6 * params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();

    // Core pass - bright white center for the lightning hot core.
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = params.glowBlur * 0.5 * scale;
    ctx.lineWidth = params.lineWidth * scale;
    ctx.globalAlpha = params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();
  }

  dispose(): void {
    this.cachedArcs = [];
    this.frameCount = 0;
  }
}
