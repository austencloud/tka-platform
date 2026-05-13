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

interface Phantom {
  posA: Vec2;
  posB: Vec2;
  /** `currentStep` at the moment of capture. Age = (currentStep - capturedStep) / interval. */
  capturedStep: number;
}

/**
 * Beat-onset phantom renderer for the Canvas2D backend.
 *
 * On each frame, reads the current animation step; when a beat boundary
 * is crossed (`floor(currentStep / interval) > lastStepIndex`), captures
 * a phantom of each active prop's tip pair. Phantoms age by the same
 * step index and are culled once their age (in intervals) reaches `decay`.
 *
 * Rendering uses additive blend so overlapping phantoms brighten where
 * the prop returned to a position - the viewer sees the beat lattice as
 * a constellation of fading ghosts.
 */
export class Echo2DRenderer {
  private phantomsBlue: Phantom[] = [];
  private phantomsRed: Phantom[] = [];
  private lastStepIndex: number = -1;
  private previousStep: number = -1;

  private static readonly MAX_PHANTOMS = 200;
  private static readonly LOOP_DETECTION_THRESHOLD = 0.5;

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
        });
      }
      if (tips.redPosA && tips.redPosB) {
        this.phantomsRed.push({
          posA: { x: tips.redPosA.x, y: tips.redPosA.y },
          posB: { x: tips.redPosB.x, y: tips.redPosB.y },
          capturedStep: tips.currentStep,
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

    try {
      ctx.globalCompositeOperation = params.blendMode ?? "lighter";
      ctx.lineCap = "round";
      // thickness is px at reference size.
      ctx.lineWidth = params.thickness * scale;

      for (const phantom of this.phantomsBlue) {
        const age = ageInIntervals(phantom);
        const alpha = params.intensity * Math.max(0, 1 - age / cullAge);
        const color = this.pickColor(
          params,
          Math.floor(phantom.capturedStep / params.interval),
          age,
          tips.blueColor,
        );
        this.drawPhantom(ctx, phantom, params, alpha, color, scale);
      }
      for (const phantom of this.phantomsRed) {
        const age = ageInIntervals(phantom);
        const alpha = params.intensity * Math.max(0, 1 - age / cullAge);
        const color = this.pickColor(
          params,
          Math.floor(phantom.capturedStep / params.interval),
          age,
          tips.redColor,
        );
        this.drawPhantom(ctx, phantom, params, alpha, color, scale);
      }
    } finally {
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
      ctx.lineCap = prevLineCap;
      ctx.lineWidth = prevLineWidth;
      ctx.strokeStyle = prevStroke;
      ctx.fillStyle = prevFill;
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
  ): void {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    if (params.shape === "staff" || params.shape === "both") {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(phantom.posA.x, phantom.posA.y);
      ctx.lineTo(phantom.posB.x, phantom.posB.y);
      ctx.stroke();
    }
    if (params.shape === "tips" || params.shape === "both") {
      ctx.fillStyle = color;
      const tipR = params.thickness * scale;
      ctx.beginPath();
      ctx.arc(phantom.posA.x, phantom.posA.y, tipR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(phantom.posB.x, phantom.posB.y, tipR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    this.phantomsBlue = [];
    this.phantomsRed = [];
    this.lastStepIndex = -1;
    this.previousStep = -1;
  }
}
