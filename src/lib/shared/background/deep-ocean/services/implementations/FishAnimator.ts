import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { IFishAnimator } from "../contracts/IFishAnimator";
import type { IFishFactory } from "../contracts/IFishFactory";
import type { IFishSpineController } from "../contracts/IFishSpineController";
import type { IFishMovementController } from "../contracts/IFishMovementController";
import type { IFishFlockingCalculator } from "../contracts/IFishFlockingCalculator";
import type { IFishVisualUpdater } from "../contracts/IFishVisualUpdater";
import type { IFishMoodManager } from "../contracts/IFishMoodManager";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";
import { FISH_COUNTS, SPAWN_CONFIG } from "../../domain/constants/fish-constants";
import type { SpineChain } from "../../physics/SpineChain";
import { FishMoodManager } from "./FishMoodManager";
import { FishWobbleAnimator } from "./FishWobbleAnimator";

/**
 * FishAnimator - Orchestrates fish animation subsystems
 *
 * Coordinates creation, physics, movement, flocking, mood, and visual updates
 * by delegating to specialized services. Manages spawn scheduling and
 * fish lifecycle.
 */
export class FishAnimator implements IFishAnimator {
  private pendingSpawns: number[] = [];
  private moodManager: IFishMoodManager;
  private wobbleAnimator: IFishWobbleAnimator;

  constructor(
    private readonly fishFactory: IFishFactory,
    private readonly spineController: IFishSpineController,
    private readonly movementController: IFishMovementController,
    private readonly flockingCalculator: IFishFlockingCalculator,
    private readonly visualUpdater: IFishVisualUpdater,
    moodManager?: IFishMoodManager,
    wobbleAnimator?: IFishWobbleAnimator
  ) {
    this.moodManager = moodManager ?? new FishMoodManager();
    this.wobbleAnimator = wobbleAnimator ?? new FishWobbleAnimator();
  }

  async initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain: boolean = true
  ): Promise<FishMarineLife[]> {
    const fish = this.fishFactory.initializeFish(dimensions, count, useSpineChain);

    // Initialize spine chains for spine-enabled fish
    for (const f of fish) {
      if (f.useSpineChain) {
        this.spineController.initializeSpineChain(f);
      }
    }

    // Form schools
    this.flockingCalculator.formSchools(fish);

    return fish;
  }

  createFish(dimensions: Dimensions, useSpineChain: boolean = true): FishMarineLife {
    const fish = this.fishFactory.createFish(dimensions, useSpineChain);

    if (fish.useSpineChain) {
      this.spineController.initializeSpineChain(fish);
    }

    return fish;
  }

  updateFish(
    fish: FishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): FishMarineLife[] {
    const updatedFish: FishMarineLife[] = [];
    const deltaSeconds = 0.016 * frameMultiplier;

    // Apply flocking forces to schooling fish
    this.flockingCalculator.applyFlockingForces(fish, deltaSeconds);

    // Update each fish
    for (const f of fish) {
      // Update behavior timer
      f.behaviorTimer -= deltaSeconds;
      if (f.behaviorTimer <= 0) {
        // Pass nearby fish for social behavior decisions
        const nearbyFish = fish.filter(
          (other) =>
            other !== f &&
            Math.abs(other.x - f.x) < 200 &&
            Math.abs(other.y - f.y) < 100
        );
        this.movementController.transitionBehavior(
          f,
          dimensions,
          nearbyFish,
          animationTime
        );
      }

      // Update mood state (handles energy, hunger, mood decay)
      this.moodManager.updateMood(f, deltaSeconds);

      // Update propulsion from tail physics BEFORE movement
      // This connects tail animation to actual speed
      if (f.useSpineChain) {
        this.spineController.updatePropulsion(f, deltaSeconds);
      }

      // Apply behavior-specific movement (now uses thrust-modulated speed)
      this.movementController.applyBehavior(f, deltaSeconds, frameMultiplier, dimensions);

      // Update animation based on mode
      if (f.useSpineChain) {
        this.spineController.updateSpineChain(f, deltaSeconds, frameMultiplier);
      } else {
        this.visualUpdater.updateBodyFlex(f, frameMultiplier);
        this.visualUpdater.updateFinPhysics(f, frameMultiplier);
      }

      // Update visual animations
      this.visualUpdater.updateVisuals(f, frameMultiplier, animationTime);

      // Update wobble animations (decay timer and intensity)
      this.wobbleAnimator.updateWobble(f, deltaSeconds);

      // Check if off screen
      if (this.movementController.isOffScreen(f, dimensions)) {
        this.scheduleSpawn(
          animationTime + this.randomInRange(SPAWN_CONFIG.respawnDelay)
        );
        this.spineController.removeSpineChain(f);
      } else {
        updatedFish.push(f);
      }
    }

    return updatedFish;
  }

  /**
   * Get spine chain for a fish (for external access)
   */
  getSpineChain(fish: FishMarineLife): SpineChain | undefined {
    return this.spineController.getSpineChain(fish);
  }

  /**
   * Get wobble offset for a fish (for rendering)
   */
  getWobbleOffset(fish: FishMarineLife) {
    return this.wobbleAnimator.getWobbleOffset(fish);
  }

  getFishCount(quality: string): number {
    return FISH_COUNTS[quality] ?? 8;
  }

  scheduleSpawn(spawnTime: number): void {
    this.pendingSpawns.push(spawnTime);
  }

  processPendingSpawns(
    dimensions: Dimensions,
    currentTime: number
  ): FishMarineLife[] {
    const newFish: FishMarineLife[] = [];

    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const spawnTime = this.pendingSpawns[i];
      if (spawnTime !== undefined && currentTime >= spawnTime) {
        newFish.push(this.createFish(dimensions));
        this.pendingSpawns.splice(i, 1);
      }
    }

    return newFish;
  }

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
