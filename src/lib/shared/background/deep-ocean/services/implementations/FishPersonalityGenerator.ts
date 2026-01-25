import type { FishSpecies } from "../../domain/models/DeepOceanModels";
import type {
  FishPersonality,
  BehaviorModifiers,
  SpeciesPersonalityConfig,
  TraitRange,
} from "../../domain/types/fish-personality-types";
import type { IFishPersonalityGenerator } from "../contracts/IFishPersonalityGenerator";

/**
 * Species-specific personality trait ranges
 *
 * Each species has tendencies that influence personality generation:
 * - Tropical: Bold, curious, moderately social, high activity
 * - Sleek: Very bold, low social, very high activity, moderate curiosity
 * - Deep: Shy, very curious (big eyes!), low activity, solitary
 * - Schooling: Moderate boldness, very social, moderate activity/curiosity
 */
const SPECIES_PERSONALITY_RANGES: Record<FishSpecies, SpeciesPersonalityConfig> = {
  tropical: {
    boldness: [0.5, 0.85],
    sociability: [0.3, 0.65],
    activity: [0.5, 0.8],
    curiosity: [0.55, 0.9],
  },
  sleek: {
    boldness: [0.6, 0.95],
    sociability: [0.15, 0.4],
    activity: [0.7, 0.95],
    curiosity: [0.3, 0.6],
  },
  deep: {
    boldness: [0.1, 0.35],
    sociability: [0.05, 0.25],
    activity: [0.2, 0.45],
    curiosity: [0.65, 0.95],
  },
  schooling: {
    boldness: [0.25, 0.55],
    sociability: [0.75, 0.98],
    activity: [0.4, 0.65],
    curiosity: [0.35, 0.6],
  },
};

/**
 * FishPersonalityGenerator - Creates unique personalities for fish
 *
 * Uses species-influenced random generation to create personality traits
 * that feel consistent with the fish type while maintaining individual variation.
 */
export class FishPersonalityGenerator implements IFishPersonalityGenerator {
  generatePersonality(species: FishSpecies): FishPersonality {
    const ranges = SPECIES_PERSONALITY_RANGES[species];

    return {
      boldness: this.randomInRange(ranges.boldness),
      sociability: this.randomInRange(ranges.sociability),
      activity: this.randomInRange(ranges.activity),
      curiosity: this.randomInRange(ranges.curiosity),
    };
  }

  getBehaviorModifiers(personality: FishPersonality): BehaviorModifiers {
    const { boldness, sociability, activity, curiosity } = personality;

    return {
      // High curiosity = more likely to turn/change direction
      turnChance: 0.6 + curiosity * 0.8,

      // Low boldness = more likely to dart (startle easily)
      dartChance: 1.5 - boldness * 1.0,

      // High sociability = more likely to join schools
      schoolChance: 0.3 + sociability * 1.4,

      // High curiosity = more exploring
      browseChance: 0.2 + curiosity * 1.2,

      // Low activity = more resting
      restChance: 1.2 - activity * 0.8,

      // Moderate effect from all traits
      feedChance: 0.5 + boldness * 0.3 + activity * 0.2,

      // Activity directly affects base speed
      speedMultiplier: 0.7 + activity * 0.6,
    };
  }

  describePersonality(personality: FishPersonality): string {
    const traits: string[] = [];

    // Boldness descriptions
    if (personality.boldness > 0.7) {
      traits.push("brave");
    } else if (personality.boldness < 0.3) {
      traits.push("shy");
    }

    // Sociability descriptions
    if (personality.sociability > 0.7) {
      traits.push("friendly");
    } else if (personality.sociability < 0.3) {
      traits.push("solitary");
    }

    // Activity descriptions
    if (personality.activity > 0.7) {
      traits.push("energetic");
    } else if (personality.activity < 0.3) {
      traits.push("lazy");
    }

    // Curiosity descriptions
    if (personality.curiosity > 0.7) {
      traits.push("curious");
    } else if (personality.curiosity < 0.3) {
      traits.push("focused");
    }

    if (traits.length === 0) {
      return "balanced";
    }

    return traits.join(", ");
  }

  private randomInRange(range: TraitRange): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
