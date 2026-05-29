import type { EffectType } from "$lib/shared/effects/domain/EffectsConfig";
import type { FramePropState } from "../domain/qr-video-types";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

import {
  resolveZap2D,
  resolveSparkles2D,
  resolveEcho2D,
  resolveBloom2D,
  resolveWater2D,
  resolveBubbles2D,
  resolvePetals2D,
  resolveSmoke2D,
  resolveInk2D,
  resolveFrost2D,
  resolveSilk2D,
  resolvePulse2D,
} from "$lib/shared/effects/translators/canvas2d-translator";

import { Bloom2DRenderer, type BloomTipInput } from "$lib/shared/effects/renderers/Bloom2DRenderer";
import { Bubbles2DRenderer, type BubblesTipInput } from "$lib/shared/effects/renderers/Bubbles2DRenderer";
import { Echo2DRenderer, type EchoTipInput } from "$lib/shared/effects/renderers/Echo2DRenderer";
import { Frost2DRenderer, type FrostTipInput } from "$lib/shared/effects/renderers/Frost2DRenderer";
import { Ink2DRenderer, type InkTipInput } from "$lib/shared/effects/renderers/Ink2DRenderer";
import { Petals2DRenderer, type PetalsTipInput } from "$lib/shared/effects/renderers/Petals2DRenderer";
import { Pulse2DRenderer, type PulseTipInput } from "$lib/shared/effects/renderers/Pulse2DRenderer";
import { Silk2DRenderer, type SilkTipInput } from "$lib/shared/effects/renderers/Silk2DRenderer";
import { Smoke2DRenderer, type SmokeTipInput } from "$lib/shared/effects/renderers/Smoke2DRenderer";
import { Sparkles2DRenderer, type SparklesTipInput } from "$lib/shared/effects/renderers/Sparkles2DRenderer";
import { Water2DRenderer, type WaterTipInput } from "$lib/shared/effects/renderers/Water2DRenderer";
import { Zap2DRenderer, type ZapTipInput } from "$lib/shared/effects/renderers/Zap2DRenderer";

import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
import { DEFAULT_TRAIL_SETTINGS, TrailMode, TrailEffect } from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type { TrailPoint, TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";

import { WebGLFireRenderer } from "$lib/shared/animation-engine/services/fire/web-gl-fire-renderer";
import { WebGLLedRenderer } from "$lib/shared/animation-engine/services/led/web-gl-led-renderer";
import { CharcoalSparkRenderer } from "$lib/shared/animation-engine/services/charcoal/charcoal-spark-renderer";
import type { FireFrameInput, PropTipData } from "$lib/shared/animation-engine/domain/types/FireTypes";
import { DEFAULT_FIRE_CONFIG } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { LedFrameInput, LedTipData } from "$lib/shared/animation-engine/domain/types/LedTypes";
import { DEFAULT_LED_CONFIG, PROP_BLUE, PROP_RED } from "$lib/shared/animation-engine/domain/types/LedTypes";

const VIEWBOX_SIZE = 950;
const BLUE_COLOR = "#3575E2";
const RED_COLOR = "#ED1C24";

export interface WorkerEffectRenderer {
  renderFrame(
    ctx: OffscreenCanvasRenderingContext2D,
    canvasSize: number,
    blue: FramePropState | null,
    red: FramePropState | null,
    blueViewBox: { width: number; height: number },
    redViewBox: { width: number; height: number },
    frameIndex: number,
    dt: number,
    stepIndex: number,
    isStartPosition: boolean,
  ): void;
  dispose(): void;
}

interface Vec2 {
  x: number;
  y: number;
}

function getPropCenter(canvasSize: number, propState: FramePropState): Vec2 {
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const inwardFactor = 0.95;
  const gridScale = canvasSize / VIEWBOX_SIZE;
  const halfwayRadius = 150 * gridScale;

  if (propState.x !== undefined && propState.y !== undefined) {
    return {
      x: cx + propState.x * halfwayRadius * inwardFactor,
      y: cy + propState.y * halfwayRadius * inwardFactor,
    };
  }
  return {
    x: cx + Math.cos(propState.centerPathAngle) * halfwayRadius * inwardFactor,
    y: cy + Math.sin(propState.centerPathAngle) * halfwayRadius * inwardFactor,
  };
}

function computeTips(
  canvasSize: number,
  prop: FramePropState | null,
  viewBox: { width: number; height: number },
): { a: Vec2; b: Vec2 } | null {
  if (!prop) return null;
  const center = getPropCenter(canvasSize, prop);
  const gridScale = canvasSize / VIEWBOX_SIZE;
  const halfLen = (viewBox.width / 2) * gridScale;
  const cos = Math.cos(prop.staffRotationAngle);
  const sin = Math.sin(prop.staffRotationAngle);
  return {
    a: { x: center.x + halfLen * cos, y: center.y + halfLen * sin },
    b: { x: center.x - halfLen * cos, y: center.y - halfLen * sin },
  };
}

interface FourTipPositions {
  bluePosA: Vec2 | null;
  bluePosB: Vec2 | null;
  redPosA: Vec2 | null;
  redPosB: Vec2 | null;
}

function computeFourTips(
  canvasSize: number,
  blue: FramePropState | null,
  red: FramePropState | null,
  blueVB: { width: number; height: number },
  redVB: { width: number; height: number },
): FourTipPositions {
  const b = computeTips(canvasSize, blue, blueVB);
  const r = computeTips(canvasSize, red, redVB);
  return {
    bluePosA: b?.a ?? null,
    bluePosB: b?.b ?? null,
    redPosA: r?.a ?? null,
    redPosB: r?.b ?? null,
  };
}

// ── Trails wrapper ─────────────────────────────────────────────

function createTrailsRenderer(): WorkerEffectRenderer {
  const renderer = new Canvas2DTrailRenderer();
  const bluePoints: TrailPoint[] = [];
  const redPoints: TrailPoint[] = [];
  const settings: TrailSettings = {
    ...DEFAULT_TRAIL_SETTINGS,
    mode: TrailMode.FADE,
    effect: TrailEffect.GLOW,
    blueColor: BLUE_COLOR,
    redColor: RED_COLOR,
  };

  return {
    renderFrame(ctx, canvasSize, blue, red, blueVB, redVB, frameIndex, dt) {
      const timestamp = frameIndex * dt * 1000;
      const tips = computeFourTips(canvasSize, blue, red, blueVB, redVB);

      if (tips.bluePosA) {
        bluePoints.push({ x: tips.bluePosA.x, y: tips.bluePosA.y, timestamp, propIndex: 0, tipIndex: 0 });
      }
      if (tips.bluePosB) {
        bluePoints.push({ x: tips.bluePosB.x, y: tips.bluePosB.y, timestamp, propIndex: 0, tipIndex: 1 });
      }
      if (tips.redPosA) {
        redPoints.push({ x: tips.redPosA.x, y: tips.redPosA.y, timestamp, propIndex: 1, tipIndex: 0 });
      }
      if (tips.redPosB) {
        redPoints.push({ x: tips.redPosB.x, y: tips.redPosB.y, timestamp, propIndex: 1, tipIndex: 1 });
      }

      const maxPoints = settings.maxPoints;
      if (bluePoints.length > maxPoints) bluePoints.splice(0, bluePoints.length - maxPoints);
      if (redPoints.length > maxPoints) redPoints.splice(0, redPoints.length - maxPoints);

      renderer.renderTrails(
        ctx as unknown as CanvasRenderingContext2D,
        bluePoints, redPoints,
        settings, timestamp,
        !!blue, !!red,
        canvasSize,
      );
    },
    dispose() {
      bluePoints.length = 0;
      redPoints.length = 0;
    },
  };
}

// ── Canvas2D "quad-tip" effects (smoke, water, bubbles, etc.) ──

type QuadTipInput = SmokeTipInput | WaterTipInput | BubblesTipInput |
  PetalsTipInput | FrostTipInput | InkTipInput | SparklesTipInput |
  SilkTipInput | ZapTipInput;

function createQuadTipEffect(
  effectType: Exclude<EffectType, "none" | "trails" | "fire" | "led" | "charcoal" | "bloom" | "echo" | "pulse">,
  canvasSize: number,
): WorkerEffectRenderer {
  const scale = computeEffectScale(canvasSize, canvasSize);
  const config = DEFAULT_EFFECTS_CONFIG;

  const renderers = {
    smoke: () => ({ r: new Smoke2DRenderer(), p: resolveSmoke2D(config.smoke) }),
    water: () => ({ r: new Water2DRenderer(), p: resolveWater2D(config.water) }),
    bubbles: () => ({ r: new Bubbles2DRenderer(), p: resolveBubbles2D(config.bubbles) }),
    petals: () => ({ r: new Petals2DRenderer(), p: resolvePetals2D(config.petals) }),
    frost: () => ({ r: new Frost2DRenderer(), p: resolveFrost2D(config.frost) }),
    ink: () => ({ r: new Ink2DRenderer(), p: resolveInk2D(config.ink) }),
    sparkles: () => ({ r: new Sparkles2DRenderer(), p: resolveSparkles2D(config.sparkles) }),
    silk: () => ({ r: new Silk2DRenderer(), p: resolveSilk2D(config.silk) }),
    zap: () => ({ r: new Zap2DRenderer(), p: resolveZap2D(config.zap) }),
  } as const;

  const { r, p } = renderers[effectType]();

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, _fi, dt) {
      const tips: QuadTipInput = computeFourTips(cs, blue, red, blueVB, redVB);

      switch (effectType) {
        case "smoke":
          (r as Smoke2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as SmokeTipInput, dt, scale);
          break;
        case "water":
          (r as Water2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as WaterTipInput, dt, scale);
          break;
        case "bubbles":
          (r as Bubbles2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as BubblesTipInput, dt, scale);
          break;
        case "petals":
          (r as Petals2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as PetalsTipInput, dt, scale);
          break;
        case "frost":
          (r as Frost2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as FrostTipInput, dt, scale);
          break;
        case "ink":
          (r as Ink2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as InkTipInput, dt, scale);
          break;
        case "sparkles":
          (r as Sparkles2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as SparklesTipInput, dt, scale);
          break;
        case "silk":
          (r as Silk2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as SilkTipInput, dt, scale);
          break;
        case "zap":
          (r as Zap2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips as ZapTipInput, scale);
          break;
      }
    },
    dispose() {
      (r as any).dispose();
    },
  };
}

// ── Bloom (per-tip array input) ────────────────────────────────

function createBloomRenderer(canvasSize: number): WorkerEffectRenderer {
  const renderer = new Bloom2DRenderer();
  const params = resolveBloom2D(DEFAULT_EFFECTS_CONFIG.bloom);
  const scale = computeEffectScale(canvasSize, canvasSize);

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB) {
      const tips: BloomTipInput[] = [];
      const bt = computeTips(cs, blue, blueVB);
      const rt = computeTips(cs, red, redVB);

      if (bt) {
        tips.push({ x: bt.a.x, y: bt.a.y, propIndex: 0, tipIndex: 0, blueColor: BLUE_COLOR, redColor: RED_COLOR });
        tips.push({ x: bt.b.x, y: bt.b.y, propIndex: 0, tipIndex: 1, blueColor: BLUE_COLOR, redColor: RED_COLOR });
      }
      if (rt) {
        tips.push({ x: rt.a.x, y: rt.a.y, propIndex: 1, tipIndex: 2, blueColor: BLUE_COLOR, redColor: RED_COLOR });
        tips.push({ x: rt.b.x, y: rt.b.y, propIndex: 1, tipIndex: 3, blueColor: BLUE_COLOR, redColor: RED_COLOR });
      }

      renderer.render(ctx as unknown as CanvasRenderingContext2D, params, tips, scale);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

// ── Echo (quad-tip + currentStep) ──────────────────────────────

function createEchoRenderer(canvasSize: number): WorkerEffectRenderer {
  const renderer = new Echo2DRenderer();
  const params = resolveEcho2D(DEFAULT_EFFECTS_CONFIG.echo);
  const scale = computeEffectScale(canvasSize, canvasSize);

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt, stepIndex, isStartPosition) {
      const fourTips = computeFourTips(cs, blue, red, blueVB, redVB);
      const currentStep = isStartPosition ? 0 : stepIndex + (frameIndex * dt) % 1;
      const tips: EchoTipInput = {
        ...fourTips,
        currentStep,
        blueColor: BLUE_COLOR,
        redColor: RED_COLOR,
      };
      renderer.render(ctx as unknown as CanvasRenderingContext2D, params, tips, scale);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

// ── Pulse (per-tip array + currentStep + dt) ───────────────────

function createPulseRenderer(canvasSize: number): WorkerEffectRenderer {
  const renderer = new Pulse2DRenderer();
  const params = resolvePulse2D(DEFAULT_EFFECTS_CONFIG.pulse);
  const scale = computeEffectScale(canvasSize, canvasSize);

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt, stepIndex, isStartPosition) {
      const tips: PulseTipInput[] = [];
      const bt = computeTips(cs, blue, blueVB);
      const rt = computeTips(cs, red, redVB);

      if (bt) {
        tips.push({ x: bt.a.x, y: bt.a.y, propIndex: 0, tipIndex: 0, blueColor: BLUE_COLOR, redColor: RED_COLOR });
        tips.push({ x: bt.b.x, y: bt.b.y, propIndex: 0, tipIndex: 1, blueColor: BLUE_COLOR, redColor: RED_COLOR });
      }
      if (rt) {
        tips.push({ x: rt.a.x, y: rt.a.y, propIndex: 1, tipIndex: 2, blueColor: BLUE_COLOR, redColor: RED_COLOR });
        tips.push({ x: rt.b.x, y: rt.b.y, propIndex: 1, tipIndex: 3, blueColor: BLUE_COLOR, redColor: RED_COLOR });
      }

      const currentStep = isStartPosition ? 0 : stepIndex + (frameIndex * dt) % 1;
      renderer.render(ctx as unknown as CanvasRenderingContext2D, params, tips, currentStep, dt, scale);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

// ── WebGL effects (fire, led, charcoal) ────────────────────────

interface PrevTipState {
  x: number;
  y: number;
}

function createFireRenderer(canvasSize: number): WorkerEffectRenderer | null {
  const renderer = new WebGLFireRenderer();
  const ok = renderer.initializeHeadless(canvasSize, canvasSize);
  if (!ok) return null;

  const webglCanvas = (renderer as any).canvas as OffscreenCanvas;
  const prevTips = new Map<string, PrevTipState>();

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt) {
      const tips: PropTipData[] = [];
      const currentTime = frameIndex * dt * 1000;

      const buildTip = (
        pos: Vec2,
        propIndex: 0 | 1,
        tipIndex: number,
      ): PropTipData => {
        const key = `${propIndex}_${tipIndex}`;
        const prev = prevTips.get(key) ?? pos;
        const vx = (pos.x - prev.x) / Math.max(dt, 0.001);
        const vy = (pos.y - prev.y) / Math.max(dt, 0.001);
        const speed = Math.sqrt(vx * vx + vy * vy);
        prevTips.set(key, { x: pos.x, y: pos.y });
        return {
          x: pos.x, y: pos.y,
          prevX: prev.x, prevY: prev.y,
          velocityX: vx, velocityY: vy,
          speed, propIndex, tipIndex,
          flameScale: 1.0,
          jerk: 0,
        };
      };

      const bt = computeTips(cs, blue, blueVB);
      const rt = computeTips(cs, red, redVB);
      if (bt) {
        tips.push(buildTip(bt.a, 0, 0));
        tips.push(buildTip(bt.b, 0, 1));
      }
      if (rt) {
        tips.push(buildTip(rt.a, 1, 0));
        tips.push(buildTip(rt.b, 1, 1));
      }

      const input: FireFrameInput = {
        tips,
        currentTime,
        canvasWidth: cs,
        canvasHeight: cs,
        darkMode: true,
      };

      renderer.renderFire(input, { ...DEFAULT_FIRE_CONFIG });
      ctx.drawImage(webglCanvas as any, 0, 0);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

function createLedRenderer(canvasSize: number): WorkerEffectRenderer | null {
  const renderer = new WebGLLedRenderer();
  const ok = renderer.initializeHeadless(canvasSize, canvasSize);
  if (!ok) return null;

  const webglCanvas = (renderer as any).canvas as OffscreenCanvas;
  const prevTips = new Map<string, PrevTipState>();

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt) {
      const tips: LedTipData[] = [];
      const currentTime = frameIndex * dt * 1000;

      const buildTip = (
        pos: Vec2,
        propIndex: 0 | 1,
        tipIndex: number,
        color: { r: number; g: number; b: number },
      ): LedTipData => {
        const key = `${propIndex}_${tipIndex}`;
        const prev = prevTips.get(key) ?? pos;
        const vx = (pos.x - prev.x) / Math.max(dt, 0.001);
        const vy = (pos.y - prev.y) / Math.max(dt, 0.001);
        const speed = Math.sqrt(vx * vx + vy * vy);
        prevTips.set(key, { x: pos.x, y: pos.y });
        return {
          x: pos.x, y: pos.y,
          velocityX: vx, velocityY: vy,
          speed, propIndex, tipIndex,
          brightness: 1.0,
          ...color,
        };
      };

      const blueRGB = { r: 0.21, g: 0.46, b: 0.89 };
      const redRGB = { r: 0.96, g: 0.27, b: 0.21 };

      const bt = computeTips(cs, blue, blueVB);
      const rt = computeTips(cs, red, redVB);
      if (bt) {
        tips.push(buildTip(bt.a, 0, 0, blueRGB));
        tips.push(buildTip(bt.b, 0, 1, blueRGB));
      }
      if (rt) {
        tips.push(buildTip(rt.a, 1, 0, redRGB));
        tips.push(buildTip(rt.b, 1, 1, redRGB));
      }

      const input: LedFrameInput = {
        tips,
        currentTime,
        canvasWidth: cs,
        canvasHeight: cs,
      };

      renderer.renderLeds(input, { ...DEFAULT_LED_CONFIG, enabled: true });
      ctx.drawImage(webglCanvas as any, 0, 0);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

function createCharcoalRenderer(canvasSize: number): WorkerEffectRenderer | null {
  const renderer = new CharcoalSparkRenderer();
  const ok = renderer.initializeHeadless(canvasSize, canvasSize);
  if (!ok) return null;

  const webglCanvas = (renderer as any).canvas as OffscreenCanvas;
  const prevTips = new Map<string, PrevTipState>();

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt) {
      const tips: PropTipData[] = [];
      const currentTime = frameIndex * dt * 1000;

      const buildTip = (
        pos: Vec2,
        propIndex: 0 | 1,
        tipIndex: number,
      ): PropTipData => {
        const key = `${propIndex}_${tipIndex}`;
        const prev = prevTips.get(key) ?? pos;
        const vx = (pos.x - prev.x) / Math.max(dt, 0.001);
        const vy = (pos.y - prev.y) / Math.max(dt, 0.001);
        const speed = Math.sqrt(vx * vx + vy * vy);
        prevTips.set(key, { x: pos.x, y: pos.y });
        return {
          x: pos.x, y: pos.y,
          prevX: prev.x, prevY: prev.y,
          velocityX: vx, velocityY: vy,
          speed, propIndex, tipIndex,
          flameScale: 1.0,
          jerk: 0,
        };
      };

      const bt = computeTips(cs, blue, blueVB);
      const rt = computeTips(cs, red, redVB);
      if (bt) {
        tips.push(buildTip(bt.a, 0, 0));
        tips.push(buildTip(bt.b, 0, 1));
      }
      if (rt) {
        tips.push(buildTip(rt.a, 1, 0));
        tips.push(buildTip(rt.b, 1, 1));
      }

      const input: FireFrameInput = {
        tips,
        currentTime,
        canvasWidth: cs,
        canvasHeight: cs,
        darkMode: true,
      };

      renderer.renderCharcoal(input, { ...DEFAULT_FIRE_CONFIG });
      ctx.drawImage(webglCanvas as any, 0, 0);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

// ── Factory ────────────────────────────────────────────────────

export function createWorkerEffectRenderer(
  effectType: EffectType,
  canvasSize: number,
): WorkerEffectRenderer | null {
  switch (effectType) {
    case "none":
      return null;
    case "trails":
      return createTrailsRenderer();
    case "bloom":
      return createBloomRenderer(canvasSize);
    case "echo":
      return createEchoRenderer(canvasSize);
    case "pulse":
      return createPulseRenderer(canvasSize);
    case "fire":
      return createFireRenderer(canvasSize);
    case "led":
      return createLedRenderer(canvasSize);
    case "charcoal":
      return createCharcoalRenderer(canvasSize);
    case "smoke":
    case "water":
    case "bubbles":
    case "petals":
    case "frost":
    case "ink":
    case "sparkles":
    case "silk":
    case "zap":
      return createQuadTipEffect(effectType, canvasSize);
    default: {
      const _exhaustive: never = effectType;
      return null;
    }
  }
}
