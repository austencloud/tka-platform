/**
 * The finite set of arm movements that Level 1 can ask for.
 *
 * This is what makes the labeling effort bounded rather than endless. Level 1
 * holds no turns and no non-radial orientations, so once every distinct per-hand
 * movement in it has been described, that world is mapped and the next one can
 * start. The tool can only say "you are 62% of the way through Level 1" because
 * this module can say what the whole of Level 1 is.
 *
 * Nothing here is written down by hand. The movements come from the pictograph
 * dataframe that the app already renders from, and every end orientation is
 * computed by the same calculator the sequence engine uses. A hardcoded table
 * would drift the moment either changed, and would be a claim about the domain
 * rather than a reading of it.
 *
 * Level 1 is defined by `sequence-difficulty-calculator.ts`: a sequence is
 * Level 1 when no motion carries turns and no orientation is CLOCK or COUNTER.
 * Applied to a single motion, that means turns of zero and radial orientations
 * at both ends.
 */

import { csvLoader } from "$lib/shared/foundation/services/data/csv-loader";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/render/core/calculations/orientation";
import {
  signatureKey,
  type HandMotionSignature,
} from "./movement-annotation";

/** The orientations Level 1 is allowed to use. */
export const LEVEL_ONE_ORIENTATIONS: readonly string[] = [
  Orientation.IN,
  Orientation.OUT,
];

export function isLevelOneOrientation(orientation: string): boolean {
  return LEVEL_ONE_ORIENTATIONS.includes(orientation);
}

/** One movement in the space, with the letters that can ask for it. */
export interface LevelOneMovement {
  readonly key: string;
  readonly signature: HandMotionSignature;
  /** Letters whose pictographs contain this movement, for orientation. */
  readonly letters: readonly string[];
}

export interface LevelOneSpace {
  readonly movements: readonly LevelOneMovement[];
  readonly byKey: ReadonlyMap<string, LevelOneMovement>;
  /** Which grid modes were read to build this. */
  readonly gridModes: readonly GridMode[];
}

interface DataframeRow {
  readonly letter: string;
  readonly blue: HandColumns;
  readonly red: HandColumns;
}

interface HandColumns {
  readonly motionType: string;
  readonly rotationDirection: string;
  readonly startLocation: string;
  readonly endLocation: string;
}

function parseDataframe(csv: string): DataframeRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0]!.split(",").map((h) => h.trim());
  const index = (name: string) => header.indexOf(name);

  const columns = {
    letter: index("letter"),
    blueMotionType: index("blueMotionType"),
    blueRotationDirection: index("blueRotationDirection"),
    blueStartLocation: index("blueStartLocation"),
    blueEndLocation: index("blueEndLocation"),
    redMotionType: index("redMotionType"),
    redRotationDirection: index("redRotationDirection"),
    redStartLocation: index("redStartLocation"),
    redEndLocation: index("redEndLocation"),
  };

  if (Object.values(columns).some((i) => i < 0)) return [];

  const rows: DataframeRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",");
    if (cells.length < header.length) continue;
    const at = (position: number) => (cells[position] ?? "").trim();

    rows.push({
      letter: at(columns.letter),
      blue: {
        motionType: at(columns.blueMotionType),
        rotationDirection: at(columns.blueRotationDirection),
        startLocation: at(columns.blueStartLocation),
        endLocation: at(columns.blueEndLocation),
      },
      red: {
        motionType: at(columns.redMotionType),
        rotationDirection: at(columns.redRotationDirection),
        startLocation: at(columns.redStartLocation),
        endLocation: at(columns.redEndLocation),
      },
    });
  }
  return rows;
}

/**
 * Expands one dataframe movement into every Level 1 signature it can carry.
 *
 * The dataframe records where a hand goes but not which way the prop points, so
 * each movement appears once per legal starting orientation. A combination whose
 * computed end orientation leaves the radial pair is not Level 1 and is dropped
 * rather than recorded, which is how a Level 3 shape stays out of a Level 1
 * coverage count.
 */
function signaturesForMovement(
  hand: HandColumns
): HandMotionSignature[] {
  const signatures: HandMotionSignature[] = [];

  for (const startOrientation of LEVEL_ONE_ORIENTATIONS) {
    let endOrientation: string;
    try {
      endOrientation = calculateEndOrientation({
        motionType: hand.motionType,
        turns: 0,
        rotationDirection: hand.rotationDirection,
        startLocation: hand.startLocation,
        endLocation: hand.endLocation,
        startOrientation,
      }) as unknown as string;
    } catch {
      // A movement the calculator cannot resolve is not a movement anyone can
      // perform, so it does not belong in a map of what a body has to do.
      continue;
    }

    if (!isLevelOneOrientation(endOrientation)) continue;

    signatures.push({
      motionType: hand.motionType,
      rotationDirection: hand.rotationDirection,
      startLocation: hand.startLocation,
      endLocation: hand.endLocation,
      startOrientation,
      endOrientation,
    });
  }

  return signatures;
}

export function buildLevelOneSpaceFromCsv(
  sources: readonly { gridMode: GridMode; csv: string }[]
): LevelOneSpace {
  const byKey = new Map<string, LevelOneMovement>();
  const lettersByKey = new Map<string, Set<string>>();

  for (const source of sources) {
    for (const row of parseDataframe(source.csv)) {
      for (const hand of [row.blue, row.red]) {
        for (const signature of signaturesForMovement(hand)) {
          const key = signatureKey(signature);
          if (!byKey.has(key)) {
            byKey.set(key, { key, signature, letters: [] });
            lettersByKey.set(key, new Set());
          }
          if (row.letter) lettersByKey.get(key)!.add(row.letter);
        }
      }
    }
  }

  const movements = [...byKey.values()]
    .map((movement) => ({
      ...movement,
      letters: [...(lettersByKey.get(movement.key) ?? [])].sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    movements,
    byKey: new Map(movements.map((m) => [m.key, m])),
    gridModes: sources.map((s) => s.gridMode),
  };
}

/**
 * Loads the dataframes and builds the space. Diamond and Box are both included
 * because a body performing a Box sequence has the same arms as one performing
 * a Diamond sequence, and the map is of arms.
 */
export async function loadLevelOneSpace(
  gridModes: readonly GridMode[] = [GridMode.DIAMOND, GridMode.BOX]
): Promise<LevelOneSpace> {
  const sources: { gridMode: GridMode; csv: string }[] = [];

  for (const gridMode of gridModes) {
    const result = await csvLoader.loadCSVForGridMode(gridMode);
    if (result.success && result.data) {
      sources.push({ gridMode, csv: result.data });
    }
  }

  return buildLevelOneSpaceFromCsv(sources);
}
