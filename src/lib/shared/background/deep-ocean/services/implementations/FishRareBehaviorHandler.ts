import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type {
  IFishRareBehaviorHandler,
  RareBehaviorResult,
  RareBehaviorType,
} from "../contracts/IFishRareBehaviorHandler";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";
import { FishWobbleAnimator } from "./FishWobbleAnimator";

/**
 * Configuration for rare behavior probabilities and conditions
 */
const RARE_BEHAVIOR_CONFIG = {
  /** Base probability per second for each behavior type */
  baseProbabilities: {
    barrel_roll: 0.003, // ~0.3% per second when playful
    freeze: 0.005, // ~0.5% per second when alert
    double_take: 0.004, // ~0.4% per second when curious
    happy_flip: 0.002, // ~0.2% per second when high energy
    sync_swim: 0.006, // ~0.6% per second when near friend
  },

  /** Mood requirements for each behavior */
  moodRequirements: {
    barrel_roll: ["playful"] as const,
    freeze: ["alert"] as const,
    double_take: ["curious"] as const,
    happy_flip: ["playful", "calm"] as const,
    sync_swim: ["social", "calm", "playful"] as const,
  },

  /** Minimum energy level for energy-dependent behaviors */
  minEnergyForFlip: 0.7,

  /** Distance threshold for sync swim (pixels) */
  syncSwimDistance: 80,

  /** Cooldown between rare behaviors per fish (seconds) */
  cooldownDuration: 8,

  /** Minimum sociability for sync swim */
  minSociabilityForSync: 0.5,
};

/**
 * FishRareBehaviorHandler - Creates memorable "did that fish just...?" moments
 *
 * Low-probability behaviors that surprise and delight users:
 * - Barrel rolls when playful
 * - Freeze-then-dart when alert
 * - Double-takes when curious
 * - Happy flips when energetic
 * - Synchronized swimming with friends
 */
export class FishRareBehaviorHandler implements IFishRareBehaviorHandler {
  /** Cooldown timers per fish */
  private cooldowns = new WeakMap<FishMarineLife, number>();

  constructor(
    private wobbleAnimator: IFishWobbleAnimator = new FishWobbleAnimator()
  ) {}

  checkRareBehaviors(
    fish: FishMarineLife[],
    deltaSeconds: number
  ): RareBehaviorResult[] {
    const results: RareBehaviorResult[] = [];

    // Update cooldowns
    this.updateCooldowns(fish, deltaSeconds);

    for (const f of fish) {
      // Skip if on cooldown or currently wobbling
      if (this.isOnCooldown(f)) continue;
      if (this.wobbleAnimator.isWobbling(f)) continue;

      // Check each rare behavior type
      const result = this.checkBehaviorsForFish(f, fish, deltaSeconds);
      if (result) {
        results.push(result);
        this.setCooldown(f);
      }
    }

    return results;
  }

  applyRareBehavior(result: RareBehaviorResult): void {
    const { fish, wobbleType, partner, type } = result;

    // Trigger the wobble animation
    this.wobbleAnimator.triggerWobble(fish, wobbleType, 1.0);

    // For sync swim, also trigger on partner
    if (type === "sync_swim" && partner) {
      this.wobbleAnimator.triggerWobble(partner, "sync_pulse", 0.8);

      // Add each other to social memory
      this.addToSocialMemory(fish, partner);
      this.addToSocialMemory(partner, fish);
    }

    // For freeze, we need to temporarily pause movement
    if (type === "freeze") {
      const originalSpeed = fish.speed;
      fish.speed = 0;
      // Restore after wobble duration
      setTimeout(() => {
        if (fish.speed === 0) {
          fish.speed = originalSpeed * 1.5; // Dart after freeze
        }
      }, 600);
    }
  }

  triggerRareBehavior(
    fish: FishMarineLife,
    type: RareBehaviorType,
    partner?: FishMarineLife
  ): void {
    const result = this.createResult(fish, type, partner);
    if (result) {
      this.applyRareBehavior(result);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateCooldowns(fish: FishMarineLife[], deltaSeconds: number): void {
    for (const f of fish) {
      const remaining = this.cooldowns.get(f);
      if (remaining !== undefined && remaining > 0) {
        this.cooldowns.set(f, remaining - deltaSeconds);
      }
    }
  }

  private isOnCooldown(fish: FishMarineLife): boolean {
    const remaining = this.cooldowns.get(fish);
    return remaining !== undefined && remaining > 0;
  }

  private setCooldown(fish: FishMarineLife): void {
    // Add randomness to prevent synchronized behaviors
    const cooldown =
      RARE_BEHAVIOR_CONFIG.cooldownDuration * (0.7 + Math.random() * 0.6);
    this.cooldowns.set(fish, cooldown);
  }

  private checkBehaviorsForFish(
    fish: FishMarineLife,
    allFish: FishMarineLife[],
    deltaSeconds: number
  ): RareBehaviorResult | null {
    const mood = fish.mood ?? "calm";
    const personality = fish.personality;
    const energy = fish.energy ?? 0.8;

    // Check each behavior type in priority order
    const behaviorChecks: Array<{
      type: RareBehaviorType;
      check: () => boolean;
    }> = [
      {
        type: "barrel_roll",
        check: () => {
          if (!RARE_BEHAVIOR_CONFIG.moodRequirements.barrel_roll.includes(mood as any))
            return false;
          const prob =
            RARE_BEHAVIOR_CONFIG.baseProbabilities.barrel_roll *
            deltaSeconds *
            (personality?.activity ?? 0.5) *
            2;
          return Math.random() < prob;
        },
      },
      {
        type: "freeze",
        check: () => {
          if (!RARE_BEHAVIOR_CONFIG.moodRequirements.freeze.includes(mood as any))
            return false;
          const prob =
            RARE_BEHAVIOR_CONFIG.baseProbabilities.freeze *
            deltaSeconds *
            (1 - (personality?.boldness ?? 0.5)); // Shy fish freeze more
          return Math.random() < prob;
        },
      },
      {
        type: "double_take",
        check: () => {
          if (!RARE_BEHAVIOR_CONFIG.moodRequirements.double_take.includes(mood as any))
            return false;
          const prob =
            RARE_BEHAVIOR_CONFIG.baseProbabilities.double_take *
            deltaSeconds *
            (personality?.curiosity ?? 0.5) *
            2;
          return Math.random() < prob;
        },
      },
      {
        type: "happy_flip",
        check: () => {
          if (energy < RARE_BEHAVIOR_CONFIG.minEnergyForFlip) return false;
          if (
            !RARE_BEHAVIOR_CONFIG.moodRequirements.happy_flip.includes(mood as any)
          )
            return false;
          const prob =
            RARE_BEHAVIOR_CONFIG.baseProbabilities.happy_flip *
            deltaSeconds *
            energy *
            (personality?.activity ?? 0.5) *
            2;
          return Math.random() < prob;
        },
      },
      {
        type: "sync_swim",
        check: () => {
          if (
            !RARE_BEHAVIOR_CONFIG.moodRequirements.sync_swim.includes(mood as any)
          )
            return false;
          if (
            (personality?.sociability ?? 0.5) <
            RARE_BEHAVIOR_CONFIG.minSociabilityForSync
          )
            return false;

          // Check for nearby friends
          const nearbyFriend = this.findNearbyFriend(fish, allFish);
          if (!nearbyFriend) return false;

          const prob =
            RARE_BEHAVIOR_CONFIG.baseProbabilities.sync_swim *
            deltaSeconds *
            (personality?.sociability ?? 0.5) *
            2;
          return Math.random() < prob;
        },
      },
    ];

    for (const { type, check } of behaviorChecks) {
      if (check()) {
        const partner =
          type === "sync_swim" ? this.findNearbyFriend(fish, allFish) : undefined;
        return this.createResult(fish, type, partner ?? undefined);
      }
    }

    return null;
  }

  private findNearbyFriend(
    fish: FishMarineLife,
    allFish: FishMarineLife[]
  ): FishMarineLife | null {
    const socialMemory = fish.socialMemory;

    for (const other of allFish) {
      if (other === fish) continue;

      // Check distance
      const dx = Math.abs(fish.x - other.x);
      const dy = Math.abs(fish.y - other.y);
      if (dx > RARE_BEHAVIOR_CONFIG.syncSwimDistance) continue;
      if (dy > RARE_BEHAVIOR_CONFIG.syncSwimDistance * 0.6) continue;

      // Prefer fish we've interacted with before (friends)
      if (socialMemory && other.fishId && socialMemory.has(other.fishId)) {
        return other;
      }

      // Or just any nearby social fish
      if ((other.personality?.sociability ?? 0.5) > 0.5) {
        return other;
      }
    }

    return null;
  }

  private createResult(
    fish: FishMarineLife,
    type: RareBehaviorType,
    partner?: FishMarineLife
  ): RareBehaviorResult {
    const wobbleMap: Record<RareBehaviorType, FishMarineLife["wobbleType"]> = {
      barrel_roll: "barrel_roll",
      freeze: "freeze",
      double_take: "double_take",
      happy_flip: "happy_flip",
      sync_swim: "sync_pulse",
    };

    return {
      type,
      fish,
      partner,
      wobbleType: wobbleMap[type],
    };
  }

  private addToSocialMemory(fish: FishMarineLife, other: FishMarineLife): void {
    if (!other.fishId) return;

    if (!fish.socialMemory) {
      fish.socialMemory = new Set();
    }

    fish.socialMemory.add(other.fishId);

    // Limit memory size to prevent unbounded growth
    if (fish.socialMemory.size > 10) {
      const first = fish.socialMemory.values().next().value;
      if (first !== undefined) {
        fish.socialMemory.delete(first);
      }
    }
  }
}
