import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishRenderer } from "../contracts/IFishRenderer";
import type { IFishEffectRenderer } from "../contracts/IFishEffectRenderer";
import type { IFishFaceRenderer } from "../contracts/IFishFaceRenderer";
import type { IFishFinRenderer } from "../contracts/IFishFinRenderer";
import type { IFishPatternRenderer } from "../contracts/IFishPatternRenderer";
import type { IFishBodyRenderer } from "../contracts/IFishBodyRenderer";
import { SpineChain } from "../../physics/SpineChain";
import { BodyOutlineCalculator, type Point } from "../../physics/BodyOutlineCalculator";

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
    // Sort by depth layer for proper z-ordering (far first, near last)
    const sorted = [...fish].sort((a, b) => {
      const order = { far: 0, mid: 1, near: 2 };
      return order[a.depthLayer] - order[b.depthLayer];
    });

    for (const f of sorted) {
      if (f.useSpineChain && f.spineJoints) {
        this.drawSpineChainFish(ctx, f);
      } else {
        this.drawSingleFish(ctx, f);
      }
    }
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

    ctx.save();
    ctx.globalAlpha = fish.opacity;

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
    ctx.save();
    ctx.globalAlpha = fish.opacity;
    ctx.translate(fish.x, fish.y);
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

}
