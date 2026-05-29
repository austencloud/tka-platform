/**
 * Pictograph Inspect Formatters
 *
 * Pure functions for formatting pictograph data as text.
 */
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import DefaultPropPositioner from "$lib/shared/pictograph/prop/services/implementations/DefaultPropPositioner";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { propPlacer } from "$lib/shared/pictograph/prop/services/implementations/PropPlacer";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isBuugengFamilyProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

/** "dash" -> "Dash", "static" -> "Static". For the dense motion-line display. */
export function formatMotionTypeLabel(motionType: string | undefined): string {
  if (!motionType) return "—";
  return motionType.charAt(0).toUpperCase() + motionType.slice(1);
}

/**
 * Rotation-override lookup keys all share the constant `_rot_angle_override`
 * suffix, which duplicates the chip's own label. Strip it and the underscores
 * so only the distinguishing part shows (e.g. "dash", "static from layer1",
 * or the color for special letters). The full raw key stays available on hover.
 */
export function formatRotationOverrideKey(key: string | null): string {
  if (!key) return "";
  return key.replace(/_rot_angle_override$/, "").replace(/_/g, " ") || key;
}

/** "noRotation" -> "No Rotation", "cw" -> "CW", "ccw" -> "CCW". */
export function formatRotationLabel(
  rotationDirection: string | undefined
): string {
  if (!rotationDirection) return "—";
  if (rotationDirection === "cw") return "CW";
  if (rotationDirection === "ccw") return "CCW";
  const spaced = rotationDirection.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function formatMotionText(
  motion: MotionData | undefined,
  color: string,
  rotationOverride: { hasOverride: boolean } | null,
  pictographData?: PictographData
): Promise<string> {
  if (!motion) return `${color.toUpperCase()} MOTION: None`;

  const arrow = motion.arrowPlacementData;

  // Calculate actual prop placement using the PropPlacer service
  // Apply settings override for prop type (same as PictographPreparer does)
  let calculatedPlacement: {
    positionX: number;
    positionY: number;
    rotationAngle: number;
  } | null = null;
  if (pictographData) {
    try {
      const settings = getSettings();
      const propTypeOverride =
        color === "blue" ? settings.bluePropType : settings.redPropType;
      const motionWithOverride = propTypeOverride
        ? { ...motion, propType: propTypeOverride }
        : motion;
      const placement = await propPlacer.calculatePlacement(
        pictographData,
        motionWithOverride
      );
      calculatedPlacement = placement;
    } catch (e) {
      console.warn("Failed to calculate prop placement:", e);
    }
  }
  const lines = [
    `${color.toUpperCase()} MOTION:`,
    `  Type: ${motion.motionType}`,
    `  Turns: ${motion.turns === "fl" ? "float" : motion.turns}`,
    `  Rotation: ${motion.rotationDirection}`,
    `  Start Location: ${motion.startLocation}`,
    `  End Location: ${motion.endLocation}`,
    `  Arrow Location: ${motion.arrowLocation}`,
    `  Start Orientation: ${motion.startOrientation}`,
    `  End Orientation: ${motion.endOrientation}`,
  ];

  // Only add prefloat info if present
  if (motion.prefloatMotionType) {
    lines.push(`  Prefloat Type: ${motion.prefloatMotionType}`);
  }
  if (motion.prefloatRotationDirection) {
    lines.push(`  Prefloat Rotation: ${motion.prefloatRotationDirection}`);
  }

  // Arrow placement section
  lines.push(``, `  ARROW PLACEMENT:`);
  lines.push(
    `    Position: (${arrow?.positionX?.toFixed(2) ?? "N/A"}, ${arrow?.positionY?.toFixed(2) ?? "N/A"})`
  );
  lines.push(`    Rotation: ${arrow?.rotationAngle?.toFixed(1) ?? "N/A"}°`);
  lines.push(`    SVG Mirrored: ${arrow?.svgMirrored ? "Yes" : "No"}`);

  // Rotation override info (only for STATIC/DASH)
  if (rotationOverride) {
    lines.push(
      `    Rotation Override: ${rotationOverride.hasOverride ? "YES" : "No"}`
    );
  }

  if (arrow?.manualAdjustmentX || arrow?.manualAdjustmentY) {
    lines.push(
      `    Manual Adjustment: (${arrow?.manualAdjustmentX?.toFixed(2) ?? 0}, ${arrow?.manualAdjustmentY?.toFixed(2) ?? 0})`
    );
  }

  // Prop placement section - use calculated placement, not stale MotionData
  lines.push(``, `  PROP PLACEMENT:`);

  if (calculatedPlacement) {
    lines.push(
      `    Position: (${calculatedPlacement.positionX.toFixed(2)}, ${calculatedPlacement.positionY.toFixed(2)})`
    );
    lines.push(
      `    Rotation: ${calculatedPlacement.rotationAngle.toFixed(1)}°`
    );

    // Calculate expected default position and beta offset
    try {
      const gridMode =
        motion.gridMode === GridMode.BOX ? GridMode.BOX : GridMode.DIAMOND;
      const defaultPos = DefaultPropPositioner.calculatePosition(
        motion.endLocation,
        gridMode
      );
      lines.push(
        `    Default Position: (${defaultPos.x.toFixed(2)}, ${defaultPos.y.toFixed(2)})`
      );

      const offsetX = calculatedPlacement.positionX - defaultPos.x;
      const offsetY = calculatedPlacement.positionY - defaultPos.y;
      const hasOffset = Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01;
      lines.push(
        `    Beta Offset: ${hasOffset ? `(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})` : "None"}`
      );
    } catch {
      lines.push(`    Default Position: (calculation error)`);
    }
  } else {
    lines.push(`    Position: (not calculated)`);
  }

  return lines.join("\n");
}

export function formatBasicInfo(
  displayData: StepData | null,
  blueMotion: MotionData | undefined,
  redMotion: MotionData | undefined
): string {
  if (!displayData) return "";

  const gridMode = blueMotion?.gridMode ?? redMotion?.gridMode ?? "unknown";
  const propType = blueMotion?.propType ?? redMotion?.propType ?? "unknown";

  return `STEP INFO:
  Beat Number: ${displayData.stepNumber}
  Letter: ${displayData.letter ?? "None"}
  Grid Mode: ${gridMode}
  Prop Type: ${propType}
  Start Position: ${displayData.startPosition ?? "N/A"}
  End Position: ${displayData.endPosition ?? "N/A"}
  Blue Reversal: ${displayData.blueReversal}
  Red Reversal: ${displayData.redReversal}
  ID: ${displayData.id}`;
}

export async function formatAllForAI(
  displayData: StepData | null,
  blueMotion: MotionData | undefined,
  redMotion: MotionData | undefined,
  blueRotationOverride: { hasOverride: boolean } | null,
  redRotationOverride: { hasOverride: boolean } | null,
  pictographData?: PictographData
): Promise<string> {
  if (!displayData) return "";

  const [blueText, redText] = await Promise.all([
    formatMotionText(blueMotion, "blue", blueRotationOverride, pictographData),
    formatMotionText(redMotion, "red", redRotationOverride, pictographData),
  ]);

  const betaAnalysis = formatBetaAnalysis(blueMotion, redMotion);

  return `=== PICTOGRAPH DATA ===

${formatBasicInfo(displayData, blueMotion, redMotion)}

${betaAnalysis}

${blueText}

${redText}`;
}

/**
 * Analyze and format beta offset decision factors
 */
function formatBetaAnalysis(
  blueMotion: MotionData | undefined,
  redMotion: MotionData | undefined
): string {
  if (!blueMotion || !redMotion) {
    return "BETA ANALYSIS: Insufficient motion data";
  }

  const settings = getSettings();
  const lines: string[] = ["BETA OFFSET ANALYSIS:"];

  // Prop types (stored vs actual)
  const storedBlueProp = blueMotion.propType;
  const storedRedProp = redMotion.propType;
  const actualBlueProp = settings.bluePropType ?? storedBlueProp;
  const actualRedProp = settings.redPropType ?? storedRedProp;

  lines.push(
    `  Stored Prop Types: blue=${storedBlueProp}, red=${storedRedProp}`
  );
  lines.push(
    `  Actual Prop Types: blue=${actualBlueProp}, red=${actualRedProp}`
  );

  // Buugeng family check
  const blueIsBuugeng = isBuugengFamilyProp(actualBlueProp);
  const redIsBuugeng = isBuugengFamilyProp(actualRedProp);
  const bothBuugeng = blueIsBuugeng && redIsBuugeng;
  lines.push(`  Blue is Buugeng Family: ${blueIsBuugeng}`);
  lines.push(`  Red is Buugeng Family: ${redIsBuugeng}`);
  lines.push(`  Both are Buugeng Family: ${bothBuugeng}`);

  // Chirality: which mirror-image form of the asymmetric Buugeng is used
  // (separate concept from orientation - orientation affects rotation angle,
  // chirality affects the shape itself)
  const blueChirality = settings.blueBuugengFlipped ?? false;
  const redChirality = settings.redBuugengFlipped ?? false;
  const oppositeChirality = blueChirality !== redChirality;
  lines.push(`  Blue Buugeng Chirality: ${blueChirality ? "B" : "A"}`);
  lines.push(`  Red Buugeng Chirality: ${redChirality ? "B" : "A"}`);
  lines.push(`  Opposite Chirality: ${oppositeChirality}`);

  // End locations
  const sameEndLocation = blueMotion.endLocation === redMotion.endLocation;
  lines.push(
    `  Same End Location: ${sameEndLocation} (blue=${blueMotion.endLocation}, red=${redMotion.endLocation})`
  );

  // Orientation analysis
  const blueEndOri = blueMotion.endOrientation;
  const redEndOri = redMotion.endOrientation;
  const radialOrientations: Orientation[] = [Orientation.IN, Orientation.OUT];
  const nonRadialOrientations: Orientation[] = [
    Orientation.CLOCK,
    Orientation.COUNTER,
  ];

  const blueIsRadial = radialOrientations.includes(blueEndOri);
  const redIsRadial = radialOrientations.includes(redEndOri);
  const blueIsNonRadial = nonRadialOrientations.includes(blueEndOri);
  const redIsNonRadial = nonRadialOrientations.includes(redEndOri);

  const bothRadial = blueIsRadial && redIsRadial;
  const bothNonRadial = blueIsNonRadial && redIsNonRadial;
  const hybridOrientation =
    (blueIsRadial && redIsNonRadial) || (blueIsNonRadial && redIsRadial);
  const sameTypeButDifferent =
    (bothRadial || bothNonRadial) && blueEndOri !== redEndOri;

  lines.push(`  Blue End Orientation: ${blueEndOri} (radial=${blueIsRadial})`);
  lines.push(`  Red End Orientation: ${redEndOri} (radial=${redIsRadial})`);
  lines.push(`  Both Radial (IN/OUT): ${bothRadial}`);
  lines.push(`  Both Non-Radial (CLOCK/COUNTER): ${bothNonRadial}`);
  lines.push(`  Hybrid (one radial, one not): ${hybridOrientation}`);
  lines.push(`  Same Type But Different Orientation: ${sameTypeButDifferent}`);

  // Decision summary
  // NOTE: Orientation (IN/OUT/CLOCK/COUNTER) is SEPARATE from Chirality (shape form)
  // Buugeng nesting only requires: both Buugeng + opposite chirality
  lines.push(``, `  BUUGENG NESTING CONDITIONS:`);
  lines.push(`    1. Both Buugeng Family: ${bothBuugeng ? "✓" : "✗"}`);
  lines.push(`    2. Opposite Chirality: ${oppositeChirality ? "✓" : "✗"}`);
  lines.push(`    (Orientation is irrelevant for nesting decision)`);

  const shouldSkipBetaOffset = bothBuugeng && oppositeChirality;
  lines.push(
    `  → Should Skip Beta Offset: ${shouldSkipBetaOffset ? "YES" : "NO"}`
  );

  if (!shouldSkipBetaOffset && bothBuugeng) {
    if (!oppositeChirality) {
      lines.push(
        `  → Reason: Same chirality (both ${blueChirality ? "B" : "A"})`
      );
    }
  }

  // Orientation analysis (for reference, not part of nesting decision)
  lines.push(``, `  ORIENTATION ANALYSIS (for reference):`);
  lines.push(
    `    Blue End Orientation: ${blueEndOri} (radial=${blueIsRadial})`
  );
  lines.push(`    Red End Orientation: ${redEndOri} (radial=${redIsRadial})`);
  lines.push(`    Same Type But Different: ${sameTypeButDifferent}`);

  return lines.join("\n");
}
