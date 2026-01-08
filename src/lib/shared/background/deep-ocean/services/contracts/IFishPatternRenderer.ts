import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";
import type { Point } from "../../physics/BodyOutlineCalculator";

/**
 * Renders fish patterns (scales, stripes, spots, iridescence, lateral line).
 */
export interface IFishPatternRenderer {
  // Spine-based patterns
  drawSpineScalePattern(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;
  drawSpineStripes(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;
  drawVerticalBands(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;
  drawHorizontalStripes(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;
  drawSpineSpots(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;
  drawSpineIridescence(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void;
  drawSpineLateralLine(ctx: CanvasRenderingContext2D, fish: FishMarineLife, spine: SpineChain): void;

  // Legacy Bezier patterns
  drawScalePattern(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number): void;
  drawLateralLine(ctx: CanvasRenderingContext2D, fish: FishMarineLife, len: number, height: number): void;
}
