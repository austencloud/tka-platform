import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type {
  IFishHuntingHandler,
  ActiveHunt,
  HuntResult,
  HuntOutcome,
  HuntState,
  HuntStats,
} from "../contracts/IFishHuntingHandler";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";
import { FishWobbleAnimator } from "./FishWobbleAnimator";

/**
 * Hunting system configuration
 */
const HUNTING_CONFIG = {
  // Trigger conditions
  hungerThreshold: 0.6, // Min hunger to start hunting
  detectionRadius: 150, // How far predator can spot prey
  chaseRadius: 200, // Max distance predator will chase

  // Timing (seconds)
  stalkDuration: [2, 3] as const, // How long stalk phase lasts
  maxChaseDuration: [4, 6] as const, // Max chase before giving up
  huntCooldown: 30, // Time between hunts

  // Outcomes
  catchProbability: 0.2, // 20% catch rate
  escapeSpeedBoost: 1.5, // Prey speed multiplier when fleeing
  predatorChaseSpeed: 2.0, // Predator burst speed multiplier
  predatorStalkSpeed: 0.6, // Slow approach during stalk

  // School defense
  alertPropagationRadius: 100, // Alert nearby fish in school
};

/**
 * FishHuntingHandler - Manages predator/prey chase sequences
 *
 * Creates emergent drama through pursuit and escape:
 * - Sleek fish are active predators (fast, bold, solitary)
 * - Deep fish are ambush predators (patient, z-axis approach)
 * - Tropical/schooling fish are prey (flee, school up)
 *
 * No death mechanics - just pursuit behavior that adds life to the scene.
 */
export class FishHuntingHandler implements IFishHuntingHandler {
  private activeHunts: Map<number, ActiveHunt> = new Map();
  private stats: HuntStats = {
    activeHunts: 0,
    totalHunts: 0,
    successfulCatches: 0,
    escapes: 0,
  };
  private wobbleAnimator: IFishWobbleAnimator;

  constructor(wobbleAnimator?: IFishWobbleAnimator) {
    this.wobbleAnimator = wobbleAnimator ?? new FishWobbleAnimator();
  }

  processHunting(
    fish: FishMarineLife[],
    deltaSeconds: number,
    animationTime: number
  ): HuntResult[] {
    const results: HuntResult[] = [];

    // Build lookup maps
    const fishById = new Map(fish.map((f) => [f.fishId ?? 0, f]));

    // Update existing hunts
    for (const [hunterId, hunt] of this.activeHunts) {
      const predator = fishById.get(hunterId);
      const prey = fishById.get(hunt.targetId);

      // Cancel if either fish is gone
      if (!predator || !prey) {
        results.push({ hunt, outcome: "cancelled" });
        this.activeHunts.delete(hunterId);
        continue;
      }

      const huntAge = animationTime - hunt.startTime;

      // State machine
      switch (hunt.state) {
        case "stalking": {
          // Check if stalk phase is complete
          const stalkEnd =
            HUNTING_CONFIG.stalkDuration[0] +
            Math.random() *
              (HUNTING_CONFIG.stalkDuration[1] -
                HUNTING_CONFIG.stalkDuration[0]);
          if (huntAge >= stalkEnd) {
            // Transition to chase
            hunt.state = "chasing";
            predator.huntState = "chasing";
            predator.behavior = "chasing";

            // Prey detects predator and starts fleeing
            prey.isBeingHunted = true;
            prey.hunterId = hunterId;
            prey.mood = "alert";
            prey.behavior = "fleeing";
            this.wobbleAnimator.triggerWobble(prey, "startled_dart", 0.8);

            // Alert nearby schoolmates
            this.alertSchoolmates(prey, fish, animationTime);
          } else {
            // Slow approach during stalk
            this.applyStalking(predator, prey, deltaSeconds);
          }
          break;
        }

        case "chasing": {
          // Check timeout
          if (huntAge >= hunt.maxDuration) {
            results.push({ hunt, outcome: "timeout" });
            this.clearHuntState(predator, prey, animationTime);
            this.activeHunts.delete(hunterId);
            continue;
          }

          // Check distance - escaped if too far
          const dist = this.distance(predator, prey);
          if (dist > HUNTING_CONFIG.chaseRadius) {
            results.push({ hunt, outcome: "escaped" });
            this.clearHuntState(predator, prey, animationTime);
            this.activeHunts.delete(hunterId);
            this.stats.escapes++;
            continue;
          }

          // Check catch - random chance when close enough
          if (dist < 30) {
            const caught = Math.random() < HUNTING_CONFIG.catchProbability;
            if (caught) {
              results.push({ hunt, outcome: "caught" });
              this.clearHuntState(predator, prey, animationTime);
              this.activeHunts.delete(hunterId);
              this.stats.successfulCatches++;
              continue;
            }
          }

          // Apply chase movement
          this.applyChasing(predator, prey, deltaSeconds);
          this.applyFleeing(prey, predator, deltaSeconds);
          break;
        }
      }
    }

    // Look for new hunts
    const predators = fish.filter(
      (f) =>
        this.isPredator(f) &&
        !this.activeHunts.has(f.fishId ?? 0) &&
        this.canHunt(f, animationTime)
    );

    for (const predator of predators) {
      const prey = this.findPrey(predator, fish);
      if (prey) {
        this.startHunt(predator, prey, animationTime);
      }
    }

    // Update stats
    this.stats.activeHunts = this.activeHunts.size;

    return results;
  }

  applyHuntResult(result: HuntResult, fish: FishMarineLife[]): void {
    const fishById = new Map(fish.map((f) => [f.fishId ?? 0, f]));
    const predator = fishById.get(result.hunt.hunterId);
    const prey = fishById.get(result.hunt.targetId);

    switch (result.outcome) {
      case "caught":
        // Predator gets satisfied
        if (predator) {
          predator.hunger = Math.max(0, (predator.hunger ?? 0.5) - 0.4);
          predator.mood = "calm";
          this.wobbleAnimator.triggerWobble(predator, "feeding_lunge", 0.9);
        }
        // Prey gets startled (but survives - no death in this system)
        if (prey) {
          prey.mood = "alert";
          this.wobbleAnimator.triggerWobble(prey, "startled_dart", 1.0);
        }
        break;

      case "escaped":
        // Prey relief
        if (prey) {
          prey.mood = "alert";
          prey.energy = Math.max(0, (prey.energy ?? 0.7) - 0.2); // Tired from fleeing
        }
        break;

      case "timeout":
        // Predator frustrated
        if (predator) {
          predator.mood = "tired";
          predator.energy = Math.max(0, (predator.energy ?? 0.7) - 0.15);
        }
        break;

      case "cancelled":
        // Nothing special
        break;
    }
  }

  isPredator(fish: FishMarineLife): boolean {
    return fish.species === "sleek" || fish.species === "deep";
  }

  isPrey(fish: FishMarineLife): boolean {
    return fish.species === "tropical" || fish.species === "schooling";
  }

  getActiveHunts(): ActiveHunt[] {
    return Array.from(this.activeHunts.values());
  }

  getStats(): HuntStats {
    return { ...this.stats };
  }

  forceHunt(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    if (!predator.fishId || !prey.fishId) return;

    // Cancel any existing hunt
    this.activeHunts.delete(predator.fishId);

    // Start new hunt (skip hunger check)
    this.startHunt(predator, prey, animationTime);
  }

  cancelAllHunts(): void {
    this.activeHunts.clear();
    this.stats.activeHunts = 0;
  }

  getHuntVisualization(
    fish: FishMarineLife
  ): { targetX: number; targetY: number; state: HuntState } | null {
    const hunt = this.activeHunts.get(fish.fishId ?? 0);
    if (!hunt) return null;

    // We'd need the prey's position, which we don't have here
    // This should be called from a context with access to all fish
    return null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private canHunt(predator: FishMarineLife, animationTime: number): boolean {
    // Check hunger threshold
    const hunger = predator.hunger ?? 0.3;
    if (hunger < HUNTING_CONFIG.hungerThreshold) return false;

    // Check cooldown
    if (
      predator.huntCooldownEnd &&
      animationTime < predator.huntCooldownEnd
    ) {
      return false;
    }

    // Check mood - don't hunt if tired
    if (predator.mood === "tired") return false;

    return true;
  }

  private findPrey(
    predator: FishMarineLife,
    allFish: FishMarineLife[]
  ): FishMarineLife | null {
    // Find closest prey within detection range
    let closestPrey: FishMarineLife | null = null;
    let closestDist = HUNTING_CONFIG.detectionRadius;

    for (const fish of allFish) {
      if (!this.isPrey(fish)) continue;
      if (fish.isBeingHunted) continue; // Already being chased

      const dist = this.distance(predator, fish);
      if (dist < closestDist) {
        closestDist = dist;
        closestPrey = fish;
      }
    }

    return closestPrey;
  }

  private startHunt(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    const hunterId = predator.fishId ?? 0;
    const targetId = prey.fishId ?? 0;

    const maxDuration =
      HUNTING_CONFIG.maxChaseDuration[0] +
      Math.random() *
        (HUNTING_CONFIG.maxChaseDuration[1] -
          HUNTING_CONFIG.maxChaseDuration[0]);

    const hunt: ActiveHunt = {
      hunterId,
      targetId,
      state: "stalking",
      startTime: animationTime,
      maxDuration,
    };

    this.activeHunts.set(hunterId, hunt);
    this.stats.totalHunts++;

    // Update predator state
    predator.huntState = "stalking";
    predator.huntingTarget = targetId;
    predator.huntStartTime = animationTime;
    predator.behavior = "stalking";
  }

  private clearHuntState(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    // Clear predator state
    predator.huntState = "cooldown";
    predator.huntingTarget = undefined;
    predator.huntStartTime = undefined;
    predator.huntCooldownEnd = animationTime + HUNTING_CONFIG.huntCooldown;
    predator.behavior = "cruising";

    // Clear prey state
    prey.isBeingHunted = false;
    prey.hunterId = undefined;
    prey.behavior = "cruising";
  }

  private applyStalking(
    predator: FishMarineLife,
    prey: FishMarineLife,
    deltaSeconds: number
  ): void {
    // Slow, steady approach toward prey
    const dx = prey.x - predator.x;
    const dy = prey.y - predator.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const speed =
        predator.baseSpeed * HUNTING_CONFIG.predatorStalkSpeed * deltaSeconds;
      predator.x += (dx / dist) * speed * 60;
      predator.y += (dy / dist) * speed * 60;

      // Update direction to face prey
      predator.direction = dx > 0 ? 1 : -1;
    }
  }

  private applyChasing(
    predator: FishMarineLife,
    prey: FishMarineLife,
    deltaSeconds: number
  ): void {
    // Burst speed pursuit
    const dx = prey.x - predator.x;
    const dy = prey.y - predator.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const speed =
        predator.baseSpeed * HUNTING_CONFIG.predatorChaseSpeed * deltaSeconds;
      predator.x += (dx / dist) * speed * 60;
      predator.y += (dy / dist) * speed * 60;

      // Update direction
      predator.direction = dx > 0 ? 1 : -1;

      // Set high speed for visual effect
      predator.speed = predator.baseSpeed * HUNTING_CONFIG.predatorChaseSpeed;
    }
  }

  private applyFleeing(
    prey: FishMarineLife,
    predator: FishMarineLife,
    deltaSeconds: number
  ): void {
    // Flee away from predator
    const dx = prey.x - predator.x;
    const dy = prey.y - predator.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const speed =
        prey.baseSpeed * HUNTING_CONFIG.escapeSpeedBoost * deltaSeconds;
      prey.x += (dx / dist) * speed * 60;
      prey.y += (dy / dist) * speed * 60;

      // Update direction (away from predator)
      prey.direction = dx > 0 ? 1 : -1;

      // Set high speed for visual effect
      prey.speed = prey.baseSpeed * HUNTING_CONFIG.escapeSpeedBoost;
    }
  }

  private alertSchoolmates(
    alertedFish: FishMarineLife,
    allFish: FishMarineLife[],
    _animationTime: number
  ): void {
    // Find schoolmates within alert radius
    for (const fish of allFish) {
      if (fish === alertedFish) continue;
      if (fish.schoolId !== alertedFish.schoolId) continue;

      const dist = this.distance(alertedFish, fish);
      if (dist < HUNTING_CONFIG.alertPropagationRadius) {
        fish.mood = "alert";
        this.wobbleAnimator.triggerWobble(fish, "startled_dart", 0.5);
      }
    }
  }

  private distance(a: FishMarineLife, b: FishMarineLife): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private randomInRange(range: readonly [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
