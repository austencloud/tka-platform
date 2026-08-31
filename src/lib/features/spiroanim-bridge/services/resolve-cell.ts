/**
 * cellKey → hydrated SequenceData.
 *
 * SpiroAnim's transcription records what each cell DOES — letter, start and end
 * position, per-hand turns — but not the motions themselves. Those live in
 * TKA's own pictograph dataframes, so the resolver recovers each step by
 * looking up `(letter, startPosition, endPosition)` there and then hands the
 * result to the canonical owners: `applyPendingTurnsToOption` for turns,
 * `propagateOrientationsForColor` for the orientation chain, and
 * `hydrateSequence` for letters, positions, word, LOOP, placement and grid
 * mode. Nothing the hydrator owns is derived here.
 *
 * ## Choosing the row
 *
 * `(letter, startPosition, endPosition)` addresses exactly one dataframe row
 * for every step in this corpus except the six one-pro-one-anti letters
 * (C, F, I, L, O, R), where two rows differ only in which hand carries the anti
 * motion. Every one of those pairs is a pure blue↔red swap — verified across
 * all 96 ambiguous keys — so the choice is a hand-role assignment, not a
 * different pictograph.
 *
 * It is resolved by rotation-direction constancy: within one cell a hand keeps
 * a single rotation direction from first step to last. That holds for all 144
 * hand-cells of `eightstep-72-base.json`, SpiroAnim's own compiled geometry, and
 * it settles all 1,200 transcription cells that contain at least one
 * unambiguous step — with zero conflicts and no residual ambiguity.
 *
 * The other 384 cells (words IIII, CCCC, LFLF, FLFL, RORO, OROR) have no
 * unambiguous step to anchor on. Both readings there are the same animation
 * with the two props' colors exchanged, and the transcription does not record
 * which prop is which, so the resolver takes the reading whose blue hand turns
 * clockwise. Deterministic, and honest about what the source data does not say.
 */

import { formatCellKey, parseCellKey } from "../domain/cell-key";
import {
  effectiveOrientation,
  rotatePositionName,
  rotationStepsFor,
} from "../domain/orientation-rotation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
import { applyPendingTurnsToOption } from "$lib/shared/create/services/apply-turns-to-motion";
import { propagateOrientationsForColor } from "$lib/shared/create/services/orientation-propagation";
import { convertToStep } from "$lib/features/create/generate/shared/services/step-converter";
import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";

/** One step as SpiroAnim transcribed it. */
export interface TranscriptionStep {
  letter: string;
  startPosition: string;
  endPosition: string;
  swapped: boolean;
  blueTurns: number;
  redTurns: number;
}

/** One cell of SpiroAnim's VTG / QTR / 8-Step catalogues. */
export interface TranscriptionEntry {
  concept: string;
  reference: string;
  speedRatio?: string;
  isAnti?: boolean;
  shape: string;
  word: string;
  steps: TranscriptionStep[];
  /** qtr only — his quarter-spacing builder's `quarters` option (1 or 2). */
  quarters?: number;
  /** 8stp only — his eight-step builder's `reversePlane` option. */
  reversePlane?: boolean;
}

export interface ResolvedCell {
  sequence: SequenceData;
  /** Powers the route's provenance line; never shown to the sequence viewer. */
  entry: TranscriptionEntry;
}

interface IndexedRow {
  pictograph: PictographData;
  gridMode: GridMode;
}

let rowIndexPromise: Promise<Map<string, IndexedRow[]>> | null = null;

/**
 * Diamond and Box in one index, keyed by `(letter, startPosition, endPosition)`.
 *
 * A cell's declared shape is SpiroAnim's word for its own grid, not a promise
 * about which dataframe holds the pictograph: 144 cells labelled `box` resolve
 * wholly against the Diamond frame. No cell draws from both frames, so the
 * frame the rows come from IS the sequence's grid mode.
 */
async function getRowIndex(): Promise<Map<string, IndexedRow[]>> {
  rowIndexPromise ??= (async () => {
    const index = new Map<string, IndexedRow[]>();
    for (const gridMode of [GridMode.DIAMOND, GridMode.BOX]) {
      const variations =
        await letterQueryHandler.getAllPictographVariations(gridMode);
      for (const pictograph of variations) {
        if (!pictograph.letter || !pictograph.startPosition || !pictograph.endPosition)
          continue;
        const key = rowKey(
          String(pictograph.letter),
          String(pictograph.startPosition),
          String(pictograph.endPosition)
        );
        const bucket = index.get(key);
        if (bucket) bucket.push({ pictograph, gridMode });
        else index.set(key, [{ pictograph, gridMode }]);
      }
    }
    return index;
  })();
  return rowIndexPromise;
}

function rowKey(letter: string, startPosition: string, endPosition: string): string {
  return `${letter}|${startPosition}|${endPosition}`;
}

function rotationOf(row: IndexedRow, color: MotionColor): RotationDirection | null {
  return row.pictograph.motions?.[color]?.rotationDirection ?? null;
}

/**
 * Pick one dataframe row per step. Returns null if any step has no row at all —
 * a missing pictograph is a data problem, and inventing one would be worse than
 * the route's honest "no bridge entry" card.
 */
function chooseRows(
  entry: TranscriptionEntry,
  index: Map<string, IndexedRow[]>
): IndexedRow[] | null {
  const candidates = entry.steps.map((step) =>
    index.get(rowKey(step.letter, step.startPosition, step.endPosition))
  );
  if (candidates.some((bucket) => !bucket || bucket.length === 0)) return null;
  const buckets = candidates as IndexedRow[][];

  const anchor = buckets.find((bucket) => bucket.length === 1)?.[0];
  const blueDirection = anchor
    ? rotationOf(anchor, MotionColor.BLUE)
    : RotationDirection.CLOCKWISE;
  const redDirection = anchor ? rotationOf(anchor, MotionColor.RED) : null;

  return buckets.map((bucket) => {
    if (bucket.length === 1) return bucket[0]!;
    const matching = bucket.filter(
      (row) =>
        rotationOf(row, MotionColor.BLUE) === blueDirection &&
        (redDirection === null || rotationOf(row, MotionColor.RED) === redDirection)
    );
    // One match is the shipped case for all 8,640 steps of the corpus. The
    // fallback keeps a future cell resolvable rather than throwing; it is
    // deterministic, and the resolver sweep would catch it going wrong.
    return matching.length === 1 ? matching[0]! : bucket[0]!;
  });
}

function buildSteps(entry: TranscriptionEntry, rows: IndexedRow[]): StepData[] {
  const steps = rows.map((row, i) => {
    const transcribed = entry.steps[i]!;
    const blue = row.pictograph.motions?.[MotionColor.BLUE];
    const red = row.pictograph.motions?.[MotionColor.RED];
    // Every motion in this corpus is a shift (pro or anti), which carries its
    // own rotation direction; the explicit directions only matter to dash and
    // static hands, which never appear here.
    const withTurns = applyPendingTurnsToOption(
      row.pictograph,
      transcribed.blueTurns,
      transcribed.redTurns,
      blue?.rotationDirection ?? RotationDirection.CLOCKWISE,
      red?.rotationDirection ?? RotationDirection.CLOCKWISE
    );
    // The letter is cleared on purpose: the hydrator re-derives it from the
    // motions, so a wrong row shows up as a wrong word instead of being masked
    // by the letter we copied in.
    return { ...convertToStep(withTurns, i + 1, row.gridMode), letter: null };
  });

  const withBlue = propagateOrientationsForColor(
    steps,
    MotionColor.BLUE,
    Orientation.IN
  );
  return propagateOrientationsForColor(withBlue, MotionColor.RED, Orientation.IN);
}

function matchesKey(
  entry: TranscriptionEntry,
  key: ReturnType<typeof parseCellKey>
): boolean {
  if (!key) return false;
  return (
    formatCellKey({
      concept: entry.concept as "vtg" | "qtr" | "8stp",
      reference: entry.reference,
      speedRatio: entry.speedRatio ?? "1:1",
      shape: entry.shape,
      isAnti: entry.isAnti === true,
    }) === formatCellKey(key)
  );
}

/**
 * The reading the five-field key addresses.
 *
 * The transcription carries two axes the key does not: `quarters` (qtr) and
 * `reversePlane` (8stp). SpiroAnim's own link builder emits the canonical
 * reading of each cell — `quarters: 1`, `reversePlane: false` — and that is the
 * one `cell-catalogue.json` records, so the bridge addresses it too.
 */
function isCanonicalReading(entry: TranscriptionEntry): boolean {
  if (entry.quarters !== undefined && entry.quarters !== 1) return false;
  if (entry.reversePlane !== undefined && entry.reversePlane !== false) return false;
  return true;
}

/**
 * The transcription was captured at pattern orientation -90, and the key
 * requests some other view — 0 (SpiroAnim's default) when it carries no `o`
 * token. Rotate every step's positions clockwise before the dataframe lookup
 * so the resolved pictographs show what SpiroAnim actually renders. Turns are
 * per-hand scalars and survive rotation unchanged. Null when any position
 * cannot be rotated — unresolvable, never a guess.
 */
function withRequestedOrientation(
  entry: TranscriptionEntry,
  clockwiseSteps: number
): TranscriptionEntry | null {
  if (clockwiseSteps === 0) return entry;
  const rotated: TranscriptionStep[] = [];
  for (const step of entry.steps) {
    const startPosition = rotatePositionName(step.startPosition, clockwiseSteps);
    const endPosition = rotatePositionName(step.endPosition, clockwiseSteps);
    if (!startPosition || !endPosition) return null;
    rotated.push({ ...step, startPosition, endPosition });
  }
  return { ...entry, steps: rotated };
}

/**
 * Resolve a cellKey against the transcription. Returns null — never throws and
 * never guesses — for a malformed key, an unknown cell, or a cell whose steps
 * have no pictograph.
 *
 * The transcription is passed in rather than imported: it is 1,584 entries, and
 * a static import would put all of it in the app's main chunk. The route
 * dynamic-imports it.
 */
export async function resolveCell(
  key: string,
  transcription: readonly TranscriptionEntry[]
): Promise<ResolvedCell | null> {
  const parsed = parseCellKey(key);
  if (!parsed) return null;

  const entry = transcription.find(
    (candidate) => isCanonicalReading(candidate) && matchesKey(candidate, parsed)
  );
  if (!entry) return null;

  const oriented = withRequestedOrientation(entry, rotationStepsFor(parsed));
  if (!oriented) return null;

  const index = await getRowIndex();
  const rows = chooseRows(oriented, index);
  if (!rows || rows.length === 0) return null;

  const built = createSequenceData({
    // `word` stays the full expanded string the hydrator derives; `name` is the
    // display/save field, so it carries the smallest form of a repeating word
    // (every cell in this catalogue repeats by construction).
    name: simplifyRepeatedWord(entry.word),
    steps: buildSteps(oriented, rows),
    gridMode: rows[0]!.gridMode,
    metadata: {
      source: "spiroanim-bridge",
      cellKey: formatCellKey(parsed),
      concept: entry.concept,
      reference: entry.reference,
      ...(parsed.concept === "8stp"
        ? {}
        : { spiroanimOrientation: effectiveOrientation(parsed) }),
      attribution:
        "Concept catalogues and generated geometry by Ryan Girard (spiroanim)",
    },
  });

  const sequence = await hydrateSequence(built, { loopDetector });
  return { sequence, entry };
}
