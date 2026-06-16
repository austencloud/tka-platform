import type { Echo2DParams } from "../translators/canvas2d-types";

/**
 * Per-tip input for the echo overlay. Each prop contributes a tip pair
 * (A + B ends of the staff) - a phantom captures the whole pair at once
 * so the rendered line correctly connects the two ends the user sees in
 * the live staff.
 *
 * `currentStep` drives beat-onset detection and phantom aging. It is the
 * authoritative step index from the animation engine (fractional, advances
 * during playback) - using it instead of wall-clock dt makes the
 * stroboscope land exactly on the beat grid regardless of frame jitter.
 *
 * `blueColor` / `redColor` are consumed when `params.colorMode === "prop-matched"`.
 */
export interface EchoTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
  /** Current animation step index (fractional). Used for beat-onset detection + aging. */
  currentStep: number;
  /** Hex for blue prop - used when params.colorMode === "prop-matched". */
  blueColor: string;
  /** Hex for red prop - used when params.colorMode === "prop-matched". */
  redColor: string;
}

type Vec2 = { x: number; y: number };
type TipKey = "bluePosA" | "bluePosB" | "redPosA" | "redPosB";

interface Phantom {
  posA: Vec2;
  posB: Vec2;
  /** `currentStep` at the moment of capture. Age = (currentStep - capturedStep) / interval. */
  capturedStep: number;
  /** Per-end velocity (px/frame) frozen at capture, for the directional smear. */
  velA: Vec2;
  velB: Vec2;
}

/**
 * Luminous beat-onset stroboscope for the Canvas2D backend.
 *
 * On each beat boundary (`floor(currentStep / interval)` advances) it captures
 * a phantom of each active prop's tip pair. Phantoms age by the same step index
 * and are culled once their age (in intervals) reaches `decay`. The result is a
 * lattice of fading ghosts - a visual metronome.
 *
 * Each phantom is rendered as light, not a flat stroke:
 *   - a glowing staff (shadowBlur halo + a white-hot core for fresh captures),
 *   - tips as radiant orbs (radial gradient),
 *   - temporal depth: older phantoms recede - they shrink and blur more, so the
 *     newest snapshot reads crisp and the oldest dissolves into the background,
 *   - a capture flash on the beat (a bright additive pop at the moment of
 *     capture) so each beat snaps,
 *   - a subtle motion smear frozen into each phantom from the prop's velocity at
 *     capture - a fast swing leaves a directional blur, a slow drift stays crisp.
 *
 * Additive blend means overlapping ghosts brighten where the prop returned to a
 * position. Capture/cull/loop logic is unchanged from the original stroboscope.
 */
export class Echo2DRenderer {
  private phantomsBlue: Phantom[] = [];
  private phantomsRed: Phantom[] = [];
  private lastStepIndex: number = -1;
  private previousStep: number = -1;
  /** Last frame's tip positions, for capturing per-end velocity. */
  private prevTips: Partial<Record<TipKey, Vec2>> = {};

  private static readonly MAX_PHANTOMS = 200;
  private static readonly LOOP_DETECTION_THRESHOLD = 0.5;
  /** Phantom age (in intervals) within which the capture flash is visible. */
  private static readonly FLASH_INTERVALS = 0.45;

  render(
    ctx: CanvasRenderingContext2D,
    params: Echo2DParams,
    tips: EchoTipInput,
    scale: number = 1,
  ): void {
    // Detect animation loop (currentStep jumps backward). Without this,
    // phantoms from the previous iteration get negative age and are never
    // culled — unbounded growth that eventually crashes the tab.
    if (
      this.previousStep >= 0 &&
      this.previousStep - tips.currentStep > Echo2DRenderer.LOOP_DETECTION_THRESHOLD
    ) {
      this.phantomsBlue.length = 0;
      this.phantomsRed.length = 0;
      this.lastStepIndex = -1;
    }
    this.previousStep = tips.currentStep;

    // 1. Beat-onset detection. floor() places every sub-step within one
    //    beat cell; the transition from one cell to the next is the onset.
    const stepNumber = Math.floor(tips.currentStep / params.interval);
    if (stepNumber > this.lastStepIndex) {
      if (tips.bluePosA && tips.bluePosB) {
        this.phantomsBlue.push({
          posA: { x: tips.bluePosA.x, y: tips.bluePosA.y },
          posB: { x: tips.bluePosB.x, y: tips.bluePosB.y },
          capturedStep: tips.currentStep,
          velA: this.velocityAt("bluePosA", tips.bluePosA),
          velB: this.velocityAt("bluePosB", tips.bluePosB),
        });
      }
      if (tips.redPosA && tips.redPosB) {
        this.phantomsRed.push({
          posA: { x: tips.redPosA.x, y: tips.redPosA.y },
          posB: { x: tips.redPosB.x, y: tips.redPosB.y },
          capturedStep: tips.currentStep,
          velA: this.velocityAt("redPosA", tips.redPosA),
          velB: this.velocityAt("redPosB", tips.redPosB),
        });
      }
      this.lastStepIndex = stepNumber;

      // Hard cap: drop oldest phantoms if arrays grow past safety limit.
      const cap = Echo2DRenderer.MAX_PHANTOMS;
      if (this.phantomsBlue.length > cap) {
        this.phantomsBlue.splice(0, this.phantomsBlue.length - cap);
      }
      if (this.phantomsRed.length > cap) {
        this.phantomsRed.splice(0, this.phantomsRed.length - cap);
      }
    }

    // Remember positions for next frame's velocity (after capture so the
    // captured velocity reflects the step into this frame).
    this.rememberTips(tips);

    // 2. Cull aged-out phantoms (in-place compaction - zero allocation).
    const cullAge = params.decay;
    const ageInIntervals = (p: Phantom) =>
      (tips.currentStep - p.capturedStep) / params.interval;
    let bw = 0;
    for (let i = 0; i < this.phantomsBlue.length; i++) {
      if (ageInIntervals(this.phantomsBlue[i]!) < cullAge) {
        if (i !== bw) this.phantomsBlue[bw] = this.phantomsBlue[i]!;
        bw++;
      }
    }
    this.phantomsBlue.length = bw;
    let rw = 0;
    for (let i = 0; i < this.phantomsRed.length; i++) {
      if (ageInIntervals(this.phantomsRed[i]!) < cullAge) {
        if (i !== rw) this.phantomsRed[rw] = this.phantomsRed[i]!;
        rw++;
      }
    }
    this.phantomsRed.length = rw;

    if (!this.phantomsBlue.length && !this.phantomsRed.length) return;

    // 3. Draw each phantom. Additive blend means overlapping ghosts brighten.
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

      const draw = (phantoms: Phantom[], propColor: string) => {
        for (const phantom of phantoms) {
          const age = ageInIntervals(phantom);
          const ageT = Math.min(1, Math.max(0, age / cullAge));
          const alpha = params.intensity * Math.max(0, 1 - age / cullAge);
          const color = this.pickColor(
            params,
            Math.floor(phantom.capturedStep / params.interval),
            age,
            propColor,
          );
          this.drawPhantom(ctx, phantom, params, alpha, color, scale, ageT);
          if (age < Echo2DRenderer.FLASH_INTERVALS) {
            this.drawFlash(ctx, phantom, params, color, scale, age);
          }
        }
      };
      draw(this.phantomsBlue, tips.blueColor);
      draw(this.phantomsRed, tips.redColor);
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
  }

  private velocityAt(key: TipKey, cur: Vec2): Vec2 {
    const prev = this.prevTips[key];
    return prev ? { x: cur.x - prev.x, y: cur.y - prev.y } : { x: 0, y: 0 };
  }

  private rememberTips(tips: EchoTipInput): void {
    const keys: TipKey[] = ["bluePosA", "bluePosB", "redPosA", "redPosB"];
    for (const key of keys) {
      const p = tips[key];
      if (p) this.prevTips[key] = { x: p.x, y: p.y };
      else delete this.prevTips[key];
    }
  }

  private pickColor(
    params: Echo2DParams,
    beatIdx: number,
    age: number,
    propColor: string,
  ): string {
    switch (params.colorMode) {
      case "rainbow":
        // 47° per beat - coprime with 360 so the cycle doesn't repeat for 360 beats.
        return `hsl(${(beatIdx * 47) % 360}, 80%, 60%)`;
      case "gradient":
        // Fade from red (hue 0) → violet (hue 240) across decay.
        return `hsl(${Math.min(240, (age / params.decay) * 240)}, 80%, 60%)`;
      case "prop-matched":
        return propColor;
      case "solid":
      default:
        return params.color;
    }
  }

  private drawPhantom(
    ctx: CanvasRenderingContext2D,
    phantom: Phantom,
    params: Echo2DParams,
    alpha: number,
    color: string,
    scale: number,
    ageT: number,
  ): void {
    if (alpha <= 0) return;
    const glow = params.glow ?? 0;
    const depth = params.depth ?? 0;
    const thick = params.thickness * scale;
    // Temporal depth: older phantoms recede (shrink) and blur more.
    const recede = 1 - depth * 0.45 * ageT;
    const blur = glow * thick * (1.2 + depth * ageT * 3);

    const drawStaff = params.shape === "staff" || params.shape === "both";
    const drawTips = params.shape === "tips" || params.shape === "both";

    if (drawStaff) {
      // Frozen motion smear: faded offset copies along -velocity at capture.
      const smear = Math.hypot(phantom.velA.x, phantom.velA.y) + Math.hypot(phantom.velB.x, phantom.velB.y);
      if (smear > 1.5) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, thick * recede * 0.7);
        for (let s = 1; s <= 2; s++) {
          const k = (s / 3) * 0.6;
          ctx.globalAlpha = alpha * 0.22 * (1 - s / 3);
          ctx.beginPath();
          ctx.moveTo(phantom.posA.x - phantom.velA.x * k, phantom.posA.y - phantom.velA.y * k);
          ctx.lineTo(phantom.posB.x - phantom.velB.x * k, phantom.posB.y - phantom.velB.y * k);
          ctx.stroke();
        }
      }

      // Glowing staff.
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = thick * recede;
      ctx.beginPath();
      ctx.moveTo(phantom.posA.x, phantom.posA.y);
      ctx.lineTo(phantom.posB.x, phantom.posB.y);
      ctx.stroke();

      // White-hot core - strongest on the freshest phantom, fades with age.
      ctx.shadowBlur = blur * 0.4;
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = alpha * (1 - ageT) * 0.8;
      ctx.lineWidth = Math.max(1, thick * recede * 0.4);
      ctx.beginPath();
      ctx.moveTo(phantom.posA.x, phantom.posA.y);
      ctx.lineTo(phantom.posB.x, phantom.posB.y);
      ctx.stroke();
    }

    if (drawTips) {
      const r = Math.max(1, thick * recede * 1.3);
      this.orb(ctx, phantom.posA.x, phantom.posA.y, r, color, alpha, blur);
      this.orb(ctx, phantom.posB.x, phantom.posB.y, r, color, alpha, blur);
    }

    ctx.shadowBlur = 0;
  }

  /** A radiant tip orb: white-hot center → color → transparent. */
  private orb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number,
    blur: number,
  ): void {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha("#ffffff", alpha));
    g.addColorStop(0.4, withAlpha(color, alpha));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.globalAlpha = 1;
    ctx.shadowBlur = blur * 0.5;
    ctx.shadowColor = color;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Bright additive pop at the staff midpoint on the beat of capture. */
  private drawFlash(
    ctx: CanvasRenderingContext2D,
    phantom: Phantom,
    params: Echo2DParams,
    color: string,
    scale: number,
    age: number,
  ): void {
    const flash = params.flash ?? 0;
    if (flash <= 0) return;
    const t = age / Echo2DRenderer.FLASH_INTERVALS; // 0 at capture → 1 at window end
    const a = flash * params.intensity * (1 - t);
    if (a <= 0) return;
    const mx = (phantom.posA.x + phantom.posB.x) / 2;
    const my = (phantom.posA.y + phantom.posB.y) / 2;
    // Flash expands as it fades.
    const r = params.thickness * scale * (3 + t * 6);
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0, withAlpha("#ffffff", a));
    g.addColorStop(0.5, withAlpha(color, a * 0.5));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
  }

  dispose(): void {
    this.phantomsBlue = [];
    this.phantomsRed = [];
    this.lastStepIndex = -1;
    this.previousStep = -1;
    this.prevTips = {};
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
