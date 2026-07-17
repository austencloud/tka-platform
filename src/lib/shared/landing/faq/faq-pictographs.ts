/**
 * Pictograph data for the landing FAQ's live demos.
 *
 * Same CSV-backed source as the rest of the app (letterQueryHandler), loaded
 * once per session. The read-test's correct answer is COMPUTED from the chosen
 * pictograph's own motion data (motions.blue.endLocation), never authored by
 * hand, so the quiz can't drift from the data it renders.
 *
 * Only imported by the FAQ demo components, which FaqInterview dynamic-imports
 * as the section scrolls near — nothing here lands in the landing page's
 * initial bundle.
 */
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

let allVariations: Promise<PictographData[]> | null = null;

function loadAll(): Promise<PictographData[]> {
  allVariations ??= letterQueryHandler
    .getAllPictographVariations(GridMode.DIAMOND)
    .catch(() => []);
  return allVariations;
}

const CARDINALS: GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
];

/**
 * Two vocabularies for the same points. The read-test buttons use plain
 * screen words a first-time visitor already owns (the grid renders north at
 * the top); the feedback then introduces the spinner term, so the test
 * teaches instead of assuming.
 */
export const SCREEN_WORDS: Partial<Record<GridLocation, string>> = {
  [GridLocation.NORTH]: "Top",
  [GridLocation.EAST]: "Right",
  [GridLocation.SOUTH]: "Bottom",
  [GridLocation.WEST]: "Left",
};

export const COMPASS_NAMES: Partial<Record<GridLocation, string>> = {
  [GridLocation.NORTH]: "north",
  [GridLocation.EAST]: "east",
  [GridLocation.SOUTH]: "south",
  [GridLocation.WEST]: "west",
};

function isCardinal(loc: GridLocation | undefined): loc is GridLocation {
  return !!loc && CARDINALS.includes(loc);
}

/**
 * The "what is TKA" demo beat: first A variation, for continuity with the
 * AABB sequence the How-It-Works section builds from; any lettered row as
 * fallback. Null when the CSV fails to load — callers hide the demo.
 */
export async function getIntroPictograph(): Promise<PictographData | null> {
  const all = await loadAll();
  return all.find((p) => String(p.letter) === "A") ?? all.find((p) => !!p.letter) ?? null;
}

export type ReadTestQuestion = {
  pictograph: PictographData;
  /** Blue hand's end location, straight from the data. */
  correct: GridLocation;
  /** Three cardinal choices including `correct`, in fixed compass order. */
  options: GridLocation[];
};

/**
 * Deterministic pick: the first variation whose blue hand travels between two
 * cardinal points, so the question always has a readable, unambiguous answer.
 * Distractors are the blue hand's START location (the classic wrong answer)
 * plus one other cardinal, kept in fixed N/E/S/W order so nothing shuffles.
 */
export async function getReadTestQuestion(): Promise<ReadTestQuestion | null> {
  const all = await loadAll();
  const intro = await getIntroPictograph();
  const travelsCardinals = (p: PictographData): boolean => {
    const blue = p.motions?.blue;
    return (
      !!p.letter &&
      isVisibleMotion(blue) &&
      isCardinal(blue.startLocation as GridLocation) &&
      isCardinal(blue.endLocation as GridLocation) &&
      blue.startLocation !== blue.endLocation
    );
  };
  // Prefer a DIFFERENT letter than the intro demo so the two proofs on the
  // page aren't the same picture twice; fall back to any qualifying row.
  const pictograph =
    all.find((p) => travelsCardinals(p) && String(p.letter) !== String(intro?.letter)) ??
    all.find(travelsCardinals);
  const blue = pictograph?.motions?.blue;
  if (!pictograph || !blue) return null;

  const correct = blue.endLocation as GridLocation;
  const start = blue.startLocation as GridLocation;
  const filler = CARDINALS.find((c) => c !== correct && c !== start);
  const chosen = new Set([correct, start, filler].filter(Boolean) as GridLocation[]);
  const options = CARDINALS.filter((c) => chosen.has(c));
  return { pictograph, correct, options };
}
