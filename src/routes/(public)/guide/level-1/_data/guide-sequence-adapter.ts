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
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/** A box is the start pose when it has no beat number (0 or null/undefined). */
const isStartBox = (b: StepData): boolean =>
  b.stepNumber === 0 || b.stepNumber === null || b.stepNumber === undefined;

/**
 * Force a linear path archetype on every HAND motion of a box (clones — never
 * mutates the page's source StepData). The Level 1 guide teaches the grid points
 * themselves, so a companion animation should trace a straight point-to-point
 * hand path; a curved shift arc reads as extra information the lesson hasn't
 * introduced yet. This is the one seam every page's example strip flows through,
 * so hardcoding it here keeps all guide HAND animations linear (matching the
 * baked demos in guide-motion-configs.ts). resolvePathType honours a per-motion
 * pathShape above any motion-aware/global/user path-shape setting.
 *
 * STAFF motions keep their natural arc: the staff pages teach rotation (a base
 * isolation keeps one end pinned at the grid center), and a straight-line hand
 * path would detach that end mid-sweep.
 */
function withLinearPaths<T extends Record<string, unknown>>(box: T): T {
  const motions = box.motions as Record<string, MotionData | undefined> | undefined;
  if (!motions) return box;
  const linear: Record<string, MotionData | undefined> = {};
  for (const [color, m] of Object.entries(motions)) {
    linear[color] =
      m && m.propType === PropType.HAND ? { ...m, pathShape: "linear" as const } : m;
  }
  return { ...box, motions: linear };
}

export function stripToSequence(
  strip: StepData[],
  opts: { word?: string; name?: string } = {}
): SequenceData {
  const startBox = strip.find(isStartBox);
  const stepBoxes = strip.filter((b) => !isStartBox(b));

  const steps = stepBoxes.map((b, i) =>
    withLinearPaths({ ...b, stepNumber: i + 1 })
  ) as unknown as StepData[];

  const startPosition = startBox
    ? (withLinearPaths({
        ...(startBox as object),
        isStartPosition: true,
        id: startBox.id ?? "start",
      }) as unknown as StartPositionData)
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
