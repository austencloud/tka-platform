/**
 * Attribute Key Generator
 *
 * Generates attribute keys for arrow positioning using modern data structures.
 */

import type { ArrowPlacementData } from "../../placement/domain/arrow-placement-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

function hasHybridMotions(pictographData: PictographData): boolean {
  try {
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (!blueMotion || !redMotion) return false;
    const blueType = blueMotion.motionType || "";
    const redType = redMotion.motionType || "";
    return blueType !== redType;
  } catch {
    return false;
  }
}

function startsFromMixedOrientation(pictographData: PictographData): boolean {
  try {
    const IN = "in";
    const OUT = "out";
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;
    if (!blueMotion || !redMotion) return false;
    const blueStart = blueMotion.startOrientation || "";
    const redStart = redMotion.startOrientation || "";
    const blueLayer1 = [IN, OUT].includes(blueStart);
    const redLayer1 = [IN, OUT].includes(redStart);
    return blueLayer1 !== redLayer1;
  } catch {
    return false;
  }
}

function isNonHybridLetter(letter: string): boolean {
  const nonHybridLetters = ["A","B","D","E","G","H","J","K","M","N","P","Q","S","T"];
  return nonHybridLetters.includes(letter);
}

export function generateAttributeKey(
  motionType: string,
  letter: string,
  startOrientation: string,
  color: string,
  leadState?: string,
  hybridMotions?: boolean,
  mixedOrientation?: boolean,
  _standardOrientation?: boolean
): string {
  try {
    const IN = "in";
    const OUT = "out";
    const CLOCK = "clock";
    const COUNTER = "counter";

    if (mixedOrientation) {
      if (["S", "T"].includes(letter)) {
        return leadState || color;
      } else if (hybridMotions) {
        if ([IN, OUT].includes(startOrientation)) {
          return `${motionType}_from_layer1`;
        } else if ([CLOCK, COUNTER].includes(startOrientation)) {
          return `${motionType}_from_layer2`;
        } else {
          return color;
        }
      } else if (isNonHybridLetter(letter)) {
        return color;
      } else {
        return motionType;
      }
    } else {
      return color;
    }
  } catch (error) {
    console.error("Error in key generation:", error);
    return color;
  }
}

export function getKeyFromArrow(
  _arrowData: ArrowPlacementData,
  pictographData: PictographData,
  color: string
): string {
  try {
    const motionData = pictographData.motions[color as keyof typeof pictographData.motions];

    if (!motionData) {
      console.debug(`No motion data for ${color}, using color as key`);
      return color;
    }

    const motionType = motionData.motionType || "";
    const letter = pictographData.letter || "";
    const startOrientation = motionData.startOrientation || "";
    const leadState: string | undefined = undefined;

    const hybrid = hasHybridMotions(pictographData);
    const mixed = startsFromMixedOrientation(pictographData);
    const standard = !mixed;

    return generateAttributeKey(motionType, letter, startOrientation, color, leadState, hybrid, mixed, standard);
  } catch (error) {
    console.error(`Error generating attribute key for ${color}:`, error);
    return color;
  }
}
