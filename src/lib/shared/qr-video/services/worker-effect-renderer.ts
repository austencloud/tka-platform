import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { FramePropState } from "../domain/qr-video-types";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

import {
  resolveZap2D,
  resolveSparkles2D,
  resolveGhost2D,
  resolveBloom2D,
  resolveGoo2D,
  resolveBubbles2D,
  resolvePetals2D,
  resolveSmoke2D,
  resolveInk2D,
  resolveFrost2D,
  resolveSilk2D,
  resolveAnimal2D,
  resolvePulse2D,
} from "$lib/shared/effects/translators/canvas2d-translator";

import { Bloom2DRenderer, type BloomTipInput } from "$lib/shared/effects/renderers/bloom-2d-renderer";
import { Bubbles2DRenderer } from "$lib/shared/effects/renderers/bubbles-2d-renderer";
import { Ghost2DRenderer, type GhostInput } from "$lib/shared/effects/renderers/ghost-2d-renderer";
import { Frost2DRenderer } from "$lib/shared/effects/renderers/frost-2d-renderer";
import { Ink2DRenderer } from "$lib/shared/effects/renderers/ink-2d-renderer";
import { Petals2DRenderer } from "$lib/shared/effects/renderers/petals-2d-renderer";
import { Pulse2DRenderer, type PulseTipInput } from "$lib/shared/effects/renderers/pulse-2d-renderer";
import { Silk2DRenderer } from "$lib/shared/effects/renderers/silk-2d-renderer";
import { Animal2DRenderer } from "$lib/shared/effects/renderers/animal-2d-renderer";
import { Smoke2DRenderer } from "$lib/shared/effects/renderers/smoke-2d-renderer";
import { Sparkles2DRenderer } from "$lib/shared/effects/renderers/sparkles-2d-renderer";
import { Goo2DRenderer } from "$lib/shared/effects/renderers/goo-2d-renderer";
import { Zap2DRenderer } from "$lib/shared/effects/renderers/zap-2d-renderer";
import type { EmitterTip } from "$lib/shared/effects/renderers/emitter-tip";

import { Canvas2DTrailRenderer } from "$lib/shared/animation-engine/services/canvas2d/canvas-2d-trail-renderer";
import { DEFAULT_TRAIL_SETTINGS, TrailMode, TrailEffect } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { TrailPoint, TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";

import { WebGLFireRenderer } from "$lib/shared/animation-engine/services/fire/web-gl-fire-renderer";
import { WebGLLedRenderer } from "$lib/shared/animation-engine/services/led/web-gl-led-renderer";
import { CharcoalSparkRenderer } from "$lib/shared/animation-engine/services/charcoal/charcoal-spark-renderer";
import type { FireFrameInput, PropTipData } from "$lib/shared/animation-engine/domain/types/fire-types";
import { DEFAULT_FIRE_CONFIG } from "$lib/shared/animation-engine/domain/types/fire-types";
import type { LedFrameInput, LedTipData } from "$lib/shared/animation-engine/domain/types/led-types";
import { DEFAULT_LED_CONFIG, PROP_BLUE, PROP_RED } from "$lib/shared/animation-engine/domain/types/led-types";

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

/**
 * Convert the QR-export 4-slot tip positions to the flat emitter contract.
 * The export pipeline only renders the two base props (no tunnel layers), so
 * this emits propIndex 0 (blue) / 1 (red) with the export's fixed colors.
 */
function fourTipsToEmitters(four: FourTipPositions): EmitterTip[] {
  const out: EmitterTip[] = [];
  if (four.bluePosA) out.push({ ...four.bluePosA, propIndex: 0, tipIndex: 0, end: "A", color: BLUE_COLOR });
  if (four.bluePosB) out.push({ ...four.bluePosB, propIndex: 0, tipIndex: 1, end: "B", color: BLUE_COLOR });
  if (four.redPosA) out.push({ ...four.redPosA, propIndex: 1, tipIndex: 0, end: "A", color: RED_COLOR });
  if (four.redPosB) out.push({ ...four.redPosB, propIndex: 1, tipIndex: 1, end: "B", color: RED_COLOR });
  return out;
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

function createQuadTipEffect(
  effectType: Exclude<EffectType, "none" | "trails" | "fire" | "led" | "charcoal" | "bloom" | "ghost" | "pulse">,
  canvasSize: number,
): WorkerEffectRenderer {
  const scale = computeEffectScale(canvasSize, canvasSize);
  const config = DEFAULT_EFFECTS_CONFIG;

  const renderers = {
    smoke: () => ({ r: new Smoke2DRenderer(), p: resolveSmoke2D(config.smoke) }),
    goo: () => ({ r: new Goo2DRenderer(), p: resolveGoo2D(config.goo) }),
    bubbles: () => ({ r: new Bubbles2DRenderer(), p: resolveBubbles2D(config.bubbles) }),
    petals: () => ({ r: new Petals2DRenderer(), p: resolvePetals2D(config.petals) }),
    frost: () => ({ r: new Frost2DRenderer(), p: resolveFrost2D(config.frost) }),
    ink: () => ({ r: new Ink2DRenderer(), p: resolveInk2D(config.ink) }),
    sparkles: () => ({ r: new Sparkles2DRenderer(), p: resolveSparkles2D(config.sparkles) }),
    silk: () => ({ r: new Silk2DRenderer(), p: resolveSilk2D(config.silk) }),
    animal: () => ({ r: new Animal2DRenderer(), p: resolveAnimal2D(config.animal) }),
    zap: () => ({ r: new Zap2DRenderer(), p: resolveZap2D(config.zap) }),
  } as const;

  const { r, p } = renderers[effectType]();

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, _fi, dt) {
      const tips: EmitterTip[] = fourTipsToEmitters(computeFourTips(cs, blue, red, blueVB, redVB));

      switch (effectType) {
        case "smoke":
          (r as Smoke2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "goo":
          (r as Goo2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "bubbles":
          (r as Bubbles2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "petals":
          (r as Petals2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "frost":
          (r as Frost2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "ink":
          (r as Ink2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "sparkles":
          (r as Sparkles2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "silk":
          (r as Silk2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "animal":
          (r as Animal2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, dt, scale);
          break;
        case "zap":
          (r as Zap2DRenderer).render(ctx as unknown as CanvasRenderingContext2D, p as any, tips, scale);
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
        tips.push({ x: bt.a.x, y: bt.a.y, propIndex: 0, tipIndex: 0, color: BLUE_COLOR });
        tips.push({ x: bt.b.x, y: bt.b.y, propIndex: 0, tipIndex: 1, color: BLUE_COLOR });
      }
      if (rt) {
        tips.push({ x: rt.a.x, y: rt.a.y, propIndex: 1, tipIndex: 2, color: RED_COLOR });
        tips.push({ x: rt.b.x, y: rt.b.y, propIndex: 1, tipIndex: 3, color: RED_COLOR });
      }

      renderer.render(ctx as unknown as CanvasRenderingContext2D, params, tips, scale);
    },
    dispose() {
      renderer.dispose();
    },
  };
}

// ── Ghost (quad-tip + currentStep) ──────────────────────────────

function createGhostRenderer(canvasSize: number): WorkerEffectRenderer {
  const renderer = new Ghost2DRenderer();
  const params = resolveGhost2D(DEFAULT_EFFECTS_CONFIG.ghost);
  const scale = computeEffectScale(canvasSize, canvasSize);
  // Ghost full-redraws its stroboscopic figure into a buffer each frame (the inner
  // renderer self-clears), then we composite that buffer at the master intensity.
  const accum = new OffscreenCanvas(canvasSize, canvasSize);
  const accumCtx = accum.getContext("2d");

  return {
    renderFrame(ctx, cs, blue, red, blueVB, redVB, frameIndex, dt, stepIndex, isStartPosition) {
      if (!accumCtx) return;
      const currentStep = isStartPosition ? 0 : stepIndex + (frameIndex * dt) % 1;
      // Ghost now onion-skins the REAL prop sprite, which the export worker does
      // not load (it only computes analytic tips). Real export ghosting is wired
      // in productionization; until then the export echo layer is empty.
      const input: GhostInput = {
        props: [],
        currentStep,
        // One export = one exposure; the figure persists across all frames.
        epoch: "export",
      };
      renderer.render(
        accumCtx as unknown as CanvasRenderingContext2D,
        params,
        input,
        dt,
        scale,
      );
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, params.intensity));
      ctx.drawImage(accum, 0, 0);
      ctx.restore();
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
        tips.push({ x: bt.a.x, y: bt.a.y, propIndex: 0, tipIndex: 0, color: BLUE_COLOR });
        tips.push({ x: bt.b.x, y: bt.b.y, propIndex: 0, tipIndex: 1, color: BLUE_COLOR });
      }
      if (rt) {
        tips.push({ x: rt.a.x, y: rt.a.y, propIndex: 1, tipIndex: 2, color: RED_COLOR });
        tips.push({ x: rt.b.x, y: rt.b.y, propIndex: 1, tipIndex: 3, color: RED_COLOR });
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
    case "ghost":
      return createGhostRenderer(canvasSize);
    case "pulse":
      return createPulseRenderer(canvasSize);
    case "fire":
      return createFireRenderer(canvasSize);
    case "led":
      return createLedRenderer(canvasSize);
    case "charcoal":
      return createCharcoalRenderer(canvasSize);
    case "smoke":
    case "goo":
    case "bubbles":
    case "petals":
    case "frost":
    case "ink":
    case "sparkles":
    case "silk":
    case "animal":
    case "zap":
      return createQuadTipEffect(effectType, canvasSize);
    default: {
      const _exhaustive: never = effectType;
      return null;
    }
  }
}
