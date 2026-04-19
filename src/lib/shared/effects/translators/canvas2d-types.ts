/**
 * Canvas 2D backend parameter interfaces.
 *
 * Each extends the intent layer with 2D-specific extras that have
 * no clean 3D analog (shadow blur, canvas blend modes, etc.). These
 * extras populate `EffectsConfig.overrides.*2D` when the user has
 * opened an Advanced panel (Phase D). Core users never see them.
 */

import type {
  TrailsIntent,
  FireIntent,
  LedIntent,
  CharcoalIntent,
  ZapIntent,
  SparklesIntent,
  EchoIntent,
  BloomIntent,
  WaterIntent,
} from "../domain/EffectsConfig";
import type { WaterPalette } from "../domain/WaterPalettes";

export interface Trails2DParams extends TrailsIntent {
  /** px value for ctx.lineWidth. Derived from thickness. */
  lineWidth: number;
  /** 0-1. Derived from brightness. */
  maxOpacity: number;
  /** 0-1. Derived as brightness * 0.3. */
  minOpacity: number;
  /** px value for ctx.shadowBlur. Default 3; overridable via 2D advanced. */
  glowBlur: number;
  /** Canvas composite op. Default 'source-over'. */
  blendMode?: GlobalCompositeOperation;
}

export interface Fire2DParams extends FireIntent {
  /** Hz — optional override for idle flame pulse rate. */
  flickerRate?: number;
  /** Canvas composite op. */
  canvasBlendMode?: GlobalCompositeOperation;
  /** px — optional halo blur. */
  shadowBlur?: number;
}

export interface Led2DParams extends LedIntent {
  /** px — LED dot radius when rendered to 2D canvas. */
  dotRadius?: number;
}

export interface Charcoal2DParams extends CharcoalIntent {
  /** Max particle count in the 2D particle pool. */
  particleCount?: number;
  /** Canvas composite op. */
  canvasBlendMode?: GlobalCompositeOperation;
}

export interface Zap2DParams extends ZapIntent {
  /** Segment count along each arc. Derived from intensity + distance. */
  segments: number;
  /** px — random jitter radius per segment midpoint. */
  jitterAmount: number;
  /** px — shadowBlur for the glow pass. */
  glowBlur: number;
  /** px — core line width. */
  lineWidth: number;
}

export interface Sparkles2DParams extends SparklesIntent {
  /** Max particles alive at once. */
  poolSize: number;
  /** px — base particle radius before `size` multiplier. */
  baseRadius: number;
  /** Canvas composite op. */
  blendMode?: GlobalCompositeOperation;
}

export interface Echo2DParams extends EchoIntent {
  /** Canvas composite op. Default 'lighter' so overlapping phantoms brighten. */
  blendMode?: GlobalCompositeOperation;
}

export interface Bloom2DParams extends BloomIntent {
  /** Canvas composite op. Default 'lighter' so overlapping halos brighten. */
  blendMode?: GlobalCompositeOperation;
}

export interface Water2DParams extends WaterIntent {
  /** Resolved palette swatches (intent's palette enum → concrete hex stops). */
  resolvedPalette: WaterPalette;
  /** Max droplets alive at once. Tier-dependent: 512 / 1024 / 2048. */
  poolSize: number;
  /** px — base droplet radius before `intensity` multiplier. */
  baseRadius: number;
  /** Droplets/sec at `ambientEmission=1`. */
  ambientSpawnRate: number;
  /** Droplets/sec at full velocity * `motionEmission=1`. */
  motionSpawnRate: number;
  /** World units/s that maps to full motion scalar (tuned against medium spin). */
  motionReferenceSpeed: number;
  /** Canvas composite op — `source-over` for body, `lighter` for highlight. */
  blendMode?: GlobalCompositeOperation;
}
