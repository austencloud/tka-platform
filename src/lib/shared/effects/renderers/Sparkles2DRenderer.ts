import type { Sparkles2DParams } from "../translators/canvas2d-types";

export interface SparklesTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
  /** Initial radians; drifts via spinSpeed so the cross shape twinkles instead of sitting static. */
  rotation: number;
  spinSpeed: number;
  /** Phase offset (radians) for the per-particle alpha twinkle. */
  twinklePhase: number;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

const MAX_PARTICLES = 200;
/** Burst mode: minimum tip displacement (px) per frame to trigger a spawn burst. */
const BURST_MOTION_THRESHOLD = 0.3;

/**
 * Particle-pool sparkle renderer for the Canvas2D backend.
 *
 * Holds particle state across frames. Caller passes tips per frame; renderer
 * manages spawn, physics, decay, and draw using ctx.globalCompositeOperation
 * = "lighter" for additive bloom. Color picked per spawn from the active
 * colorMode (solid / rainbow / palette). Mode controls when spawns happen:
 * stream every frame, burst only when tip is moving, trail along the path
 * between last and current tip position.
 */
export class Sparkles2DRenderer {
  private particles: Particle[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};

  render(
    ctx: CanvasRenderingContext2D,
    params: Sparkles2DParams,
    tips: SparklesTipInput,
    dt: number,
  ): void {
    // 1. Spawn from each enabled tip per current mode.
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip) {
        delete this.lastTipPos[key];
        continue;
      }
      const last = this.lastTipPos[key];
      this.spawnFromTip(params, tip, last, dt);
      this.lastTipPos[key] = { x: tip.x, y: tip.y };
    }

    // 2. Step physics + cull dead particles.
    const gravityPx = params.gravity * 200; // px/s²
    const surviving: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += gravityPx * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spinSpeed * dt;
      surviving.push(p);
    }
    this.particles = surviving;

    // 3. Draw — each particle is a 4-point star (cross + smaller diagonal cross)
    //    with a bright pinpoint core. Sin-modulated alpha = twinkle. The cross
    //    shape + scintillation is what differentiates sparkles from charcoal's
    //    additive-glow blobs.
    if (this.particles.length === 0) return;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFill = ctx.fillStyle;
    const prevStroke = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    const prevLineCap = ctx.lineCap;
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      ctx.lineCap = "round";
      const baseR = params.baseRadius;
      for (const p of this.particles) {
        const t = p.life / p.maxLife;
        const fade = Math.max(0, 1 - t);
        const twinkle = 0.55 + 0.45 * Math.sin(p.life * 22 + p.twinklePhase);
        const alpha = fade * twinkle;
        const armLen = baseR * p.scale * 2.4;
        const diagLen = armLen * 0.55;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Major cross (+) — long, thin, bright.
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(1, baseR * p.scale * 0.45);
        ctx.beginPath();
        ctx.moveTo(-armLen, 0);
        ctx.lineTo(armLen, 0);
        ctx.moveTo(0, -armLen);
        ctx.lineTo(0, armLen);
        ctx.stroke();

        // Minor diagonal cross (×) — shorter, thinner, gives it the 8-point feel.
        ctx.lineWidth = Math.max(0.6, baseR * p.scale * 0.25);
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.moveTo(-diagLen, -diagLen);
        ctx.lineTo(diagLen, diagLen);
        ctx.moveTo(-diagLen, diagLen);
        ctx.lineTo(diagLen, -diagLen);
        ctx.stroke();

        // Bright white pinpoint core.
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, baseR * p.scale * 0.35), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFill;
      ctx.strokeStyle = prevStroke;
      ctx.lineWidth = prevLineWidth;
      ctx.lineCap = prevLineCap;
    }
  }

  private spawnFromTip(
    params: Sparkles2DParams,
    tip: { x: number; y: number },
    last: { x: number; y: number } | undefined,
    dt: number,
  ): void {
    // Base count: ~rate * 8 spawns/s normalized via dt * 60 so a 60fps tick spawns
    // at the documented rate regardless of actual frame timing.
    const baseCount = Math.floor(params.rate * 8 * dt * 60);
    let spawnCount = 0;
    let usePathSpawn = false;

    if (params.mode === "stream") {
      spawnCount = Math.max(1, baseCount);
    } else if (params.mode === "burst") {
      if (!last) return; // No motion data yet — wait one frame to seed last position.
      const dx = tip.x - last.x;
      const dy = tip.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BURST_MOTION_THRESHOLD) return;
      spawnCount = Math.max(1, Math.floor(baseCount * (1 + dist / 10)));
    } else {
      // trail mode — spawn along the path between last and current tip.
      spawnCount = Math.max(1, baseCount);
      usePathSpawn = !!last;
    }

    for (let i = 0; i < spawnCount; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;

      // Position: scattered within spread radius around tip, or along path for trail.
      let px = tip.x;
      let py = tip.y;
      if (usePathSpawn && last) {
        const t = i / spawnCount;
        px = last.x + (tip.x - last.x) * t;
        py = last.y + (tip.y - last.y) * t;
      }
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * params.spread;
      const x = px + Math.cos(angle) * r;
      const y = py + Math.sin(angle) * r;

      // Velocity: random direction × small initial speed, with slight upward bias.
      const vAngle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 30;
      const vx = Math.cos(vAngle) * speed;
      const vy = Math.sin(vAngle) * speed - 20;

      this.particles.push({
        x,
        y,
        vx,
        vy,
        life: 0,
        maxLife: params.lifetime,
        color: this.pickColor(params),
        scale: 0.6 + Math.random() * 0.8 * params.size * 2,
        rotation: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 1.6,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  private pickColor(params: Sparkles2DParams): string {
    if (params.colorMode === "rainbow") {
      const hue = (Date.now() * 0.1) % 360;
      return `hsl(${hue}, 80%, 60%)`;
    }
    if (params.colorMode === "palette" && params.palette.length > 0) {
      const idx = Math.floor(Math.random() * params.palette.length);
      return params.palette[idx]!;
    }
    return params.color;
  }

  dispose(): void {
    this.particles = [];
    this.lastTipPos = {};
  }
}
