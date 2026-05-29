import type { InternalStepPair } from "../domain/models/internal-step-models";
import type { StepPairGroups } from "../domain/models/label-models";
import { TRANSFORMATION_PRIORITY } from "../domain/constants/transformation-priority";
import {
  TRANSFORMATION_FAMILIES,
  RELATED_TRANSFORMATION_GROUPS,
} from "../domain/constants/transformation-families";

// Suppressing unused import - keeping for future use
void TRANSFORMATION_PRIORITY;

/**
 * Service for analyzing transformation patterns across beat pairs.
 */
export class TransformationAnalyzer {
  constructor() {}

  normalizeToBase(transformation: string): string {
    return transformation
      .toLowerCase()
      .replace(/_inverted$/, "")
      .replace(/\+inverted$/, "")
      .replace(/ /g, "_")
      .replace(/\+/g, "_");
  }

  findAllCommonTransformations(stepPairs: InternalStepPair[]): string[] {
    if (stepPairs.length === 0) return [];

    const allTransformations = stepPairs.map(
      (pair) => new Set(pair.rawTransformations || [])
    );
    const firstSet = allTransformations[0];
    if (!firstSet) return [];

    // First, look for exact common transformations
    const exactCommon = [...firstSet].filter((t) =>
      allTransformations.every((set) => set.has(t))
    );

    if (exactCommon.length > 0) {
      return exactCommon.sort((a, b) => {
        const priorityA = TRANSFORMATION_PRIORITY.indexOf(a);
        const priorityB = TRANSFORMATION_PRIORITY.indexOf(b);
        return (
          (priorityA === -1 ? 999 : priorityA) -
          (priorityB === -1 ? 999 : priorityB)
        );
      });
    }

    // No exact common - check for family matches
    for (const family of TRANSFORMATION_FAMILIES) {
      const allPairsMatchFamily = allTransformations.every((set) =>
        family.members.some((member) => set.has(member))
      );

      if (allPairsMatchFamily) {
        // Check if this is genuine ambiguity or distinct patterns
        const pairsAreAmbiguous = allTransformations.every((set) => {
          const matchingMembers = family.members.filter((member) =>
            set.has(member)
          );
          return matchingMembers.length > 1;
        });

        if (pairsAreAmbiguous) {
          return [family.base];
        }

        // Some pairs are definitive - check if they all have the SAME member
        const definitiveMembers = allTransformations.map((set) => {
          const matching = family.members.filter((member) => set.has(member));
          return matching.length === 1 ? matching[0] : null;
        });

        const definitiveSame = definitiveMembers.filter((m) => m !== null);
        if (
          definitiveSame.length > 0 &&
          definitiveSame.every((m) => m === definitiveSame[0])
        ) {
          return [definitiveSame[0]!];
        }

        // Different definitive patterns = MODULAR
        return [];
      }
    }

    return [];
  }

  groupStepPairsByPattern(stepPairs: InternalStepPair[]): StepPairGroups {
    const groups: StepPairGroups = {};

    for (const pair of stepPairs) {
      const primaryPattern = pair.detectedTransformations[0] || "UNKNOWN";
      if (!groups[primaryPattern]) {
        groups[primaryPattern] = [];
      }
      groups[primaryPattern].push(pair.keyStep);
    }

    return groups;
  }

  reprioritizeBeatPairs(stepPairs: InternalStepPair[]): void {
    if (stepPairs.length === 0) return;

    const commonRaw = this.findAllCommonTransformations(stepPairs);

    if (commonRaw.length > 0) {
      // Global harmonization - all pairs share a common transformation
      this.harmonizeAllPairs(stepPairs, commonRaw[0]!);
    } else {
      // No global common transformation - harmonize subgroups by family
      this.harmonizeSubgroups(stepPairs);
    }
  }

  private harmonizeAllPairs(
    stepPairs: InternalStepPair[],
    primaryCommon: string
  ): void {
    // Find the family for this common transformation
    const family = TRANSFORMATION_FAMILIES.find(
      (f) => f.base === primaryCommon || f.members.includes(primaryCommon)
    );

    // Find the DEFINITIVE member from pairs that have rotation data
    let definitiveVariant: string | null = null;
    if (family) {
      for (const pair of stepPairs) {
        const matchingMembers = family.members.filter((member) =>
          pair.rawTransformations.includes(member)
        );
        if (matchingMembers.length === 1) {
          definitiveVariant = matchingMembers[0]!;
          break;
        }
      }
    }

    // Update each pair
    for (const pair of stepPairs) {
      if (family) {
        if (
          definitiveVariant &&
          pair.rawTransformations.includes(definitiveVariant)
        ) {
          pair.detectedTransformations = [
            formatSingleTransformation(
              definitiveVariant
            ),
          ];
          continue;
        }

        const matchingMember = family.members.find((member) =>
          pair.rawTransformations.includes(member)
        );
        if (matchingMember) {
          pair.detectedTransformations = [
            formatSingleTransformation(matchingMember),
          ];
          continue;
        }
      }

      const formattedCommon =
        formatSingleTransformation(primaryCommon);
      if (pair.allValidTransformations.includes(formattedCommon)) {
        pair.detectedTransformations = [formattedCommon];
      }
    }
  }

  private harmonizeSubgroups(stepPairs: InternalStepPair[]): void {
    // Group beat pairs by their transformation family
    const familyGroups: Map<string, InternalStepPair[]> = new Map();

    for (const pair of stepPairs) {
      // Find which family this pair belongs to
      let matchedFamily: { base: string; members: string[] } | null = null;
      for (const family of TRANSFORMATION_FAMILIES) {
        const hasMatch = family.members.some((member) =>
          pair.rawTransformations.includes(member)
        );
        if (hasMatch) {
          matchedFamily = family;
          break;
        }
      }

      if (matchedFamily) {
        const key = matchedFamily.base;
        if (!familyGroups.has(key)) {
          familyGroups.set(key, []);
        }
        familyGroups.get(key)!.push(pair);
      }
    }

    // Harmonize each subgroup that has 2+ members
    for (const [familyBase, groupPairs] of familyGroups) {
      if (groupPairs.length < 2) continue;

      const family = TRANSFORMATION_FAMILIES.find((f) => f.base === familyBase);
      if (!family) continue;

      // Find if any pair in this subgroup has a definitive (non-ambiguous) member
      let definitiveVariant: string | null = null;
      for (const pair of groupPairs) {
        const matchingMembers = family.members.filter((member) =>
          pair.rawTransformations.includes(member)
        );
        if (matchingMembers.length === 1) {
          definitiveVariant = matchingMembers[0]!;
          break;
        }
      }

      // Apply the definitive variant to all pairs in this subgroup
      if (definitiveVariant) {
        for (const pair of groupPairs) {
          // Only update if this pair has the definitive variant as a valid option
          if (pair.rawTransformations.includes(definitiveVariant)) {
            pair.detectedTransformations = [
              formatSingleTransformation(
                definitiveVariant
              ),
            ];
          } else {
            // Check if the pair has both members (ambiguous) - use the definitive one
            const hasBase = pair.rawTransformations.includes(family.base);
            const hasInverted = pair.rawTransformations.includes(
              `${family.base}_inverted`
            );
            if (hasBase && hasInverted) {
              pair.detectedTransformations = [
                formatSingleTransformation(
                  definitiveVariant
                ),
              ];
            }
          }
        }
      }
    }
  }

  detectAxisAlternatingPattern(
    stepPairs: InternalStepPair[],
    _beatPairGroups: StepPairGroups
  ): AxisAlternatingResult | null {
    if (stepPairs.length < 2) return null;

    // Get the primary transformation for each beat pair (in order)
    const patternSequence = stepPairs.map((pair) => {
      const primary = pair.detectedTransformations[0] || "unknown";
      return this.normalizeToBase(primary);
    });

    const uniqueTransformations = [...new Set(patternSequence)];

    // Skip if there's only one transformation
    if (uniqueTransformations.length < 2) return null;

    // Skip if there are too many different transformations
    if (uniqueTransformations.length > 3) return null;

    // Determine the meta-pattern type
    let metaPatternType:
      | "palindromic"
      | "alternating"
      | "symmetric"
      | "structured" = "structured";

    if (this.isPalindromic(patternSequence)) {
      metaPatternType = "palindromic";
    } else if (this.isAlternating(patternSequence)) {
      metaPatternType = "alternating";
    } else if (this.isSymmetricAroundCenter(patternSequence)) {
      metaPatternType = "symmetric";
    }

    // Check if all transformations belong to a related group
    let matchedGroup: (typeof RELATED_TRANSFORMATION_GROUPS)[0] | null = null;
    for (const group of RELATED_TRANSFORMATION_GROUPS) {
      const allBelongToGroup = uniqueTransformations.every((t) =>
        group.members.some((member) => t.includes(member) || member.includes(t))
      );
      if (allBelongToGroup) {
        matchedGroup = group;
        break;
      }
    }

    // Build human-readable description
    const formattedTransformations = uniqueTransformations.map((t) =>
      t.toUpperCase().replace(/_/g, " ")
    );

    let description = "";
    if (matchedGroup) {
      // Matched a related transformation group
      if (metaPatternType === "palindromic") {
        description = `Palindromic Axis-Alternating: ${formattedTransformations.join(" ↔ ")}`;
      } else if (metaPatternType === "alternating") {
        description = `Alternating Axis: ${formattedTransformations.join(" ↔ ")}`;
      } else if (metaPatternType === "symmetric") {
        description = `Symmetric Axis-Alternating: ${formattedTransformations.join(" ↔ ")}`;
      } else {
        description = `Dual-Axis (${matchedGroup.description}): ${formattedTransformations.join(" + ")}`;
      }
    } else {
      // No matched group, but we have a structured pattern with 2-3 distinct types
      // This is a "Simple Modular" pattern
      const typeCount = uniqueTransformations.length;
      if (metaPatternType === "palindromic") {
        description = `Simple Modular (${typeCount} types, palindromic): ${formattedTransformations.join(" ↔ ")}`;
      } else if (metaPatternType === "alternating") {
        description = `Simple Modular (${typeCount} types, alternating): ${formattedTransformations.join(" ↔ ")}`;
      } else if (metaPatternType === "symmetric") {
        description = `Simple Modular (${typeCount} types, symmetric): ${formattedTransformations.join(" ↔ ")}`;
      } else {
        description = `Simple Modular (${typeCount} primary pair types): ${formattedTransformations.join(" + ")}`;
      }
    }

    return {
      isAxisAlternating: true,
      transformationFamily: uniqueTransformations,
      metaPatternType,
      patternSequence: patternSequence.map((t) =>
        t.toUpperCase().replace(/_/g, " ")
      ),
      description,
    };
  }

  private isPalindromic(sequence: string[]): boolean {
    if (sequence.length < 2) return false;
    for (let i = 0; i < Math.floor(sequence.length / 2); i++) {
      if (sequence[i] !== sequence[sequence.length - 1 - i]) {
        return false;
      }
    }
    return true;
  }

  private isAlternating(sequence: string[]): boolean {
    if (sequence.length < 2) return false;
    const uniqueValues = [...new Set(sequence)];
    if (uniqueValues.length !== 2) return false;

    for (let i = 0; i < sequence.length; i++) {
      const expected = uniqueValues[i % 2];
      if (sequence[i] !== expected) return false;
    }
    return true;
  }

  private isSymmetricAroundCenter(sequence: string[]): boolean {
    if (sequence.length < 3) return false;

    if (sequence.length % 2 === 0) {
      return this.isPalindromic(sequence);
    }

    const center = Math.floor(sequence.length / 2);
    for (let i = 0; i < center; i++) {
      if (sequence[i] !== sequence[sequence.length - 1 - i]) {
        return false;
      }
    }
    return true;
  }

  detectModularPattern(
    stepPairs: InternalStepPair[],
    cycleLength: number
  ): ModularAnalysisResult | null {
    if (stepPairs.length < cycleLength || cycleLength < 2) return null;

    // Group beat pairs by their position within the cycle
    const columnMap: Map<number, InternalStepPair[]> = new Map();
    for (let i = 0; i < stepPairs.length; i++) {
      const columnPos = (i % cycleLength) + 1; // 1-based
      if (!columnMap.has(columnPos)) {
        columnMap.set(columnPos, []);
      }
      columnMap.get(columnPos)!.push(stepPairs[i]!);
    }

    // Analyze each column for consistent behavior
    const columnBehaviors: ColumnBehavior[] = [];

    for (let pos = 1; pos <= cycleLength; pos++) {
      const columnPairs = columnMap.get(pos) || [];
      if (columnPairs.length === 0) continue;

      // Find consistent transformations for this column
      const allTransformations = columnPairs.flatMap(
        (p) => p.rawTransformations || []
      );
      const uniqueTransformations = [...new Set(allTransformations)];

      // Determine if this column is consistently swapped
      const isSwapped = this.isColumnSwapped(columnPairs);
      const isInverted = columnPairs.every((p) =>
        p.rawTransformations.some((t) => t.includes("inverted"))
      );
      const isMirrored = columnPairs.every((p) =>
        p.rawTransformations.some((t) => t.includes("mirrored"))
      );
      const isFlipped = columnPairs.every((p) =>
        p.rawTransformations.some((t) => t.includes("flipped"))
      );

      // Get base transformation (without swap modifier)
      const baseTransformation = this.getColumnBaseTransformation(columnPairs);

      columnBehaviors.push({
        position: pos,
        baseTransformation,
        isSwapped,
        isInverted,
        isMirrored,
        isFlipped,
        steps: columnPairs.map((p) => p.keyStep),
        transformations: uniqueTransformations.map((t) =>
          formatSingleTransformation(t)
        ),
      });
    }

    // Check if there's variation in swap behavior across columns
    const swappedPositions = columnBehaviors
      .filter((c) => c.isSwapped)
      .map((c) => c.position);
    const _notSwappedPositions = columnBehaviors
      .filter((c) => !c.isSwapped)
      .map((c) => c.position);

    // Determine swap rhythm pattern
    const swapRhythm = this.detectSwapRhythm(columnBehaviors);

    // Check if it's truly modular (different behaviors) or uniform
    const isModular =
      swapRhythm !== "uniform" || this.hasVariedBaseBehavior(columnBehaviors);

    if (!isModular) return null;

    // Find common base transformation across columns
    const baseTransformations = columnBehaviors
      .map((c) => c.baseTransformation)
      .filter((t) => t !== "unknown");
    const commonBase = this.findMostCommonBase(baseTransformations);

    // Build description
    const description = this.buildModularDescription(
      commonBase,
      swapRhythm,
      swappedPositions,
      columnBehaviors
    );

    return {
      isModular: true,
      columnBehaviors,
      swapRhythm,
      swappedPositions,
      baseTransformation: commonBase,
      description,
    };
  }

  private isColumnSwapped(pairs: InternalStepPair[]): boolean {
    // Check if this column has swap behavior
    // Strategy: Look for definitive SWAPPED (not just SWAPPED+INVERTED ambiguous)
    // If ANY pair in the column has a clean SWAPPED transformation, consider it swapped

    for (const pair of pairs) {
      // Check primary detected transformation
      const primary = pair.detectedTransformations[0] || "";

      // Clean swap = has "swapped" but NOT "inverted"
      const hasCleanSwap =
        primary.toLowerCase().includes("swapped") &&
        !primary.toLowerCase().includes("inverted");

      if (hasCleanSwap) return true;

      // Also check raw transformations for definitive swapped
      const rawHasCleanSwap = (pair.rawTransformations || []).some((t) => {
        const lower = t.toLowerCase();
        return lower.includes("swapped") && !lower.includes("inverted");
      });

      if (rawHasCleanSwap) return true;
    }

    return false;
  }

  private getColumnBaseTransformation(pairs: InternalStepPair[]): string {
    // Find the most common base transformation (without swap/invert)
    const baseCounts: Map<string, number> = new Map();

    for (const pair of pairs) {
      for (const t of pair.rawTransformations || []) {
        const base = t
          .toLowerCase()
          .replace(/_swapped/g, "")
          .replace(/_inverted/g, "")
          .replace(/swapped_/g, "")
          .replace(/inverted_/g, "");
        baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
      }
    }

    let maxCount = 0;
    let mostCommon = "unknown";
    for (const [base, count] of baseCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = base;
      }
    }

    return mostCommon;
  }

  private detectSwapRhythm(columns: ColumnBehavior[]): SwapRhythmPattern {
    if (columns.length !== 4) return "unknown";

    // Build pattern string from swap status
    const pattern = columns.map((c) => (c.isSwapped ? "2" : "1")).join("-");

    // Match known patterns
    const knownPatterns: SwapRhythmPattern[] = [
      "1-2-2-1",
      "1-2-1-2",
      "1-1-2-2",
      "2-1-1-2",
      "2-1-2-1",
      "2-2-1-1",
    ];

    if (knownPatterns.includes(pattern as SwapRhythmPattern)) {
      return pattern as SwapRhythmPattern;
    }

    // Check for uniform (all same)
    const allSwapped = columns.every((c) => c.isSwapped);
    const noneSwapped = columns.every((c) => !c.isSwapped);
    if (allSwapped || noneSwapped) return "uniform";

    return "unknown";
  }

  private hasVariedBaseBehavior(columns: ColumnBehavior[]): boolean {
    const bases = new Set(
      columns.map((c) => c.baseTransformation).filter((b) => b !== "unknown")
    );
    return bases.size > 1;
  }

  private findMostCommonBase(bases: string[]): string | null {
    if (bases.length === 0) return null;

    const counts: Map<string, number> = new Map();
    for (const base of bases) {
      counts.set(base, (counts.get(base) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: string | null = null;
    for (const [base, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = base;
      }
    }

    return mostCommon;
  }

  private buildModularDescription(
    commonBase: string | null,
    swapRhythm: SwapRhythmPattern,
    swappedPositions: number[],
    columns: ColumnBehavior[]
  ): string {
    const baseName = commonBase
      ? formatSingleTransformation(commonBase)
      : "Mixed Transformations";

    if (swapRhythm === "uniform") {
      return `Modular: ${baseName} (varied column behaviors)`;
    }

    if (swappedPositions.length === 0) {
      return `Modular: ${baseName}`;
    }

    // Build binary swap pattern: 0 = no swap, 1 = swap
    const binaryPattern = columns
      .map((c) => (c.isSwapped ? "1" : "0"))
      .join("");

    return `Modular: ${baseName} + SWAPPED (${binaryPattern})`;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

import { formatSingleTransformation } from "./candidate-formatter";
import type { AxisAlternatingResult, ModularAnalysisResult, ColumnBehavior, SwapRhythmPattern } from "./types";

export const transformationAnalyzer = new TransformationAnalyzer();
