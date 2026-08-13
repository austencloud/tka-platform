import type { SilkPalette } from "../domain/silk-palettes";
import type { Silk2DParams } from "../translators/canvas2d-types";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";
import {
  traceCentripetalBackward,
  traceCentripetalForward,
} from "./ribbon-trace";

interface RibbonSample {
  x: number;
  y: number;
  t: number;
  speed: number;
  pathDistance: number;
}

interface RibbonTrail {
  samples: RibbonSample[];
  color: string;
  phase: number;
  lastSeenAt: number;
}

interface SilkMaterialProfile {
  propColorMix: number;
  edgeBodyMix: number;
  shadowMix: number;
  bodyAlpha: number;
  glowAlpha: number;
  edgeAlpha: number;
  foldStrength: number;
}

const MAX_SAMPLES = 300;
const AURA_STRIDE = 8;
const TAU = Math.PI * 2;

const MATERIAL_PROFILES: Record<SilkPalette["id"], SilkMaterialProfile> = {
  satin: {
    propColorMix: 0.58,
    edgeBodyMix: 0.55,
    shadowMix: 0.42,
    bodyAlpha: 0.9,
    glowAlpha: 0.02,
    edgeAlpha: 0.28,
    foldStrength: 0.24,
  },
  velvet: {
    propColorMix: 0.2,
    edgeBodyMix: 0.35,
    shadowMix: 0.54,
    bodyAlpha: 0.94,
    glowAlpha: 0.018,
    edgeAlpha: 0.22,
    foldStrength: 0.3,
  },
  ethereal: {
    propColorMix: 0.42,
    edgeBodyMix: 0.45,
    shadowMix: 0.3,
    bodyAlpha: 0.62,
    glowAlpha: 0.12,
    edgeAlpha: 0.38,
    foldStrength: 0.22,
  },
  shadow: {
    propColorMix: 0.3,
    edgeBodyMix: 0.5,
    shadowMix: 0.65,
    bodyAlpha: 0.72,
    glowAlpha: 0.01,
    edgeAlpha: 0.24,
    foldStrength: 0.34,
  },
  gold_leaf: {
    propColorMix: 0.14,
    edgeBodyMix: 0.28,
    shadowMix: 0.48,
    bodyAlpha: 0.96,
    glowAlpha: 0.03,
    edgeAlpha: 0.34,
    foldStrength: 0.32,
  },
  ember: {
    propColorMix: 0.16,
    edgeBodyMix: 0.32,
    shadowMix: 0.46,
    bodyAlpha: 0.8,
    glowAlpha: 0.18,
    edgeAlpha: 0.38,
    foldStrength: 0.24,
  },
  custom: {
    propColorMix: 0.36,
    edgeBodyMix: 0.48,
    shadowMix: 0.45,
    bodyAlpha: 0.9,
    glowAlpha: 0.035,
    edgeAlpha: 0.3,
    foldStrength: 0.28,
  },
};

/**
 * Keeps the normal two-prop, two-end view vivid while preventing tunnel layers
 * from stacking into a white disc. The floor preserves material identity at
 * high source counts without allowing total opacity to grow linearly.
 */
export function resolveSilk2DEnergyScale(sourceCount: number): number {
  if (sourceCount <= 4) return 1;
  return Math.max(0.32, Math.sqrt(4 / sourceCount));
}

/**
 * Silk opens quickly from its free tail, holds a broad middle, then gathers
 * into the prop tip. Both ends stay non-zero so the spline remains stable.
 */
export function resolveSilk2DWidthEnvelope(positionFraction: number): number {
  const p = clamp01(positionFraction);
  const tailTaper = smoothstep(0, 0.14, p);
  const attachmentThroat = 1 - 0.9 * smoothstep(0.84, 1, p);
  return Math.max(0.06, tailTaper * attachmentThroat);
}

/**
 * Motion interpolation can leave tiny frame-to-frame corners in an otherwise
 * smooth path. Two light neighbor passes remove that grit while keeping both
 * the free tail and the prop attachment exactly where they were recorded.
 */
export function smoothSilk2DPath(points: readonly { x: number; y: number }[]): {
  x: number[];
  y: number[];
} {
  let x = points.map((point) => point.x);
  let y = points.map((point) => point.y);
  if (points.length < 3) return { x, y };

  for (let pass = 0; pass < 2; pass++) {
    const nextX = [...x];
    const nextY = [...y];
    for (let index = 1; index < points.length - 1; index++) {
      nextX[index] = x[index]! * 0.64 + (x[index - 1]! + x[index + 1]!) * 0.18;
      nextY[index] = y[index]! * 0.64 + (y[index - 1]! + y[index + 1]!) * 0.18;
    }
    x = nextX;
    y = nextY;
  }

  return { x, y };
}

/** Resolve palette material color while retaining each prop's identity. */
export function resolveSilk2DMaterialColors(
  palette: SilkPalette,
  propColor: string,
  positionFraction: number
): { body: string; edge: string; shadow: string } {
  const profile = MATERIAL_PROFILES[palette.id] ?? MATERIAL_PROFILES.satin;
  const p = clamp01(positionFraction);
  const paletteBody =
    palette.hueShift && palette.bodyAlt
      ? mixColor(palette.body, palette.bodyAlt, p)
      : palette.body;
  const paletteEdge =
    palette.hueShift && palette.edgeAlt
      ? mixColor(palette.edge, palette.edgeAlt, p)
      : palette.edge;
  const body = mixColor(paletteBody, propColor, profile.propColorMix);
  const edge = mixColor(paletteEdge, body, profile.edgeBodyMix);

  return {
    body,
    edge,
    shadow: mixColor(body, "#05050c", profile.shadowMix),
  };
}

export class Silk2DRenderer {
  private time = 0;
  private tipTrails = new Map<string, RibbonTrail>();
  private lastTipPos = new Map<string, { x: number; y: number }>();

  render(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1,
    loopDetected: boolean = false
  ): void {
    this.time += dt;

    const present = new Map<string, EmitterTip>();
    for (const emitter of emitters) {
      if (!this.isEndEnabled(emitter.end, params)) continue;
      present.set(emitterId(emitter.propIndex, emitter.tipIndex), emitter);
    }

    // Keep vanished emitters in the union so their fabric decays instead of
    // disappearing on the first missing frame.
    const ids = new Set<string>(this.tipTrails.keys());
    for (const id of present.keys()) ids.add(id);

    for (const id of ids) {
      const tip = present.get(id);
      if (!tip) {
        const trail = this.tipTrails.get(id);
        if (trail) {
          this.trimTrail(trail.samples, params.lifetimeSeconds);
          if (trail.samples.length === 0) this.tipTrails.delete(id);
        }
        this.lastTipPos.delete(id);
        continue;
      }

      let trail = this.tipTrails.get(id);
      if (!trail) {
        trail = {
          samples: [],
          color: tip.color,
          phase: phaseFromId(id),
          lastSeenAt: this.time,
        };
        this.tipTrails.set(id, trail);
      }
      trail.color = tip.color;
      trail.lastSeenAt = this.time;

      if (loopDetected) {
        // The sequence seam teleports the prop. Do not stitch that jump into
        // the cloth, but prime velocity for the next continuous frame.
        this.lastTipPos.set(id, { x: tip.x, y: tip.y });
        continue;
      }

      const last = this.lastTipPos.get(id);
      let speed = 0;
      if (last && dt > 0) {
        speed = Math.hypot(tip.x - last.x, tip.y - last.y) / dt;
        speed /= 60 * scale;
      }

      const previousSample = trail.samples[trail.samples.length - 1];
      const pathDistance = previousSample
        ? (Number.isFinite(previousSample.pathDistance)
            ? previousSample.pathDistance
            : 0) +
          Math.hypot(tip.x - previousSample.x, tip.y - previousSample.y)
        : 0;
      trail.samples.push({
        x: tip.x,
        y: tip.y,
        t: this.time,
        speed,
        pathDistance,
      });
      this.trimTrail(trail.samples, params.lifetimeSeconds);
      if (trail.samples.length > MAX_SAMPLES) {
        trail.samples.splice(0, trail.samples.length - MAX_SAMPLES);
      }

      if (last) {
        last.x = tip.x;
        last.y = tip.y;
      } else {
        this.lastTipPos.set(id, { x: tip.x, y: tip.y });
      }
    }

    const drawableTrails = [...this.tipTrails.values()].filter(
      (trail) => trail.samples.length >= 3
    );
    if (drawableTrails.length === 0) return;

    const energyScale = resolveSilk2DEnergyScale(drawableTrails.length);
    const prevAlpha = ctx.globalAlpha;
    const prevComposite = ctx.globalCompositeOperation;
    ctx.save();
    try {
      ctx.globalCompositeOperation = params.blendMode ?? "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const trail of drawableTrails) {
        this.drawRibbon(ctx, params, trail, scale, energyScale);
      }
    } finally {
      ctx.restore();
      // Test contexts do not implement a state stack; explicitly restore the
      // two shared properties that other overlay renderers depend on.
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  private trimTrail(trail: RibbonSample[], lifetimeSeconds: number): void {
    const cutoff = this.time - lifetimeSeconds;
    while (trail.length > 0 && trail[0]!.t < cutoff) trail.shift();
  }

  private drawRibbon(
    ctx: CanvasRenderingContext2D,
    params: Silk2DParams,
    trail: RibbonTrail,
    scale: number,
    energyScale: number
  ): void {
    const samples = trail.samples;
    const n = samples.length;
    const basePath = smoothSilk2DPath(samples);
    const leftX = new Array<number>(n);
    const leftY = new Array<number>(n);
    const rightX = new Array<number>(n);
    const rightY = new Array<number>(n);
    const spineX = new Array<number>(n);
    const spineY = new Array<number>(n);
    const halfWidths = new Array<number>(n);
    const palette = params.resolvedPalette;
    const profile = MATERIAL_PROFILES[palette.id] ?? MATERIAL_PROFILES.satin;

    let lastTx = 1;
    let lastTy = 0;
    let maxHalfWidth = 1;

    for (let i = 0; i < n; i++) {
      const sample = samples[i]!;
      const previousIndex = Math.max(0, i - 2);
      const nextIndex = Math.min(n - 1, i + 2);
      let tx = basePath.x[nextIndex]! - basePath.x[previousIndex]!;
      let ty = basePath.y[nextIndex]! - basePath.y[previousIndex]!;
      const tangentLength = Math.hypot(tx, ty);
      if (tangentLength > 0.001) {
        tx /= tangentLength;
        ty /= tangentLength;
        lastTx = tx;
        lastTy = ty;
      } else {
        tx = lastTx;
        ty = lastTy;
      }

      const px = -ty;
      const py = tx;
      const speedFraction = clamp01(
        params.motionReferenceSpeed > 0
          ? sample.speed / params.motionReferenceSpeed
          : 0
      );
      const positionFraction = i / (n - 1);
      const freeEnd = Math.pow(1 - positionFraction, 0.72);
      const bodyEnvelope = smoothstep(0, 0.12, positionFraction) * freeEnd;
      const tautWidth = 1 - speedFraction * params.tautness * 0.58;
      const widthEnvelope = resolveSilk2DWidthEnvelope(positionFraction);
      const halfWidth = Math.max(
        0.65 * scale,
        params.baseHalfWidth *
          scale *
          params.intensity *
          tautWidth *
          widthEnvelope
      );
      halfWidths[i] = halfWidth;
      maxHalfWidth = Math.max(maxHalfWidth, halfWidth);

      const turn = clamp(signedTurn(basePath.x, basePath.y, i), -0.45, 0.45);
      const flutterEnergy =
        (0.3 + speedFraction * 0.7) * (1 - params.tautness * 0.42);
      const flutterAmplitude =
        params.flutter * scale * (1.2 + flutterEnergy * 5.5);
      const stableDistance = Number.isFinite(sample.pathDistance)
        ? sample.pathDistance
        : i * scale * 4;
      const pathCoordinate = stableDistance / Math.max(0.001, scale);
      const waveA = Math.sin(
        pathCoordinate * 0.055 -
          this.time * (1.15 + speedFraction * 1.35) +
          trail.phase
      );
      const waveB = Math.sin(
        pathCoordinate * 0.024 + this.time * 0.62 + trail.phase * 1.7
      );
      const centerFlutter =
        (waveA + waveB * 0.42) * flutterAmplitude * bodyEnvelope +
        turn * params.flutter * 7 * scale * freeEnd;
      const foldWave = Math.sin(
        pathCoordinate * 0.072 + this.time * 0.72 + trail.phase * 1.31
      );
      const fold =
        foldWave *
        halfWidth *
        params.flutter *
        0.52 *
        freeEnd *
        profile.foldStrength;
      const leftWidth = Math.max(0.45 * scale, halfWidth + fold);
      const rightWidth = Math.max(0.45 * scale, halfWidth - fold);

      spineX[i] = basePath.x[i]! + px * centerFlutter;
      spineY[i] = basePath.y[i]! + py * centerFlutter;
      leftX[i] = spineX[i]! + px * leftWidth;
      leftY[i] = spineY[i]! + py * leftWidth;
      rightX[i] = spineX[i]! - px * rightWidth;
      rightY[i] = spineY[i]! - py * rightWidth;
    }

    const representative = resolveSilk2DMaterialColors(
      palette,
      trail.color,
      0.55
    );
    const disappearanceDuration = Math.max(0.12, params.lifetimeSeconds * 0.7);
    const trailVisibility =
      1 - smoothstep(0, disappearanceDuration, this.time - trail.lastSeenAt);
    const ribbonAlpha = params.intensity * energyScale * trailVisibility;
    if (ribbonAlpha <= 0.01) return;

    // Every layer follows one unbroken path. Restarting the body and selvedges
    // every few samples created visible joints that read as frayed fabric.
    if (profile.glowAlpha > 0) {
      ctx.globalAlpha = profile.glowAlpha * ribbonAlpha;
      ctx.strokeStyle = representative.body;
      ctx.lineWidth = maxHalfWidth * (palette.emissive ? 2.8 : 2.15);
      ctx.beginPath();
      traceCentripetalForward(ctx, spineX, spineY, 0, n - 1, n);
      ctx.stroke();
    }

    if (palette.emissive) {
      ctx.globalAlpha = ribbonAlpha * 0.12;
      for (let index = 0; index < n; index += AURA_STRIDE) {
        const radius = halfWidths[index]! * 3.2;
        const gradient = ctx.createRadialGradient(
          spineX[index]!,
          spineY[index]!,
          0,
          spineX[index]!,
          spineY[index]!,
          radius
        );
        gradient.addColorStop(0, representative.edge);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(spineX[index]!, spineY[index]!, radius, 0, TAU);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // A canvas gradient lives in screen space; it cannot bend with this path.
    // The old white highlight therefore crossed curved fabric at unrelated
    // angles. Color now stays on the continuous body, while the two actual
    // ribbon boundaries provide the surface definition.
    ctx.globalAlpha = ribbonAlpha * profile.bodyAlpha;
    ctx.fillStyle = representative.body;
    ctx.beginPath();
    traceCentripetalForward(ctx, leftX, leftY, 0, n - 1, n);
    traceCentripetalBackward(ctx, rightX, rightY, 0, n - 1, n);
    ctx.closePath();
    ctx.fill();

    let edgeStyle: string | CanvasGradient = representative.edge;
    if (
      palette.hueShift &&
      Math.hypot(spineX[n - 1]! - spineX[0]!, spineY[n - 1]! - spineY[0]!) > 1
    ) {
      const edgeGradient = ctx.createLinearGradient(
        spineX[0]!,
        spineY[0]!,
        spineX[n - 1]!,
        spineY[n - 1]!
      );
      edgeGradient.addColorStop(
        0,
        resolveSilk2DMaterialColors(palette, trail.color, 0).edge
      );
      edgeGradient.addColorStop(0.5, representative.edge);
      edgeGradient.addColorStop(
        1,
        resolveSilk2DMaterialColors(palette, trail.color, 1).edge
      );
      edgeStyle = edgeGradient;
    }

    ctx.globalAlpha = ribbonAlpha * profile.edgeAlpha * 0.55;
    ctx.strokeStyle = representative.shadow;
    ctx.lineWidth = 0.65 * scale;
    ctx.beginPath();
    traceCentripetalForward(ctx, rightX, rightY, 0, n - 1, n);
    ctx.stroke();

    ctx.globalAlpha = ribbonAlpha * profile.edgeAlpha;
    ctx.strokeStyle = edgeStyle;
    ctx.lineWidth = 0.7 * scale;
    ctx.beginPath();
    traceCentripetalForward(ctx, leftX, leftY, 0, n - 1, n);
    ctx.stroke();
  }

  private isEndEnabled(end: "A" | "B", params: Silk2DParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  dispose(): void {
    this.tipTrails.clear();
    this.lastTipPos.clear();
    this.time = 0;
  }
}

function signedTurn(x: number[], y: number[], index: number): number {
  if (index <= 0 || index >= x.length - 1) return 0;
  let ax = x[index]! - x[index - 1]!;
  let ay = y[index]! - y[index - 1]!;
  let bx = x[index + 1]! - x[index]!;
  let by = y[index + 1]! - y[index]!;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength < 0.001 || bLength < 0.001) return 0;
  ax /= aLength;
  ay /= aLength;
  bx /= bLength;
  by /= bLength;
  return ax * by - ay * bx;
}

function phaseFromId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * TAU;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function colorToRgb(color: string): [number, number, number] {
  if (color.startsWith("rgb")) {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (channels?.length === 3) return channels as [number, number, number];
  }

  const source = color.replace(/^#/, "");
  const normalized =
    source.length === 3
      ? source
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : source.slice(0, 6);
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixColor(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = colorToRgb(a);
  const [br, bg, bb] = colorToRgb(b);
  const t = clamp01(amount);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${blue})`;
}
