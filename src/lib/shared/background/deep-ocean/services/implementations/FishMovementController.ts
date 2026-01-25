import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishMovementController } from "../contracts/IFishMovementController";
import type { IFishDecisionMaker } from "../contracts/IFishDecisionMaker";
import {
  BEHAVIOR_CONFIG,
  EDGE_AWARENESS,
  SPAWN_CONFIG,
  DEPTH_TRANSITION,
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
    dimensions: Dimensions
  ): void {
    // Always update depth (z-axis lerping)
    this.updateDepth(fish, frameMultiplier);

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
      case "passing":
        this.applyPassing(fish, deltaSeconds);
        break;
      case "ascending":
        this.applyAscending(fish, deltaSeconds, frameMultiplier, dimensions);
        break;
      case "descending":
        this.applyDescending(fish, deltaSeconds, frameMultiplier, dimensions);
        break;
      case "approaching":
      case "receding":
        // These behaviors use normal horizontal movement,
        // z-axis change is handled by updateDepth via targetZ
        this.applyCruising(fish, deltaSeconds, frameMultiplier);
        break;
    }

    // Clamp to depth band (relaxed for ascending/descending)
    if (fish.behavior !== "ascending" && fish.behavior !== "descending") {
      fish.baseY = Math.max(
        fish.depthBand.min,
        Math.min(fish.depthBand.max, fish.baseY)
      );
    } else {
      // Wider bounds during vertical movement
      const margin = dimensions.height * 0.1;
      fish.baseY = Math.max(margin, Math.min(dimensions.height - margin, fish.baseY));
    }
  }

  /**
   * Updates the fish's z-axis position by lerping toward targetZ.
   * Called every frame to smoothly animate depth changes.
   */
  updateDepth(fish: FishMarineLife, frameMultiplier: number): void {
    const lerpSpeed = DEPTH_TRANSITION.lerpSpeed * frameMultiplier;
    fish.z += (fish.targetZ - fish.z) * lerpSpeed;

    // Clamp to valid range
    fish.z = Math.max(DEPTH_TRANSITION.minZ, Math.min(DEPTH_TRANSITION.maxZ, fish.z));
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

    // Complete passing: return to cruise
    if (current === "passing") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.speed = fish.baseSpeed;
      fish.rotation = 0;
      return;
    }

    // Complete ascending/descending: return to cruise with updated baseY
    if (current === "ascending" || current === "descending") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.speed = fish.baseSpeed;
      fish.rotation = 0;
      fish.targetY = undefined;
      // Update depth band to center around new position
      const bandHeight = fish.depthBand.max - fish.depthBand.min;
      fish.depthBand = {
        min: Math.max(dimensions.height * 0.05, fish.baseY - bandHeight / 2),
        max: Math.min(dimensions.height * 0.95, fish.baseY + bandHeight / 2),
      };
      return;
    }

    // Complete approaching/receding: return to cruise (z already changed via lerp)
    if (current === "approaching" || current === "receding") {
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
      case "passing":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.passing.duration);
        fish.speed =
          fish.baseSpeed *
          (decision.speedMultiplier ??
            this.randomInRange(BEHAVIOR_CONFIG.passing.speedMultiplier));
        break;
      case "ascending":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.ascending.duration);
        fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.ascending.speedMultiplier;
        fish.targetY = decision.targetY ?? fish.baseY - this.randomInRange([30, 60]);
        fish.rotation = this.randomInRange(BEHAVIOR_CONFIG.ascending.bodyRotation);
        break;
      case "descending":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.descending.duration);
        fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.descending.speedMultiplier;
        fish.targetY = decision.targetY ?? fish.baseY + this.randomInRange([30, 60]);
        fish.rotation = this.randomInRange(BEHAVIOR_CONFIG.descending.bodyRotation);
        break;
      case "approaching":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.approaching.duration);
        fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.approaching.speedMultiplier;
        fish.targetZ = Math.max(
          DEPTH_TRANSITION.minZ,
          fish.z + this.randomInRange(BEHAVIOR_CONFIG.approaching.zChange)
        );
        break;
      case "receding":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.receding.duration);
        fish.speed = fish.baseSpeed * BEHAVIOR_CONFIG.receding.speedMultiplier;
        fish.targetZ = Math.min(
          DEPTH_TRANSITION.maxZ,
          fish.z + this.randomInRange(BEHAVIOR_CONFIG.receding.zChange)
        );
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

  /**
   * Natural fish C-start escape response with three phases:
   * 1. COIL - body tenses, slows down briefly (preparatory)
   * 2. BURST - explosive acceleration (propulsive)
   * 3. RECOVERY - gradual easeOutExpo deceleration
   */
  private applyDarting(fish: FishMarineLife, deltaSeconds: number): void {
    const config = BEHAVIOR_CONFIG.darting;
    const totalDuration = config.duration;

    // Calculate elapsed time (timer counts down, so invert)
    const elapsed = totalDuration - fish.behaviorTimer;

    // Determine which phase we're in and calculate speed multiplier
    let speedMultiplier: number;
    let verticalJitter = 0;

    if (elapsed < config.coilDuration) {
      // Phase 1: COIL (preparatory)
      // Fish slows down, body tenses - this creates the "windup" feel
      speedMultiplier = config.coilSpeedMultiplier;
      // Increase body flex to simulate coiling
      fish.bodyFlexAmount = 1.3;
    } else if (elapsed < config.coilDuration + config.burstDuration) {
      // Phase 2: BURST (propulsive)
      // Explosive acceleration - the actual dart
      const burstProgress =
        (elapsed - config.coilDuration) / config.burstDuration;
      speedMultiplier =
        (fish.dartSpeed ?? fish.baseSpeed * config.burstSpeedMultiplier[0]) /
        fish.baseSpeed;
      // Strong vertical jitter that decreases as burst progresses
      // (fish doesn't move in a perfectly straight line during escape)
      verticalJitter = (Math.random() - 0.5) * 4 * (1 - burstProgress);
      // Reset body flex
      fish.bodyFlexAmount = 1.0;
    } else {
      // Phase 3: RECOVERY (deceleration)
      // Gradual slowdown using easeOutExpo for natural feel
      const recoveryProgress =
        (elapsed - config.coilDuration - config.burstDuration) /
        config.recoveryDuration;

      // easeOutExpo: fast initial slowdown, then gradual settle
      const easeOut = recoveryProgress === 1 ? 1 : 1 - Math.pow(2, -10 * recoveryProgress);

      // Interpolate from dart speed back to base speed
      const dartMultiplier =
        (fish.dartSpeed ?? fish.baseSpeed * config.burstSpeedMultiplier[0]) /
        fish.baseSpeed;
      speedMultiplier = dartMultiplier * (1 - easeOut) + 1 * easeOut;

      // Minimal jitter during recovery
      verticalJitter = (Math.random() - 0.5) * 0.5;
    }

    // Apply movement
    fish.speed = fish.baseSpeed * speedMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;
    fish.y += verticalJitter;
  }

  /**
   * Fast direct swimming - no bobbing, straight line, streamlined posture.
   * Creates variety with fish that zoom across the screen.
   */
  private applyPassing(fish: FishMarineLife, deltaSeconds: number): void {
    // No bobbing, no vertical drift - straight line
    fish.x += fish.direction * fish.speed * deltaSeconds;
    // Reduced body flex for streamlined appearance
    fish.bodyFlexAmount = BEHAVIOR_CONFIG.passing.bodyFlexMultiplier;
  }

  /**
   * Ascending - swimming upward with vertical focus.
   * Fish browses toward the surface with angled body rotation.
   */
  private applyAscending(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions
  ): void {
    // Horizontal movement at reduced speed
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;

    // Strong vertical movement upward
    if (fish.targetY !== undefined) {
      const verticalSpeed = this.randomInRange(BEHAVIOR_CONFIG.ascending.verticalSpeed);
      const direction = fish.targetY < fish.baseY ? -1 : 1;
      fish.baseY += direction * verticalSpeed * deltaSeconds;
    }

    // Bob around the moving baseY
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude * 0.5;
    fish.y = fish.baseY + bob;
  }

  /**
   * Descending - swimming downward with vertical focus.
   * Fish browses toward the depths with angled body rotation.
   */
  private applyDescending(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions
  ): void {
    // Horizontal movement at reduced speed
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.direction * fish.speed * deltaSeconds;

    // Strong vertical movement downward
    if (fish.targetY !== undefined) {
      const verticalSpeed = Math.abs(this.randomInRange(BEHAVIOR_CONFIG.descending.verticalSpeed));
      const direction = fish.targetY > fish.baseY ? 1 : -1;
      fish.baseY += direction * verticalSpeed * deltaSeconds;
    }

    // Bob around the moving baseY
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude * 0.5;
    fish.y = fish.baseY + bob;
  }

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
