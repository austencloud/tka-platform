/**
 * Ecological Pattern Provider
 *
 * Manages ecological patterns and zone-based tree type selection.
 * Patterns define how tree types are distributed across the scene
 * based on real-world forest biomes.
 */

import type {
  TreeType,
  EcologicalPattern,
  EcologicalZone,
} from "../../domain/models/tree-silhouette-models";
import { ECOLOGICAL_PATTERNS } from "../../domain/constants/tree-silhouette-constants";

export interface IEcologicalPatternProvider {
  /** Get the current pattern */
  getCurrentPattern(): EcologicalPattern;

  /** Set the ecological pattern by ID */
  setEcologicalPattern(patternId: string): void;

  /** Get the current ecological pattern ID */
  getEcologicalPatternId(): string;

  /** Get the current ecological pattern details */
  getEcologicalPattern(): EcologicalPattern;

  /** Get all available ecological patterns */
  getAvailablePatterns(): EcologicalPattern[];

  /** Set a random ecological pattern (excluding "random" itself) */
  setRandomEcologicalPattern(): string;

  /** Find which zone a position falls into for the current pattern */
  getZoneForPosition(normalizedX: number): EcologicalZone | null;

  /**
   * Pick a tree type based on position and current ecological pattern.
   * Respects visibility settings and zone weights.
   * @param normalizedX - Position as 0-1 normalized x coordinate
   * @param enabledTypes - List of currently visible/enabled tree types
   * @param random - Random function to use (for seeded randomness)
   */
  pickTypeForPosition(
    normalizedX: number,
    enabledTypes: TreeType[],
    random: () => number
  ): TreeType;
}

export function createEcologicalPatternProvider(): IEcologicalPatternProvider {
  let currentPatternId: string = "random"; // Default to random distribution

  function getCurrentPattern(): EcologicalPattern {
    return (
      ECOLOGICAL_PATTERNS.find((p) => p.id === currentPatternId) ||
      ECOLOGICAL_PATTERNS[0]!
    );
  }

  function setEcologicalPattern(patternId: string): void {
    const pattern = ECOLOGICAL_PATTERNS.find((p) => p.id === patternId);
    if (pattern) {
      currentPatternId = patternId;
    }
  }

  function getEcologicalPatternId(): string {
    return currentPatternId;
  }

  function getEcologicalPattern(): EcologicalPattern {
    return getCurrentPattern();
  }

  function getAvailablePatterns(): EcologicalPattern[] {
    return [...ECOLOGICAL_PATTERNS];
  }

  function setRandomEcologicalPattern(): string {
    const nonRandomPatterns = ECOLOGICAL_PATTERNS.filter(
      (p) => p.id !== "random"
    );
    const randomPattern =
      nonRandomPatterns[Math.floor(Math.random() * nonRandomPatterns.length)]!;
    currentPatternId = randomPattern.id;
    return randomPattern.id;
  }

  function getZoneForPosition(normalizedX: number): EcologicalZone | null {
    const pattern = getCurrentPattern();
    for (const zone of pattern.zones) {
      if (normalizedX >= zone.startX && normalizedX < zone.endX) {
        return zone;
      }
    }
    // Fallback to last zone if at exact end
    return pattern.zones[pattern.zones.length - 1] || null;
  }

  function pickTypeForPosition(
    normalizedX: number,
    enabledTypes: TreeType[],
    random: () => number
  ): TreeType {
    const zone = getZoneForPosition(normalizedX);

    if (!zone) {
      // Fallback to uniform random from enabled types
      return enabledTypes[Math.floor(random() * enabledTypes.length)]!;
    }

    // Build weighted list of enabled types only
    const weightedOptions: Array<{ type: TreeType; weight: number }> = [];
    let totalWeight = 0;

    for (const type of enabledTypes) {
      const weight = zone.weights[type] ?? 0;
      if (weight > 0) {
        weightedOptions.push({ type, weight });
        totalWeight += weight;
      }
    }

    // If no weighted options available, fall back to uniform random
    if (weightedOptions.length === 0 || totalWeight === 0) {
      return enabledTypes[Math.floor(random() * enabledTypes.length)]!;
    }

    // Weighted random selection
    const roll = random() * totalWeight;
    let cumulative = 0;
    for (const option of weightedOptions) {
      cumulative += option.weight;
      if (roll < cumulative) {
        return option.type;
      }
    }

    // Fallback (shouldn't reach here)
    return weightedOptions[weightedOptions.length - 1]!.type;
  }

  return {
    getCurrentPattern,
    setEcologicalPattern,
    getEcologicalPatternId,
    getEcologicalPattern,
    getAvailablePatterns,
    setRandomEcologicalPattern,
    getZoneForPosition,
    pickTypeForPosition,
  };
}
