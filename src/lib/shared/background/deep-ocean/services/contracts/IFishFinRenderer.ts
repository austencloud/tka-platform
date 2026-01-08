import type { FishMarineLife, FinState, TailState, SpineFin } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";

/**
 * Renders fish fins (spine-based and legacy Bezier).
 */
export interface IFishFinRenderer {
  /**
   * Draw all fins on spine-based fish
   */
  drawSpineFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void;

  /**
   * Draw individual fin on spine-based fish
   * @param x - Calculated attachment X position
   * @param y - Calculated attachment Y position
   * @param angle - Calculated fin angle
   */
  drawSpineFin(
    ctx: CanvasRenderingContext2D,
    fin: SpineFin,
    fish: FishMarineLife,
    x: number,
    y: number,
    angle: number
  ): void;

  /**
   * Draw tail fin on spine-based fish
   */
  drawSpineTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void;

  /**
   * Draw all fins on legacy Bezier fish
   */
  drawFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;

  /**
   * Draw individual fin on legacy Bezier fish
   */
  drawFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    finState: FinState,
    x: number,
    y: number,
    baseLength: number,
    baseWidth: number,
    angle: number
  ): void;

  /**
   * Draw tail fin on legacy Bezier fish
   */
  drawTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    tailState: TailState,
    x: number,
    y: number,
    baseSize: number
  ): void;
}
