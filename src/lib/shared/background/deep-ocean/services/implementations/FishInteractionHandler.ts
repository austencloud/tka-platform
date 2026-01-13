import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type {
  IFishInteractionHandler,
  InteractionResult,
  FishInteractionType,
} from "../contracts/IFishInteractionHandler";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator";
import { FishWobbleAnimator } from "./FishWobbleAnimator";

/**
 * Configuration for fish interaction detection
 */
const INTERACTION_CONFIG = {
  /** Distance threshold for interaction detection (pixels) */
  proximityRadius: 55,

  /** Vertical distance threshold (fish at very different depths don't interact) */
  verticalThreshold: 40,

  /** Z-depth difference threshold (fish far apart in depth don't interact) */
  depthThreshold: 0.3,

  /** Cooldown between interactions for each fish (seconds) */
  cooldownDuration: 2.5,

  /** Minimum speed difference to trigger yield behavior */
  yieldSpeedDifference: 15,

  /** Speed reduction for yielding fish */
  yieldSpeedMultiplier: 0.6,

  /** Duration of yield speed reduction (seconds) */
  yieldDuration: 0.4,

  /** Maximum vertical nudge for avoidance (pixels) */
  maxVerticalNudge: 8,

  /** Probability thresholds for different interaction types */
  probabilities: {
    /** Base chance of passing greeting (modified by sociability) */
    passingGreeting: 0.35,
    /** Base chance of yield behavior (modified by boldness difference) */
    yield: 0.25,
    /** Base chance of social approach (modified by sociability) */
    socialApproach: 0.2,
    /** Base chance of shy avoidance (modified by inverse sociability) */
    shyAvoidance: 0.3,
  },
};

/**
 * FishInteractionHandler - Detects and handles micro-interactions between fish
 *
 * Creates emergent social behaviors when fish pass close to each other:
 * - Passing greetings (social fish shimmy at each other)
 * - Yield behavior (timid fish slow down for bold ones)
 * - Social approach (social fish veer toward neighbors)
 * - Shy avoidance (asocial fish veer away from neighbors)
 */
export class FishInteractionHandler implements IFishInteractionHandler {
  /** Cooldown timers per fish (using fish reference as key via WeakMap) */
  private cooldowns = new WeakMap<FishMarineLife, number>();

  /** Track processed pairs this frame to avoid duplicate interactions */
  private processedPairs = new Set<string>();

  /** Temporary speed modifiers (fish -> {multiplier, remaining}) */
  private speedModifiers = new WeakMap<
    FishMarineLife,
    { multiplier: number; remaining: number }
  >();

  constructor(private wobbleAnimator: IFishWobbleAnimator = new FishWobbleAnimator()) {}

  processInteractions(
    fish: FishMarineLife[],
    deltaSeconds: number
  ): InteractionResult[] {
    const results: InteractionResult[] = [];
    this.processedPairs.clear();

    // Update cooldowns
    this.updateCooldowns(fish, deltaSeconds);

    // Update and apply temporary speed modifiers
    this.updateSpeedModifiers(fish, deltaSeconds);

    // Check each pair of fish for potential interactions
    for (let i = 0; i < fish.length; i++) {
      const fishA = fish[i]!;

      // Skip fish that are currently wobbling (let animation finish)
      if (this.wobbleAnimator.isWobbling(fishA)) continue;

      for (let j = i + 1; j < fish.length; j++) {
        const fishB = fish[j]!;

        // Skip if either fish is on cooldown
        if (this.isOnCooldown(fishA) || this.isOnCooldown(fishB)) continue;

        // Skip if B is wobbling
        if (this.wobbleAnimator.isWobbling(fishB)) continue;

        // Check if fish are close enough to interact
        if (!this.areInProximity(fishA, fishB)) continue;

        // Determine and create interaction
        const interaction = this.determineInteraction(fishA, fishB);
        if (interaction) {
          results.push(interaction);

          // Set cooldowns for both fish
          this.setCooldown(fishA);
          this.setCooldown(fishB);
        }
      }
    }

    return results;
  }

  applyInteraction(result: InteractionResult): void {
    const { fish, other, type, triggerWobble, speedModifier, verticalNudge } = result;

    // Trigger wobble animation
    if (triggerWobble) {
      this.wobbleAnimator.triggerWobble(fish, triggerWobble, 0.7);
    }

    // Apply temporary speed modifier
    if (speedModifier !== undefined && speedModifier !== 1) {
      this.speedModifiers.set(fish, {
        multiplier: speedModifier,
        remaining: INTERACTION_CONFIG.yieldDuration,
      });
    }

    // Apply vertical nudge (avoidance/approach)
    if (verticalNudge) {
      fish.baseY += verticalNudge;
      fish.y += verticalNudge;
    }

    // For passing greetings, also trigger wobble on the other fish
    if (type === "passing_greeting" && other.personality) {
      const otherSociability = other.personality.sociability ?? 0.5;
      // Other fish responds if they're also social
      if (Math.random() < otherSociability) {
        this.wobbleAnimator.triggerWobble(other, "social_shimmer", 0.5);
      }
    }
  }

  isOnCooldown(fish: FishMarineLife): boolean {
    const remaining = this.cooldowns.get(fish);
    return remaining !== undefined && remaining > 0;
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

  private updateSpeedModifiers(fish: FishMarineLife[], deltaSeconds: number): void {
    for (const f of fish) {
      const modifier = this.speedModifiers.get(f);
      if (modifier) {
        modifier.remaining -= deltaSeconds;

        if (modifier.remaining <= 0) {
          // Remove modifier, restore speed
          this.speedModifiers.delete(f);
        } else {
          // Apply modifier to current speed
          // We modify the current speed, not baseSpeed, for temporary effect
          f.speed = f.baseSpeed * modifier.multiplier;
        }
      }
    }
  }

  private setCooldown(fish: FishMarineLife): void {
    // Add some randomness to cooldown to prevent synchronized behaviors
    const cooldown =
      INTERACTION_CONFIG.cooldownDuration * (0.8 + Math.random() * 0.4);
    this.cooldowns.set(fish, cooldown);
  }

  private areInProximity(fishA: FishMarineLife, fishB: FishMarineLife): boolean {
    // Horizontal distance
    const dx = Math.abs(fishA.x - fishB.x);
    if (dx > INTERACTION_CONFIG.proximityRadius) return false;

    // Vertical distance
    const dy = Math.abs(fishA.y - fishB.y);
    if (dy > INTERACTION_CONFIG.verticalThreshold) return false;

    // Z-depth distance (fish at very different depths don't interact)
    const dz = Math.abs(fishA.z - fishB.z);
    if (dz > INTERACTION_CONFIG.depthThreshold) return false;

    return true;
  }

  private determineInteraction(
    fishA: FishMarineLife,
    fishB: FishMarineLife
  ): InteractionResult | null {
    const personalityA = fishA.personality ?? this.defaultPersonality();
    const personalityB = fishB.personality ?? this.defaultPersonality();

    // Determine if fish are passing each other (moving in opposite directions)
    const arePassing = fishA.direction !== fishB.direction;

    // Determine if one fish is overtaking another (same direction, different speeds)
    const areOvertaking =
      fishA.direction === fishB.direction &&
      Math.abs(fishA.speed - fishB.speed) > INTERACTION_CONFIG.yieldSpeedDifference;

    // Calculate relevant personality differences
    const boldnessDiff = personalityA.boldness - personalityB.boldness;
    const avgSociability = (personalityA.sociability + personalityB.sociability) / 2;
    const minSociability = Math.min(personalityA.sociability, personalityB.sociability);

    // Roll for each interaction type and pick the first that triggers
    const roll = Math.random();

    // 1. PASSING GREETING - Social fish acknowledge each other when passing
    if (arePassing && avgSociability > 0.4) {
      const greetingChance =
        INTERACTION_CONFIG.probabilities.passingGreeting * avgSociability;
      if (roll < greetingChance) {
        // The more social fish initiates
        const initiator =
          personalityA.sociability >= personalityB.sociability ? fishA : fishB;
        const other = initiator === fishA ? fishB : fishA;

        return {
          type: "passing_greeting",
          fish: initiator,
          other,
          triggerWobble: "social_shimmer",
        };
      }
    }

    // 2. YIELD - Less bold fish slows for bolder fish when paths cross
    if ((arePassing || areOvertaking) && Math.abs(boldnessDiff) > 0.25) {
      const yieldChance =
        INTERACTION_CONFIG.probabilities.yield * Math.abs(boldnessDiff);
      if (roll < yieldChance) {
        // The less bold fish yields
        const yielder = boldnessDiff < 0 ? fishA : fishB;
        const dominant = yielder === fishA ? fishB : fishA;

        return {
          type: "yield",
          fish: yielder,
          other: dominant,
          speedModifier: INTERACTION_CONFIG.yieldSpeedMultiplier,
          // Subtle head bob when yielding
          triggerWobble: "curious_tilt",
        };
      }
    }

    // 3. SOCIAL APPROACH - Very social fish veer toward neighbors
    if (avgSociability > 0.65) {
      const approachChance =
        INTERACTION_CONFIG.probabilities.socialApproach *
        (avgSociability - 0.4);
      if (roll < approachChance) {
        // The more social fish approaches
        const approacher =
          personalityA.sociability >= personalityB.sociability ? fishA : fishB;
        const target = approacher === fishA ? fishB : fishA;

        // Calculate nudge direction (toward the other fish)
        const nudgeDirection = target.y > approacher.y ? 1 : -1;
        const nudgeAmount =
          nudgeDirection *
          INTERACTION_CONFIG.maxVerticalNudge *
          approacher.personality!.sociability;

        return {
          type: "social_approach",
          fish: approacher,
          other: target,
          verticalNudge: nudgeAmount,
          triggerWobble: "playful_wiggle",
        };
      }
    }

    // 4. SHY AVOIDANCE - Asocial fish veer away from neighbors
    if (minSociability < 0.35) {
      const shySociability = Math.min(personalityA.sociability, personalityB.sociability);
      const avoidanceChance =
        INTERACTION_CONFIG.probabilities.shyAvoidance *
        (1 - shySociability);
      if (roll < avoidanceChance) {
        // The less social fish avoids
        const avoider =
          personalityA.sociability <= personalityB.sociability ? fishA : fishB;
        const avoided = avoider === fishA ? fishB : fishA;

        // Calculate nudge direction (away from the other fish)
        const nudgeDirection = avoided.y > avoider.y ? -1 : 1;
        const nudgeAmount =
          nudgeDirection *
          INTERACTION_CONFIG.maxVerticalNudge *
          (1 - avoider.personality!.sociability);

        return {
          type: "shy_avoidance",
          fish: avoider,
          other: avoided,
          verticalNudge: nudgeAmount,
          // Startled reaction for very shy fish
          triggerWobble:
            avoider.personality!.boldness < 0.3 ? "startled_dart" : undefined,
        };
      }
    }

    return null;
  }

  private defaultPersonality() {
    return {
      boldness: 0.5,
      sociability: 0.5,
      activity: 0.5,
      curiosity: 0.5,
    };
  }
}
