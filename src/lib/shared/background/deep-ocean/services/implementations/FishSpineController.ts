import type {
  FishMarineLife,
  FishSpecies,
  SpineFin,
} from "../../domain/models/DeepOceanModels";
import { SPINE_CONFIGS, SWIM_PARAMS } from "../../domain/models/DeepOceanModels";
import type { IFishSpineController } from "../contracts/IFishSpineController";
import type { IFishPropulsionCalculator } from "../contracts/IFishPropulsionCalculator";
import { SpineChain } from "../../physics/SpineChain";
import { FishPropulsionCalculator, smoothSpeed } from "./FishPropulsionCalculator";
import { fishDebugConfig } from "../../domain/debug-config";

/**
 * FishSpineController - Manages spine chain physics for organic swimming
 *
 * Handles spine chain lifecycle (create, update, remove) and synchronizes
 * physics state back to fish entities for rendering. Now includes propulsion
 * calculation to connect tail motion with forward movement.
 */
export class FishSpineController implements IFishSpineController {
  private spineChains: Map<FishMarineLife, SpineChain> = new Map();
  private propulsionCalculator: IFishPropulsionCalculator;

  constructor(propulsionCalculator?: IFishPropulsionCalculator) {
    this.propulsionCalculator = propulsionCalculator ?? new FishPropulsionCalculator();
  }

  initializeSpineChain(fish: FishMarineLife): void {
    if (!fish.useSpineChain) return;

    const spineConfig = SPINE_CONFIGS[fish.species];
    const swimParams = SWIM_PARAMS[fish.species];

    // Calculate segment length based on body length
    const segmentLength = fish.bodyLength / (spineConfig.jointCount - 1);

    // Create spine chain
    const spine = new SpineChain(
      { ...spineConfig, segmentLength },
      fish.x,
      fish.y,
      fish.direction
    );

    // Set width profile scaled to body height
    const maxWidth = fish.bodyHeight / 2;
    spine.setWidthProfile(spineConfig.widthProfile, maxWidth);

    // Store spine chain reference
    this.spineChains.set(fish, spine);

    // Set spine properties on fish for rendering
    fish.spineConfig = spineConfig;
    fish.spineJoints = spine.joints.map((j) => ({ ...j }));
    fish.swimPhase = Math.random() * Math.PI * 2;
    fish.tailAmplitude = swimParams.tailAmplitude * (fish.bodyHeight / 20);
    fish.swimSpeed = swimParams.swimSpeed;

    // Create spine-attached fins
    fish.spineFins = this.createSpineFins(fish.species, spineConfig.jointCount);
  }

  updatePropulsion(fish: FishMarineLife, deltaSeconds: number): void {
    // DEBUG: Skip propulsion if disabled via toggle
    if (!fishDebugConfig.enablePropulsion) {
      return;
    }

    // Only apply propulsion to spine-chain fish
    if (!fish.useSpineChain || fish.swimPhase === undefined) {
      return;
    }

    // Calculate target speed from tail thrust
    const targetSpeed = this.propulsionCalculator.calculateTargetSpeed(fish);

    // Smoothly interpolate toward target speed (prevents jerky changes)
    fish.speed = smoothSpeed(fish.speed, targetSpeed, deltaSeconds);
  }

  updateSpineChain(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void {
    const spine = this.spineChains.get(fish);
    if (!spine || !fish.swimPhase || !fish.tailAmplitude || !fish.swimSpeed) {
      return;
    }

    // Update swim phase (drives tail oscillation)
    const speedRatio = fish.speed / fish.baseSpeed;
    fish.swimPhase += fish.swimSpeed * speedRatio * frameMultiplier;

    // Head target is where the movement controller already placed the fish
    // DO NOT add velocity again - applyCruising/applyBehavior already moved fish.x
    const headTargetX = fish.x;
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude;
    const headTargetY = fish.baseY + bob;

    // Apply tail oscillation (DEBUG: can be disabled via toggle)
    if (fishDebugConfig.enableTailOscillation) {
      spine.applyTailOscillation(
        fish.tailAmplitude * speedRatio,
        fish.swimPhase
      );
    }

    // Update spine chain (head follows target, body follows head)
    spine.update(headTargetX, headTargetY);

    // Sync fish position with spine head (should be very close, small adjustment from tail physics)
    fish.x = spine.head.x;
    fish.y = spine.head.y;

    // Update rotation from spine head angle
    fish.rotation = spine.headAngle;
    if (fish.direction === -1) {
      fish.rotation += Math.PI;
    }

    // Copy spine joint data back to fish for rendering
    fish.spineJoints = spine.joints.map((j) => ({ ...j }));
  }

  getSpineChain(fish: FishMarineLife): SpineChain | undefined {
    return this.spineChains.get(fish);
  }

  removeSpineChain(fish: FishMarineLife): void {
    this.spineChains.delete(fish);
  }

  /**
   * Reposition a fish's spine chain to match updated fish.x/y
   * Call this after manually moving a fish's position
   */
  repositionSpineChain(fish: FishMarineLife, dx: number, dy: number): void {
    const spine = this.spineChains.get(fish);
    if (!spine) return;

    // Move all joints in the physics spine chain
    for (const joint of spine.joints) {
      joint.x += dx;
      joint.y += dy;
    }

    // Update fish.spineJoints to match
    fish.spineJoints = spine.joints.map((j) => ({ ...j }));
  }

  /**
   * Create fins attached to spine segments
   */
  private createSpineFins(species: FishSpecies, jointCount: number): SpineFin[] {
    const fins: SpineFin[] = [];

    // Dorsal fin (top, around segment 2-3)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.25),
      attachmentSide: "top",
      baseAngle: -Math.PI / 2,
      length: species === "tropical" ? 0.35 : 0.25,
      width: 0.15,
      segments: 5,
      curvatureResponse: 0.5,
    });

    // Pectoral fins (sides, around segment 1-2)
    const pectoralSegment = Math.floor(jointCount * 0.15);
    fins.push({
      attachmentSegment: pectoralSegment,
      attachmentSide: "left",
      baseAngle: -Math.PI / 4,
      length: species === "tropical" ? 0.25 : 0.15,
      width: 0.12,
      segments: 4,
      curvatureResponse: 0.8,
    });
    fins.push({
      attachmentSegment: pectoralSegment,
      attachmentSide: "right",
      baseAngle: Math.PI / 4,
      length: species === "tropical" ? 0.25 : 0.15,
      width: 0.12,
      segments: 4,
      curvatureResponse: 0.8,
    });

    // Pelvic fins (bottom, around segment 3-4)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.4),
      attachmentSide: "bottom",
      baseAngle: Math.PI / 2.5,
      length: 0.12,
      width: 0.08,
      segments: 3,
      curvatureResponse: 0.3,
    });

    // Anal fin (bottom, around segment 5-6)
    fins.push({
      attachmentSegment: Math.floor(jointCount * 0.65),
      attachmentSide: "bottom",
      baseAngle: Math.PI / 2.2,
      length: 0.15,
      width: 0.08,
      segments: 4,
      curvatureResponse: 0.4,
    });

    return fins;
  }
}
