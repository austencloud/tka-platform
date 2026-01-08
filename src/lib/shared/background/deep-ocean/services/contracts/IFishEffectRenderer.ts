import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";
import type { Point } from "../../physics/BodyOutlineCalculator";

/**
 * Renders visual effects for fish (wake trails, bioluminescence).
 */
export interface IFishEffectRenderer {
  /**
   * Draw wake trail particles (in world space)
   */
  drawWakeTrail(ctx: CanvasRenderingContext2D, fish: FishMarineLife): void;

  /**
   * Draw bioluminescence glow for spine-based fish
   */
  drawSpineBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void;

  /**
   * Draw bioluminescence spots along spine
   */
  drawSpineBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void;

  /**
   * Draw bioluminescence glow for legacy Bezier fish
   */
  drawBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;

  /**
   * Draw bioluminescence spots for legacy Bezier fish
   */
  drawBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;
}
