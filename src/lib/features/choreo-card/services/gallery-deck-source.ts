/**
 * gallery-deck-source.ts
 *
 * The third deck source (beside LOOP live-generation and TnD enumeration):
 * filter-queries the operator's own library (users/{userId}/sequences) and
 * turns the matches into DeckReleaseCards. Loaders are injectable so the
 * filtering/cap/dedup logic is unit-testable without Firestore.
 *
 * Native query filters (collection, tag, word, sort, limit) go through the
 * library repository; the axes it can't express server-side (loop type, period,
 * level, length) are applied client-side over the small result set.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { DeckReleaseCard, GalleryFilters } from "../domain/models/DeckRelease";
import type { LibraryQueryOptions } from "$lib/shared/library/domain/library-contract-types";

export type { GalleryFilters };
// NOTE: the library repository + firebase are lazy-imported inside defaultLoaders
// (not at module scope) so this module imports clean under vitest — the static
// Firestore/protobufjs chain crashes the test runner. Tests inject loaders and
// never touch the defaults.

/** The pseudo-catalog id stamped on gallery cards so loadSelectedSequences knows
 *  to resolve them via the library loader instead of the catalog loader. */
export const GALLERY_SOURCE_ID = "gallery";

/** PeriodCard semantics: quartered = 4, halved = 2 (orientation-cycle count). */
const PERIOD_VALUE: Record<"halved" | "quartered", number> = { halved: 2, quartered: 4 };

/** Injectable Firestore-touching seam so tests can drive pure logic. */
export interface GalleryLoaders {
  list: (opts: LibraryQueryOptions) => Promise<SequenceData[]>;
  fetchByIds: (ids: string[]) => Promise<SequenceData[]>;
}

const defaultLoaders: GalleryLoaders = {
  list: async (opts) => {
    const { getLibraryRepository } = await import("$lib/shared/library/get-library-repository");
    return getLibraryRepository().getSequences(opts);
  },
  fetchByIds: async (ids) => {
    if (ids.length === 0) return [];
    const [{ authState }, { getFirestoreInstance }, { batchFetchSequences }] = await Promise.all([
      import("$lib/shared/auth/state/auth-state.svelte"),
      import("$lib/shared/auth/firebase"),
      import("$lib/shared/library/services/collection-firestore-mapper"),
    ]);
    const userId = authState.effectiveUserId;
    if (!userId) return [];
    const firestore = await getFirestoreInstance();
    return batchFetchSequences(firestore, userId, ids);
  },
};

/** Axes the library query can't express server-side, applied over the result. */
function matchesClientFilters(seq: SequenceData, filters: GalleryFilters): boolean {
  if (filters.loopTypes?.length) {
    const lt = seq.loopType == null ? "" : String(seq.loopType);
    if (!filters.loopTypes.includes(lt)) return false;
  }
  if (filters.period && seq.period != null && seq.period !== PERIOD_VALUE[filters.period]) {
    return false;
  }
  if (filters.levels?.length && !(seq.level != null && filters.levels.includes(seq.level))) {
    return false;
  }
  if (filters.lengths?.length) {
    const len = seq.sequenceLength ?? seq.steps?.length ?? 0;
    if (!filters.lengths.includes(len)) return false;
  }
  return true;
}

function toGalleryCard(seq: SequenceData, index: number, notes: string): DeckReleaseCard {
  return {
    sequenceId: seq.id ?? `gallery-${index}`,
    sourceCatalogId: GALLERY_SOURCE_ID,
    stepCount: seq.steps?.length ?? seq.sequenceLength ?? 0,
    word: seq.word ?? seq.name ?? "",
    position: index + 1,
    footer: { center: notes },
  };
}

/**
 * Query the library, apply every filter, order newest-first, dedup by id, and
 * cap. Returns BOTH the cards (for persistence/release) and the resolved
 * sequences (so a live Draw can render without a second resolve round-trip).
 */
export async function queryGalleryDeck(
  filters: GalleryFilters,
  cap: number,
  notes = "",
  loaders: GalleryLoaders = defaultLoaders,
): Promise<{ cards: DeckReleaseCard[]; sequences: SequenceData[] }> {
  const seqs = await loaders.list({
    collectionId: filters.collectionId,
    tagIds: filters.tagId ? [filters.tagId] : undefined,
    searchQuery: filters.wordQuery?.trim() || undefined,
    sortBy: "createdAt",
    sortDirection: "desc",
  });

  const seen = new Set<string>();
  const picked: SequenceData[] = [];
  for (const seq of seqs) {
    if (!matchesClientFilters(seq, filters)) continue;
    if (seq.id) {
      if (seen.has(seq.id)) continue;
      seen.add(seq.id);
    }
    picked.push(seq);
    if (picked.length >= cap) break;
  }

  const cards = picked.map((seq, i) => toGalleryCard(seq, i, notes));
  return { cards, sequences: picked };
}

/** Re-resolve a released gallery deck's stored card ids → full SequenceData. */
export async function resolveGalleryCards(
  ids: string[],
  loaders: GalleryLoaders = defaultLoaders,
): Promise<SequenceData[]> {
  return loaders.fetchByIds(ids);
}
