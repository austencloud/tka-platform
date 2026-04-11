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
} from "../domain/EffectsConfig";

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
