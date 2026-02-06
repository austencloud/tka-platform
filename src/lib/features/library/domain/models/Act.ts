/**
 * Act - Ordered playlist of sequences for performance/practice
 *
 * Acts allow users to combine multiple sequences into a choreographed
 * routine with configurable ordering, transitions, and playback settings.
 *
 * Stored at: users/{userId}/library/acts/{actId}
 */

/**
 * Transition type between sequences in an act
 */
export type ActTransitionType = "immediate" | "fade" | "pause";

/**
 * A single item in an act (sequence with playback configuration)
 */
export interface ActItem {
  /** Sequence ID reference */
  readonly sequenceId: string;

  /** Position in the act (0-indexed) */
  readonly position: number;

  /** How many times to repeat this sequence (default: 1) */
  readonly repeatCount: number;

  /** Transition type to the next item */
  readonly transitionType: ActTransitionType;

  /** Pause duration before next item (ms), only used when transitionType is "pause" */
  readonly pauseDuration?: number;

  /** Per-item notes (e.g., "start slow", "crowd interaction") */
  readonly notes?: string;
}

/**
 * Act - A sequence playlist for performance
 */
export interface Act {
  /** Unique act ID */
  readonly id: string;

  /** Act name */
  readonly name: string;

  /** Optional description */
  readonly description?: string;

  /** Owner user ID */
  readonly ownerId: string;

  /** Ordered list of act items */
  readonly items: readonly ActItem[];

  /** Total sequence count (convenience, same as items.length) */
  readonly sequenceCount: number;

  /** Estimated total duration in seconds (calculated from sequences) */
  readonly estimatedDuration?: number;

  /** Cover image URL */
  readonly coverImageUrl?: string;

  /** Whether this act is visible to others */
  readonly isPublic: boolean;

  /** Default playback speed multiplier (1.0 = normal) */
  readonly defaultPlaybackSpeed: number;

  /** Whether to loop the entire act after finishing */
  readonly loopAct: boolean;

  /** When created */
  readonly createdAt: Date;

  /** When last modified */
  readonly updatedAt: Date;

  /** When last performed/practiced */
  readonly lastPerformedAt?: Date;
}

/**
 * Options for creating a new act
 */
export interface CreateActOptions {
  description?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  defaultPlaybackSpeed?: number;
  loopAct?: boolean;
}

/**
 * Create a new act
 */
export function createAct(
  name: string,
  ownerId: string,
  options: CreateActOptions = {}
): Omit<Act, "id"> {
  const now = new Date();

  return {
    name,
    ownerId,
    description: options.description,
    items: [],
    sequenceCount: 0,
    coverImageUrl: options.coverImageUrl,
    isPublic: options.isPublic ?? false,
    defaultPlaybackSpeed: options.defaultPlaybackSpeed ?? 1.0,
    loopAct: options.loopAct ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create an act item with defaults
 */
export function createActItem(
  sequenceId: string,
  position: number,
  options: Partial<Omit<ActItem, "sequenceId" | "position">> = {}
): ActItem {
  return {
    sequenceId,
    position,
    repeatCount: options.repeatCount ?? 1,
    transitionType: options.transitionType ?? "immediate",
    pauseDuration: options.pauseDuration,
    notes: options.notes,
  };
}

/**
 * Update an act immutably
 */
export function updateAct(act: Act, updates: Partial<Act>): Act {
  return {
    ...act,
    ...updates,
    updatedAt: new Date(),
  };
}

/**
 * Add a sequence to an act at the end or at a specific position
 */
export function addSequenceToAct(
  act: Act,
  sequenceId: string,
  position?: number
): Act {
  const insertPosition = position ?? act.items.length;
  const newItem = createActItem(sequenceId, insertPosition);

  // Reindex items after insertion point
  const reindexedItems = act.items.map((item) =>
    item.position >= insertPosition
      ? { ...item, position: item.position + 1 }
      : item
  );

  const newItems = [
    ...reindexedItems.slice(0, insertPosition),
    newItem,
    ...reindexedItems.slice(insertPosition),
  ];

  return updateAct(act, {
    items: newItems,
    sequenceCount: act.sequenceCount + 1,
  });
}

/**
 * Remove a sequence from an act by position
 */
export function removeSequenceFromAct(act: Act, position: number): Act {
  if (position < 0 || position >= act.items.length) {
    return act;
  }

  const newItems = act.items
    .filter((item) => item.position !== position)
    .map((item) =>
      item.position > position ? { ...item, position: item.position - 1 } : item
    );

  return updateAct(act, {
    items: newItems,
    sequenceCount: Math.max(0, act.sequenceCount - 1),
  });
}

/**
 * Reorder sequences in an act
 */
export function reorderActItems(
  act: Act,
  newSequenceIds: readonly string[]
): Act {
  const itemsBySequenceId = new Map(
    act.items.map((item) => [item.sequenceId, item])
  );

  const newItems = newSequenceIds
    .map((sequenceId, index) => {
      const existingItem = itemsBySequenceId.get(sequenceId);
      if (!existingItem) return null;
      return { ...existingItem, position: index };
    })
    .filter((item): item is ActItem => item !== null);

  return updateAct(act, {
    items: newItems,
  });
}

/**
 * Update a specific item in an act
 */
export function updateActItem(
  act: Act,
  position: number,
  updates: Partial<Omit<ActItem, "sequenceId" | "position">>
): Act {
  const newItems = act.items.map((item) =>
    item.position === position ? { ...item, ...updates } : item
  );

  return updateAct(act, { items: newItems });
}
