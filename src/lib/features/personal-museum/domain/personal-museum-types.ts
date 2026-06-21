/**
 * Personal Museum domain types.
 *
 * A single Firestore doc per user holds explicit wall placements. Slots with
 * no explicit placement are auto-filled at render time from the user's
 * Favorites (derived, never persisted) — see resolveSlotSequence.
 */

/** Stable id of a wall exhibit slot in the personal room graph (the ExhibitSegment.refId). */
export type SlotId = string;

export interface PersonalMuseumPlacement {
  /** References users/{uid}/sequences/{id}. */
  sequenceId: string;
  /** Epoch ms when assigned (for display/sort; not load-bearing). */
  assignedAt: number;
}

export interface PersonalMuseumDoc {
  /** === uid. Present day one so public sharing is additive later. */
  ownerId: string;
  /** false in MVP; flips when "others visit" ships. */
  isPublic: boolean;
  /** Firestore serverTimestamp on write; number (epoch ms) after read-back. */
  updatedAt: number;
  /** slotId -> explicit placement. Absent slot => auto-fill. */
  placements: Record<SlotId, PersonalMuseumPlacement>;
}

/** Factory for a fresh, empty personal museum doc. */
export function emptyPersonalMuseumDoc(ownerId: string, now: number): PersonalMuseumDoc {
  return { ownerId, isPublic: false, updatedAt: now, placements: {} };
}
