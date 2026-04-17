import type { Zap2DParams } from "../translators/canvas2d-types";

export interface ZapTipInput {
  /** Blue prop tip position (canvas px). Null = not visible. */
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

/**
 * Procedural lightning renderer using midpoint displacement.
 * Regenerates arc paths at the user-specified frequency (Hz) to produce flicker.
 * 'arc' mode connects blue→red tip pairs.
 * 'crackle' mode radiates short arcs outward from each tip.
 */
export class Zap2DRenderer {
  private frameCount = 0;
  private cachedArcs: Array<{ x: number; y: number }[]> = [];

  /**
   * Draw one frame. Caller is responsible for clearing/composing the canvas
   * before/after. This renderer uses additive blending via ctx.shadowBlur.
   */
  render(
    ctx: CanvasRenderingContext2D,
    params: Zap2DParams,
    tips: ZapTipInput,
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
        const pairs: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
        // Match 3D: connect blueA↔redA and blueB↔redB when both tips exist.
        if (tips.bluePosA && tips.redPosA) pairs.push([tips.bluePosA, tips.redPosA]);
        if (tips.bluePosB && tips.redPosB) pairs.push([tips.bluePosB, tips.redPosB]);

        if (needRegen || this.cachedArcs.length !== pairs.length) {
          this.cachedArcs = pairs.map(([a, b]) => this.generatePath(a, b, params));
        }
        for (const path of this.cachedArcs) {
          this.drawArc(ctx, path, params);
        }
      } else {
        // crackle mode — short radiating arcs from each tip
        const origins: Array<{ x: number; y: number }> = [];
        if (tips.bluePosA) origins.push(tips.bluePosA);
        if (tips.bluePosB) origins.push(tips.bluePosB);
        if (tips.redPosA) origins.push(tips.redPosA);
        if (tips.redPosB) origins.push(tips.redPosB);

        const CRACKLE_SPOKES = 3;
        const expectedLength = origins.length * CRACKLE_SPOKES;
        if (needRegen || this.cachedArcs.length !== expectedLength) {
          this.cachedArcs = origins.flatMap((o) => {
            return Array.from({ length: CRACKLE_SPOKES }).map(() => {
              const angle = Math.random() * Math.PI * 2;
              const len = 40 + params.intensity * 60;
              const end = {
                x: o.x + Math.cos(angle) * len,
                y: o.y + Math.sin(angle) * len,
              };
              return this.generatePath(o, end, params);
            });
          });
        }
        for (const path of this.cachedArcs) {
          this.drawArc(ctx, path, params);
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
        const jitter = params.jitterAmount / (iter + 1);
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
    path: Array<{ x: number; y: number }>,
    params: Zap2DParams,
  ): void {
    if (path.length < 2) return;
    const first = path[0]!;
    // Glow pass
    ctx.strokeStyle = params.color;
    ctx.shadowColor = params.color;
    ctx.shadowBlur = params.glowBlur;
    ctx.lineWidth = params.lineWidth * 2;
    ctx.globalAlpha = 0.6 * params.intensity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.stroke();

    // Core pass
    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = params.glowBlur * 0.5;
    ctx.lineWidth = params.lineWidth;
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
