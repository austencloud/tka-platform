/**
 * Regeneration glide support.
 *
 * The workbench grid keys its cells by stable step identity, so replacing a
 * sequence remounts every cell under brand-new identities — and the prop/arrow
 * position caches (keyed `${identity}-${color}`) come up empty, which makes the
 * incoming pictographs snap into place. Fuse's Regenerate glides because its
 * grid keys by index: the caches carry each slot's previous coordinates across
 * the swap and the props slide to their new homes.
 *
 * This helper gives the identity-keyed grid the same continuity: before the new
 * sequence lands, each grid slot's cached positions are re-filed under the
 * incoming step's identity. The remounted PropSvg/ArrowSvg then find a "previous"
 * position for their slot and animate from it.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { getPropPositionCache } from "$lib/shared/pictograph/prop/prop-position-cache";
import { getArrowPositionCache } from "$lib/shared/pictograph/arrow/rendering/arrow-position-cache";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStableStepIdentities } from "./history-transition-planner";

const COLORS = [MotionColor.BLUE, MotionColor.RED] as const;

/**
 * Re-file cached prop/arrow positions from the outgoing cell identities to the
 * incoming ones, slot by slot. Identities are whatever the host grid passes as
 * `transitionKey` — pass the same values the cells actually render with. Slots
 * beyond the shorter list keep their default mount behavior (appear in place,
 * no glide).
 */
export function retargetPositionCacheIdentities(
  previousIdentities: readonly string[],
  nextIdentities: readonly string[]
): void {
  const propCache = getPropPositionCache();
  const arrowCache = getArrowPositionCache();

  const sharedSlots = Math.min(previousIdentities.length, nextIdentities.length);
  for (let slot = 0; slot < sharedSlots; slot++) {
    const from = previousIdentities[slot]!;
    const to = nextIdentities[slot]!;
    if (from === to) continue;

    for (const color of COLORS) {
      const fromKey = `${from}-${color}`;
      const toKey = `${to}-${color}`;

      const prop = propCache.get(fromKey);
      if (prop) {
        propCache.set(toKey, prop);
        propCache.delete(fromKey);
      }

      const arrow = arrowCache.get(fromKey);
      if (arrow) {
        arrowCache.set(toKey, arrow);
        arrowCache.delete(fromKey);
      }
    }
  }
}

/**
 * The StepGrid flavor: the workbench keys its cells with
 * {@link createStableStepIdentities}, so the cache identities are derived from
 * the step lists themselves.
 */
export function retargetStepPositionCaches(
  previousSteps: readonly StepData[],
  nextSteps: readonly StepData[]
): void {
  retargetPositionCacheIdentities(
    createStableStepIdentities(previousSteps),
    createStableStepIdentities(nextSteps)
  );
}
