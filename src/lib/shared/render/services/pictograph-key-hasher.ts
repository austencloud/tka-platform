import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { isBuugengFamilyProp } from "$lib/shared/render/core/constants/prop-classification";
// getSettings loaded dynamically to avoid pulling $app/environment into worker bundle

interface MotionKeyData {
  isVisible?: boolean;
  motionType: string;
  startLocation: string;
  endLocation: string;
  turns: number | string;
  startOrientation: string;
  endOrientation: string;
  rotationDirection: string;
  propType: string;
  gridMode: string;
}

interface PictographKeyInput {
  letter: string | undefined;
  blue: MotionKeyData | null;
  red: MotionKeyData | null;
  // Reversal dots are BAKED into the rendered blob (LayerCompositor reads
  // stepData.blueReversal/redReversal), so the flags are image identity. The
  // same letter+motions can carry different reversal flags depending on the
  // preceding step — omitting them served dotted blobs to dot-free steps.
  blueReversal: boolean;
  redReversal: boolean;
  // betaSwapped changes prepared prop geometry (PictographPreparer keys it);
  // without it two identical-motion pictographs collide across the swap.
  betaSwapped: boolean;
  // Present only when a narrowly-scoped render algorithm revision changes
  // this pictograph's pixels. Unaffected cells keep their established key.
  propGeometryRevision?: string;
  propAppearanceRevision?: string;
  turnGlyphRevision?: string;
  visibility: {
    showTKA: boolean;
    showTnD: boolean;
    showElemental: boolean;
    showPositions: boolean;
    showReversals: boolean;
    showNonRadialPoints: boolean;
    showGrid: boolean;
    darkMode: boolean;
    bluePropType: string | undefined;
    redPropType: string | undefined;
    handPathMode: boolean;
    handPointVisibility: string;
    printMode: boolean;
    showBlueMotion: boolean;
    showRedMotion: boolean;
    // Chirality is image identity for buugeng-family props only, and only
    // when flipped. Present-when-it-matters keeps every unflipped render
    // byte-identical to the established lsp11/lsp12 key corpus.
    blueBuugengFlipped?: boolean;
    redBuugengFlipped?: boolean;
  };
}

const BETA_SHIFT_MAP_REVISION = "beta-shift-map-v2";
const QUARTER_TURN_GLYPH_REVISION = "quarter-turn-glyph-v1";
const PROP_APPEARANCE_REVISIONS: Readonly<Record<string, string>> = {
  // The original club raster was a single flat silhouette. The regular-club
  // material artwork changes those pixels without changing PropType.CLUB, so
  // old IndexedDB and cloud cells must no longer be valid hits.
  club: "club-art-v2",
};
const NON_RADIAL_ORIENTATIONS = new Set(["clock", "counter"]);
const SHIFT_MOTION_TYPES = new Set(["pro", "anti", "float"]);
const REVISED_NON_RADIAL_SHIFT_TRANSITIONS = new Set([
  "se>ne",
  "sw>nw",
  "sw>se",
  "nw>ne",
  "nw>sw",
]);
const LETTERS_WITH_INDEPENDENT_BETA_DIRECTION_MAPS = new Set(["G", "H", "I"]);

/**
 * Returns a render-identity revision only for cells whose prop pixels can be
 * changed by the corrected box/non-radial shift-direction entries.
 *
 * Keeping this predicate narrow avoids invalidating the established lsp11
 * cloud corpus for pictographs that never consult those entries.
 */
export function getPictographGeometryRevision(
  data: StepData | PictographData
): string | undefined {
  const blue = data.motions?.blue;
  const red = data.motions?.red;
  if (!blue || !red || blue.isVisible === false || red.isVisible === false) {
    return undefined;
  }

  if (blue.endLocation.toLowerCase() !== red.endLocation.toLowerCase()) {
    return undefined;
  }

  if (
    !NON_RADIAL_ORIENTATIONS.has(blue.endOrientation.toLowerCase()) ||
    !NON_RADIAL_ORIENTATIONS.has(red.endOrientation.toLowerCase())
  ) {
    return undefined;
  }

  if (LETTERS_WITH_INDEPENDENT_BETA_DIRECTION_MAPS.has(data.letter ?? "")) {
    return undefined;
  }

  const blueIsShift = SHIFT_MOTION_TYPES.has(blue.motionType.toLowerCase());
  const redIsShift = SHIFT_MOTION_TYPES.has(red.motionType.toLowerCase());
  const letter = data.letter ?? "";

  // Direction routing intentionally has one source motion. Y/Z prefer red;
  // ordinary dual shifts use blue; mixed shift/non-shift cells use the shift.
  const directionSource =
    letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-"
      ? redIsShift
        ? red
        : blueIsShift
          ? blue
          : undefined
      : blueIsShift && redIsShift
        ? blue
        : blueIsShift
          ? blue
          : redIsShift
            ? red
            : undefined;

  const transition = directionSource
    ? `${directionSource.startLocation.toLowerCase()}>${directionSource.endLocation.toLowerCase()}`
    : "";
  const usesRevisedTransition =
    REVISED_NON_RADIAL_SHIFT_TRANSITIONS.has(transition);

  return usesRevisedTransition ? BETA_SHIFT_MAP_REVISION : undefined;
}

/**
 * Rekeys only pictographs whose rasterized TKA tuple changed when the 0.25
 * number asset was introduced. Older lsp11/lsp12 blobs were rendered before
 * that glyph existed and otherwise remain valid cache hits forever.
 */
export function getTurnGlyphRevision(
  data: StepData | PictographData,
  showTKA: boolean
): string | undefined {
  if (!showTKA) return undefined;

  const usesQuarterTurn = Object.values(data.motions ?? {}).some((motion) => {
    if (!motion || motion.isVisible === false) return false;
    return Number(motion.turns) === 0.25;
  });

  return usesQuarterTurn ? QUARTER_TURN_GLYPH_REVISION : undefined;
}

/**
 * Returns only the authored-art revisions that can affect the selected props.
 *
 * Prop types are already part of the cache identity. This extra seam covers a
 * different case: the SVG behind an existing prop type changes while its enum
 * value stays stable. Keeping the revision prop-scoped avoids throwing away
 * the established cloud corpus for every unrelated prop.
 */
export function getPropAppearanceRevision(
  bluePropType: string,
  redPropType: string
): string | undefined {
  const revisions = [bluePropType, redPropType]
    .map((propType) => PROP_APPEARANCE_REVISIONS[propType.toLowerCase()])
    .filter((revision): revision is string => Boolean(revision));

  const uniqueRevisions = [...new Set(revisions)].sort();
  return uniqueRevisions.length > 0 ? uniqueRevisions.join("+") : undefined;
}

export class PictographKeyHasher {
  deriveKey(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): string {
    const input = this.buildKeyInput(data, visibility);
    return JSON.stringify(input, this.sortedReplacer);
  }

  private buildKeyInput(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): PictographKeyInput {
    const motions = data.motions ?? { blue: undefined, red: undefined };

    // Callers (ImageComposer.getVisibilitySettings) always resolve prop types before
    // calling deriveKey, so visibility.bluePropType/redPropType are always set.
    // Default to "staff" for safety. Previously this called getSettings() which pulled
    // $app/environment into the worker bundle via the static import chain.
    const resolvedBlueProp = visibility.bluePropType ?? "staff";
    const resolvedRedProp = visibility.redPropType ?? "staff";
    const includeMotionVisibility =
      motions.blue?.isVisible === false || motions.red?.isVisible === false;

    // Flags only affect the image when the reversal layer actually draws;
    // neutralize them when showReversals is off so a flagged and unflagged
    // step (identical images) share one cache entry.
    const reversalsVisible = visibility.showReversals ?? true;
    const step = data as Partial<StepData>;
    const propGeometryRevision = getPictographGeometryRevision(data);
    const propAppearanceRevision = getPropAppearanceRevision(
      resolvedBlueProp,
      resolvedRedProp
    );
    const turnGlyphRevision = getTurnGlyphRevision(
      data,
      visibility.showTKA ?? true
    );

    return {
      letter: data.letter ?? undefined,
      blue: this.extractMotionKey(motions.blue, includeMotionVisibility),
      red: this.extractMotionKey(motions.red, includeMotionVisibility),
      blueReversal: reversalsVisible ? (step.blueReversal ?? false) : false,
      redReversal: reversalsVisible ? (step.redReversal ?? false) : false,
      betaSwapped: data.betaSwapped ?? false,
      ...(propGeometryRevision && { propGeometryRevision }),
      ...(propAppearanceRevision && { propAppearanceRevision }),
      ...(turnGlyphRevision && { turnGlyphRevision }),
      visibility: {
        showTKA: visibility.showTKA ?? true,
        showTnD: visibility.showTnD ?? false,
        showElemental: visibility.showElemental ?? false,
        showPositions: visibility.showPositions ?? false,
        showReversals: visibility.showReversals ?? true,
        showNonRadialPoints: visibility.showNonRadialPoints ?? true,
        showGrid: visibility.showGrid ?? true,
        darkMode: visibility.darkMode ?? false,
        bluePropType: resolvedBlueProp,
        redPropType: resolvedRedProp,
        handPathMode: visibility.handPathMode ?? false,
        handPointVisibility: visibility.handPointVisibility ?? "all",
        printMode: visibility.printMode ?? false,
        showBlueMotion: visibility.showBlueMotion ?? true,
        showRedMotion: visibility.showRedMotion ?? true,
        ...(isBuugengFamilyProp(resolvedBlueProp) &&
          visibility.blueBuugengFlipped && { blueBuugengFlipped: true }),
        ...(isBuugengFamilyProp(resolvedRedProp) &&
          visibility.redBuugengFlipped && { redBuugengFlipped: true }),
      },
    };
  }

  private extractMotionKey(
    motion: MotionData | undefined,
    includeVisibility: boolean
  ): MotionKeyData | null {
    if (!motion) return null;

    const derivedGridMode = this.deriveGridModeFromLocations(
      motion.startLocation,
      motion.endLocation
    );

    return {
      // Keep fully-visible pictographs byte-identical to the lsp11 key corpus.
      // Once either hand is an invisible placeholder, both values enter the
      // lsp12 identity so visible and hidden versions cannot share a blob.
      ...(includeVisibility && { isVisible: motion.isVisible !== false }),
      motionType: motion.motionType ?? "",
      startLocation: motion.startLocation ?? "",
      endLocation: motion.endLocation ?? "",
      turns: motion.turns ?? 0,
      startOrientation: motion.startOrientation ?? "",
      endOrientation: motion.endOrientation ?? "",
      rotationDirection: motion.rotationDirection ?? "",
      propType: motion.propType ?? "staff",
      gridMode: derivedGridMode,
    };
  }

  private deriveGridModeFromLocations(
    startLocation: GridLocation | undefined,
    endLocation: GridLocation | undefined
  ): string {
    const intercardinalLocations: GridLocation[] = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    if (
      (startLocation && intercardinalLocations.includes(startLocation)) ||
      (endLocation && intercardinalLocations.includes(endLocation))
    ) {
      return GridMode.BOX;
    }

    return GridMode.DIAMOND;
  }

  private sortedReplacer = (_key: string, value: unknown): unknown => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce(
          (sorted, key) => {
            sorted[key] = (value as Record<string, unknown>)[key];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  };
}

export const pictographKeyHasher = new PictographKeyHasher();
