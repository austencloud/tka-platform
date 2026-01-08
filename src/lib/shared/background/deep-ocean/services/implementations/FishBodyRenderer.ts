import { inject, injectable } from "inversify";
import type {
  FishMarineLife,
  FishSpecies,
} from "../../domain/models/DeepOceanModels";
import type { IFishBodyRenderer } from "../contracts/IFishBodyRenderer";
import type { IColorCalculator } from "../contracts/IColorCalculator";
import { SpineChain } from "../../physics/SpineChain";
import { BodyOutlineCalculator, type Point } from "../../physics/BodyOutlineCalculator";
import { TYPES } from "$lib/shared/inversify/types";

/**
 * Body Shape Configuration
 *
 * Control points for Bezier curves defining fish body shapes.
 */
const RENDER_CONFIG = {
  // Body shape control points (fraction of body length)
  bodyShape: {
    // Control points for dorsal (top) curve
    dorsalControlPoints: [
      { x: -0.5, y: 0 }, // Nose
      { x: -0.3, y: -0.4 }, // Forehead rise
      { x: 0.0, y: -0.5 }, // Peak (widest)
      { x: 0.3, y: -0.3 }, // Toward tail
      { x: 0.45, y: -0.1 }, // Tail junction
    ],
    // Control points for ventral (bottom) curve
    ventralControlPoints: [
      { x: -0.5, y: 0 }, // Nose (same as dorsal)
      { x: -0.3, y: 0.25 }, // Lower jaw
      { x: 0.0, y: 0.4 }, // Belly peak
      { x: 0.3, y: 0.25 }, // Toward tail
      { x: 0.45, y: 0.1 }, // Tail junction
    ],
  },
};

/**
 * Species-specific body shape modifiers
 */
const SPECIES_SHAPE: Record<
  FishSpecies,
  {
    dorsalMod: number; // Height multiplier for dorsal curve
    ventralMod: number; // Height multiplier for ventral curve
    noseTaper: number; // How pointed the nose is
    tailTaper: number; // How tapered the tail junction is
  }
> = {
  tropical: {
    dorsalMod: 1.2, // Taller dorsal
    ventralMod: 1.1,
    noseTaper: 0.8, // Rounder nose
    tailTaper: 0.7,
  },
  sleek: {
    dorsalMod: 0.7, // Flatter
    ventralMod: 0.6,
    noseTaper: 1.3, // Pointed nose
    tailTaper: 1.2,
  },
  deep: {
    dorsalMod: 1.0,
    ventralMod: 1.1,
    noseTaper: 0.9,
    tailTaper: 0.8,
  },
  schooling: {
    dorsalMod: 0.9,
    ventralMod: 0.85,
    noseTaper: 1.0,
    tailTaper: 0.9,
  },
};

/**
 * Renders fish body shapes (spine-based and legacy Bezier).
 */
@injectable()
export class FishBodyRenderer implements IFishBodyRenderer {
  private bodyOutlineCalculator = new BodyOutlineCalculator();

  constructor(
    @inject(TYPES.IColorCalculator) private colorCalc: IColorCalculator
  ) {}

  /**
   * Draw body from spine outline with gradient
   */
  drawSpineBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void {
    const { leftPoints, rightPoints, headPoint, tailPoint } = outline;
    if (leftPoints.length < 2) return;

    // Calculate bounds for gradient
    let minY = Infinity, maxY = -Infinity;
    for (const p of leftPoints) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    for (const p of rightPoints) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Draw body path
    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);

    // Body gradient (top to bottom)
    const gradient = ctx.createLinearGradient(0, minY, 0, maxY);
    gradient.addColorStop(0, fish.colors.bodyTop);
    gradient.addColorStop(0.4, this.colorCalc.blendColors(fish.colors.bodyTop, fish.colors.bodyBottom, 0.3));
    gradient.addColorStop(1, fish.colors.bodyBottom);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw legacy Bezier fish body
   */
  drawBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const shape = SPECIES_SHAPE[fish.species];
    const colors = fish.colors;

    // Apply body flex (S-curve deformation)
    const flexAmount =
      Math.sin(fish.bodyFlexPhase) * fish.bodyFlexAmount * height * 0.5;

    // Create body path
    ctx.beginPath();

    // Get modified control points
    const dorsalPoints = RENDER_CONFIG.bodyShape.dorsalControlPoints.map(
      (p, i) => ({
        x: p.x * len,
        y: p.y * height * shape.dorsalMod + this.getFlexOffset(p.x, flexAmount),
      })
    );

    const ventralPoints = RENDER_CONFIG.bodyShape.ventralControlPoints.map(
      (p) => ({
        x: p.x * len,
        y:
          p.y * height * shape.ventralMod + this.getFlexOffset(p.x, flexAmount),
      })
    );

    // Draw dorsal curve (top)
    ctx.moveTo(dorsalPoints[0]!.x, dorsalPoints[0]!.y);
    for (let i = 1; i < dorsalPoints.length; i++) {
      const prev = dorsalPoints[i - 1]!;
      const curr = dorsalPoints[i]!;
      const cpX = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpX, (prev.y + curr.y) / 2);
    }

    // Continue to last dorsal point
    const lastDorsal = dorsalPoints[dorsalPoints.length - 1]!;
    ctx.lineTo(lastDorsal.x, lastDorsal.y);

    // Draw ventral curve (bottom) in reverse
    for (let i = ventralPoints.length - 1; i >= 0; i--) {
      const curr = ventralPoints[i]!;
      const next = i > 0 ? ventralPoints[i - 1]! : curr;
      const cpX = (curr.x + next.x) / 2;
      ctx.quadraticCurveTo(
        curr.x - (curr.x - next.x) * 0.5,
        curr.y,
        cpX,
        (curr.y + next.y) / 2
      );
    }

    ctx.closePath();

    // Body gradient (top to bottom)
    const gradient = ctx.createLinearGradient(
      0,
      -height * 0.5,
      0,
      height * 0.5
    );
    gradient.addColorStop(0, colors.bodyTop);
    gradient.addColorStop(0.4, this.colorCalc.blendColors(colors.bodyTop, colors.bodyBottom, 0.3));
    gradient.addColorStop(1, colors.bodyBottom);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = this.colorCalc.adjustAlpha(colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  private getFlexOffset(xFraction: number, flexAmount: number): number {
    // S-curve: positive at front, negative at back
    return Math.sin(xFraction * Math.PI * 2) * flexAmount;
  }
}
