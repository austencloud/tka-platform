/**
 * Guide sequence adapter — turns a page's sequence strip (a flat StepData[]) into
 * a playable SequenceData for the reader's animation companion.
 *
 * A strip's first box is the start pose (stepNumber 0 or null); the rest are
 * steps. The animation engine wants a StartPositionData (PictographData +
 * isStartPosition) plus 1-based `steps`. The page's StepData already carry
 * motions, so the engine plays this directly (ensureMotionData short-circuits).
 */
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/** A box is the start pose when it has no beat number (0 or null/undefined). */
const isStartBox = (b: StepData): boolean =>
  b.stepNumber === 0 || b.stepNumber === null || b.stepNumber === undefined;

export function stripToSequence(
  strip: StepData[],
  opts: { word?: string; name?: string } = {}
): SequenceData {
  const startBox = strip.find(isStartBox);
  const stepBoxes = strip.filter((b) => !isStartBox(b));

  const steps = stepBoxes.map((b, i) => ({ ...b, stepNumber: i + 1 })) as unknown as StepData[];

  const startPosition = startBox
    ? ({
        ...(startBox as object),
        isStartPosition: true,
        id: startBox.id ?? "start",
      } as unknown as StartPositionData)
    : undefined;

  const gridMode = (strip[0]?.gridMode as GridMode | undefined) ?? GridMode.DIAMOND;

  return createSequenceData({
    steps,
    ...(startPosition ? { startPosition } : {}),
    gridMode,
    word: opts.word ?? "",
    name: opts.name ?? opts.word ?? "guide-sequence",
  });
}
