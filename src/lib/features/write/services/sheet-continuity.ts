/**
 * Sheet continuity — pure logic for stringing sequences into one routine.
 *
 * A choreo sheet reads top-to-bottom as a single performance, so each row's END
 * state (position + blue/red orientation) must equal the next row's START state.
 * Mirrors the comparators in
 * `create/spell/services/orientation-continuity-validator.ts` and
 * `3d/state/avatar-instance-state.svelte.ts`.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { shiftStartPosition } from "$lib/shared/create/services/sequence-transformer";

export interface EdgeState {
  // Opaque comparison keys — the exact domain types don't matter to this module,
  // only that a row's end tuple equals the next row's start tuple.
  position: StepData["startPosition"];
  blueOri: string | undefined;
  redOri: string | undefined;
}

/** The state a sequence begins in (step 0's start position + start orientations). */
export function startStateOf(seq: SequenceData): EdgeState | null {
  const first = seq.steps[0];
  if (!first) return null;
  return {
    position: first.startPosition,
    blueOri: first.motions?.[MotionColor.BLUE]?.startOrientation,
    redOri: first.motions?.[MotionColor.RED]?.startOrientation,
  };
}

/** The state a sequence ends in (last step's end position + end orientations). */
export function endStateOf(seq: SequenceData): EdgeState | null {
  const last = seq.steps[seq.steps.length - 1];
  if (!last) return null;
  return {
    position: last.endPosition,
    blueOri: last.motions?.[MotionColor.BLUE]?.endOrientation,
    redOri: last.motions?.[MotionColor.RED]?.endOrientation,
  };
}

export function statesMatch(a: EdgeState, b: EdgeState): boolean {
  return a.position === b.position && a.blueOri === b.blueOri && a.redOri === b.redOri;
}

/** Does row `prev` flow straight into row `next` — same position and orientations? */
export function connects(prev: SequenceData, next: SequenceData): boolean {
  const end = endStateOf(prev);
  const start = startStateOf(next);
  if (!end || !start) return false;
  return statesMatch(end, start);
}

/**
 * Best-effort transform `seq` so its start state matches `target`, using the
 * "first beat" rebase (any sequence that passes through a position can be
 * re-based to start there). Position-first; the caller uses `connects()` on the
 * result to decide if the boundary is truly clean.
 *
 * - Already aligned            → returned as-is.
 * - Circular + passes through  → shiftStartPosition to that beat.
 * - Otherwise                  → returned unchanged (boundary stays a break).
 *
 * Only circular sequences are rebased: on a non-circular sequence
 * `shiftStartPosition` truncates the preceding beats, which we never want here.
 */
export function normalizeToStart(seq: SequenceData, target: EdgeState): SequenceData {
  const start = startStateOf(seq);
  if (start && statesMatch(start, target)) return seq;
  if (!seq.isCircular) return seq;

  const beat = seq.steps.find((s) => s.startPosition === target.position);
  if (!beat) return seq;

  return shiftStartPosition(seq, beat.stepNumber);
}

export type LoopStatus = "empty" | "loops" | "open";

/** Does the whole sheet close — last row's end returns to the first row's start? */
export function loopStatus(rows: readonly SequenceData[]): LoopStatus {
  if (rows.length === 0) return "empty";
  const first = startStateOf(rows[0]!);
  const last = endStateOf(rows[rows.length - 1]!);
  if (!first || !last) return "open";
  return statesMatch(last, first) ? "loops" : "open";
}
