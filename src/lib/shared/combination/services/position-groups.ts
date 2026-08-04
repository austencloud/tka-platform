import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
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
  const group = match[1];
  return GROUPS.has(group) ? (group as GridPositionGroup) : null;
}

/** The seam a step starts at, or null when the step carries no position.
 * Always use this instead of casting step.startPosition. */
export function seamOf(step: StepData): SeamState | null {
  return (step.startPosition as SeamState) ?? null;
}

/** The seam a step ends at, or null. */
export function seamEndOf(step: StepData): SeamState | null {
  return (step.endPosition as SeamState) ?? null;
}
