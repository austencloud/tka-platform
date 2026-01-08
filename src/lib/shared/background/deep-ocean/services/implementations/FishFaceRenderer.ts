import { inject, injectable } from "inversify";
import type { IFishFaceRenderer } from "../contracts/IFishFaceRenderer";
import type { IColorCalculator } from "../contracts/IColorCalculator";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";
import { TYPES } from "../../../inversify/types";

/**
 * Eye and gill configuration for legacy Bezier fish
 */
const EYE_CONFIG = {
  xOffset: -0.32, // From center, toward nose
  yOffset: -0.1, // Slightly above centerline
  pupilSize: 0.4, // Relative to eye size
  highlightSize: 0.2,
  highlightOffset: { x: -0.2, y: -0.25 },
};

const GILL_CONFIG = {
  xOffset: -0.15,
  yOffset: 0.05,
  length: 0.12, // Relative to body height
  openAmount: 0.3, // Base opening
};

/**
 * Renders fish facial features (eyes, gills).
 * Extracted from FishRenderer to follow single-responsibility principle.
 */
@injectable()
export class FishFaceRenderer implements IFishFaceRenderer {
  constructor(
    @inject(TYPES.IColorCalculator) private colorCalc: IColorCalculator
  ) {}

  drawSpineEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const head = spine.joints[0]!;
    const second = spine.joints[1];
    if (!second) return;

    // Position eye relative to head
    // Eye is slightly back from nose and above center line
    // In canvas coords: +Y is DOWN, so UP is -PI/2 perpendicular
    const perpAngleUp = head.angle - Math.PI / 2; // Points UP (negative Y)
    const eyeOffset = 0.12 * fish.bodyLength; // How far back from nose
    // Calculate direction from head toward second joint (backward along body)
    const backwardAngle = Math.atan2(second.y - head.y, second.x - head.x);
    const eyeX = head.x + Math.cos(backwardAngle) * eyeOffset + Math.cos(perpAngleUp) * head.width * 0.4;
    const eyeY = head.y + Math.sin(backwardAngle) * eyeOffset + Math.sin(perpAngleUp) * head.width * 0.4;
    const eyeRadius = Math.max(fish.eyeSize * fish.bodyHeight, 3); // Minimum 3px radius

    // Eye socket
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = this.colorCalc.adjustAlpha(fish.colors.bodyTop, 0.8);
    ctx.fill();

    // Eyeball
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const eyeGradient = ctx.createRadialGradient(
      eyeX - eyeRadius * 0.2,
      eyeY - eyeRadius * 0.2,
      0,
      eyeX,
      eyeY,
      eyeRadius
    );
    eyeGradient.addColorStop(0, "#ffffff");
    eyeGradient.addColorStop(0.7, "#e8e8e8");
    eyeGradient.addColorStop(1, "#cccccc");
    ctx.fillStyle = eyeGradient;
    ctx.fill();

    // Iris
    const irisRadius = eyeRadius * 0.65;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisRadius, 0, Math.PI * 2);
    const irisGradient = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, irisRadius);
    irisGradient.addColorStop(0, fish.colors.eye);
    irisGradient.addColorStop(0.8, this.colorCalc.adjustBrightness(fish.colors.eye, -20));
    irisGradient.addColorStop(1, this.colorCalc.adjustBrightness(fish.colors.eye, -40));
    ctx.fillStyle = irisGradient;
    ctx.fill();

    // Pupil
    const pupilRadius = eyeRadius * 0.4;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(eyeX - eyeRadius * 0.2, eyeY - eyeRadius * 0.25, eyeRadius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  drawSpineGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (spine.joints.length < 2) return;

    const joint = spine.joints[1]!; // Second joint (near head)
    const gillLen = 0.12 * fish.bodyHeight;
    const openAmount = 0.3 + Math.sin(fish.gillPhase) * 0.15;

    const perpAngle = joint.angle + Math.PI / 2;
    const gillX = joint.x + Math.cos(perpAngle) * joint.width * 0.2;
    const gillY = joint.y + Math.sin(perpAngle) * joint.width * 0.2;

    ctx.save();
    ctx.translate(gillX, gillY);
    ctx.rotate(joint.angle);

    // Draw gill slit
    ctx.beginPath();
    ctx.moveTo(0, -gillLen * 0.5);
    ctx.quadraticCurveTo(openAmount * fish.bodyHeight * 0.1, 0, 0, gillLen * 0.5);
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.bodyTop, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner gill
    if (openAmount > 0.2) {
      ctx.beginPath();
      ctx.moveTo(openAmount * fish.bodyHeight * 0.02, -gillLen * 0.4);
      ctx.quadraticCurveTo(
        openAmount * fish.bodyHeight * 0.08,
        0,
        openAmount * fish.bodyHeight * 0.02,
        gillLen * 0.4
      );
      ctx.strokeStyle = `rgba(180, 80, 80, ${openAmount * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = EYE_CONFIG;
    const eyeX = config.xOffset * len;
    const eyeY = config.yOffset * height;
    const eyeRadius = fish.eyeSize * height;

    // Eye socket (slightly darker)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = this.colorCalc.adjustAlpha(fish.colors.bodyTop, 0.8);
    ctx.fill();

    // Eyeball (white/light)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const eyeGradient = ctx.createRadialGradient(
      eyeX - eyeRadius * 0.2,
      eyeY - eyeRadius * 0.2,
      0,
      eyeX,
      eyeY,
      eyeRadius
    );
    eyeGradient.addColorStop(0, "#ffffff");
    eyeGradient.addColorStop(0.7, "#e8e8e8");
    eyeGradient.addColorStop(1, "#cccccc");
    ctx.fillStyle = eyeGradient;
    ctx.fill();

    // Iris
    const irisRadius = eyeRadius * 0.65;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisRadius, 0, Math.PI * 2);
    const irisGradient = ctx.createRadialGradient(
      eyeX,
      eyeY,
      0,
      eyeX,
      eyeY,
      irisRadius
    );
    irisGradient.addColorStop(0, fish.colors.eye);
    irisGradient.addColorStop(0.8, this.colorCalc.adjustBrightness(fish.colors.eye, -20));
    irisGradient.addColorStop(1, this.colorCalc.adjustBrightness(fish.colors.eye, -40));
    ctx.fillStyle = irisGradient;
    ctx.fill();

    // Pupil
    const pupilRadius = eyeRadius * config.pupilSize;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Highlight
    const highlightX = eyeX + config.highlightOffset.x * eyeRadius;
    const highlightY = eyeY + config.highlightOffset.y * eyeRadius;
    const highlightRadius = eyeRadius * config.highlightSize;

    ctx.beginPath();
    ctx.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    // Secondary smaller highlight
    ctx.beginPath();
    ctx.arc(
      highlightX + eyeRadius * 0.3,
      highlightY + eyeRadius * 0.35,
      highlightRadius * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();
  }

  drawGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = GILL_CONFIG;
    const gillX = config.xOffset * len;
    const gillY = config.yOffset * height;
    const gillLen = config.length * height;

    // Animated gill opening
    const openAmount =
      config.openAmount + Math.sin(fish.gillPhase) * config.openAmount * 0.5;

    ctx.save();
    ctx.translate(gillX, gillY);

    // Draw gill slit as curved line
    ctx.beginPath();
    ctx.moveTo(0, -gillLen * 0.5);
    ctx.quadraticCurveTo(
      openAmount * height * 0.1,
      0,
      0,
      gillLen * 0.5
    );

    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.bodyTop, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner gill (red when open)
    if (openAmount > 0.2) {
      ctx.beginPath();
      ctx.moveTo(openAmount * height * 0.02, -gillLen * 0.4);
      ctx.quadraticCurveTo(
        openAmount * height * 0.08,
        0,
        openAmount * height * 0.02,
        gillLen * 0.4
      );
      ctx.strokeStyle = `rgba(180, 80, 80, ${openAmount * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}
