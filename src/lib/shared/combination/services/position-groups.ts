import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SeamState } from "../domain/types";

const GROUPS = new Set<string>(Object.values(GridPositionGroup));

/**
 * "beta5" → "beta". Null when the prefix is not a known family.
 *
 * At least 4 partial position→group implementations already exist in this
 * codebase — `foundation/domain/models/generation/circular-position-maps.ts`
 * `getPositionGroup` (throws on zeta/eta/tau/terra), plus copies in
 * `create/generate/circular` constants, choreo-card `card-back-data.ts`, and
 * the landing `endless-spinner-orchestrator.ts`. This util supersedes them
 * for combination-engine use (handles the full GridPositionGroup set, never
 * throws). Consolidating the existing call sites onto this one is deferred
 * deliberately — not in scope here.
 */
export function positionGroup(position: string): GridPositionGroup | null {
  const match = /^([a-z]+)\d+$/.exec(position);
  if (!match) return null;
  const group = match[1] ?? "";
  return GROUPS.has(group) ? (group as GridPositionGroup) : null;
}

/** The seam a step starts at, or null when the step carries no position.
 * Always use this instead of casting step.startPosition. */
export function seamOf(step: StepData): SeamState | null {
  return step.startPosition ?? null;
}

/** The seam a step ends at, or null. */
export function seamEndOf(step: StepData): SeamState | null {
  return step.endPosition ?? null;
}

/**
 * Does a step's own motion locations actually produce the positions it is
 * labelled with?
 *
 * `startPosition`/`endPosition` are DERIVED data — `getGridPositionFromLocations`
 * of the two hands — and the whole walk is stitched on those labels alone. A
 * mislabelled `endPosition` is therefore the worst thing a provider can hand
 * over: the seam graph joins two steps whose props are nowhere near each other,
 * and the result passes every downstream check (it closes, it letters, it
 * hashes) while being physically unperformable. Teleporting props, silently.
 *
 * So both labels are re-derived here and compared. The deriver throws on a
 * location pair that names no position at all, which is the same failure and is
 * treated the same way.
 *
 * It lives HERE, next to `seamOf`/`seamEndOf`, rather than inside the search:
 * it is the same "read a step's seams safely" concern, and BOTH the engine (as
 * its hard gate on provider material) and `runtime-ambient-provider` (which
 * counts what it rejects so a silent drop stays observable) must apply the
 * identical predicate. Two copies of it could drift into an engine that
 * discards exactly what the provider swore it had filtered.
 *
 * Verified against the shipped dataframes in `facade.test.ts`: 1,152 rows
 * (576 diamond + 576 box), zero disagreements.
 */
export function positionLabelsMatchLocations(step: StepData): boolean {
  const blue = step.motions[MotionColor.BLUE];
  const red = step.motions[MotionColor.RED];
  if (!blue || !red) return false;

  try {
    return (
      getGridPositionFromLocations(blue.startLocation, red.startLocation) ===
        step.startPosition &&
      getGridPositionFromLocations(blue.endLocation, red.endLocation) ===
        step.endPosition
    );
  } catch {
    return false;
  }
}
