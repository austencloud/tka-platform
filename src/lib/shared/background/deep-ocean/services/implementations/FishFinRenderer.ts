import { inject, injectable } from "inversify";
import type { IFishFinRenderer } from "../contracts/IFishFinRenderer";
import type { IColorCalculator } from "../contracts/IColorCalculator";
import type { FishMarineLife, FinState, TailState, FishColorPalette, SpineFin } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";
import { TYPES } from "../../../inversify/types";

/**
 * Fin attachment points for legacy Bezier fish
 */
const FIN_CONFIG = {
  dorsal: { x: -0.05, y: -0.5 },
  pectoralTop: { x: -0.15, y: -0.15 },
  pectoralBottom: { x: -0.1, y: 0.2 },
  pelvic: { x: 0.1, y: 0.35 },
  anal: { x: 0.25, y: 0.35 },
  tail: { x: 0.45, y: 0 },
};

/**
 * Renders fish fins (spine-based and legacy Bezier).
 * Extracted from FishRenderer to follow single-responsibility principle.
 */
@injectable()
export class FishFinRenderer implements IFishFinRenderer {
  constructor(
    @inject(TYPES.IColorCalculator) private colorCalc: IColorCalculator
  ) {}

  drawSpineFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (!fish.spineFins) return;

    for (const fin of fish.spineFins) {
      if (fin.attachmentSegment >= spine.joints.length) continue;

      const joint = spine.joints[fin.attachmentSegment]!;
      const curvature = spine.getCurvatureAt(fin.attachmentSegment);

      // Calculate fin position
      // In canvas coords: +Y is DOWN, so "top" needs negative Y offset
      // For angle=0 (facing right): perpendicular UP is -PI/2
      const perpAngleUp = joint.angle - Math.PI / 2; // Points UP (negative Y)
      let attachX = joint.x;
      let attachY = joint.y;

      // Offset based on side (using perpAngleUp for top/bottom)
      switch (fin.attachmentSide) {
        case "top":
          // Top fin: offset in UP direction (negative Y)
          attachX += Math.cos(perpAngleUp) * joint.width;
          attachY += Math.sin(perpAngleUp) * joint.width;
          break;
        case "bottom":
          // Bottom fin: offset in DOWN direction (opposite of up)
          attachX -= Math.cos(perpAngleUp) * joint.width;
          attachY -= Math.sin(perpAngleUp) * joint.width;
          break;
        case "left":
          // Left pectoral: slightly above center (viewer's perspective)
          attachX += Math.cos(perpAngleUp) * joint.width * 0.3;
          attachY += Math.sin(perpAngleUp) * joint.width * 0.3;
          break;
        case "right":
          // Right pectoral: slightly below center (viewer's perspective)
          attachX -= Math.cos(perpAngleUp) * joint.width * 0.3;
          attachY -= Math.sin(perpAngleUp) * joint.width * 0.3;
          break;
      }

      // Calculate fin angle with curvature response
      const finAngle = joint.angle + fin.baseAngle + curvature * fin.curvatureResponse * 2;

      this.drawSpineFin(ctx, fin, fish);
    }

    // Draw tail fin separately (at last joint)
    this.drawSpineTailFin(ctx, fish, spine);
  }

  drawSpineFin(
    ctx: CanvasRenderingContext2D,
    fin: SpineFin,
    fish: FishMarineLife
  ): void {
    ctx.save();
    ctx.translate(fin.x, fin.y);
    ctx.rotate(fin.currentAngle);

    const length = fin.length * fish.bodyLength;
    const width = fin.width * fish.bodyHeight;

    // Draw fin as curved triangle
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.3, -width * 0.3, length, 0);
    ctx.quadraticCurveTo(length * 0.6, width * 0.4, 0, width * 0.1);
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, fish.colors.finTint);
    gradient.addColorStop(1, this.colorCalc.adjustAlpha(fish.colors.finTint, 0.2));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Fin rays
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.2);
    ctx.lineWidth = 0.5;
    for (let i = 1; i < fin.segments; i++) {
      const t = i / fin.segments;
      ctx.beginPath();
      ctx.moveTo(0, width * 0.05 * t);
      ctx.lineTo(length * (1 - t * 0.3), 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSpineTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const tail = spine.joints[spine.joints.length - 1]!;
    const prevTail = spine.joints[spine.joints.length - 2];
    if (!prevTail) return;

    const tailLen = fish.tailFin.length * fish.bodyLength;
    const tailWidth = fish.tailFin.width * fish.bodyHeight;
    const forkDepth = fish.tailFin.forkDepth * tailLen;
    const forkSpread = fish.tailFin.forkAngle;

    ctx.save();
    ctx.translate(tail.x, tail.y);
    // Tail fin extends AWAY from head (opposite to body direction)
    // Calculate angle from previous joint to tail (direction the tail came from)
    const awayAngle = Math.atan2(tail.y - prevTail.y, tail.x - prevTail.x);
    ctx.rotate(awayAngle);

    // Draw forked tail
    ctx.beginPath();

    // Top fork
    ctx.moveTo(0, -tailWidth * 0.1);
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      -tailWidth * 0.2 - forkSpread * tailWidth,
      tailLen,
      -tailWidth * forkSpread
    );

    // Fork indent
    ctx.quadraticCurveTo(tailLen - forkDepth, 0, tailLen, tailWidth * forkSpread);

    // Bottom fork
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      tailWidth * 0.2 + forkSpread * tailWidth,
      0,
      tailWidth * 0.1
    );

    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, tailLen, 0);
    gradient.addColorStop(0, fish.colors.finTint);
    gradient.addColorStop(0.7, this.colorCalc.adjustAlpha(fish.colors.finTint, 0.5));
    gradient.addColorStop(1, this.colorCalc.adjustAlpha(fish.colors.accent, 0.3));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Tail rays
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.15);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < fish.tailFin.segments; i++) {
      const t = i / fish.tailFin.segments - 0.5;
      const spread = t * forkSpread * tailWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, t * tailWidth * 0.2);
      ctx.quadraticCurveTo(tailLen * 0.5, spread * 0.5, tailLen * 0.9, spread);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const fins = FIN_CONFIG;

    // Draw fins back to front
    // Tail fin first (behind body)
    this.drawTailFin(ctx, fish, fish.tailFin, fins.tail.x * len, fins.tail.y * height, len * fish.tailFin.length);

    // Pelvic and anal fins
    this.drawFin(
      ctx,
      fish,
      fish.pelvicFin,
      fins.pelvic.x * len,
      fins.pelvic.y * height,
      len * fish.pelvicFin.length,
      height * fish.pelvicFin.width,
      fish.pelvicFin.angle + Math.PI / 2
    );
    this.drawFin(
      ctx,
      fish,
      fish.analFin,
      fins.anal.x * len,
      fins.anal.y * height,
      len * fish.analFin.length,
      height * fish.analFin.width,
      fish.analFin.angle + Math.PI / 2
    );

    // Pectoral fins (side fins)
    this.drawFin(
      ctx,
      fish,
      fish.pectoralFinTop,
      fins.pectoralTop.x * len,
      fins.pectoralTop.y * height,
      len * fish.pectoralFinTop.length,
      height * fish.pectoralFinTop.width,
      fish.pectoralFinTop.angle - Math.PI / 3
    );
    this.drawFin(
      ctx,
      fish,
      fish.pectoralFinBottom,
      fins.pectoralBottom.x * len,
      fins.pectoralBottom.y * height,
      len * fish.pectoralFinBottom.length,
      height * fish.pectoralFinBottom.width,
      fish.pectoralFinBottom.angle + Math.PI / 3
    );

    // Dorsal fin (top)
    this.drawFin(
      ctx,
      fish,
      fish.dorsalFin,
      fins.dorsal.x * len,
      fins.dorsal.y * height,
      len * fish.dorsalFin.length,
      height * fish.dorsalFin.width,
      fish.dorsalFin.angle - Math.PI / 2
    );
  }

  drawFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    finState: FinState,
    x: number,
    y: number,
    baseLength: number,
    baseWidth: number,
    angle: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw fin as curved triangle
    ctx.beginPath();
    ctx.moveTo(0, 0); // Attachment point

    // Curved leading edge
    ctx.quadraticCurveTo(baseLength * 0.3, -baseWidth * 0.3, baseLength, 0);

    // Curved trailing edge
    ctx.quadraticCurveTo(baseLength * 0.6, baseWidth * 0.4, 0, baseWidth * 0.1);

    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, baseLength, 0);
    gradient.addColorStop(0, fish.colors.finTint);
    gradient.addColorStop(1, this.colorCalc.adjustAlpha(fish.colors.finTint, 0.2));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Fin rays (lines)
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.2);
    ctx.lineWidth = 0.5;
    for (let i = 1; i < finState.segments; i++) {
      const t = i / finState.segments;
      ctx.beginPath();
      ctx.moveTo(0, baseWidth * 0.05 * t);
      ctx.lineTo(baseLength * (1 - t * 0.3), 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    tailState: TailState,
    x: number,
    y: number,
    baseSize: number
  ): void {
    const tailLen = baseSize;
    const tailWidth = tailState.width * fish.bodyHeight;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tailState.angle);

    // Fork parameters
    const forkDepth = tailState.forkDepth * tailLen;
    const forkSpread = tailState.forkAngle;

    // Draw forked tail
    ctx.beginPath();

    // Top fork
    ctx.moveTo(0, -tailWidth * 0.1);
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      -tailWidth * 0.2 - forkSpread * tailWidth,
      tailLen,
      -tailWidth * forkSpread
    );

    // Fork indent
    ctx.quadraticCurveTo(
      tailLen - forkDepth,
      0,
      tailLen,
      tailWidth * forkSpread
    );

    // Bottom fork
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      tailWidth * 0.2 + forkSpread * tailWidth,
      0,
      tailWidth * 0.1
    );

    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, tailLen, 0);
    gradient.addColorStop(0, fish.colors.finTint);
    gradient.addColorStop(0.7, this.colorCalc.adjustAlpha(fish.colors.finTint, 0.5));
    gradient.addColorStop(1, this.colorCalc.adjustAlpha(fish.colors.accent, 0.3));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Tail rays
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.15);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < tailState.segments; i++) {
      const t = i / tailState.segments - 0.5;
      const spread = t * forkSpread * tailWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, t * tailWidth * 0.2);
      ctx.quadraticCurveTo(tailLen * 0.5, spread * 0.5, tailLen * 0.9, spread);
      ctx.stroke();
    }

    ctx.restore();
  }
}
