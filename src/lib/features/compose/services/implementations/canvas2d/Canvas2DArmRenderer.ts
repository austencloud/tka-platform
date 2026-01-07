/**
 * Canvas2D Arm Renderer
 *
 * Renders stick-figure arms connecting shoulder to hand positions.
 * Uses 2D inverse kinematics (law of cosines) to calculate elbow positions.
 *
 * Anatomical context:
 * - The grid center represents the performer's solar plexus
 * - Shoulders are positioned above center on the Y-axis
 * - Left shoulder connects to blue prop, right to red prop
 *
 * Single Responsibility: Arm rendering logic with 2D IK
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** SVG viewbox size (matches AnimatorCanvas) */
const VIEWBOX_SIZE = 950;

/** Distance from center to hand positions */
const GRID_HALFWAY_POINT_OFFSET = 150;

/** Shoulder Y offset above center (solar plexus is at grid center) */
const SHOULDER_OFFSET_Y = 200;

/** Half the width between shoulders */
const SHOULDER_HALF_WIDTH = 80;

/** Upper arm length as fraction of GRID_HALFWAY_POINT_OFFSET */
const UPPER_ARM_RATIO = 0.55;

/** Forearm length as fraction of GRID_HALFWAY_POINT_OFFSET */
const FOREARM_RATIO = 0.47;

/** Line width for arm segments (before scaling) */
const ARM_LINE_WIDTH = 4;

/** Arm opacity (subtle, doesn't compete with props) */
const ARM_OPACITY = 0.6;

// ============================================================================
// TYPES
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

interface ArmRenderParams {
  handX: number;
  handY: number;
  shoulderX: number;
  shoulderY: number;
  color: string;
  upperArmLength: number;
  forearmLength: number;
  isLeftArm: boolean;
}

// ============================================================================
// CANVAS2D ARM RENDERER
// ============================================================================

export class Canvas2DArmRenderer {
  /**
   * Render both arms based on prop positions
   *
   * @param ctx - Canvas 2D rendering context
   * @param blueHandX - Blue prop X position
   * @param blueHandY - Blue prop Y position
   * @param redHandX - Red prop X position
   * @param redHandY - Red prop Y position
   * @param canvasSize - Current canvas size in pixels
   * @param blueColor - Color for blue arm
   * @param redColor - Color for red arm
   * @param showBlue - Whether to render blue arm
   * @param showRed - Whether to render red arm
   */
  renderArms(
    ctx: CanvasRenderingContext2D,
    blueHandX: number,
    blueHandY: number,
    redHandX: number,
    redHandY: number,
    canvasSize: number,
    blueColor: string,
    redColor: string,
    showBlue: boolean,
    showRed: boolean
  ): void {
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    // Calculate shoulder positions (scaled)
    const shoulderY = centerY - SHOULDER_OFFSET_Y * gridScaleFactor;
    const leftShoulderX = centerX - SHOULDER_HALF_WIDTH * gridScaleFactor;
    const rightShoulderX = centerX + SHOULDER_HALF_WIDTH * gridScaleFactor;

    // Calculate arm segment lengths (scaled)
    const halfwayOffset = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;
    const upperArmLength = halfwayOffset * UPPER_ARM_RATIO;
    const forearmLength = halfwayOffset * FOREARM_RATIO;

    // Render blue arm (left shoulder by convention)
    if (showBlue) {
      this.renderArm(ctx, {
        handX: blueHandX,
        handY: blueHandY,
        shoulderX: leftShoulderX,
        shoulderY: shoulderY,
        color: blueColor,
        upperArmLength,
        forearmLength,
        isLeftArm: true,
      });
    }

    // Render red arm (right shoulder by convention)
    if (showRed) {
      this.renderArm(ctx, {
        handX: redHandX,
        handY: redHandY,
        shoulderX: rightShoulderX,
        shoulderY: shoulderY,
        color: redColor,
        upperArmLength,
        forearmLength,
        isLeftArm: false,
      });
    }
  }

  /**
   * Render a single arm using 2D inverse kinematics
   */
  private renderArm(
    ctx: CanvasRenderingContext2D,
    params: ArmRenderParams
  ): void {
    const {
      handX,
      handY,
      shoulderX,
      shoulderY,
      color,
      upperArmLength,
      forearmLength,
      isLeftArm,
    } = params;

    // Calculate elbow position using 2D IK
    const elbow = this.solveIK2D(
      shoulderX,
      shoulderY,
      handX,
      handY,
      upperArmLength,
      forearmLength,
      isLeftArm
    );

    // Draw arm segments
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = ARM_LINE_WIDTH * (ctx.canvas.width / VIEWBOX_SIZE);
    ctx.globalAlpha = ARM_OPACITY;
    ctx.strokeStyle = color;

    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 2D Inverse Kinematics solver using law of cosines
   *
   * Given shoulder and hand positions plus arm segment lengths,
   * calculates the elbow position that connects them.
   *
   * Uses a "pole hint" (isLeftArm) to determine which side the
   * elbow bends toward when there are two valid solutions.
   *
   * @param shoulderX - Shoulder X coordinate
   * @param shoulderY - Shoulder Y coordinate
   * @param handX - Hand/target X coordinate
   * @param handY - Hand/target Y coordinate
   * @param upperLen - Upper arm length (shoulder to elbow)
   * @param forearmLen - Forearm length (elbow to hand)
   * @param isLeftArm - If true, elbow bends right; if false, bends left
   * @returns Elbow position {x, y}
   */
  private solveIK2D(
    shoulderX: number,
    shoulderY: number,
    handX: number,
    handY: number,
    upperLen: number,
    forearmLen: number,
    isLeftArm: boolean
  ): Point2D {
    // Vector from shoulder to hand
    const dx = handX - shoulderX;
    const dy = handY - shoulderY;
    let dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp distance to reachable range
    const maxReach = upperLen + forearmLen;
    const minReach = Math.abs(upperLen - forearmLen);

    // Use 0.999/1.001 to avoid singularity at exact reach limits
    if (dist > maxReach * 0.999) {
      dist = maxReach * 0.999;
    } else if (dist < minReach * 1.001) {
      dist = minReach * 1.001;
    }

    // Law of cosines: find angle at shoulder
    // cos(angle) = (upper² + dist² - forearm²) / (2 × upper × dist)
    const cosAngle =
      (upperLen * upperLen + dist * dist - forearmLen * forearmLen) /
      (2 * upperLen * dist);

    // Clamp to [-1, 1] to handle floating point errors
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    // Angle from shoulder to hand
    const baseAngle = Math.atan2(dy, dx);

    // Elbow bends to the side based on isLeftArm (pole hint)
    // Left arm: elbow bends right (subtract angle) - more natural pose
    // Right arm: elbow bends left (add angle) - more natural pose
    const elbowAngle = isLeftArm ? baseAngle - angle : baseAngle + angle;

    return {
      x: shoulderX + Math.cos(elbowAngle) * upperLen,
      y: shoulderY + Math.sin(elbowAngle) * upperLen,
    };
  }
}
