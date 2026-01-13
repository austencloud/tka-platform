import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife, FishBehavior } from "../../domain/models/DeepOceanModels";
import type {
  IFishDecisionMaker,
  DecisionContext,
  FishDecision,
} from "../contracts/IFishDecisionMaker";
import {
  BEHAVIOR_CONFIG,
  BEHAVIOR_TRANSITION_PROBABILITY,
  SPECIES_BEHAVIOR_MODIFIERS,
  DEPTH_TRANSITION,
} from "../../domain/constants/fish-constants";

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

    // Weighted random selection - include all behaviors
    const totalWeight =
      weights.turn +
      weights.dart +
      weights.cruise +
      weights.school +
      weights.passing +
      weights.ascending +
      weights.descending +
      weights.approaching +
      weights.receding;
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

    // Passing check (fast direct swimmers)
    if (roll < weights.passing) {
      return this.createPassingDecision(fish);
    }
    roll -= weights.passing;

    // Ascending check (vertical exploration upward)
    if (roll < weights.ascending) {
      return this.createAscendingDecision(fish, dimensions);
    }
    roll -= weights.ascending;

    // Descending check (vertical exploration downward)
    if (roll < weights.descending) {
      return this.createDescendingDecision(fish, dimensions);
    }
    roll -= weights.descending;

    // Approaching check (z-axis toward camera)
    if (roll < weights.approaching) {
      return this.createApproachingDecision(fish);
    }
    roll -= weights.approaching;

    // Receding check (z-axis away from camera)
    if (roll < weights.receding) {
      return this.createRecedingDecision(fish);
    }
    roll -= weights.receding;

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
    passing: number;
    ascending: number;
    descending: number;
    approaching: number;
    receding: number;
  } {
    const personality = fish.personality;
    const mood = fish.mood ?? "calm";
    const species = fish.species;

    // Base weights from constants
    let turn = BEHAVIOR_TRANSITION_PROBABILITY.turn;
    let dart = BEHAVIOR_TRANSITION_PROBABILITY.dart;
    let passing = BEHAVIOR_TRANSITION_PROBABILITY.passing;
    let ascending = BEHAVIOR_TRANSITION_PROBABILITY.ascending;
    let descending = BEHAVIOR_TRANSITION_PROBABILITY.descending;
    let approaching = BEHAVIOR_TRANSITION_PROBABILITY.approaching;
    let receding = BEHAVIOR_TRANSITION_PROBABILITY.receding;
    let cruise = 0.5; // Base cruising weight
    let school = 0.18;

    // Apply species-specific modifiers
    const speciesModifiers = SPECIES_BEHAVIOR_MODIFIERS[species] ?? {};
    if (speciesModifiers.passing) passing *= speciesModifiers.passing;
    if (speciesModifiers.dart) dart *= speciesModifiers.dart;
    if (speciesModifiers.ascending) ascending *= speciesModifiers.ascending;
    if (speciesModifiers.descending) descending *= speciesModifiers.descending;
    if (speciesModifiers.approaching) approaching *= speciesModifiers.approaching;
    if (speciesModifiers.receding) receding *= speciesModifiers.receding;

    if (personality) {
      // Curiosity increases turning (exploring) and vertical exploration
      turn *= 0.6 + personality.curiosity * 0.8;
      ascending *= 0.7 + personality.curiosity * 0.6;
      descending *= 0.7 + personality.curiosity * 0.6;

      // Low boldness increases darting (easily startled)
      dart *= 1.5 - personality.boldness;

      // High boldness increases passing (confident fast swimming)
      passing *= 0.5 + personality.boldness * 1.0;

      // High sociability increases schooling
      school *= 0.5 + personality.sociability * 1.0;

      // High activity reduces cruising and increases all active behaviors
      cruise *= 1.2 - personality.activity * 0.4;
      passing *= 0.8 + personality.activity * 0.4;
    }

    // Mood modifiers
    switch (mood) {
      case "alert":
        dart *= 2.0; // More likely to dart when alert
        turn *= 1.5; // More erratic
        passing *= 0.5; // Less likely to do calm fast pass
        break;

      case "playful":
        turn *= 1.5; // More direction changes
        dart *= 0.5; // Less startled, more intentional
        ascending *= 1.5; // More vertical exploration
        descending *= 1.5;
        break;

      case "tired":
        cruise *= 2.0; // Just keep swimming slowly
        turn *= 0.5;
        dart *= 0.3;
        passing *= 0.1; // Too tired to pass
        ascending *= 0.3;
        descending *= 0.5; // Might drift down
        break;

      case "social":
        school *= 2.0; // Much more likely to school
        passing *= 0.5; // Stay with the group
        break;

      case "curious":
        turn *= 1.3; // Looking around more
        ascending *= 1.4; // Exploring all dimensions
        descending *= 1.4;
        approaching *= 1.5; // Coming closer to investigate
        break;

      case "hungry":
        // Hungry fish are more exploratory
        ascending *= 1.2;
        descending *= 1.2;
        break;
    }

    // Depth-based adjustments
    // Fish near z limits are more likely to move the other direction
    if (fish.z <= 0.2) {
      receding *= 1.5; // More likely to swim away from camera
      approaching *= 0.3; // Already close
    } else if (fish.z >= 0.8) {
      approaching *= 1.5; // More likely to swim toward camera
      receding *= 0.3; // Already far
    }

    // Vertical position adjustments
    const dimensions = { height: fish.depthBand.max - fish.depthBand.min + 100 };
    const relativeY = (fish.baseY - fish.depthBand.min) / (fish.depthBand.max - fish.depthBand.min);
    if (relativeY < 0.3) {
      descending *= 1.5; // Near top, more likely to descend
      ascending *= 0.5;
    } else if (relativeY > 0.7) {
      ascending *= 1.5; // Near bottom, more likely to ascend
      descending *= 0.5;
    }

    return { turn, dart, cruise, school, passing, ascending, descending, approaching, receding };
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

  /**
   * Fast direct swimming - fish zooms across screen in a straight line
   */
  private createPassingDecision(fish: FishMarineLife): FishDecision {
    const speedRange = BEHAVIOR_CONFIG.passing.speedMultiplier;
    const speedMultiplier =
      speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);

    return {
      behavior: "passing",
      speedMultiplier,
    };
  }

  /**
   * Ascending - fish swims upward exploring vertical space
   */
  private createAscendingDecision(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): FishDecision {
    // Target a point above current position
    const verticalRange = BEHAVIOR_CONFIG.ascending.verticalSpeed;
    const duration = BEHAVIOR_CONFIG.ascending.duration;
    const avgDuration = (duration[0] + duration[1]) / 2;
    const avgSpeed = (verticalRange[0] + verticalRange[1]) / 2;
    const targetY = Math.max(
      dimensions.height * 0.05,
      fish.baseY - avgSpeed * avgDuration
    );

    return {
      behavior: "ascending",
      targetY,
    };
  }

  /**
   * Descending - fish swims downward exploring vertical space
   */
  private createDescendingDecision(
    fish: FishMarineLife,
    dimensions: Dimensions
  ): FishDecision {
    // Target a point below current position
    const verticalRange = BEHAVIOR_CONFIG.descending.verticalSpeed;
    const duration = BEHAVIOR_CONFIG.descending.duration;
    const avgDuration = (duration[0] + duration[1]) / 2;
    const avgSpeed = Math.abs((verticalRange[0] + verticalRange[1]) / 2);
    const targetY = Math.min(
      dimensions.height * 0.95,
      fish.baseY + avgSpeed * avgDuration
    );

    return {
      behavior: "descending",
      targetY,
    };
  }

  /**
   * Approaching - fish swims toward camera (z decreasing)
   */
  private createApproachingDecision(fish: FishMarineLife): FishDecision {
    const zChange = BEHAVIOR_CONFIG.approaching.zChange;
    const targetZ = Math.max(
      DEPTH_TRANSITION.minZ,
      fish.z + zChange[0] + Math.random() * (zChange[1] - zChange[0])
    );

    return {
      behavior: "approaching",
      targetZ,
    };
  }

  /**
   * Receding - fish swims away from camera (z increasing)
   */
  private createRecedingDecision(fish: FishMarineLife): FishDecision {
    const zChange = BEHAVIOR_CONFIG.receding.zChange;
    const targetZ = Math.min(
      DEPTH_TRANSITION.maxZ,
      fish.z + zChange[0] + Math.random() * (zChange[1] - zChange[0])
    );

    return {
      behavior: "receding",
      targetZ,
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
