import {
  generateDefaultDocId,
  unflattenValue,
  type DefaultArrowPlacementDoc,
  type PlacementValue,
  type PlacementsMap,
} from "../domain/default-arrow-placement";

export function createDefaultArrowPlacementState() {
  let docsMap = $state<Map<string, DefaultArrowPlacementDoc>>(new Map());
  // Raw docs as received by loadAll, retained so the bundle can round-trip via loadAll(getAllDocs()).
  let loadedDocs: DefaultArrowPlacementDoc[] = [];
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() { return isInitialized; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get count() { return docsMap.size; },

    /** The merged placements map for a (gridMode, propType, motionType), or null if no doc. */
    getMap(gridMode: string, propType: string, motionType: string): PlacementsMap | null {
      return docsMap.get(generateDefaultDocId(gridMode, propType, motionType))?.placements ?? null;
    },

    /** A single base value, Firestore-first; null if no override exists. */
    getValue(
      gridMode: string,
      propType: string,
      motionType: string,
      placementKey: string,
      turns: string,
    ): PlacementValue | null {
      const map = this.getMap(gridMode, propType, motionType);
      if (!map) return null;
      return unflattenValue(map, placementKey, turns);
    },

    /** Replace a whole doc (used by loadAll + onSnapshot). */
    setDoc(doc: DefaultArrowPlacementDoc): void {
      // Key by the canonical 3-part id, NOT the raw doc.id. A legacy 2-part doc
      // ("{grid}_{motion}") gets propType defaulted to "staff" by the schema, so
      // re-keying to "{grid}_staff_{motion}" makes it reachable by the staff read
      // path (which always computes the 3-part id). Matches setValue/removeValue.
      //
      // A legacy 2-part doc and the new 3-part doc both collapse to this id, so
      // we MERGE rather than last-write-wins: the doc physically stored AT the
      // canonical id (doc.id === id, i.e. the explicitly prop-scoped write) is
      // authoritative and its values win; the legacy seed only fills gaps. This
      // makes reload order-independent — an admin's real save can never be
      // silently clobbered by a stale seed doc that happens to load after it.
      const id = generateDefaultDocId(doc.gridMode, doc.propType, doc.motionType);
      const newMap = new Map(docsMap);
      newMap.set(id, mergeCollidingDocs(id, docsMap.get(id), doc));
      docsMap = newMap;
    },

    /** Merge a single placementKey/turns value into a doc's map (live preview + local write). */
    setValue(
      gridMode: string,
      propType: string,
      motionType: string,
      placementKey: string,
      turns: string,
      value: PlacementValue,
      updatedBy: string,
    ): void {
      const id = generateDefaultDocId(gridMode, propType, motionType);
      const existing = docsMap.get(id);
      const placements: PlacementsMap = existing
        ? structuredCloneMap(existing.placements)
        : {};
      placements[placementKey] = { ...(placements[placementKey] ?? {}), [turns]: value };
      const fakeTimestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0,
        toDate: () => new Date(),
        toMillis: () => Date.now(),
        isEqual: () => false,
      } as unknown as DefaultArrowPlacementDoc["updatedAt"];
      const newMap = new Map(docsMap);
      newMap.set(id, {
        id,
        gridMode,
        propType,
        motionType,
        placements,
        updatedAt: existing?.updatedAt ?? fakeTimestamp,
        updatedBy,
      });
      docsMap = newMap;
    },

    /** Remove a single placementKey/turns value (revert to JSON baseline). */
    removeValue(
      gridMode: string,
      propType: string,
      motionType: string,
      placementKey: string,
      turns: string,
    ): void {
      const id = generateDefaultDocId(gridMode, propType, motionType);
      const existing = docsMap.get(id);
      if (!existing) return;
      const placements = structuredCloneMap(existing.placements);
      if (placements[placementKey]) {
        delete placements[placementKey][turns];
        if (Object.keys(placements[placementKey]).length === 0) {
          delete placements[placementKey];
        }
      }
      const newMap = new Map(docsMap);
      newMap.set(id, { ...existing, placements });
      docsMap = newMap;
    },

    loadAll(docs: DefaultArrowPlacementDoc[]): void {
      isLoading = true;
      lastError = null;
      try {
        const newMap = new Map<string, DefaultArrowPlacementDoc>();
        // Canonical 3-part key so legacy 2-part docs decode to the staff path.
        // Merge on collision (legacy {grid}_{motion} + new {grid}_staff_{motion}
        // share an id) so load order can't clobber a real override — see setDoc.
        for (const doc of docs) {
          const id = generateDefaultDocId(doc.gridMode, doc.propType, doc.motionType);
          newMap.set(id, mergeCollidingDocs(id, newMap.get(id), doc));
        }
        docsMap = newMap;
        loadedDocs = [...docs];
        isInitialized = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to load defaults";
      } finally {
        isLoading = false;
      }
    },

    /** Raw loaded docs (shallow copy) in the exact shape loadAll consumes — for the bundle snapshot. */
    getAllDocs(): DefaultArrowPlacementDoc[] {
      return [...loadedDocs];
    },

    clear(): void {
      docsMap = new Map();
      loadedDocs = [];
      isInitialized = false;
    },

    setLoading(loading: boolean): void { isLoading = loading; },
    setError(error: string | null): void { lastError = error; },
  };
}

function updatedAtMillis(doc: DefaultArrowPlacementDoc): number {
  const ts = doc.updatedAt as { toMillis?: () => number } | undefined;
  try {
    return typeof ts?.toMillis === "function" ? ts.toMillis() : 0;
  } catch {
    return 0;
  }
}

/**
 * Collapse two Firestore docs that decode to the same canonical 3-part id (a
 * legacy 2-part seed + a new prop-scoped override). The AUTHORITATIVE doc — the
 * one physically stored at the canonical id (`doc.id === canonicalId`) — wins on
 * every (placementKey, turns) it defines; the other doc only fills gaps. When
 * neither (or both) is canonical-keyed, the newer `updatedAt` is authoritative.
 * Result is identity-stamped to the canonical id so the read path finds it.
 */
function mergeCollidingDocs(
  canonicalId: string,
  existing: DefaultArrowPlacementDoc | undefined,
  incoming: DefaultArrowPlacementDoc,
): DefaultArrowPlacementDoc {
  if (!existing) return incoming;

  const existingIsAuth = existing.id === canonicalId;
  const incomingIsAuth = incoming.id === canonicalId;
  let base: DefaultArrowPlacementDoc;
  let auth: DefaultArrowPlacementDoc;
  if (existingIsAuth !== incomingIsAuth) {
    auth = existingIsAuth ? existing : incoming;
    base = existingIsAuth ? incoming : existing;
  } else {
    auth = updatedAtMillis(incoming) >= updatedAtMillis(existing) ? incoming : existing;
    base = auth === incoming ? existing : incoming;
  }

  // Two-level overlay: start from base, let auth's keys/turns override.
  const placements: PlacementsMap = structuredCloneMap(base.placements);
  for (const [key, byTurns] of Object.entries(auth.placements)) {
    placements[key] = { ...(placements[key] ?? {}), ...byTurns };
  }

  return {
    id: canonicalId,
    gridMode: auth.gridMode,
    propType: auth.propType,
    motionType: auth.motionType,
    placements,
    updatedAt: auth.updatedAt,
    updatedBy: auth.updatedBy,
  };
}

/** Deep-clone a placements map (two levels) so rune updates never mutate the old snapshot. */
function structuredCloneMap(src: PlacementsMap): PlacementsMap {
  const out: PlacementsMap = {};
  for (const [k, byTurns] of Object.entries(src)) {
    out[k] = { ...byTurns };
  }
  return out;
}

export type DefaultArrowPlacementState = ReturnType<typeof createDefaultArrowPlacementState>;
