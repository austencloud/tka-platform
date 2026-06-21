import type { PersonalMuseumPlacement, SlotId } from "./personal-museum-types";

/**
 * Resolve which sequence (if any) hangs in each wall slot.
 *
 * Rules:
 *  1. An explicit placement wins, but only if its sequence still exists.
 *  2. Slots without a (valid) explicit placement auto-fill from favorites,
 *     newest-first, in slot order.
 *  3. A sequence already placed explicitly is never also auto-filled.
 *  4. Anything left over is null (empty frame).
 *
 * Pure and deterministic — same inputs, same output.
 */
export function resolveSlotSequence(
  slotIds: SlotId[],
  placements: Record<SlotId, PersonalMuseumPlacement>,
  favoritesOrdered: string[],
  availableIds: ReadonlySet<string>,
): Record<SlotId, string | null> {
  const result: Record<SlotId, string | null> = {};
  const used = new Set<string>();
  const autoFillSlots: SlotId[] = [];

  // Pass 1: honor valid explicit placements.
  for (const slot of slotIds) {
    const placed = placements[slot];
    if (placed && availableIds.has(placed.sequenceId)) {
      result[slot] = placed.sequenceId;
      used.add(placed.sequenceId);
    } else {
      autoFillSlots.push(slot);
    }
  }

  // Pass 2: auto-fill remaining slots from favorites, skipping already-used.
  const queue = favoritesOrdered.filter((id) => availableIds.has(id) && !used.has(id));
  let qi = 0;
  for (const slot of autoFillSlots) {
    result[slot] = qi < queue.length ? queue[qi++] : null;
  }

  return result;
}
