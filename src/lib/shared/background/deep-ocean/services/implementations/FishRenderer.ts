import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishRenderer } from "../contracts/IFishRenderer";
import type { IFishEffectRenderer } from "../contracts/IFishEffectRenderer";
import type { IFishFaceRenderer } from "../contracts/IFishFaceRenderer";
import type { IFishFinRenderer } from "../contracts/IFishFinRenderer";
import type { IFishPatternRenderer } from "../contracts/IFishPatternRenderer";
import type { IFishBodyRenderer } from "../contracts/IFishBodyRenderer";
import { SpineChain } from "../../physics/SpineChain";
import { BodyOutlineCalculator, type Point } from "../../physics/BodyOutlineCalculator";
import { fishDebugConfig } from "../../domain/debug-config";
import { DEPTH_TRANSITION } from "../../domain/constants/fish-constants";

/**
 * Fish Rendering Orchestrator
 *
 * Coordinates specialized rendering services to draw anatomically accurate procedural fish:
 * - Body shapes (FishBodyRenderer)
 * - Fins with physics (FishFinRenderer)
 * - Patterns and textures (FishPatternRenderer)
 * - Facial features (FishFaceRenderer)
 * - Effects like bioluminescence (FishEffectRenderer)
 */
export class FishRenderer implements IFishRenderer {
  private bodyOutlineCalculator = new BodyOutlineCalculator();

  constructor(
    private effectRenderer: IFishEffectRenderer,
    private faceRenderer: IFishFaceRenderer,
    private finRenderer: IFishFinRenderer,
    private patternRenderer: IFishPatternRenderer,
    private bodyRenderer: IFishBodyRenderer
  ) {}

  drawFish(ctx: CanvasRenderingContext2D, fish: FishMarineLife[]): void {
    // Sort by z value for proper z-ordering (high z = far = draw first)
    const sorted = [...fish].sort((a, b) => b.z - a.z);

    for (const f of sorted) {
      // DEBUG: Allow forcing legacy rendering via toggle
      const useSpine = fishDebugConfig.useSpineRendering && f.useSpineChain && f.spineJoints;
      if (useSpine) {
        this.drawSpineChainFish(ctx, f);
      } else {
        this.drawSingleFish(ctx, f);
      }
    }
  }

  /**
   * Calculate depth-based rendering modifiers from z value.
   * Uses DEPTH_TRANSITION constants for consistency.
   */
  private getDepthModifiers(fish: FishMarineLife): {
    depthScale: number;
    depthOpacity: number;
  } {
    const z = fish.z ?? 0.5; // Default to mid-depth if z not set
    return {
      depthScale: 1 - z * DEPTH_TRANSITION.scaleReduction,
      depthOpacity: 1 - z * DEPTH_TRANSITION.opacityReduction,
    };
  }

  // ===========================================================================
  // SPINE-CHAIN RENDERING (Organic Animation)
  // ===========================================================================

  /**
   * Draw fish using spine chain data for organic body shape
   */
  private drawSpineChainFish(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife
  ): void {
    if (!fish.spineJoints || fish.spineJoints.length === 0) return;

    // Get dynamic depth modifiers from z value
    const { depthScale, depthOpacity } = this.getDepthModifiers(fish);

    ctx.save();
    // Apply depth-based opacity on top of fish's base opacity
    ctx.globalAlpha = fish.opacity * depthOpacity;

    // Apply depth-based scale centered on fish head position
    const headJoint = fish.spineJoints[0];
    if (headJoint && depthScale !== 1) {
      ctx.translate(headJoint.x, headJoint.y);
      ctx.scale(depthScale, depthScale);
      ctx.translate(-headJoint.x, -headJoint.y);
    }

    // Apply wobble transform (subtle body expression animations)
    // DEBUG: Can be disabled via toggle to isolate spazzing
    if (fishDebugConfig.enableWobble) {
      const wobble = this.calculateWobbleOffset(fish);
      if (wobble.hasWobble && headJoint) {
        ctx.translate(headJoint.x + wobble.offsetX, headJoint.y + wobble.offsetY);
        ctx.rotate(wobble.rotation);
        ctx.scale(wobble.scaleX, wobble.scaleY);
        ctx.translate(-(headJoint.x + wobble.offsetX), -(headJoint.y + wobble.offsetY));
      }
    }

    // Create temporary spine chain from joint data for outline calculation
    const tempSpine = this.createTempSpineFromJoints(fish);
    const outline = this.bodyOutlineCalculator.calculateOutline(tempSpine);

    // Draw wake trail (in world space)
    this.effectRenderer.drawWakeTrail(ctx, fish);

    // Draw bioluminescence glow
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      this.effectRenderer.drawSpineBioluminescenceGlow(ctx, fish, outline);
    }

    // Draw body from spine outline
    this.bodyRenderer.drawSpineBody(ctx, fish, outline);

    // Draw stripe patterns (tropical/schooling)
    this.patternRenderer.drawSpineStripes(ctx, fish, tempSpine);

    // Draw spot patterns (deep/sleek)
    this.patternRenderer.drawSpineSpots(ctx, fish, tempSpine);

    // Draw scale pattern on spine body
    this.patternRenderer.drawSpineScalePattern(ctx, fish, tempSpine);

    // Draw iridescent shimmer highlight
    this.patternRenderer.drawSpineIridescence(ctx, fish, outline);

    // Draw lateral line
    this.patternRenderer.drawSpineLateralLine(ctx, fish, tempSpine);

    // Draw fins attached to spine
    if (fish.spineFins) {
      this.finRenderer.drawSpineFins(ctx, fish, tempSpine);
    }

    // Draw eye at head position
    this.faceRenderer.drawSpineEye(ctx, fish, tempSpine);

    // Draw gill slit
    this.faceRenderer.drawSpineGill(ctx, fish, tempSpine);

    // Draw bioluminescence spots
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      this.effectRenderer.drawSpineBioluminescenceSpots(ctx, fish, tempSpine);
    }

    ctx.restore();
  }

  /**
   * Create temporary SpineChain object from joint data
   */
  private createTempSpineFromJoints(fish: FishMarineLife): SpineChain {
    // Create a minimal SpineChain-like object for the body outline calculator
    const spineConfig = fish.spineConfig ?? {
      jointCount: fish.spineJoints!.length,
      widthProfile: fish.spineJoints!.map((j) => j.width),
      angleConstraint: Math.PI / 8,
      segmentLength: fish.bodyLength / (fish.spineJoints!.length - 1),
    };

    const tempSpine = new SpineChain(
      spineConfig,
      fish.spineJoints![0]!.x,
      fish.spineJoints![0]!.y,
      fish.direction
    );

    // Copy actual joint positions
    for (let i = 0; i < fish.spineJoints!.length && i < tempSpine.joints.length; i++) {
      const source = fish.spineJoints![i]!;
      const target = tempSpine.joints[i]!;
      target.x = source.x;
      target.y = source.y;
      target.angle = source.angle;
      target.width = source.width;
    }

    return tempSpine;
  }


  // ===========================================================================
  // LEGACY RENDERING (Static Bezier)
  // ===========================================================================

  private drawSingleFish(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife
  ): void {
    // Get dynamic depth modifiers from z value
    const { depthScale, depthOpacity } = this.getDepthModifiers(fish);

    ctx.save();
    // Apply depth-based opacity on top of fish's base opacity
    ctx.globalAlpha = fish.opacity * depthOpacity;
    ctx.translate(fish.x, fish.y);

    // Apply depth-based scale
    ctx.scale(depthScale, depthScale);

    ctx.rotate(fish.rotation);
    // Flip horizontally: direction=1 means moving right, so head should point right (positive X)
    // Body is drawn with nose at -0.5, so we need to flip based on direction
    ctx.scale(-fish.direction, 1);

    const len = fish.bodyLength;
    const height = fish.bodyHeight;

    // Draw layers back to front
    this.effectRenderer.drawWakeTrail(ctx, fish);
    this.effectRenderer.drawBioluminescenceGlow(ctx, fish, len, height);
    this.bodyRenderer.drawBody(ctx, fish, len, height);
    this.patternRenderer.drawScalePattern(ctx, fish, len, height);
    this.patternRenderer.drawLateralLine(ctx, fish, len, height);
    this.finRenderer.drawFins(ctx, fish, len, height);
    this.faceRenderer.drawGill(ctx, fish, len, height);
    this.faceRenderer.drawEye(ctx, fish, len, height);
    this.effectRenderer.drawBioluminescenceSpots(ctx, fish, len, height);

    ctx.restore();
  }

  // ===========================================================================
  // WOBBLE CALCULATIONS
  // ===========================================================================

  /**
   * Wobble configuration matching FishWobbleAnimator
   */
  private static readonly WOBBLE_CONFIGS: Record<
    string,
    {
      duration: number;
      rotationAmplitude: number;
      scaleXAmplitude: number;
      scaleYAmplitude: number;
      offsetXAmplitude: number;
      offsetYAmplitude: number;
      frequency: number;
      decay: "linear" | "exponential";
    }
  > = {
    curious_tilt: {
      duration: 0.6,
      rotationAmplitude: 0.15,
      scaleXAmplitude: 0,
      scaleYAmplitude: 0.05,
      offsetXAmplitude: 0,
      offsetYAmplitude: -3,
      frequency: 1.5,
      decay: "linear",
    },
    startled_dart: {
      duration: 0.3,
      rotationAmplitude: 0.1,
      scaleXAmplitude: 0.08,
      scaleYAmplitude: -0.05,
      offsetXAmplitude: -5,
      offsetYAmplitude: 2,
      frequency: 4,
      decay: "exponential",
    },
    playful_wiggle: {
      duration: 0.8,
      rotationAmplitude: 0.2,
      scaleXAmplitude: 0.03,
      scaleYAmplitude: 0.03,
      offsetXAmplitude: 3,
      offsetYAmplitude: 2,
      frequency: 6,
      decay: "linear",
    },
    tired_drift: {
      duration: 1.2,
      rotationAmplitude: 0.08,
      scaleXAmplitude: 0,
      scaleYAmplitude: -0.03,
      offsetXAmplitude: 0,
      offsetYAmplitude: 4,
      frequency: 0.5,
      decay: "linear",
    },
    feeding_lunge: {
      duration: 0.4,
      rotationAmplitude: 0.05,
      scaleXAmplitude: 0.1,
      scaleYAmplitude: -0.05,
      offsetXAmplitude: 8,
      offsetYAmplitude: 0,
      frequency: 2,
      decay: "exponential",
    },
    social_shimmer: {
      duration: 0.7,
      rotationAmplitude: 0.05,
      scaleXAmplitude: 0.02,
      scaleYAmplitude: 0.04,
      offsetXAmplitude: 1,
      offsetYAmplitude: 1,
      frequency: 8,
      decay: "linear",
    },
  };

  /**
   * Calculate wobble offset from fish state
   */
  private calculateWobbleOffset(fish: FishMarineLife): {
    hasWobble: boolean;
    rotation: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
  } {
    const noWobble = {
      hasWobble: false,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };

    const wobbleType = fish.wobbleType;
    if (!wobbleType || wobbleType === "none" || !fish.wobbleTimer || fish.wobbleTimer <= 0) {
      return noWobble;
    }

    const config = FishRenderer.WOBBLE_CONFIGS[wobbleType];
    if (!config) return noWobble;

    const intensity = fish.wobbleIntensity ?? 0;
    if (!Number.isFinite(intensity) || intensity <= 0) return noWobble;

    const timeInWobble = config.duration - fish.wobbleTimer;
    if (!Number.isFinite(timeInWobble)) return noWobble;

    const phase = timeInWobble * config.frequency * Math.PI * 2;
    const dir = fish.direction ?? 1;

    const rotation = Math.sin(phase) * config.rotationAmplitude * intensity * dir;
    const scaleX = 1 + Math.sin(phase) * config.scaleXAmplitude * intensity;
    const scaleY = 1 + Math.cos(phase * 0.7) * config.scaleYAmplitude * intensity;
    const offsetX = Math.sin(phase) * config.offsetXAmplitude * intensity * dir;
    const offsetY = Math.sin(phase * 1.3) * config.offsetYAmplitude * intensity;

    // Guard against NaN/Infinity
    if (!Number.isFinite(rotation) || !Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
      return noWobble;
    }

    return {
      hasWobble: true,
      rotation,
      scaleX,
      scaleY,
      offsetX: Number.isFinite(offsetX) ? offsetX : 0,
      offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    };
  }
}
