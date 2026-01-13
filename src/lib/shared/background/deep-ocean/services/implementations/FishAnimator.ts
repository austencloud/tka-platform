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
import type { IFishInteractionHandler } from "../contracts/IFishInteractionHandler";
import type { IFishRareBehaviorHandler } from "../contracts/IFishRareBehaviorHandler";
import type { IFishHomeZoneHandler } from "../contracts/IFishHomeZoneHandler";
import { FISH_COUNTS, SPAWN_CONFIG } from "../../domain/constants/fish-constants";
import { fishDebugConfig } from "../../domain/debug-config";
import type { SpineChain } from "../../physics/SpineChain";
import { FishMoodManager } from "./FishMoodManager";
import { FishWobbleAnimator } from "./FishWobbleAnimator";
import { FishInteractionHandler } from "./FishInteractionHandler";
import { FishRareBehaviorHandler } from "./FishRareBehaviorHandler";
import { FishHomeZoneHandler } from "./FishHomeZoneHandler";

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
  private interactionHandler: IFishInteractionHandler;
  private rareBehaviorHandler: IFishRareBehaviorHandler;
  private homeZoneHandler: IFishHomeZoneHandler;

  constructor(
    private readonly fishFactory: IFishFactory,
    private readonly spineController: IFishSpineController,
    private readonly movementController: IFishMovementController,
    private readonly flockingCalculator: IFishFlockingCalculator,
    private readonly visualUpdater: IFishVisualUpdater,
    moodManager?: IFishMoodManager,
    wobbleAnimator?: IFishWobbleAnimator,
    interactionHandler?: IFishInteractionHandler,
    rareBehaviorHandler?: IFishRareBehaviorHandler,
    homeZoneHandler?: IFishHomeZoneHandler
  ) {
    this.moodManager = moodManager ?? new FishMoodManager();
    this.wobbleAnimator = wobbleAnimator ?? new FishWobbleAnimator();
    this.interactionHandler = interactionHandler ?? new FishInteractionHandler(this.wobbleAnimator);
    this.rareBehaviorHandler = rareBehaviorHandler ?? new FishRareBehaviorHandler(this.wobbleAnimator);
    this.homeZoneHandler = homeZoneHandler ?? new FishHomeZoneHandler();
  }

  async initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain: boolean = true,
    spawnOnScreen: boolean = false
  ): Promise<FishMarineLife[]> {
    const fish = this.fishFactory.initializeFish(dimensions, count, useSpineChain, spawnOnScreen);

    // Initialize spine chains and home zones for all fish
    for (const f of fish) {
      if (f.useSpineChain) {
        this.spineController.initializeSpineChain(f);
      }
      // Initialize home zone at spawn position
      this.homeZoneHandler.initializeHomeZone(f);
    }

    // Form schools
    this.flockingCalculator.formSchools(fish);

    return fish;
  }

  createFish(dimensions: Dimensions, useSpineChain: boolean = true, spawnOnScreen: boolean = false): FishMarineLife {
    const fish = this.fishFactory.createFish(dimensions, useSpineChain, spawnOnScreen);

    if (fish.useSpineChain) {
      this.spineController.initializeSpineChain(fish);
    }

    // Initialize home zone at spawn position
    this.homeZoneHandler.initializeHomeZone(fish);

    return fish;
  }

  // Debug: Track position jumps (disabled - was causing console spam)
  private static DEBUG_POSITION_JUMPS = false;
  private static JUMP_THRESHOLD = 30; // pixels

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

    // Process fish-to-fish micro-interactions (greetings, yielding, etc.)
    if (fishDebugConfig.enableInteractions) {
      const interactions = this.interactionHandler.processInteractions(fish, deltaSeconds);
      for (const interaction of interactions) {
        this.interactionHandler.applyInteraction(interaction);
      }
    }

    // Process rare special behaviors (barrel rolls, freezes, etc.)
    if (fishDebugConfig.enableRareBehaviors) {
      const rareBehaviors = this.rareBehaviorHandler.checkRareBehaviors(fish, deltaSeconds);
      for (const behavior of rareBehaviors) {
        this.rareBehaviorHandler.applyRareBehavior(behavior);
      }
    }

    // Apply home zone drift (subtle pull toward spawn area)
    if (fishDebugConfig.enableHomeZones) {
      for (const f of fish) {
        this.homeZoneHandler.applyHomeZoneDrift(f, deltaSeconds);
      }
    }

    // Update each fish
    for (const f of fish) {
      // DEBUG: Capture position before update
      const beforeX = f.x;
      const beforeY = f.y;
      const beforeSpineX = f.spineJoints?.[0]?.x;
      const beforeSpineY = f.spineJoints?.[0]?.y;
      const stepPositions: Array<{step: string, x: number, y: number, spineX?: number, spineY?: number}> = [];
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        stepPositions.push({ step: 'start', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
      }
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
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        stepPositions.push({ step: 'afterMood', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
      }

      // Update propulsion from tail physics BEFORE movement
      // This connects tail animation to actual speed
      if (f.useSpineChain) {
        this.spineController.updatePropulsion(f, deltaSeconds);
      }
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        stepPositions.push({ step: 'afterPropulsion', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
      }

      // Apply behavior-specific movement (now uses thrust-modulated speed)
      this.movementController.applyBehavior(f, deltaSeconds, frameMultiplier, dimensions);
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        stepPositions.push({ step: 'afterBehavior', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
      }

      // Update animation based on mode
      if (f.useSpineChain) {
        this.spineController.updateSpineChain(f, deltaSeconds, frameMultiplier);
        if (FishAnimator.DEBUG_POSITION_JUMPS) {
          stepPositions.push({ step: 'afterSpineUpdate', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
        }
      } else {
        this.visualUpdater.updateBodyFlex(f, frameMultiplier);
        this.visualUpdater.updateFinPhysics(f, frameMultiplier);
      }

      // Update visual animations
      this.visualUpdater.updateVisuals(f, frameMultiplier, animationTime);
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        stepPositions.push({ step: 'afterVisuals', x: f.x, y: f.y, spineX: f.spineJoints?.[0]?.x, spineY: f.spineJoints?.[0]?.y });
      }

      // Update wobble animations (decay timer and intensity)
      this.wobbleAnimator.updateWobble(f, deltaSeconds);

      // DEBUG: Detect position jumps
      if (FishAnimator.DEBUG_POSITION_JUMPS) {
        const afterX = f.x;
        const afterY = f.y;
        const afterSpineX = f.spineJoints?.[0]?.x;
        const afterSpineY = f.spineJoints?.[0]?.y;

        const deltaX = Math.abs(afterX - beforeX);
        const deltaY = Math.abs(afterY - beforeY);
        const deltaSpineX = beforeSpineX !== undefined && afterSpineX !== undefined
          ? Math.abs(afterSpineX - beforeSpineX) : 0;
        const deltaSpineY = beforeSpineY !== undefined && afterSpineY !== undefined
          ? Math.abs(afterSpineY - beforeSpineY) : 0;

        const maxDelta = Math.max(deltaX, deltaY, deltaSpineX, deltaSpineY);

        if (maxDelta > FishAnimator.JUMP_THRESHOLD) {
          // Find where the jump happened
          let jumpStep = 'unknown';
          for (let i = 1; i < stepPositions.length; i++) {
            const prev = stepPositions[i - 1]!;
            const curr = stepPositions[i]!;
            const stepDeltaX = Math.abs(curr.x - prev.x);
            const stepDeltaY = Math.abs(curr.y - prev.y);
            const stepDeltaSpineX = prev.spineX !== undefined && curr.spineX !== undefined
              ? Math.abs(curr.spineX - prev.spineX) : 0;
            const stepDeltaSpineY = prev.spineY !== undefined && curr.spineY !== undefined
              ? Math.abs(curr.spineY - prev.spineY) : 0;
            const stepMaxDelta = Math.max(stepDeltaX, stepDeltaY, stepDeltaSpineX, stepDeltaSpineY);
            if (stepMaxDelta > FishAnimator.JUMP_THRESHOLD) {
              jumpStep = `${prev.step} → ${curr.step} (delta: ${stepMaxDelta.toFixed(1)})`;
              break;
            }
          }

          console.warn(`🐟 POSITION JUMP DETECTED!`, {
            jumpStep,
            species: f.species,
            behavior: f.behavior,
            mood: f.mood,
            wobbleType: f.wobbleType,
            wobbleTimer: f.wobbleTimer?.toFixed(3),
            wobbleIntensity: f.wobbleIntensity?.toFixed(3),
            frameMultiplier: frameMultiplier.toFixed(3),
            deltaSeconds: deltaSeconds.toFixed(4),
            speed: f.speed.toFixed(1),
            baseSpeed: f.baseSpeed.toFixed(1),
            position: {
              before: { x: beforeX.toFixed(1), y: beforeY.toFixed(1) },
              after: { x: afterX.toFixed(1), y: afterY.toFixed(1) },
              deltaX: deltaX.toFixed(1),
              deltaY: deltaY.toFixed(1),
            },
            spine: beforeSpineX !== undefined ? {
              before: { x: beforeSpineX.toFixed(1), y: beforeSpineY?.toFixed(1) },
              after: { x: afterSpineX?.toFixed(1), y: afterSpineY?.toFixed(1) },
              deltaX: deltaSpineX.toFixed(1),
              deltaY: deltaSpineY.toFixed(1),
            } : 'no spine',
            stepTrace: stepPositions.map(s => `${s.step}: (${s.x.toFixed(0)}, ${s.y.toFixed(0)}) spine:(${s.spineX?.toFixed(0) ?? '?'}, ${s.spineY?.toFixed(0) ?? '?'})`),
          });
        }
      }

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

  /**
   * Reposition a fish's spine chain by a delta
   * Call this after manually moving a fish's position to keep physics in sync
   */
  repositionFish(fish: FishMarineLife, dx: number, dy: number): void {
    this.spineController.repositionSpineChain(fish, dx, dy);
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

  // ============================================================================
  // Handler Access (for lab/testing)
  // ============================================================================

  /**
   * Get the rare behavior handler for manual triggering in lab
   */
  getRareBehaviorHandler(): IFishRareBehaviorHandler {
    return this.rareBehaviorHandler;
  }

  /**
   * Get the home zone handler for visualization in lab
   */
  getHomeZoneHandler(): IFishHomeZoneHandler {
    return this.homeZoneHandler;
  }

  /**
   * Get the interaction handler for manual triggering in lab
   */
  getInteractionHandler(): IFishInteractionHandler {
    return this.interactionHandler;
  }
}
