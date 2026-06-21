import { resolveSlotSequence } from "../domain/resolve-slot-sequence";
import {
  emptyPersonalMuseumDoc,
  type PersonalMuseumDoc,
  type SlotId,
} from "../domain/personal-museum-types";
import {
  loadPersonalMuseum,
  subscribePersonalMuseum,
  assignPlacement,
  clearPlacement,
} from "../services/personal-museum-repository";

/** Minimal shape we need from a favorited sequence: id + sort key. */
export interface FavoriteRef {
  id: string;
  updatedAt: number;
}

export interface PersonalMuseumStateOptions {
  slotIds: SlotId[];
}

export function createPersonalMuseumState(opts: PersonalMuseumStateOptions) {
  let docData = $state<PersonalMuseumDoc>(emptyPersonalMuseumDoc("", 0));
  let favorites = $state<FavoriteRef[]>([]);
  let unsubscribe: (() => void) | null = null;

  function favoritesOrdered(): string[] {
    return [...favorites].sort((a, b) => b.updatedAt - a.updatedAt).map((f) => f.id);
  }

  function availableIds(): Set<string> {
    return new Set<string>([
      ...favorites.map((f) => f.id),
      ...Object.values(docData.placements).map((p) => p.sequenceId),
    ]);
  }

  return {
    get doc() {
      return docData;
    },
    get favoritesOrdered() {
      return favoritesOrdered();
    },
    get resolvedSlots() {
      return resolveSlotSequence(
        opts.slotIds,
        docData.placements,
        favoritesOrdered(),
        availableIds(),
      );
    },

    setFavorites(refs: FavoriteRef[]) {
      favorites = refs;
    },

    async init() {
      docData = await loadPersonalMuseum();
      unsubscribe = await subscribePersonalMuseum((d) => {
        docData = d;
      });
    },

    async assign(slotId: SlotId, sequenceId: string) {
      docData = await assignPlacement(docData, slotId, sequenceId);
    },
    async clear(slotId: SlotId) {
      docData = await clearPlacement(docData, slotId);
    },

    dispose() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

export type PersonalMuseumState = ReturnType<typeof createPersonalMuseumState>;
