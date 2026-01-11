import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishMovementController } from "../contracts/IFishMovementController";
import type { IFishDecisionMaker } from "../contracts/IFishDecisionMaker";
import {
  BEHAVIOR_CONFIG,
  EDGE_AWARENESS,
  SPAWN_CONFIG,
} from "../../domain/constants/fish-constants";
import { FishDecisionMaker } from "./FishDecisionMaker";

/**
 * FishMovementController - Manages fish behavior state machine and movement
 *
 * Handles behavior transitions (cruising, turning, darting, schooling),
 * applies movement based on current behavior, and manages edge awareness.
 * Now supports personality-influenced decisions via FishDecisionMaker.
 */
export class FishMovementController implements IFishMovementController {
  private decisionMaker: IFishDecisionMaker;

  constructor(decisionMaker?: IFishDecisionMaker) {
    this.decisionMaker = decisionMaker ?? new FishDecisionMaker();
  }
  applyBehavior(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    _dimensions: Dimensions
  ): void {
    switch (fish.behavior) {
      case "cruising":
      case "schooling":
        this.applyCruising(fish, deltaSeconds, frameMultiplier);
        break;
      case "turning":
        this.applyTurning(fish, deltaSeconds);
        break;
      case "darting":
        this.applyDarting(fish, deltaSeconds);
        break;
    }

    // Clamp to depth band
    fish.baseY = Math.max(
      fish.depthBand.min,
      Math.min(fish.depthBand.max, fish.baseY)
    );
  }

  transitionBehavior(
    fish: FishMarineLife,
    dimensions: Dimensions,
    nearbyFish: FishMarineLife[] = [],
    animationTime: number = 0
  ): void {
    const current = fish.behavior;

    // Complete turning: flip direction
    if (current === "turning") {
      fish.direction =
        fish.targetDirection ?? ((fish.direction * -1) as 1 | -1);
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.rotation = 0;
      fish.speed = fish.baseSpeed;
      return;
    }

    // Complete darting: return to cruise
    if (current === "darting") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.speed = fish.baseSpeed;
      return;
    }

    // Use personality-influenced decision making
    const decision = this.decisionMaker.decideNextBehavior({
      fish,
      nearbyFish,
      dimensions,
      animationTime,
    });

    // Apply the decision
    fish.behavior = decision.behavior;

    // Set behavior timer based on behavior type
    switch (decision.behavior) {
      case "turning":
        fish.behaviorTimer = BEHAVIOR_CONFIG.turning.duration;
        fish.targetDirection = decision.targetDirection;
        break;
      case "darting":
        fish.behaviorTimer = BEHAVIOR_CONFIG.darting.duration;
        fish.dartSpeed =
          fish.baseSpeed *
          (decision.speedMultiplier ??
            this.randomInRange(BEHAVIOR_CONFIG.darting.speedMultiplier));
        break;
      case "cruising":
      case "schooling":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
        // Apply speed modifier for mood-based decisions (e.g., tired fish)
        if (decision.speedMultiplier) {
          fish.speed = fish.baseSpeed * decision.speedMultiplier;
        }
        break;
    }

    // Store wobble trigger for visual system to pick up
    if (decision.triggerWobble) {
      fish.wobbleType = decision.triggerWobble;
      fish.wobbleTimer = 0.5; // Half-second wobble
      fish.wobbleIntensity = 1.0;
    }
  }

  isOffScreen(fish: FishMarineLife, dimensions: Dimensions): boolean {
    const buffer = fish.bodyLength + SPAWN_CONFIG.offScreenBuffer;
    return fish.x > dimensions.width + buffer || fish.x < -buffer;
  }

  getEdgeProximity(fish: FishMarineLife, dimensions: Dimensions): number {
    const warningZone = dimensions.width * EDGE_AWARENESS.warningZone;

    if (fish.direction === 1) {
      // Moving right, check right edge
      const distToEdge = dimensions.width - fish.x;
      if (distToEdge < warningZone) return 1 - distToEdge / warningZone;
    } else {
      // Moving left, check left edge
      if (fish.x < warningZone) return 1 - fish.x / warningZone;
    }
    return 0;
  }

  private applyCruising(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void {
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;
    fish.baseY += fish.verticalDrift * deltaSeconds;

    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude;
    fish.y = fish.baseY + bob;
  }

  private applyTurning(fish: FishMarineLife, deltaSeconds: number): void {
    fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.turning.speedMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;

    const turnProgress =
      1 - fish.behaviorTimer / BEHAVIOR_CONFIG.turning.duration;
    fish.rotation =
      fish.direction *
      Math.sin(turnProgress * Math.PI) *
      BEHAVIOR_CONFIG.turning.maxRotation;
  }

  private applyDarting(fish: FishMarineLife, deltaSeconds: number): void {
    fish.speed =
      fish.dartSpeed ??
      fish.baseSpeed * BEHAVIOR_CONFIG.darting.speedMultiplier[0];
    fish.x += fish.direction * fish.speed * deltaSeconds;
    fish.y += (Math.random() - 0.5) * 2; // Slight vertical jitter
  }

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
