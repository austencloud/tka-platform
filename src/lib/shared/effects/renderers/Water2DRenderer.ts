import type { Water2DParams } from "../translators/canvas2d-types";

export interface WaterTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
}

type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";
const TIP_KEYS: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];

/**
 * A single "water element" released from a tip. Once released it's on
 * rails — position is computed from the release state plus ballistic
 * motion (gravity only, no drag). Stream samples chain together to form
 * the continuous ribbon; splashes are loners that break off.
 */
interface WaterElement {
  /** Release position (world-space px on the canvas). */
  x0: number;
  y0: number;
  /** Release velocity (px/s). */
  vx0: number;
  vy0: number;
  /** Seconds since release. */
  age: number;
  /** Seconds until retirement. */
  maxAge: number;
  /** Released width factor (stream samples: 1; splashes: 0.5-1.5 jittered). */
  width: number;
  /** Per-chunk random seed in [0,1). Drives the blob-cluster shape so each
   *  chunk renders as a stable irregular outline instead of a flickering
   *  shape. Unused by stream samples. */
  blobSeed: number;
}

/** Screen-down gravity, px/s² at scale=1. Water falls hard. */
const GRAVITY_PX = 820;
/** Stream sample lifetime — how long a released ribbon element lasts. */
const STREAM_LIFE_BASE = 0.55;
/** Splash droplet lifetime range. */
const SPLASH_LIFE_MIN = 0.3;
const SPLASH_LIFE_VAR = 0.35;
/** Hard pool ceilings so a burst can't OOM. */
const MAX_STREAM_PER_TIP = 80;
const MAX_SPLASHES = 512;
const TAU = Math.PI * 2;

/**
 * Ribbon-stream water renderer for the Canvas2D backend.
 *
 * Conceptually water is no longer a cloud of discrete particles — it's a
 * continuous stream of released elements. Each element leaves the tip
 * with the tip's current velocity, then follows a ballistic trajectory
 * under gravity. Rendering draws the chain as overlapping white disks on
 * an offscreen mask; neighbors fuse through the gooey filter pass into
 * a tapered ribbon that bends under gravity the same way real falling
 * water does.
 *
 * Splash droplets are a second, optional layer — they break off at
 * direction changes or at the tail of a stream element's life. They
 * share the same white-mask → gooey-filter → color-fill pipeline so
 * stream and splash read as one continuous liquid.
 *
 * Why this works where the pure-particle model didn't: particles have
 * gaps. A continuous ribbon never does. Fire doesn't look like fire
 * because of its flames; it looks like fire because it's a *continuous
 * density field with no gaps*. This ribbon-stream is the 2D analogue.
 */
export class Water2DRenderer {
  private stream: Partial<Record<TipKey, WaterElement[]>> = {};
  private splashes: WaterElement[] = [];
  private lastTipPos: Partial<Record<TipKey, { x: number; y: number }>> = {};
  /** Rolling tip velocity smoothed over a few frames so splash kicks
   *  don't flicker at 60fps noise. */
  private smoothedVelocity: Partial<Record<TipKey, { vx: number; vy: number }>> =
    {};

  private offscreen: HTMLCanvasElement | OffscreenCanvas | null = null;
  private offctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private offW = 0;
  private offH = 0;
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
    const momentumMode = params.momentumMode === true;

    // Momentum-mode speed gating: below SLOW ribbon is fully suppressed,
    // above FAST it's full-rate. Chunk size + splash magnitude key off
    // the same normalized scalar so the whole effect breathes with motion.
    const MOMENTUM_SLOW_PX = 140 * scale;
    const MOMENTUM_FAST_PX = 900 * scale;

    // 1. Per-tip stream update + splash spawn.
    const streamLife = STREAM_LIFE_BASE;
    for (const key of TIP_KEYS) {
      const tip = tips[key];
      if (!tip || !this.isTipEnabled(key, tips, params)) {
        delete this.lastTipPos[key];
        delete this.smoothedVelocity[key];
        this.stream[key] = [];
        continue;
      }

      const last = this.lastTipPos[key];
      let vx = 0;
      let vy = 0;
      if (last && dt > 0) {
        vx = (tip.x - last.x) / dt;
        vy = (tip.y - last.y) / dt;
      }
      // Smooth tip velocity — raw per-frame delta is noisy.
      const prevSmooth = this.smoothedVelocity[key];
      const smoothAlpha = 1 - Math.pow(0.6, dt * 60); // ~55ms half-life
      const svx = prevSmooth ? prevSmooth.vx + (vx - prevSmooth.vx) * smoothAlpha : vx;
      const svy = prevSmooth ? prevSmooth.vy + (vy - prevSmooth.vy) * smoothAlpha : vy;
      this.smoothedVelocity[key] = { vx: svx, vy: svy };
      const speedPx = Math.hypot(svx, svy);

      // 1a. Append a fresh stream sample at the tip. Released velocity =
      //     tip velocity (so the element inherits the prop's motion),
      //     plus a small inward perpendicular bias that makes the ribbon
      //     hug the tip's path instead of flying sideways.
      //
      // Momentum mode: the ribbon is disabled entirely — all visual
      //   weight moves onto the fling-off chunks so the two layers don't
      //   fight each other. Any existing samples are allowed to age out
      //   naturally (not cleared mid-flight — looks worse).
      const samples = this.stream[key] ?? (this.stream[key] = []);
      if (!momentumMode && samples.length < MAX_STREAM_PER_TIP) {
        samples.push({
          x0: tip.x,
          y0: tip.y,
          vx0: svx,
          vy0: svy,
          age: 0,
          maxAge: streamLife,
          width: 1,
          blobSeed: 0,
        });
      }

      // 1b. Age existing stream samples; drop any past their maxAge.
      for (let i = samples.length - 1; i >= 0; i--) {
        const el = samples[i]!;
        el.age += dt;
        if (el.age >= el.maxAge) {
          // End-of-life ribbon tail → inject a splash so the ribbon
          // visually "breaks off" into drops. Cheap realism win.
          this.spawnEndOfLifeSplash(el, g, scale);
          samples.splice(i, 1);
        }
      }

      // 1c. Spawn splash droplets at a rate driven by intensity + speed.
      this.spawnSplashesFromTip(
        params,
        tip,
        svx,
        svy,
        speedPx,
        dt,
        scale,
        momentumMode,
      );

      this.lastTipPos[key] = { x: tip.x, y: tip.y };
    }

    // 2. Age splash pool, evict dead.
    const survivingSplashes: WaterElement[] = [];
    for (const s of this.splashes) {
      s.age += dt;
      if (s.age < s.maxAge) survivingSplashes.push(s);
    }
    this.splashes = survivingSplashes;

    // Early exit if nothing to draw.
    const anyStream = TIP_KEYS.some((k) => (this.stream[k]?.length ?? 0) > 0);
    if (!anyStream && this.splashes.length === 0) return;

    const baseR = params.baseRadius * scale;
    const bodyRadius = baseR * (1.3 + 0.6 * params.intensity);

    // Momentum mode: direct-draw chunks to the main ctx with crisp edges,
    // flat body color, rim light, and specular — skip the offscreen +
    // gooey-filter pipeline entirely. The filter always reads as "blur
    // vibes" because metaball rendering *is* blur-then-threshold; real
    // water has volumetric shading instead. Draw each chunk as a stretched
    // ellipse path + thin rim arc + specular dot.
    if (momentumMode) {
      this.drawMomentumChunksDirect(ctx, params, g, bodyRadius);
      return;
    }

    // 3. Prepare full-res offscreen mask.
    const mainW = ctx.canvas.width;
    const mainH = ctx.canvas.height;
    this.ensureOffscreen(mainW, mainH);
    const off = this.offctx;
    if (!off) return; // no offscreen → skip gracefully
    off.clearRect(0, 0, mainW, mainH);

    // 4. Draw pure-white mask.
    off.save();
    off.globalCompositeOperation = "source-over";
    off.fillStyle = "#ffffff";

    // 4a. Ribbon — each tip's stream rendered as a tapered chain of
    //     overlapping disks. The gooey filter fuses them into a smooth
    //     ribbon.
    for (const key of TIP_KEYS) {
      const samples = this.stream[key];
      if (!samples || samples.length < 1) continue;

      // Precompute current positions + per-sample radius/alpha.
      const cache = samples.map((s) => {
        const pt = computeBallistic(s, g);
        const ageT = s.age / s.maxAge;
        // Newer samples are fatter, older thinner.
        const widthT = 1 - ageT;
        const radius = Math.max(1, bodyRadius * s.width * (0.3 + 0.7 * widthT));
        const alpha = Math.min(1, 0.25 + 0.9 * widthT);
        return { x: pt.x, y: pt.y, radius, alpha };
      });

      for (let i = 0; i < cache.length; i++) {
        const c = cache[i]!;
        off.globalAlpha = c.alpha;
        off.beginPath();
        off.arc(c.x, c.y, c.radius, 0, TAU);
        off.fill();

        // Interpolate disks along the segment to the next sample so the
        // ribbon never has gaps even at high tip speeds.
        if (i + 1 < cache.length) {
          const n = cache[i + 1]!;
          const dx = n.x - c.x;
          const dy = n.y - c.y;
          const segLen = Math.hypot(dx, dy);
          const stepSpacing = Math.max(1.5, Math.min(c.radius, n.radius) * 0.7);
          const steps = Math.min(16, Math.max(1, Math.ceil(segLen / stepSpacing)));
          for (let k = 1; k < steps; k++) {
            const t = k / steps;
            const r = c.radius + (n.radius - c.radius) * t;
            const a = c.alpha + (n.alpha - c.alpha) * t;
            off.globalAlpha = a;
            off.beginPath();
            off.arc(c.x + dx * t, c.y + dy * t, r, 0, TAU);
            off.fill();
          }
        }
      }
    }

    // 4b. Splash droplets — drawn as a velocity-stretched teardrop cluster.
    //     The whole cluster lives in a rotated+scaled local frame so fast
    //     chunks elongate dramatically along their flight direction, slow
    //     chunks stay rounder. Inside the local frame: big head at origin,
    //     2-3 overlapping satellites trailing along -X (opposite flight).
    //     The gooey filter then fuses the stretched cluster into a smooth
    //     teardrop/comma outline with crisp edges.
    for (const s of this.splashes) {
      const pt = computeBallistic(s, g);
      const ageT = s.age / s.maxAge;
      const fade = ageT < 0.15 ? ageT / 0.15 : ageT > 0.7 ? 1 - (ageT - 0.7) / 0.3 : 1;
      if (fade <= 0.05) continue;
      const headR = Math.max(1, bodyRadius * s.width * 0.55);

      // Velocity at current age (gravity has affected vy).
      const currVy = s.vy0 + g * s.age;
      const sp = Math.hypot(s.vx0, currVy);
      const angle = sp > 1 ? Math.atan2(currVy, s.vx0) : 0;
      // Non-area-preserving stretch: elongates along velocity 1×→3.5×.
      // We want water streaks, not ovals; scaling only X (not 1/X on Y)
      // gives real motion-blur-style elongation like real falling water.
      const stretchX = 1 + Math.min(2.5, sp / 400);
      const squashY = 0.75 + 0.25 * Math.min(1, sp / 800); // slight pinch perp to flight

      // Seed-derived cluster asymmetry — each chunk gets its own shape.
      const seed = s.blobSeed;
      const tailOffset1 = headR * (0.7 + seed * 0.6);
      const tailOffset2 = headR * (1.4 + seed * 0.7);
      const tailR1 = headR * (0.8 + ((seed * 3.1) % 1) * 0.25);
      const tailR2 = headR * (0.45 + ((seed * 5.7) % 1) * 0.3);
      const perpJitter = (((seed * 7.3) % 1) - 0.5) * headR * 0.35;

      off.globalAlpha = fade;
      off.save();
      off.translate(pt.x, pt.y);
      if (sp > 1) {
        off.rotate(angle);
        off.scale(stretchX, squashY);
      }
      // Head (at cluster origin).
      off.beginPath();
      off.arc(0, 0, headR, 0, TAU);
      off.fill();
      // Trailing satellites along -X (opposite flight direction).
      off.beginPath();
      off.arc(-tailOffset1, perpJitter, tailR1, 0, TAU);
      off.fill();
      if (tailR2 > 1.2) {
        off.beginPath();
        off.arc(-tailOffset2, perpJitter * 0.5, tailR2, 0, TAU);
        off.fill();
      }
      off.restore();
    }
    off.restore();

    // 5. Composite through gooey filter + color fill + highlights.
    if (!this.filterProbeDone) {
      this.filterSupported = this.probeFilterSupport(ctx);
      this.filterProbeDone = true;
    }
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFilter = ctx.filter;
    const prevFillStyle = ctx.fillStyle;
    try {
      const { core, highlight } = params.resolvedPalette;
      if (this.filterSupported) {
        // Gooey filter — blur fuses neighbors, contrast cliff thresholds
        // the resulting alpha into crisp ribbon/drop edges.
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        // Momentum mode: small blur + *huge* contrast. The goal is
        // metaball fusion of the cluster into a teardrop with HARD edges
        // (what water actually has) — not a soft-blur halo (what the
        // ribbon pipeline produces). High contrast clips the alpha
        // gradient into a near-binary cliff, so the end result reads as
        // a crisp-edged liquid shape instead of fuzzy goo.
        const blurPx = momentumMode
          ? Math.max(3, Math.round(4 * scale))
          : Math.max(5, Math.round(8 * scale));
        const contrastX = momentumMode
          ? 120 + params.surfaceTension * 40
          : 26 + params.surfaceTension * 22;
        ctx.filter = `blur(${blurPx}px) contrast(${contrastX.toFixed(1)})`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(this.offscreen as any, 0, 0);
        ctx.filter = "none";

        // Replace RGB with the water color, keep the crisp alpha mask.
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = core;
        ctx.globalAlpha = 1.0 - params.clarity * 0.12;
        ctx.fillRect(0, 0, mainW, mainH);
      } else {
        // Fallback: tinted additive blit.
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.85;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ctx.drawImage(this.offscreen as any, 0, 0);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, mainW, mainH);
      }

      // Specular highlights at every live ribbon sample head + newest
      // samples of every tip. Keeps the wet-sheen read.
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.fillStyle = highlight;
      for (const key of TIP_KEYS) {
        const samples = this.stream[key];
        if (!samples || samples.length === 0) continue;
        // Only the newest ~3 samples get a highlight — older samples
        // have settled into the ribbon body.
        const startIdx = Math.max(0, samples.length - 3);
        for (let i = startIdx; i < samples.length; i++) {
          const s = samples[i]!;
          const pt = computeBallistic(s, g);
          const ageT = s.age / s.maxAge;
          const r = Math.max(1, bodyRadius * s.width * (0.3 + 0.7 * (1 - ageT)));
          if (r < 2) continue;
          ctx.globalAlpha = (1 - ageT) * 0.55;
          ctx.beginPath();
          ctx.arc(pt.x - r * 0.22, pt.y - r * 0.28, r * 0.3, 0, TAU);
          ctx.fill();
        }
      }
      // Splash highlights — in momentum mode, a tiny specular crescent on
      // the leading edge of each chunk (reads as wet-shine, not glow).
      // In classic mode, the original bigger top-left dot (ribbon look).
      for (const s of this.splashes) {
        const pt = computeBallistic(s, g);
        const ageT = s.age / s.maxAge;
        const fade = ageT < 0.15 ? ageT / 0.15 : ageT > 0.7 ? 1 - (ageT - 0.7) / 0.3 : 1;
        if (fade <= 0.1) continue;
        const r = Math.max(1, bodyRadius * s.width * 0.55);
        if (r < 2) continue;
        if (momentumMode) {
          // Tiny specular dot on the leading edge of the head sphere
          // (where light would catch a moving wet surface). Much smaller
          // and slightly offset forward along flight — crescent feel
          // without the extra mask complexity.
          const currVy = s.vy0 + g * s.age;
          const sp = Math.hypot(s.vx0, currVy);
          const cosA = sp > 1 ? s.vx0 / sp : 0;
          const sinA = sp > 1 ? currVy / sp : 0;
          const specR = r * 0.16;
          const specX = pt.x + cosA * r * 0.45 - sinA * r * 0.25;
          const specY = pt.y + sinA * r * 0.45 + cosA * r * 0.25;
          ctx.globalAlpha = fade * 0.35;
          ctx.beginPath();
          ctx.arc(specX, specY, specR, 0, TAU);
          ctx.fill();
        } else {
          ctx.globalAlpha = fade * 0.45;
          ctx.beginPath();
          ctx.arc(pt.x - r * 0.25, pt.y - r * 0.3, r * 0.28, 0, TAU);
          ctx.fill();
        }
      }
    } finally {
      ctx.filter = prevFilter;
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFillStyle;
    }
  }

  private spawnSplashesFromTip(
    params: Water2DParams,
    tip: { x: number; y: number },
    vx: number,
    vy: number,
    speedPx: number,
    dt: number,
    scale: number,
    momentumMode: boolean,
  ): void {
    if (this.splashes.length >= MAX_SPLASHES) return;

    const PX_PER_WORLD_UNIT = 60;
    const refSpeedPx = params.motionReferenceSpeed * PX_PER_WORLD_UNIT * scale;
    const speedScalar = refSpeedPx > 0 ? Math.min(1, speedPx / refSpeedPx) : 0;

    // Momentum mode: cut ambient to near-zero (no constant mist), crank
    // motion response so hard flings launch big wet chunks, mild motion
    // still yields something but sparsely.
    const ambientScale = momentumMode ? 0.03 : 0.35;
    const motionScale = momentumMode ? 1.2 : 0.55;
    const ambientRate = params.ambientEmission * params.ambientSpawnRate * ambientScale;
    const motionRate =
      params.motionEmission * speedScalar * params.motionSpawnRate * motionScale;
    const expected = (ambientRate + motionRate) * dt;

    let spawnCount = Math.floor(expected);
    if (Math.random() < expected - spawnCount) spawnCount++;
    const slots = MAX_SPLASHES - this.splashes.length;
    if (spawnCount > slots) spawnCount = slots;
    if (spawnCount <= 0) return;

    // In momentum mode, chunk size + fling magnitude ride speedScalar so
    // fast sweeps throw big globs and slow sweeps throw tiny drips.
    const kickBase = momentumMode ? 40 + speedScalar * 140 : 50;
    const kickVar = momentumMode ? 60 + speedScalar * 140 : 90;
    const widthBase = momentumMode ? 0.8 + speedScalar * 1.5 : 0.55;
    const widthVar = momentumMode ? 0.6 + speedScalar * 0.8 : 0.6;
    // Low velocity inheritance so the tip *leaves chunks behind* as it
    // sweeps — this is the charcoal trick that makes sparks trail the
    // prop. Chunks get ~40% of tip velocity and then a backward kick,
    // so the tip's continued forward motion creates the classic wet-trail
    // shedding read.
    const velInherit = momentumMode ? 0.4 : 0.55;
    // Momentum mode: narrow kick cone pointing *opposite* to the tip's
    // motion — water sheds behind the moving prop (like drops flying off
    // a whipped mop, or sparks trailing a sword). Cone tightens as
    // momentum builds so fast sweeps throw tight backward streams, slow
    // sweeps fan out. Stationary tip → isotropic.
    const motionDir = speedPx > 1 ? Math.atan2(vy, vx) : null;
    const shedDir = motionDir !== null ? motionDir + Math.PI : null;
    const coneHalfAngle = 0.75 - speedScalar * 0.45; // ~0.75 rad @ slow → ~0.3 rad @ fast

    for (let i = 0; i < spawnCount; i++) {
      const kickMag = kickBase + Math.random() * kickVar;
      const kickAngle =
        momentumMode && shedDir !== null
          ? shedDir + (Math.random() - 0.5) * 2 * coneHalfAngle
          : Math.random() * Math.PI * 2;
      const ox = (Math.random() - 0.5) * 6 * scale;
      const oy = (Math.random() - 0.5) * 6 * scale;
      this.splashes.push({
        x0: tip.x + ox,
        y0: tip.y + oy,
        vx0: vx * velInherit + Math.cos(kickAngle) * kickMag * scale,
        vy0: vy * velInherit + Math.sin(kickAngle) * kickMag * scale,
        age: 0,
        maxAge: SPLASH_LIFE_MIN + Math.random() * SPLASH_LIFE_VAR,
        width: widthBase + Math.random() * widthVar,
        blobSeed: Math.random(),
      });
    }
  }

  /**
   * Direct-draw momentum-mode chunks to the main context, no offscreen
   * mask, no gooey filter. Each chunk is:
   *   1. A velocity-stretched ellipse body in water core color (crisp edge)
   *   2. A thin rim-light arc on the leading edge (highlight color)
   *   3. A tiny specular dot on the leading edge (highlight, crisper)
   * This is what gives chunks the "drop of water" read — volumetric depth
   * through layered shading, not blurred goo.
   */
  private drawMomentumChunksDirect(
    ctx: CanvasRenderingContext2D,
    params: Water2DParams,
    g: number,
    bodyRadius: number,
  ): void {
    if (this.splashes.length === 0) return;
    const { core, highlight } = params.resolvedPalette;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    const prevFillStyle = ctx.fillStyle;
    const prevStrokeStyle = ctx.strokeStyle;
    const prevLineWidth = ctx.lineWidth;
    try {
      ctx.globalCompositeOperation = "source-over";
      for (const s of this.splashes) {
        const pt = computeBallistic(s, g);
        const ageT = s.age / s.maxAge;
        const fade =
          ageT < 0.1 ? ageT / 0.1 : ageT > 0.75 ? 1 - (ageT - 0.75) / 0.25 : 1;
        if (fade <= 0.05) continue;

        const headR = Math.max(1, bodyRadius * s.width * 0.6);
        // Elongate along velocity — 1× at rest, up to 3× at full flight.
        const currVy = s.vy0 + g * s.age;
        const sp = Math.hypot(s.vx0, currVy);
        const stretchX = 1 + Math.min(2.0, sp / 420);
        const squashY = 0.8 + 0.2 * Math.min(1, sp / 900);
        const angle = sp > 1 ? Math.atan2(currVy, s.vx0) : 0;

        ctx.save();
        ctx.translate(pt.x, pt.y);
        if (sp > 1) ctx.rotate(angle);

        // 1. Body: solid water color, crisp edge. Drawn as an ellipse
        //    with stretchX × squashY in local frame. Alpha slightly
        //    below 1 so overlaps pool naturally instead of flat-stamping.
        ctx.globalAlpha = fade * (0.88 - params.clarity * 0.18);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.ellipse(0, 0, headR * stretchX, headR * squashY, 0, 0, TAU);
        ctx.fill();

        // 2. Rim light: thin bright arc on the leading (+X) edge. Reads
        //    as the wet-surface catching light as the chunk flies.
        ctx.globalAlpha = fade * 0.55;
        ctx.strokeStyle = highlight;
        ctx.lineWidth = Math.max(1, headR * 0.18);
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          headR * stretchX,
          headR * squashY,
          0,
          -Math.PI * 0.55,
          Math.PI * 0.1,
        );
        ctx.stroke();

        // 3. Specular: small bright dot on the upper-leading edge.
        //    Positioned in the local (pre-rotation) frame so it tracks the
        //    chunk's flight direction.
        const specR = Math.max(0.8, headR * 0.18);
        const specX = headR * stretchX * 0.45;
        const specY = -headR * squashY * 0.55;
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = highlight;
        ctx.beginPath();
        ctx.arc(specX, specY, specR, 0, TAU);
        ctx.fill();

        ctx.restore();
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.fillStyle = prevFillStyle;
      ctx.strokeStyle = prevStrokeStyle;
      ctx.lineWidth = prevLineWidth;
    }
  }

  private spawnEndOfLifeSplash(
    src: WaterElement,
    g: number,
    scale: number,
  ): void {
    if (this.splashes.length >= MAX_SPLASHES) return;
    // Only spawn eol splash occasionally so we don't flood.
    if (Math.random() > 0.18) return;
    const pt = computeBallistic(src, g);
    const currVy = src.vy0 + g * src.age;
    // Mild scatter so the tail breaks up into a few drops — but the
    // scatter is a narrow cone around the sample's own flight direction,
    // not isotropic. Breaking ribbons shed drops *along* their path.
    const kickMag = 20 + Math.random() * 40;
    const flightSpeed = Math.hypot(src.vx0, currVy);
    const flightDir = flightSpeed > 1 ? Math.atan2(currVy, src.vx0) : 0;
    const kickAngle = flightDir + (Math.random() - 0.5) * 0.8;
    this.splashes.push({
      x0: pt.x,
      y0: pt.y,
      blobSeed: Math.random(),
      vx0: src.vx0 * 0.9 + Math.cos(kickAngle) * kickMag * scale,
      vy0: currVy * 0.9 + Math.sin(kickAngle) * kickMag * scale,
      age: 0,
      maxAge: SPLASH_LIFE_MIN + Math.random() * SPLASH_LIFE_VAR,
      width: 0.5 + Math.random() * 0.4,
    });
  }

  private ensureOffscreen(w: number, h: number): void {
    if (this.offscreen && this.offW === w && this.offH === h) return;
    this.offW = w;
    this.offH = h;
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        this.offscreen = new OffscreenCanvas(w, h);
        this.offctx = (this.offscreen as OffscreenCanvas).getContext("2d");
        return;
      }
    } catch {
      // fall through
    }
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      this.offscreen = c;
      this.offctx = c.getContext("2d");
      return;
    }
    this.offscreen = null;
    this.offctx = null;
  }

  private probeFilterSupport(ctx: CanvasRenderingContext2D): boolean {
    try {
      const prev = ctx.filter;
      ctx.filter = "blur(2px)";
      const applied = ctx.filter;
      ctx.filter = prev;
      return typeof applied === "string" && applied.includes("blur");
    } catch {
      return false;
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
    this.stream = {};
    this.splashes = [];
    this.lastTipPos = {};
    this.smoothedVelocity = {};
    this.offscreen = null;
    this.offctx = null;
    this.offW = 0;
    this.offH = 0;
    this.filterProbeDone = false;
    this.filterSupported = false;
  }
}

/** Ballistic position at current age — release point + constant horizontal
 *  velocity + gravity-accelerated vertical velocity. */
function computeBallistic(e: WaterElement, g: number): { x: number; y: number } {
  return {
    x: e.x0 + e.vx0 * e.age,
    y: e.y0 + e.vy0 * e.age + 0.5 * g * e.age * e.age,
  };
}
