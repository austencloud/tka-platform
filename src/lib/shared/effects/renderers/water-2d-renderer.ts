import type { Water2DParams } from "../translators/canvas2d-types";
import type { WaterPalette } from "../domain/water-palettes";

export interface WaterTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * A single in-flight water droplet. Once released it's on rails - position
 * is computed from the release state plus ballistic motion (gravity only).
 */
interface WaterDroplet {
  /** Release position (world-space px). */
  x0: number;
  y0: number;
  /** Release velocity (px/s). */
  vx0: number;
  vy0: number;
  /** Seconds since release. */
  age: number;
  /** Seconds until retirement. */
  maxAge: number;
  /** Droplet radius in world px (SSFR density-based sizing). */
  radius: number;
  /** Base sprite rotation (radians). For stationary spawns only - motion
   *  droplets rotate to face their flight direction. */
  rotation: number;
  /** Radians/sec of rotation (slow tumble). */
  rotVel: number;
}

const GRAVITY_PX = 820;
const DROPLET_LIFE_MIN = 0.55;
const DROPLET_LIFE_VAR = 0.6;
const MAX_DROPLETS = 1024;
const TAU = Math.PI * 2;
const SPRITE_SIZE = 128;

type SpewStyle = "splash" | "flow" | "mist";

/**
 * Per-style tuning table. Each style is a complete visual language - not a
 * "strength slider". Splash = chunky discrete throws, Flow = continuous
 * thin streaks, Mist = fine high-count spray.
 */
interface StyleTuning {
  /** Multiplier on droplet radius. Smaller = finer water. */
  sizeScale: number;
  /** Extra multiplicative spread baked into sizeBand randomness. */
  sizeVariance: number;
  /** Ambient (at-rest) spawn multiplier. */
  ambientMult: number;
  /** Motion-driven spawn multiplier. */
  motionMult: number;
  /** 1/px - higher = more elongation per unit velocity. */
  stretchPerSpeed: number;
  /** Max stretch factor under motion, before surface-tension adjustment. */
  stretchLimitBase: number;
  /** Lifetime multiplier. */
  lifeScale: number;
  /** Fraction of tip velocity each droplet inherits. */
  velInherit: number;
  /** Cone half-angle at slow tip motion. */
  coneHalfBase: number;
  /** Cone half-angle at max tip speed. */
  coneHalfMin: number;
  /** Fraction of spawns that go in the directional cone vs isotropic. */
  motionFracBase: number;
  /** Kick magnitude added per unit speedScalar. */
  kickPerSpeed: number;
  /** Atmospheric blur radius in px (before scale). 0 = direct draw, no
   *  offscreen. >0 routes through offscreen + blur filter for "wet haze"
   *  and heavy fog looks. */
  atmosphericBlur: number;
  /** Alpha of the blurred fog layer (0 = no fog pass). */
  fogAlpha: number;
  /** Alpha of the crisp droplet layer on top of fog. */
  dropletAlpha: number;
  /** How many phantom copies of each droplet to stamp along its recent
   *  trajectory. Gives the temporal-streak look real water has when
   *  photographed in motion. 0 = no trail. */
  trailCount: number;
  /** Spacing in seconds between trail phantoms. Smaller = tighter streak. */
  trailStep: number;
  /** Starting alpha of the first trail phantom (subsequent phantoms decay
   *  linearly toward 0 across trailCount). */
  trailAlphaStart: number;
}

const STYLE_TUNINGS: Record<SpewStyle, StyleTuning> = {
  splash: {
    sizeScale: 0.55,
    sizeVariance: 0.5,
    ambientMult: 0.2,
    motionMult: 1.2,
    stretchPerSpeed: 1 / 420,
    stretchLimitBase: 2.4,
    lifeScale: 1.0,
    velInherit: 0.4,
    coneHalfBase: 0.7,
    coneHalfMin: 0.3,
    motionFracBase: 0.35,
    kickPerSpeed: 210,
    atmosphericBlur: 0,
    fogAlpha: 0,
    dropletAlpha: 1.0,
    trailCount: 2,
    trailStep: 0.04,
    trailAlphaStart: 0.42,
  },
  flow: {
    sizeScale: 0.35,
    sizeVariance: 0.3,
    ambientMult: 0.12,
    motionMult: 2.0,
    stretchPerSpeed: 1 / 240,
    stretchLimitBase: 4.0,
    lifeScale: 1.35,
    velInherit: 0.75,
    coneHalfBase: 0.4,
    coneHalfMin: 0.11,
    motionFracBase: 0.75,
    kickPerSpeed: 120,
    // Subtle wet sheen halo around each droplet - fog pass at low alpha
    // gives the "atmospheric moisture" feel without smearing shapes.
    atmosphericBlur: 2.5,
    fogAlpha: 0.4,
    dropletAlpha: 0.95,
    trailCount: 3,
    trailStep: 0.035,
    trailAlphaStart: 0.55,
  },
  mist: {
    sizeScale: 0.24,
    sizeVariance: 0.35,
    ambientMult: 0.4,
    motionMult: 3.2,
    stretchPerSpeed: 1 / 540,
    stretchLimitBase: 1.7,
    lifeScale: 0.9,
    velInherit: 0.22,
    coneHalfBase: 1.05,
    coneHalfMin: 0.55,
    motionFracBase: 0.4,
    kickPerSpeed: 140,
    // Heavy atmospheric blur makes mist read as diffuse fog rather than
    // discrete particles. Most of the visible output is the blurred pass;
    // the crisp layer only peeks through to hint at droplet structure.
    atmosphericBlur: 7,
    fogAlpha: 0.9,
    dropletAlpha: 0.22,
    // Mist already has heavy atmospheric blur - adding trails on top
    // smears into unreadable fog. Skip.
    trailCount: 0,
    trailStep: 0,
    trailAlphaStart: 0,
  },
};

/**
 * SSFR-derived water renderer for the Canvas2D backend.
 *
 * Canvas2D can't run per-pixel shaders, so full Screen-Space Fluid Rendering
 * (depth buffer → bilateral blur → normal reconstruction → Fresnel/GGX/
 * refraction) isn't viable at 60fps. Instead we **pre-bake** the SSFR
 * shading into a droplet sprite on a cached canvas: four layered radial
 * gradients encode dark-rim Fresnel, saturated body, upper-left specular,
 * and lower-right refraction caustic - exactly what a screen-space shader
 * would compute per-pixel, just done once and stamped per droplet.
 *
 * Each droplet is then one drawImage call with translate + rotate + scale,
 * stretched along velocity (SSFR's velocity-elongation) and sized per
 * density band (SSFR's density sizing: isolated = small, clustered = large).
 * When droplets overlap they naturally read as thicker/darker water because
 * the sprite already has alpha fall-off at the edges - accumulation through
 * source-over compositing produces the volumetric look that metaball
 * blur-and-threshold can't.
 *
 * References: NVIDIA SSFR (GDC 2010), Macklin & Müller Position Based
 * Fluids (ACM TOG 2013), Codrops WebGPU Fluids (2025).
 */
export class Water2DRenderer {
  private droplets: WaterDroplet[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};
  private smoothedVelocity: Partial<Record<TipKey, { vx: number; vy: number }>> = {};
  private spriteCache = new DropletSpriteCache();
  private atmosOff: HTMLCanvasElement | OffscreenCanvas | null = null;
  private atmosCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null;
  private atmosW = 0;
  private atmosH = 0;
  private filterProbeDone = false;
  private filterSupported = false;

  render(
    ctx: CanvasRenderingContext2D,
    params: Water2DParams,
    tips: WaterTipInput,
    dt: number,
    scale: number = 1,
  ): void {
    const g = GRAVITY_PX * scale;
    const style = (params.spewStyle ?? "flow") as SpewStyle;
    const tuning = STYLE_TUNINGS[style] ?? STYLE_TUNINGS.flow;
    const baseR =
      params.baseRadius * scale * (1.2 + 0.6 * params.intensity) * tuning.sizeScale;
    const poolCap = Math.min(MAX_DROPLETS, params.poolSize ?? MAX_DROPLETS);

    // 1. Per-tip: smooth velocity + spawn droplets.
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip || !this.isTipEnabled(key, tips, params)) {
        delete this.lastTipPos[key];
        delete this.smoothedVelocity[key];
        continue;
      }
      const last = this.lastTipPos[key];
      let vx = 0;
      let vy = 0;
      if (last && dt > 0) {
        vx = (tip.x - last.x) / dt;
        vy = (tip.y - last.y) / dt;
      }
      // EMA smoothing - raw per-frame delta is noisy and makes spawn rate
      // flicker on top of the intended motion curve.
      const prev = this.smoothedVelocity[key];
      const alpha = 1 - Math.pow(0.6, dt * 60);
      const svx = prev ? prev.vx + (vx - prev.vx) * alpha : vx;
      const svy = prev ? prev.vy + (vy - prev.vy) * alpha : vy;
      if (prev) { prev.vx = svx; prev.vy = svy; } else { this.smoothedVelocity[key] = { vx: svx, vy: svy }; }
      const speedPx = Math.hypot(svx, svy);
      this.spawnDroplets(
        params,
        tip,
        svx,
        svy,
        speedPx,
        dt,
        scale,
        baseR,
        poolCap,
        tuning,
      );
      if (last) { last.x = tip.x; last.y = tip.y; } else { this.lastTipPos[key] = { x: tip.x, y: tip.y }; }
    }

    // 2. Age + evict (in-place compaction - zero allocation).
    let writeIdx = 0;
    for (let i = 0; i < this.droplets.length; i++) {
      const d = this.droplets[i]!;
      d.age += dt;
      if (d.age >= d.maxAge) continue;
      if (i !== writeIdx) this.droplets[writeIdx] = d;
      writeIdx++;
    }
    this.droplets.length = writeIdx;
    if (this.droplets.length === 0) return;

    // 3. Resolve sprite for active palette.
    const sprite = this.spriteCache.get(params.resolvedPalette, params.clarity);
    if (!sprite) return;

    // 4. Route drawing: styles with atmospheric blur render droplets to an
    //    offscreen canvas, then composite to main in two passes - blurred
    //    fog (wet haze / diffuse mist) + crisp droplets on top. Splash
    //    skips the offscreen for perf and draws direct.
    if (tuning.atmosphericBlur > 0 && this.probeFilter(ctx)) {
      this.renderViaAtmosphere(ctx, sprite, params, tuning, g);
    } else {
      this.stampDroplets(
        ctx as
          | CanvasRenderingContext2D
          | OffscreenCanvasRenderingContext2D,
        sprite,
        params,
        tuning,
        g,
      );
    }
  }

  private stampDroplets(
    ctx:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    sprite: HTMLCanvasElement | OffscreenCanvas,
    params: Water2DParams,
    tuning: StyleTuning,
    g: number,
  ): void {
    // Stamp each droplet - the entire shading model is baked into the
    // sprite, so this loop only handles placement, rotation, stretch,
    // and fade.
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const savedTransform = ctx.getTransform();
    try {
      ctx.globalCompositeOperation = "source-over";
      const stretchLimit = tuning.stretchLimitBase * (1.0 - params.surfaceTension * 0.55);
      const trailCount = tuning.trailCount;
      const trailStep = tuning.trailStep;
      const trailAlphaStart = tuning.trailAlphaStart;
      const TRAIL_SPEED_THRESHOLD = 70;
      const halfSprite = -SPRITE_SIZE / 2;
      for (const d of this.droplets) {
        const ptX = d.x0 + d.vx0 * d.age;
        const ptY = d.y0 + d.vy0 * d.age + 0.5 * g * d.age * d.age;
        const ageT = d.age / d.maxAge;
        const fade =
          ageT < 0.1
            ? ageT / 0.1
            : ageT > 0.75
              ? 1 - (ageT - 0.75) / 0.25
              : 1;
        if (fade <= 0.02) continue;
        const sizeFade = ageT < 0.7 ? 1 : 1 - ((ageT - 0.7) / 0.3) * 0.35;
        const currVy = d.vy0 + g * d.age;
        const sp = Math.hypot(d.vx0, currVy);
        const stretchX = 1 + Math.min(stretchLimit, sp * tuning.stretchPerSpeed);
        const squashY = 1 / Math.sqrt(stretchX);
        const angle =
          sp > 6 ? Math.atan2(currVy, d.vx0) : d.rotation + d.rotVel * d.age;
        const drawR = d.radius * sizeFade;
        const spriteScale = drawR / (SPRITE_SIZE * 0.42);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        if (trailCount > 0 && sp > TRAIL_SPEED_THRESHOLD) {
          for (let k = trailCount; k >= 1; k--) {
            const phantomAge = Math.max(0, d.age - k * trailStep);
            if (phantomAge <= 0) continue;
            const px = d.x0 + d.vx0 * phantomAge;
            const py = d.y0 + d.vy0 * phantomAge + 0.5 * g * phantomAge * phantomAge;
            const phantomAlpha =
              fade * trailAlphaStart * ((trailCount - k + 1) / trailCount);
            if (phantomAlpha <= 0.01) continue;
            const tsx = spriteScale * stretchX;
            const tsy = spriteScale * squashY;
            ctx.setTransform(tsx * cos, tsx * sin, -tsy * sin, tsy * cos, px, py);
            ctx.globalAlpha = phantomAlpha;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ctx.drawImage(sprite as any, halfSprite, halfSprite);
          }
        }

        const sx = spriteScale * stretchX;
        const sy = spriteScale * squashY;
        ctx.setTransform(sx * cos, sx * sin, -sy * sin, sy * cos, ptX, ptY);
        ctx.globalAlpha = fade;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(sprite as any, halfSprite, halfSprite);
      }
    } finally {
      ctx.setTransform(savedTransform);
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  private renderViaAtmosphere(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement | OffscreenCanvas,
    params: Water2DParams,
    tuning: StyleTuning,
    g: number,
  ): void {
    const mainW = ctx.canvas.width;
    const mainH = ctx.canvas.height;
    const off = this.ensureAtmosOffscreen(mainW, mainH);
    if (!off) {
      // Fallback: direct draw if offscreen can't be created.
      this.stampDroplets(ctx, sprite, params, tuning, g);
      return;
    }
    off.clearRect(0, 0, mainW, mainH);
    this.stampDroplets(off, sprite, params, tuning, g);

    // Two-pass composite: blurred fog then crisp droplets on top.
    const prevFilter = ctx.filter;
    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    try {
      ctx.globalCompositeOperation = "source-over";
      if (tuning.fogAlpha > 0) {
        ctx.filter = `blur(${Math.max(1, Math.round(tuning.atmosphericBlur))}px)`;
        ctx.globalAlpha = tuning.fogAlpha;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(this.atmosOff as any, 0, 0);
        ctx.filter = "none";
      }
      if (tuning.dropletAlpha > 0) {
        ctx.globalAlpha = tuning.dropletAlpha;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(this.atmosOff as any, 0, 0);
      }
    } finally {
      ctx.filter = prevFilter;
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private ensureAtmosOffscreen(
    w: number,
    h: number,
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (this.atmosOff && this.atmosW === w && this.atmosH === h && this.atmosCtx) {
      return this.atmosCtx;
    }
    const canvas = createOffscreen(w, h);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    this.atmosOff = canvas;
    this.atmosCtx = ctx;
    this.atmosW = w;
    this.atmosH = h;
    return ctx;
  }

  private probeFilter(ctx: CanvasRenderingContext2D): boolean {
    if (this.filterProbeDone) return this.filterSupported;
    try {
      const prev = ctx.filter;
      ctx.filter = "blur(2px)";
      const applied = ctx.filter;
      ctx.filter = prev;
      this.filterSupported = typeof applied === "string" && applied.includes("blur");
    } catch {
      this.filterSupported = false;
    }
    this.filterProbeDone = true;
    return this.filterSupported;
  }

  private spawnDroplets(
    params: Water2DParams,
    tip: { x: number; y: number },
    vx: number,
    vy: number,
    speedPx: number,
    dt: number,
    scale: number,
    baseR: number,
    poolCap: number,
    tuning: StyleTuning,
  ): void {
    if (this.droplets.length >= poolCap) return;

    const PX_PER_WORLD = 60;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * scale;
    const speedScalar = refSpeed > 0 ? Math.min(1, speedPx / refSpeed) : 0;

    // Spawn rates per the style's ambient/motion multipliers.
    const ambient = params.ambientEmission * params.ambientSpawnRate * tuning.ambientMult;
    const motion =
      params.motionEmission * speedScalar * params.motionSpawnRate * tuning.motionMult;
    const expected = (ambient + motion) * dt;
    let n = Math.floor(expected);
    if (Math.random() < expected - n) n++;
    const slots = poolCap - this.droplets.length;
    if (n > slots) n = slots;
    if (n <= 0) return;

    // Shed direction - droplets fly opposite tip motion. Cone width and
    // inheritance come from the style tuning, so flow draws tight trailing
    // streams while mist fans widely.
    const motionDir = speedPx > 1 ? Math.atan2(vy, vx) : 0;
    const shedDir = motionDir + Math.PI;
    const coneHalf =
      tuning.coneHalfBase -
      speedScalar * (tuning.coneHalfBase - tuning.coneHalfMin);
    const motionFrac = tuning.motionFracBase + (1 - tuning.motionFracBase) * speedScalar;
    const lifeMin = DROPLET_LIFE_MIN * tuning.lifeScale;
    const lifeVar = DROPLET_LIFE_VAR * tuning.lifeScale;

    for (let i = 0; i < n; i++) {
      const isMotion = speedPx > 1 && Math.random() < motionFrac;
      const kickAngle = isMotion
        ? shedDir + (Math.random() - 0.5) * 2 * coneHalf
        : Math.random() * TAU;
      const kickMag = isMotion
        ? 40 +
          speedScalar * tuning.kickPerSpeed +
          Math.random() * (30 + speedScalar * tuning.kickPerSpeed * 0.8)
        : 10 + Math.random() * 30;
      const ox = (Math.random() - 0.5) * 6 * scale;
      const oy = (Math.random() - 0.5) * 6 * scale;
      // Density-based sizing: isolated ambient drips small, motion-spawned
      // chunks larger at higher speed. sizeVariance controls how much
      // spread mixes sizes within a spawn burst.
      const sizeBand = isMotion
        ? 0.45 + speedScalar * 0.8 + Math.random() * tuning.sizeVariance * 1.6
        : 0.25 + Math.random() * tuning.sizeVariance;
      this.droplets.push({
        x0: tip.x + ox,
        y0: tip.y + oy,
        vx0: vx * tuning.velInherit + Math.cos(kickAngle) * kickMag * scale,
        vy0: vy * tuning.velInherit + Math.sin(kickAngle) * kickMag * scale,
        age: 0,
        maxAge: lifeMin + Math.random() * lifeVar,
        radius: baseR * sizeBand,
        rotation: Math.random() * TAU,
        rotVel: (Math.random() - 0.5) * 2.0,
      });
    }
  }

  private isTipEnabled(
    key: TipKey,
    tips: WaterTipInput,
    params: Water2DParams,
  ): boolean {
    if (tips[key] == null) return false;
    if (params.trackingMode === "both_ends") return true;
    const isEndA = key === "bluePosA" || key === "redPosA";
    return params.trackingMode === "left_end" ? isEndA : !isEndA;
  }

  dispose(): void {
    this.droplets = [];
    this.lastTipPos = {};
    this.smoothedVelocity = {};
    this.spriteCache.dispose();
    this.atmosOff = null;
    this.atmosCtx = null;
    this.atmosW = 0;
    this.atmosH = 0;
    this.filterProbeDone = false;
    this.filterSupported = false;
  }
}

/**
 * Cached pre-baked droplet sprite. Regenerates whenever the palette or
 * clarity changes - keyed on a signature string so per-frame lookups are
 * cheap. The sprite encodes everything a real SSFR shader would compute
 * per-pixel (Fresnel rim darkening, body refraction absorption, specular
 * highlight, caustic focus spot) as four layered radial gradients.
 */
class DropletSpriteCache {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private signature = "";

  get(
    palette: WaterPalette,
    clarity: number,
  ): HTMLCanvasElement | OffscreenCanvas | null {
    const sig = `${palette.core}|${palette.edge}|${palette.highlight}|${clarity.toFixed(2)}`;
    if (sig === this.signature && this.canvas) return this.canvas;
    this.canvas = renderDropletSprite(palette, clarity);
    this.signature = sig;
    return this.canvas;
  }

  dispose(): void {
    this.canvas = null;
    this.signature = "";
  }
}

function renderDropletSprite(
  palette: WaterPalette,
  clarity: number,
): HTMLCanvasElement | OffscreenCanvas | null {
  const canvas = createOffscreen(SPRITE_SIZE, SPRITE_SIZE);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) return null;

  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const R = SPRITE_SIZE * 0.42;
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Layer 1 - BODY. Radial gradient from a slightly-lit interior to the
  // saturated rim. Alpha goes to 0 at R so the droplet has a soft (but
  // not blurred) edge. Clarity reduces interior opacity so you see through
  // the drop more.
  const interiorAlpha = Math.max(0.55, 0.95 - clarity * 0.2);
  const bodyGrad = ctx.createRadialGradient(
    cx - R * 0.2,
    cy - R * 0.2,
    0,
    cx,
    cy,
    R,
  );
  bodyGrad.addColorStop(0, withAlpha(palette.edge, interiorAlpha * 0.82));
  bodyGrad.addColorStop(0.5, withAlpha(palette.core, interiorAlpha));
  bodyGrad.addColorStop(0.9, withAlpha(palette.core, interiorAlpha * 0.75));
  bodyGrad.addColorStop(1.0, withAlpha(palette.core, 0));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();

  // Layer 2 - BACKLIT RIM. Additive bright ring near the drop's edge.
  // On a *dark* background (our pictograph canvas), real water drops
  // exhibit a bright silhouette rim from light backlighting through the
  // thin edge of the drop - the OPPOSITE of Fresnel-dark-rim which is
  // only correct for light backgrounds. This is what makes real photos
  // of water drops against dark bg look luminous instead of outlined.
  ctx.globalCompositeOperation = "lighter";
  const rimGrad = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
  rimGrad.addColorStop(0, withAlpha(palette.highlight, 0));
  rimGrad.addColorStop(0.55, withAlpha(palette.highlight, 0.45));
  rimGrad.addColorStop(0.9, withAlpha(palette.highlight, 0.3));
  rimGrad.addColorStop(1.0, withAlpha(palette.highlight, 0));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();

  // Layer 3 - SPECULAR HIGHLIGHT. Assumes a single light source from the
  // upper-left, so specular peaks there. Additive so it lights on top of
  // the body without tinting it. This is what reads as "wet surface
  // catching light" - the feature SSFR's Fresnel + GGX produces.
  ctx.globalCompositeOperation = "lighter";
  const specCx = cx - R * 0.38;
  const specCy = cy - R * 0.42;
  const specR = R * 0.48;
  const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specR);
  specGrad.addColorStop(0, withAlpha(palette.highlight, 0.95));
  specGrad.addColorStop(0.35, withAlpha(palette.highlight, 0.35));
  specGrad.addColorStop(1.0, withAlpha(palette.highlight, 0));
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(specCx, specCy, specR, 0, TAU);
  ctx.fill();

  // Layer 4 - REFRACTION CAUSTIC. Bright focal spot on the lower-right
  // interior where light passing through the drop converges. This is the
  // subtle "glowy bottom" that makes real water drops photograph as
  // luminous - without it they look like painted blobs. SSFR gets this
  // for free from its refraction-offset math; we bake it in.
  const caustCx = cx + R * 0.24;
  const caustCy = cy + R * 0.32;
  const caustR = R * 0.32;
  const caustGrad = ctx.createRadialGradient(
    caustCx,
    caustCy,
    0,
    caustCx,
    caustCy,
    caustR,
  );
  caustGrad.addColorStop(0, withAlpha(palette.highlight, 0.55));
  caustGrad.addColorStop(0.55, withAlpha(palette.highlight, 0.15));
  caustGrad.addColorStop(1.0, withAlpha(palette.highlight, 0));
  ctx.fillStyle = caustGrad;
  ctx.beginPath();
  ctx.arc(caustCx, caustCy, caustR, 0, TAU);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(w, h);
    }
  } catch {
    // fall through
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

function withAlpha(hex: string, alpha: number): string {
  const s = hex.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}
