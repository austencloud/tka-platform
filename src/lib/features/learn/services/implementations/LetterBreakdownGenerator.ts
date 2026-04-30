/**
 * LetterBreakdownGenerator
 *
 * Produces deterministic, correct letter descriptions and comparisons
 * from the static letter breakdown table. Eliminates LLM hallucination
 * risk by pre-computing all domain content before TIKA receives it.
 */

import type {
  ILetterBreakdownGenerator,
  LetterBreakdown,
  LetterComparison,
  ComparisonRelationship,
} from "../contracts/ILetterBreakdownGenerator";
import {
  LETTER_BREAKDOWN_TABLE,
  type LetterBreakdownEntry,
} from "../domain/letter-breakdown-data";

export class LetterBreakdownGenerator implements ILetterBreakdownGenerator {
  getBreakdown(letter: string): LetterBreakdown | null {
    const entry = LETTER_BREAKDOWN_TABLE.get(letter);
    if (!entry) return null;

    return {
      letter,
      typeNumber: entry.typeNumber,
      typeName: entry.typeName,
      positionDescription: this.buildPositionDescription(entry),
      motionDescription: entry.motionDescription,
      vtgMode: entry.vtgMode,
      vtgElement: entry.vtgElement,
      motionGroup: entry.motionGroup,
      upgradeFrom: entry.upgradeFrom,
      summary: this.buildSummary(letter, entry),
    };
  }

  compare(letterA: string, letterB: string): LetterComparison | null {
    const breakdownA = this.getBreakdown(letterA);
    const breakdownB = this.getBreakdown(letterB);
    if (!breakdownA || !breakdownB) return null;

    const entryA = LETTER_BREAKDOWN_TABLE.get(letterA)!;
    const entryB = LETTER_BREAKDOWN_TABLE.get(letterB)!;

    const relationship = this.detectRelationship(
      letterA,
      letterB,
      entryA,
      entryB
    );
    const explanation = this.buildExplanation(
      breakdownA,
      breakdownB,
      entryA,
      entryB,
      relationship
    );

    return { letterA: breakdownA, letterB: breakdownB, relationship, explanation };
  }

  // ─── Summary builders ───────────────────────────────────────────

  private buildPositionDescription(entry: LetterBreakdownEntry): string {
    if (entry.startPosition === entry.endPosition) {
      return `${entry.startPosition} to ${entry.endPosition}`;
    }
    return `${entry.startPosition} to ${entry.endPosition}`;
  }

  private buildSummary(letter: string, entry: LetterBreakdownEntry): string {
    const pos = `${entry.startPosition}\u2192${entry.endPosition}`;

    switch (entry.typeNumber) {
      case 1:
        return this.buildType1Summary(letter, entry, pos);
      case 2:
        return this.buildType2Summary(letter, entry, pos);
      case 3:
        return this.buildType3Summary(letter, entry);
      case 4:
        return this.buildType4Summary(letter, entry, pos);
      case 5:
        return this.buildType5Summary(letter, entry);
      case 6:
        return this.buildType6Summary(letter, entry);
      default:
        return `${letter} is a Type ${entry.typeNumber} (${entry.typeName}) letter: ${pos}, ${entry.motionDescription}`;
    }
  }

  private buildType1Summary(
    letter: string,
    entry: LetterBreakdownEntry,
    pos: string
  ): string {
    const base = `${letter} is ${pos} with ${entry.motionDescription} spins`;
    const vtgPart = entry.vtgMode
      ? ` (${entry.vtgMode}${entry.vtgElement ? ` / ${entry.vtgElement}` : ""})`
      : "";
    return base + vtgPart;
  }

  private buildType2Summary(
    letter: string,
    entry: LetterBreakdownEntry,
    pos: string
  ): string {
    return `${letter} is ${pos} through a single ${this.extractShiftDirection(entry)} shift against a static hand`;
  }

  private buildType3Summary(
    letter: string,
    entry: LetterBreakdownEntry
  ): string {
    return `${letter} is like ${entry.upgradeFrom} but the static hand now dashes`;
  }

  private buildType4Summary(
    letter: string,
    entry: LetterBreakdownEntry,
    pos: string
  ): string {
    const qualifier = this.extractDashQualifier(entry);
    return `${letter} is ${pos} with one${qualifier} dash against a static hand`;
  }

  private buildType5Summary(
    letter: string,
    entry: LetterBreakdownEntry
  ): string {
    const qualifier = this.extractDashQualifier(entry);
    return `${letter} is like ${entry.upgradeFrom} but both hands dash${qualifier}`;
  }

  private buildType6Summary(
    letter: string,
    entry: LetterBreakdownEntry
  ): string {
    return `${letter}: both hands static at ${entry.startPosition}`;
  }

  // ─── Helpers for extracting motion details ──────────────────────

  private extractShiftDirection(entry: LetterBreakdownEntry): string {
    if (entry.motionDescription.includes("pro")) return "pro";
    if (entry.motionDescription.includes("anti")) return "anti";
    return "";
  }

  private extractDashQualifier(entry: LetterBreakdownEntry): string {
    if (entry.motionDescription.includes("diverging")) return " diverging";
    if (entry.motionDescription.includes("converging")) return " converging";
    if (entry.motionDescription.includes("angle preserved"))
      return " (angle preserved)";
    return "";
  }

  // ─── Comparison logic ──────────────────────────────────────────

  private detectRelationship(
    letterA: string,
    letterB: string,
    entryA: LetterBreakdownEntry,
    entryB: LetterBreakdownEntry
  ): ComparisonRelationship {
    // Check for upgrade relationship (Type 2→3 or Type 4→5)
    if (entryA.upgradeFrom === letterB || entryB.upgradeFrom === letterA) {
      return "cross-type-upgrade";
    }

    const sameType = entryA.typeNumber === entryB.typeNumber;
    const sameStart = entryA.startPosition === entryB.startPosition;
    const sameEnd = entryA.endPosition === entryB.endPosition;

    if (sameType) {
      if (sameStart && sameEnd) {
        // Same position pair - must differ in rotation
        if (entryA.motionGroup !== entryB.motionGroup) {
          return "same-type-different-rotation";
        }
        // Same type, same positions, same group (e.g. M vs P - different gamma subgroups)
        return "same-type-different-group";
      }
      // Same type, different positions
      return "same-type-different-position";
    }

    // Different types
    if (sameEnd) {
      return "same-position-different-type";
    }

    return "cross-type-confusion";
  }

  private buildExplanation(
    a: LetterBreakdown,
    b: LetterBreakdown,
    entryA: LetterBreakdownEntry,
    entryB: LetterBreakdownEntry,
    relationship: ComparisonRelationship
  ): string {
    switch (relationship) {
      case "same-type-different-rotation":
        return this.explainSamePositionDifferentRotation(a, b);
      case "same-type-different-position":
        return this.explainSameTypeDifferentPosition(a, b);
      case "same-type-different-group":
        return this.explainSameTypeDifferentGroup(a, b);
      case "cross-type-upgrade":
        return this.explainUpgrade(a, b, entryA, entryB);
      case "same-position-different-type":
        return this.explainSameEndPositionDifferentType(a, b);
      case "cross-type-confusion":
        return this.explainCrossTypeConfusion(a, b);
      case "unrelated":
      default:
        return this.explainUnrelated(a, b);
    }
  }

  private explainSamePositionDifferentRotation(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    return (
      `Both ${a.letter} and ${b.letter} are ${a.positionDescription} Type ${a.typeNumber} letters. ` +
      `${a.letter} is ${a.motionDescription}. ${b.letter} is ${b.motionDescription}. ` +
      `Same hand paths, different prop rotation.`
    );
  }

  private explainSameTypeDifferentPosition(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    return (
      `Both are Type ${a.typeNumber} (${a.typeName}), ${a.motionDescription}. ` +
      `${a.letter} goes ${a.positionDescription}. ${b.letter} goes ${b.positionDescription}.`
    );
  }

  private explainSameTypeDifferentGroup(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    const vtgA = a.vtgMode ? ` (${a.vtgMode})` : "";
    const vtgB = b.vtgMode ? ` (${b.vtgMode})` : "";
    return (
      `Both ${a.letter} and ${b.letter} are Type ${a.typeNumber} ${a.positionDescription}. ` +
      `They differ in their VTG timing: ${a.letter}${vtgA} vs ${b.letter}${vtgB}.`
    );
  }

  private explainUpgrade(
    a: LetterBreakdown,
    b: LetterBreakdown,
    entryA: LetterBreakdownEntry,
    entryB: LetterBreakdownEntry
  ): string {
    const [base, upgraded] = entryA.upgradeFrom
      ? [b, a]
      : [a, b];
    return (
      `${upgraded.letter} is ${base.letter} with the static hand upgraded to a dash. ` +
      `${base.letter} is Type ${base.typeNumber} (${base.typeName}). ` +
      `${upgraded.letter} is Type ${upgraded.typeNumber} (${upgraded.typeName}).`
    );
  }

  private explainSameEndPositionDifferentType(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    return (
      `Both end at the same position, but use different motion types. ` +
      `${a.letter} is Type ${a.typeNumber} (${a.typeName}): ${a.motionDescription}. ` +
      `${b.letter} is Type ${b.typeNumber} (${b.typeName}): ${b.motionDescription}.`
    );
  }

  private explainCrossTypeConfusion(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    return (
      `${a.letter} is Type ${a.typeNumber} (${a.typeName}): ${a.motionDescription}. ` +
      `${b.letter} is Type ${b.typeNumber} (${b.typeName}): ${b.motionDescription}. ` +
      `Different letter types with different motion patterns.`
    );
  }

  private explainUnrelated(
    a: LetterBreakdown,
    b: LetterBreakdown
  ): string {
    return `${a.summary} ${b.summary}`;
  }
}
