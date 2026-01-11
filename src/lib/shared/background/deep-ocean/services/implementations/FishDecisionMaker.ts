import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife, FishBehavior } from "../../domain/models/DeepOceanModels";
import type {
  IFishDecisionMaker,
  DecisionContext,
  FishDecision,
} from "../contracts/IFishDecisionMaker";
import { BEHAVIOR_CONFIG } from "../../domain/constants/fish-constants";

/**
 * FishDecisionMaker - Personality and mood-influenced behavior decisions
 *
 * Modifies behavior transition probabilities based on:
 * - Personality traits (boldness, curiosity, activity, sociability)
 * - Current mood (alert, playful, tired, etc.)
 * - Environmental context (nearby fish, edge proximity)
 */
export class FishDecisionMaker implements IFishDecisionMaker {
  decideNextBehavior(ctx: DecisionContext): FishDecision {
    const { fish, nearbyFish, dimensions } = ctx;
    const weights = this.getTransitionWeights(fish);

    // Check for mood-driven overrides
    const moodDecision = this.checkMoodOverrides(fish, nearbyFish);
    if (moodDecision) return moodDecision;

    // Calculate edge proximity
    const edgeProximity = this.getEdgeProximity(fish, dimensions);

    // Weighted random selection
    const totalWeight = weights.turn + weights.dart + weights.cruise + weights.school;
    let roll = Math.random() * totalWeight;

    // Edge proximity strongly influences turning
    if (edgeProximity > 0.7) {
      return this.createTurnDecision(fish, dimensions);
    }

    // Turn check (increased weight near edges)
    const adjustedTurnWeight = weights.turn * (1 + edgeProximity * 4);
    if (roll < adjustedTurnWeight) {
      return this.createTurnDecision(fish, dimensions);
    }
    roll -= adjustedTurnWeight;

    // Dart check (startled behavior)
    if (roll < weights.dart) {
      return this.createDartDecision(fish);
    }
    roll -= weights.dart;

    // School check (if near other fish and sociable)
    if (roll < weights.school && nearbyFish.length > 0) {
      return this.createSchoolDecision(fish);
    }

    // Default: continue cruising
    return this.createCruiseDecision(fish);
  }

  getTransitionWeights(fish: FishMarineLife): {
    turn: number;
    dart: number;
    cruise: number;
    school: number;
  } {
    const personality = fish.personality;
    const mood = fish.mood ?? "calm";

    // Base weights
    let turn = 0.08;
    let dart = 0.04;
    let cruise = 0.7;
    let school = 0.18;

    if (personality) {
      // Curiosity increases turning (exploring)
      turn *= 0.6 + personality.curiosity * 0.8;

      // Low boldness increases darting (easily startled)
      dart *= 1.5 - personality.boldness;

      // High sociability increases schooling
      school *= 0.5 + personality.sociability * 1.0;

      // High activity reduces cruising (always doing something)
      cruise *= 1.2 - personality.activity * 0.4;
    }

    // Mood modifiers
    switch (mood) {
      case "alert":
        dart *= 2.0; // More likely to dart when alert
        turn *= 1.5; // More erratic
        break;

      case "playful":
        turn *= 1.5; // More direction changes
        dart *= 0.5; // Less startled, more intentional
        break;

      case "tired":
        cruise *= 2.0; // Just keep swimming slowly
        turn *= 0.5;
        dart *= 0.3;
        break;

      case "social":
        school *= 2.0; // Much more likely to school
        break;

      case "curious":
        turn *= 1.3; // Looking around more
        break;

      case "hungry":
        // No major changes, handled by mood override
        break;
    }

    return { turn, dart, cruise, school };
  }

  /**
   * Check if mood should override normal decision making
   */
  private checkMoodOverrides(
    fish: FishMarineLife,
    _nearbyFish: FishMarineLife[]
  ): FishDecision | null {
    const mood = fish.mood;

    // Tired fish should mostly cruise slowly
    if (mood === "tired" && Math.random() < 0.8) {
      return {
        behavior: "cruising",
        speedMultiplier: 0.4,
        triggerWobble: "tired_drift",
      };
    }

    // Alert fish might dart
    if (mood === "alert" && Math.random() < 0.4) {
      return {
        behavior: "darting",
        speedMultiplier: 1.5,
        triggerWobble: "startled_dart",
      };
    }

    // Playful fish do random things
    if (mood === "playful" && Math.random() < 0.3) {
      const behaviors: FishBehavior[] = ["turning", "darting", "cruising"];
      return {
        behavior: behaviors[Math.floor(Math.random() * behaviors.length)]!,
        speedMultiplier: 1.2,
        triggerWobble: "playful_wiggle",
      };
    }

    return null;
  }

  private createTurnDecision(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): FishDecision {
    // Determine turn direction based on edge proximity
    const distToRight = dimensions.width - fish.x;
    const distToLeft = fish.x;
    const targetDirection: 1 | -1 = distToRight < distToLeft ? -1 : 1;

    return {
      behavior: "turning",
      targetDirection,
      triggerWobble: fish.mood === "curious" ? "curious_tilt" : undefined,
    };
  }

  private createDartDecision(fish: FishMarineLife): FishDecision {
    const speedRange = BEHAVIOR_CONFIG.darting.speedMultiplier;
    const speedMultiplier =
      speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);

    return {
      behavior: "darting",
      speedMultiplier,
      triggerWobble: "startled_dart",
    };
  }

  private createSchoolDecision(fish: FishMarineLife): FishDecision {
    return {
      behavior: "schooling",
      triggerWobble: fish.mood === "social" ? "social_shimmer" as "playful_wiggle" : undefined,
    };
  }

  private createCruiseDecision(_fish: FishMarineLife): FishDecision {
    return {
      behavior: "cruising",
    };
  }

  private getEdgeProximity(fish: FishMarineLife, dimensions: Dimensions): number {
    const warningZone = dimensions.width * 0.15;

    if (fish.direction === 1) {
      const distToEdge = dimensions.width - fish.x;
      if (distToEdge < warningZone) return 1 - distToEdge / warningZone;
    } else {
      if (fish.x < warningZone) return 1 - fish.x / warningZone;
    }
    return 0;
  }
}
