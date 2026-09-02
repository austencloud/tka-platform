import type { ResolvedDirectorHold } from "./film-director-schema";

/**
 * Where one performer's prop phrase sits when time stops for them.
 *
 * A hold is not a pause of the film. The shared clock keeps counting, the
 * camera keeps moving, and the rest of the cast keeps dancing; this one
 * performer's phrase freezes at `fromStep` for `steps` counts and then picks up
 * exactly where it froze. Everything after a hold therefore lags by its length,
 * and several holds accumulate.
 *
 * Blocking is deliberately untouched. A performer's staging is authored
 * geometry on the scene's own clock, so a performer who holds mid-walk keeps
 * walking with a frozen prop — which is the picture a director asking for this
 * is asking for.
 *
 * `totalSteps` is the performer's loaded sequence length, or 0 when the caller
 * does not know it. The film director does not: the sequence lives in the
 * viewer, whose `resolvePerformerStepSource` wraps whatever the host supplies.
 * So the film passes 0 and lets the viewer wrap, while a caller that does know
 * the length gets the wrap here.
 */
export interface HeldStep {
  /** Whole step of the performer's own phrase. */
  step: number;
  /** How far into that step, 0 to 1. Always 0 inside a hold. */
  progress: number;
}

export function resolveHeldStep(
  sharedStep: number,
  progress: number,
  beatOffset: number,
  holds: readonly ResolvedDirectorHold[],
  totalSteps: number
): HeldStep {
  if (
    !Number.isFinite(sharedStep) ||
    !Number.isFinite(progress) ||
    !Number.isFinite(beatOffset)
  ) {
    return { step: 0, progress: 0 };
  }

  const shared = sharedStep + progress + beatOffset;

  // Sorted and non-overlapping by the resolver, but sorting here too keeps
  // this function honest for a caller that builds holds some other way.
  const ordered = [...holds].sort((a, b) => a.fromStep - b.fromStep);

  let lag = 0;
  for (const hold of ordered) {
    // Where this hold's window sits on the SHARED clock: its own step plus
    // every earlier hold's length.
    const opens = hold.fromStep + lag;
    if (shared < opens) break;
    if (shared < opens + hold.steps) {
      return { step: wrap(hold.fromStep, totalSteps), progress: 0 };
    }
    lag += hold.steps;
  }

  const position = wrap(shared - lag, totalSteps);
  const step = Math.floor(position);
  return { step, progress: position - step };
}

function wrap(value: number, totalSteps: number): number {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) {
    return Math.max(0, value);
  }
  return ((value % totalSteps) + totalSteps) % totalSteps;
}
