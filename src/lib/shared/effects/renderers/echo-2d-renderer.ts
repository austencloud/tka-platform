import type { Echo2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";

/**
 * Input for the echo overlay. Each prop contributes a tip pair (A + B ends of
 * the staff) - a clone captures the whole pair at once so the rendered staff
 * correctly connects the two ends the user sees in the live staff. The flat
 * emitter list carries every prop including tunnel kaleidoscope layers
 * (propIndex >= 2); pairs are reconstructed by grouping on propIndex, so the
 * strobe lattice covers the whole stack.
 *
 * `currentStep` drives beat-onset detection. It is the authoritative step index
 * from the animation engine (fractional, advances during playback) - using it
 * instead of wall-clock dt makes the strobe land exactly on the beat grid
 * regardless of frame jitter.
 *
 * Each emitter's `color` is consumed when `params.colorMode === "prop-matched"`
 * (spectrum-gated per prop by the builder).
 */
export interface EchoTipInput {
  emitters: EmitterTip[];
  /** Current animation step index (fractional). Used for beat-onset detection. */
  currentStep: number;
}

type Vec2 = { x: number; y: number };

/** The previous clone's frozen tip pair for one prop, used to draw the streak. */
interface ClonePos {
  posA: Vec2;
  posB: Vec2;
}

/**
 * Long-exposure strobe stamp for the Canvas2D backend.
 *
 * On each beat boundary (`floor(currentStep / interval)` advances) it STAMPS a
 * crisp light-painted clone of each active prop's tip pair into the target
 * canvas. It does NOT manage persistence or fade - that is the
 * EchoOverlayRenderer's accumulation buffer. The renderer only draws on the
 * beat; non-beat frames are a no-op. The accumulator keeps every stamp and
 * fades it over the exposure window, so the screen shows a march of clones
 * marching through space - the literal strobe-flash long exposure.
 *
 * Each clone is rendered as light:
 *   - a glowing staff (shadowBlur halo + a white-hot core),
 *   - tips as radiant orbs (radial gradient),
 *   - a faint velocity-aware streak from the previous clone to this one
 *     (`params.streak`), so the exposure reads as one continuous strobe rather
 *     than isolated stamps,
 *   - a bright additive flash pop at the staff midpoint (`params.flash`).
 *
 * Additive blend means overlapping clones brighten where the prop returned to a
 * position.
 */
export class Echo2DRenderer {
  private lastStepIndex: number = -1;
  private previousStep: number = -1;
  /** Last frame's tip positions (keyed by emitter id), for per-end velocity. */
  private prevTips = new Map<string, Vec2>();
  /** Previous stamped clone per propIndex, for the connective streak. */
  private lastClonePos = new Map<number, ClonePos>();

  private static readonly LOOP_DETECTION_THRESHOLD = 0.5;
  /** Base alpha of the connective streak at `streak` = 1. */
  private static readonly STREAK_BASE = 0.5;

  render(
    ctx: CanvasRenderingContext2D,
    params: Echo2DParams,
    input: EchoTipInput,
    scale: number = 1,
  ): void {
    const { emitters, currentStep } = input;

    // Detect animation loop (currentStep jumps backward). Reset onset tracking
    // and the streak's previous-position memory so the next iteration starts a
    // fresh exposure. (The overlay clears the accumulator on the same signal.)
    if (
      this.previousStep >= 0 &&
      this.previousStep - currentStep > Echo2DRenderer.LOOP_DETECTION_THRESHOLD
    ) {
      this.lastStepIndex = -1;
      this.lastClonePos.clear();
    }
    this.previousStep = currentStep;

    // Group emitters into per-prop (A,B) pairs keyed by propIndex. A clone
    // captures a whole prop's tip pair; layers (propIndex >= 2) become their
    // own clones with their own spectrum-gated color.
    const pairs = new Map<number, { a?: EmitterTip; b?: EmitterTip }>();
    for (const e of emitters) {
      let slot = pairs.get(e.propIndex);
      if (!slot) { slot = {}; pairs.set(e.propIndex, slot); }
      if (e.end === "A") slot.a = e;
      else slot.b = e;
    }

    // Beat-onset detection. floor() places every sub-step within one beat
    // cell; the transition from one cell to the next is the onset. Only stamp
    // on the onset - the accumulator holds the rest.
    const stepNumber = Math.floor(currentStep / params.interval);
    const onset = stepNumber > this.lastStepIndex;

    if (onset) {
      const prevComposite = ctx.globalCompositeOperation;
      const prevAlpha = ctx.globalAlpha;
      const prevLineCap = ctx.lineCap;
      const prevLineWidth = ctx.lineWidth;
      const prevStroke = ctx.strokeStyle;
      const prevFill = ctx.fillStyle;
      const prevBlur = ctx.shadowBlur;
      const prevShadow = ctx.shadowColor;

      try {
        ctx.globalCompositeOperation = params.blendMode ?? "lighter";
        ctx.lineCap = "round";

        for (const [propIndex, { a, b }] of pairs) {
          if (!a || !b) continue;
          const posA: Vec2 = { x: a.x, y: a.y };
          const posB: Vec2 = { x: b.x, y: b.y };
          const velA = this.velocityAt(emitterId(a.propIndex, a.tipIndex), a);
          const velB = this.velocityAt(emitterId(b.propIndex, b.tipIndex), b);
          const color = this.pickColor(params, stepNumber, a.color);

          const prior = this.lastClonePos.get(propIndex);
          if (prior && params.streak > 0) {
            this.drawStreak(ctx, prior, posA, posB, velA, velB, params, color, scale);
          }
          this.drawClone(ctx, posA, posB, params, color, scale);
          if (params.flash > 0) {
            this.drawFlash(ctx, posA, posB, params, color, scale);
          }

          this.lastClonePos.set(propIndex, { posA, posB });
        }
      } finally {
        ctx.globalCompositeOperation = prevComposite;
        ctx.globalAlpha = prevAlpha;
        ctx.lineCap = prevLineCap;
        ctx.lineWidth = prevLineWidth;
        ctx.strokeStyle = prevStroke;
        ctx.fillStyle = prevFill;
        ctx.shadowBlur = prevBlur;
        ctx.shadowColor = prevShadow;
      }

      this.lastStepIndex = stepNumber;
    }

    // Remember positions for next frame's velocity (every frame, so a clone
    // stamped on the next beat carries an up-to-date swing direction).
    this.rememberTips(emitters);
  }

  private velocityAt(id: string, cur: Vec2): Vec2 {
    const prev = this.prevTips.get(id);
    return prev ? { x: cur.x - prev.x, y: cur.y - prev.y } : { x: 0, y: 0 };
  }

  private rememberTips(emitters: EmitterTip[]): void {
    const seen = new Set<string>();
    for (const e of emitters) {
      const id = emitterId(e.propIndex, e.tipIndex);
      seen.add(id);
      this.prevTips.set(id, { x: e.x, y: e.y });
    }
    for (const id of this.prevTips.keys()) if (!seen.has(id)) this.prevTips.delete(id);
  }

  private pickColor(
    params: Echo2DParams,
    beatIdx: number,
    propColor: string,
  ): string {
    switch (params.colorMode) {
      case "rainbow":
        // 47° per beat - coprime with 360 so the cycle doesn't repeat for 360 beats.
        return `hsl(${(beatIdx * 47) % 360}, 80%, 60%)`;
      case "gradient": {
        // Red → violet sweep across the exposure window, keyed to capture-beat
        // (color bakes at stamp time, so it can't fade by age post-capture).
        const span = Math.max(1, params.decay);
        const hue = ((((beatIdx % span) + span) % span) / span) * 280;
        return `hsl(${hue}, 80%, 60%)`;
      }
      case "prop-matched":
        return propColor;
      case "solid":
      default:
        return params.color;
    }
  }

  /** A crisp light-painted clone of the staff's tip pair, stamped once. */
  private drawClone(
    ctx: CanvasRenderingContext2D,
    posA: Vec2,
    posB: Vec2,
    params: Echo2DParams,
    color: string,
    scale: number,
  ): void {
    const glow = params.glow ?? 0;
    const thick = params.thickness * scale;
    const blur = glow * thick * 1.2;

    const drawStaff = params.shape === "staff" || params.shape === "both";
    const drawTips = params.shape === "tips" || params.shape === "both";

    if (drawStaff) {
      // Glowing colored body.
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.stroke();

      // White-hot core down the middle.
      ctx.shadowBlur = blur * 0.4;
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = Math.max(1, thick * 0.4);
      ctx.beginPath();
      ctx.moveTo(posA.x, posA.y);
      ctx.lineTo(posB.x, posB.y);
      ctx.stroke();
    }

    if (drawTips) {
      const r = Math.max(1, thick * 1.3);
      this.orb(ctx, posA.x, posA.y, r, color, blur);
      this.orb(ctx, posB.x, posB.y, r, color, blur);
    }

    ctx.shadowBlur = 0;
  }

  /**
   * Faint velocity-aware thread from the previous clone's ends to this one's.
   * Body-to-body, dim, additive, beat-gated - the dim LED smear between strobe
   * flashes. Kept deliberately distinct from Trails (a bright tapered tip ribbon).
   */
  private drawStreak(
    ctx: CanvasRenderingContext2D,
    prior: ClonePos,
    posA: Vec2,
    posB: Vec2,
    velA: Vec2,
    velB: Vec2,
    params: Echo2DParams,
    color: string,
    scale: number,
  ): void {
    const alpha = params.streak * Echo2DRenderer.STREAK_BASE;
    if (alpha <= 0) return;
    const thick = params.thickness * scale;
    ctx.shadowBlur = (params.glow ?? 0) * thick * 0.8;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, thick * 0.5);

    // Each end's thread bows the way the prop swung (control point offset by the
    // frozen velocity at capture).
    this.streakEnd(ctx, prior.posA, posA, velA);
    this.streakEnd(ctx, prior.posB, posB, velB);
    ctx.shadowBlur = 0;
  }

  private streakEnd(
    ctx: CanvasRenderingContext2D,
    from: Vec2,
    to: Vec2,
    vel: Vec2,
  ): void {
    const cx = (from.x + to.x) / 2 - vel.x * 0.5;
    const cy = (from.y + to.y) / 2 - vel.y * 0.5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(cx, cy, to.x, to.y);
    ctx.stroke();
  }

  /** A radiant tip orb: white-hot center → color → transparent. */
  private orb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    blur: number,
  ): void {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha("#ffffff", 1));
    g.addColorStop(0.4, withAlpha(color, 1));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.globalAlpha = 1;
    ctx.shadowBlur = blur * 0.5;
    ctx.shadowColor = color;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Bright additive pop at the staff midpoint - the strobe flash, baked in. */
  private drawFlash(
    ctx: CanvasRenderingContext2D,
    posA: Vec2,
    posB: Vec2,
    params: Echo2DParams,
    color: string,
    scale: number,
  ): void {
    const flash = params.flash ?? 0;
    if (flash <= 0) return;
    const mx = (posA.x + posB.x) / 2;
    const my = (posA.y + posB.y) / 2;
    const r = params.thickness * scale * 4;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0, withAlpha("#ffffff", flash));
    g.addColorStop(0.5, withAlpha(color, flash * 0.5));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
  }

  /** Reset cross-frame state. Called on loop and dispose. */
  reset(): void {
    this.lastStepIndex = -1;
    this.previousStep = -1;
    this.prevTips.clear();
    this.lastClonePos.clear();
  }

  dispose(): void {
    this.reset();
  }
}

/** Blend a color with an alpha. Handles `#rgb`/`#rrggbb` and `hsl(...)`. */
function withAlpha(color: string, alpha: number): string {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  if (color.startsWith("#")) {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (color.startsWith("hsl(") && !color.startsWith("hsla(")) {
    return `hsla${color.slice(3, -1)}, ${a})`;
  }
  if (color.startsWith("rgb(") && !color.startsWith("rgba(")) {
    return `rgba${color.slice(3, -1)}, ${a})`;
  }
  return color;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}
