/**
 * Who occupies the population's render slots this pass.
 *
 * The walking layer mounts a bounded number of avatars and hands them the
 * nearest people. Re-ranking by distance every second and handing a slot to
 * whoever is nearest now is what made bodies swap identity and place in one
 * frame: a walker heading east became a different walker heading west. So a
 * held person keeps their slot until they are genuinely gone, free slots fill
 * nearest-first, and a swap happens one at a time and only when the waiting
 * person is closer by a clear margin.
 *
 * Pure: distances in, the next slot occupancy out.
 */

/** A held person keeps their slot this far beyond the cull radius. */
export const FLOW_FEST_SLOT_RELEASE_MARGIN_METERS = 8;
/** A waiting person takes a held slot only when closer by this much. */
export const FLOW_FEST_SLOT_SWAP_MARGIN_METERS = 12;

/**
 * @param held Agent index per slot, or -1 for an empty slot.
 * @param distances Metres from the eye per agent; Infinity means ineligible.
 * @param limit How many slots the current budget allows.
 * @param cullMeters Beyond this a waiting person is never mounted.
 * @returns The next agent index per slot, same length as `held`.
 */
export function assignFlowFestPopulationSlots(
  held: ReadonlyArray<number>,
  distances: ReadonlyArray<number>,
  limit: number,
  cullMeters: number
): number[] {
  const next = [...held];
  const capacity = Math.max(0, Math.min(limit, next.length));
  const releaseBeyond = cullMeters + FLOW_FEST_SLOT_RELEASE_MARGIN_METERS;

  const distanceOf = (agentIndex: number): number =>
    distances[agentIndex] ?? Number.POSITIVE_INFINITY;

  // 1. Release whoever is gone: ineligible, or well past the cull radius.
  for (let slot = 0; slot < next.length; slot += 1) {
    const agentIndex = next[slot]!;
    if (agentIndex < 0) continue;
    if (!(distanceOf(agentIndex) <= releaseBeyond)) next[slot] = -1;
  }

  // 2. A smaller budget releases the farthest held people first.
  const farthestHeldSlot = (): number => {
    let worst = -1;
    let worstDistance = Number.NEGATIVE_INFINITY;
    for (let slot = 0; slot < next.length; slot += 1) {
      const agentIndex = next[slot]!;
      if (agentIndex < 0) continue;
      const distance = distanceOf(agentIndex);
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = slot;
      }
    }
    return worst;
  };
  let heldCount = next.filter((agentIndex) => agentIndex >= 0).length;
  while (heldCount > capacity) {
    next[farthestHeldSlot()] = -1;
    heldCount -= 1;
  }

  // 3. Everyone eligible and not held, nearest first.
  const heldSet = new Set(next.filter((agentIndex) => agentIndex >= 0));
  const waiting: number[] = [];
  for (let agentIndex = 0; agentIndex < distances.length; agentIndex += 1) {
    if (heldSet.has(agentIndex)) continue;
    if (!(distanceOf(agentIndex) <= cullMeters)) continue;
    waiting.push(agentIndex);
  }
  waiting.sort(
    (first, second) => distanceOf(first) - distanceOf(second) || first - second
  );

  // 4. Fill free slots nearest-first.
  let cursor = 0;
  for (let slot = 0; slot < next.length && heldCount < capacity; slot += 1) {
    if (next[slot]! >= 0) continue;
    const agentIndex = waiting[cursor];
    if (agentIndex === undefined) break;
    cursor += 1;
    next[slot] = agentIndex;
    heldCount += 1;
  }

  // 5. Full house: one swap, and only for a clear win.
  const nearestWaiting = waiting[cursor];
  if (nearestWaiting !== undefined && heldCount >= capacity && capacity > 0) {
    const slot = farthestHeldSlot();
    if (
      slot >= 0 &&
      distanceOf(nearestWaiting) + FLOW_FEST_SLOT_SWAP_MARGIN_METERS <
        distanceOf(next[slot]!)
    ) {
      next[slot] = nearestWaiting;
    }
  }

  return next;
}
