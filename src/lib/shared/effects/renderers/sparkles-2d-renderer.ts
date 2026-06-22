import type { Sparkles2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

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

/** Hard ceiling on particle count for perf safety. The live cap is rate-scaled. */
const MAX_PARTICLES = 1500;
/** Spawns per second per tip per unit rate. */
const SPAWN_DENSITY = 18;
/** Floor for rate-scaled cap so rate near 0 still shows something visible. */
const MIN_LIVE_PARTICLES = 40;
/** Burst mode: minimum tip displacement (px) per frame to trigger a spawn burst (at scale=1). */
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
  private lastTipPos = new Map<string, { x: number; y: number }>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Sparkles2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1,
  ): void {
    // 1. Spawn from each enabled emitter per current mode. Covers base props
    //    and every tunnel kaleidoscope layer (propIndex >= 2).
    //    Live cap scales with params.rate so the slider actually controls
    //    on-screen density (not just the spawn rate, which was being masked
    //    by a static cap once rate crossed ~0.08).
    //    Per-emitter allocation prevents the first emitter in iteration order
    //    from consuming the whole budget - without it, sparkles appear to come
    //    from only one tip.
    const effectiveMax = Math.max(
      MIN_LIVE_PARTICLES,
      Math.min(MAX_PARTICLES, Math.floor(MAX_PARTICLES * params.rate)),
    );
    const activeEmitters = emitters.filter((e) => this.isEndEnabled(e.end, params));
    const slotsLeft = Math.max(0, effectiveMax - this.particles.length);
    const perTipCap = activeEmitters.length > 0
      ? Math.max(0, Math.floor(slotsLeft / activeEmitters.length))
      : 0;

    const seen = new Set<string>();
    for (const e of activeEmitters) {
      const id = emitterId(e.propIndex, e.tipIndex);
      seen.add(id);
      const last = this.lastTipPos.get(id);
      this.spawnFromTip(params, e, last, dt, perTipCap, scale);
      if (last) { last.x = e.x; last.y = e.y; } else { this.lastTipPos.set(id, { x: e.x, y: e.y }); }
    }
    // Prune per-tip state for emitters absent this frame (a layer toggled off
    // or a tip disabled by tracking-mode) so the Map doesn't grow unbounded.
    for (const id of this.lastTipPos.keys()) if (!seen.has(id)) this.lastTipPos.delete(id);

    // 2. Step physics + cull dead particles (in-place compaction - zero allocation).
    const gravityPx = params.gravity * 200 * scale;
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += gravityPx * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spinSpeed * dt;
      if (i !== writeIdx) this.particles[writeIdx] = p;
      writeIdx++;
    }
    this.particles.length = writeIdx;

    // 3. Draw - each particle is a 4-point star (cross + smaller diagonal cross)
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
    const savedTransform = ctx.getTransform();
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      ctx.lineCap = "round";
      const baseR = params.baseRadius * scale;
      for (const p of this.particles) {
        const t = p.life / p.maxLife;
        const fade = Math.max(0, 1 - t);
        const twinkle = 0.55 + 0.45 * Math.sin(p.life * 22 + p.twinklePhase);
        const alpha = fade * twinkle;
        const armLen = baseR * p.scale * 2.4;
        const diagLen = armLen * 0.55;

        const cos = Math.cos(p.rotation);
        const sin = Math.sin(p.rotation);
        ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);

        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(1, baseR * p.scale * 0.45);
        ctx.beginPath();
        ctx.moveTo(-armLen, 0);
        ctx.lineTo(armLen, 0);
        ctx.moveTo(0, -armLen);
        ctx.lineTo(0, armLen);
        ctx.stroke();

        ctx.lineWidth = Math.max(0.6, baseR * p.scale * 0.25);
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.moveTo(-diagLen, -diagLen);
        ctx.lineTo(diagLen, diagLen);
        ctx.moveTo(-diagLen, diagLen);
        ctx.lineTo(diagLen, -diagLen);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, baseR * p.scale * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    } finally {
      ctx.setTransform(savedTransform);
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
    perTipCap: number,
    scale: number,
  ): void {
    // Base count: rate × SPAWN_DENSITY spawns/s, normalized via dt × 60 so a 60fps
    // tick spawns at the documented rate regardless of actual frame timing.
    const baseCount = Math.floor(params.rate * SPAWN_DENSITY * dt * 60);
    let spawnCount = 0;
    let usePathSpawn = false;

    if (params.mode === "stream") {
      spawnCount = Math.max(1, baseCount);
    } else if (params.mode === "burst") {
      if (!last) return;
      const dx = tip.x - last.x;
      const dy = tip.y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Motion threshold is px/frame at reference size; scale with canvas.
      if (dist < BURST_MOTION_THRESHOLD * scale) return;
      // `dist / 10` keeps ratio invariant - distance already scales with canvas
      // (tips are in canvas px), so the divisor scales too.
      spawnCount = Math.max(1, Math.floor(baseCount * (1 + dist / (10 * scale))));
    } else {
      spawnCount = Math.max(1, baseCount);
      usePathSpawn = !!last;
    }

    // Clamp to this tip's fair share of the pool so other tips can spawn too.
    spawnCount = Math.max(0, Math.min(spawnCount, perTipCap));

    for (let i = 0; i < spawnCount; i++) {
      // Origin: AT the tip (no scatter) so all particles emerge from the same
      // point and burst outward - that's what reads as "bursting from the tip"
      // rather than "appearing in a fuzzy area".
      let originX = tip.x;
      let originY = tip.y;
      if (usePathSpawn && last) {
        const t = i / spawnCount;
        originX = last.x + (tip.x - last.x) * t;
        originY = last.y + (tip.y - last.y) * t;
      }

      const angle = Math.random() * Math.PI * 2;
      // Burst speed is px/s at reference size; scales with canvas.
      const burstSpeed = (params.spread * 4 + Math.random() * params.spread * 8) * scale;
      const vx = Math.cos(angle) * burstSpeed;
      // Upward bias is px/s at reference size; scales with canvas.
      const vy = Math.sin(angle) * burstSpeed - 15 * scale;

      // Stagger lifetime ±40% so particles die at different times. Without this
      // the whole batch dies together and the canvas pulses dark every lifetime.
      const lifeJitter = 0.6 + Math.random() * 0.8;

      this.particles.push({
        x: originX,
        y: originY,
        vx,
        vy,
        life: 0,
        maxLife: params.lifetime * lifeJitter,
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

  private isEndEnabled(end: "A" | "B", params: Sparkles2DParams): boolean {
    // Sparkles has no tracking-mode control - all emitter ends spawn. The
    // optional field is read defensively so the per-emitter filter shape stays
    // consistent with the other overlay renderers; absent it, every end passes.
    const trackingMode = (params as { trackingMode?: "left_end" | "right_end" | "both_ends" }).trackingMode;
    if (!trackingMode || trackingMode === "both_ends") return true;
    return trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.particles = [];
    this.lastTipPos.clear();
  }
}
