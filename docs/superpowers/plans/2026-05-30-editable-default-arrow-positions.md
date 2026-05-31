# Editable Default Arrow Positions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Default tier of the arrow-positioning cascade editable from the step-editor Inspect panel, backed by Firebase as canonical source with the static JSON as offline fallback.

**Architecture:** A new `default-override/` tier module (domain + state + persister + repository + singleton) mirrors the existing `special-override/` structure, but stores the *dense* baseline as one Firestore doc per `{gridMode}_{motionType}` (10 docs, 1:1 with the static JSON files) instead of doc-per-key. `ArrowPlacer.getDefaultAdjustment` consults an injected resolver (registered by the singleton on init) before the static map — Firestore-first with file fallback, no cache invalidation, worker-safe. The `PipelineEditorDock` gains a 4th tier branch wired to the new repository.

**Tech Stack:** Svelte 5 runes, Firestore (modular SDK client reads/writes + Admin SDK seed), Zod, Vitest, firebase-admin (`npx tsx`).

---

## Background facts the engineer must know

- **The cascade** (first non-null wins): Global Override → Special JSON → Prop Geometry → **Default**. Source of truth for tier order: `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts:396-425`.
- **The Default lookup key** has exactly four dimensions: `gridMode` ("box"/"diamond"), `motionType` ("pro"/"anti"/"float"/"dash"/"static"), `placementKey` (e.g. `pro_to_nonradial_layer3_alpha`), and `turns` (string: `"0"`, `"0.5"`, `"1.5"`, `"fl"`). Rotation direction and start/end location are NOT in the key — they drive directional-tuple rotation applied *after* lookup. So the stored value is the pre-rotation **base**, same kind every tier stores.
- **The 10 static files** live at `static/data/arrow_placement/{box,diamond}/default/default_{gridMode}_{motionType}_placements.json`. SvelteKit serves `static/` at `/`, so `ArrowPlacer` fetches them as `/data/arrow_placement/...` (see `arrow-placer.ts:32-52`). Each file is shaped `{ [placementKey]: { [turns]: [x, y] } }` (see `static/data/arrow_placement/box/default/default_box_pro_placements.json`).
- **Admin gate:** `ADMIN_EMAIL = "austencloud@gmail.com"`, checked against `authState.user?.email` (see `prop-geometry-adjustment-repository.ts:26,173`).
- **Reactivity bus:** `globalAdjustmentVersion.increment()` + `pictographPreparer.clearCache()` after any edit so the renderer + dock recompute (see dock `handleGlobalNumericUpdate`, `PipelineEditorDock.svelte:437-453`).
- **Firestore helpers:** `firestoreList(collection, schema)`, `firestoreSet(collection, id, data, { merge })`, `firestoreDelete(collection, id)`, `firestoreDate` from `$lib/shared/firestore` (see `firestore-crud.ts`). `firestoreSet` deep-merges nested maps when `{ merge: true }` and auto-stamps `updatedAt: serverTimestamp()`.
- **Run tests:** `npx vitest run <path> --config tests/config/vitest.config.ts`. Sibling tests in `tests/unit/arrow-adjustment/`.
- **Type/build gates (commit-time only, never inner loop):** `npm run check`. Dev server on :5173 is the user's — do not start `npm run dev`.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts` | Types, `generateDefaultDocId`, `parseDefaultDocId`, Zod schema, pure flatten/unflatten helpers |
| `src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts` | In-memory `[gridMode|motionType] → placements` map (runes), version-bumped |
| `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts` | Firestore I/O against `default_arrow_adjustments` (10 docs) — loadAll / saveValue (nested merge) / deleteValue (FieldPath delete) / subscribe |
| `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts` | Admin-gated `saveDefault` / `deleteDefault` + in-memory `saveDefaultLocal` / `deleteDefaultLocal` preview + `getValue` |
| `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts` | `getDefaultOverrideRepository()` + `initializeDefaultOverrides()` + dispose; registers the resolver into ArrowPlacer |
| `scripts/seed-default-arrow-placements.ts` | Admin-SDK one-time/idempotent seed: 10 JSON files → 10 Firestore docs |
| `scripts/export-default-arrow-placements.ts` | Admin-SDK reverse: 10 Firestore docs → 10 JSON files (commit path) |
| `tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts` | Domain helper + flatten/unflatten unit tests |
| `tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts` | ArrowPlacer resolver-first precedence + JSON fallback |

**Modify:**

| File | Change |
|---|---|
| `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts` | Module-level injectable `setDefaultOverrideResolver`; consult it first in `getDefaultAdjustment` |
| `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts` | Extend `DefaultTierInfo` with `gridMode`/`motionType`/`placementKey`/`turns` |
| `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts` | Extract `resolveDefaultLookupIdentity`; populate the extended `diagnostics.default` |
| `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte` | 4th tier: tierOptions, union widen, `defaultOverrideKey` derived, handlers, template branches |
| `src/lib/shared/auth/services/auth-boot-orchestrator.ts` | Register `initializeDefaultOverrides()` alongside the other tiers |
| `firestore.rules` | `match /default_arrow_adjustments/{docId}` — `read: if true`, `write: if isAdmin()` |

---

## Task 1: Domain module (`DefaultArrowPlacement.ts`)

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts`
- Test: `tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateDefaultDocId,
  parseDefaultDocId,
  flattenPlacements,
  unflattenValue,
  DefaultArrowPlacementDocSchema,
} from "$lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement";

describe("DefaultArrowPlacement domain", () => {
  it("generates a doc id from gridMode + motionType", () => {
    expect(generateDefaultDocId("box", "pro")).toBe("box_pro");
    expect(generateDefaultDocId("diamond", "static")).toBe("diamond_static");
  });

  it("round-trips a doc id", () => {
    expect(parseDefaultDocId("box_pro")).toEqual({ gridMode: "box", motionType: "pro" });
    expect(parseDefaultDocId("diamond_static")).toEqual({
      gridMode: "diamond",
      motionType: "static",
    });
  });

  it("returns null for a malformed doc id", () => {
    expect(parseDefaultDocId("box")).toBeNull();
    expect(parseDefaultDocId("a_b_c")).toBeNull();
  });

  it("flattens a placements map into a doc body and reads a single value back", () => {
    const placements = {
      pro_to_layer1_alpha: { "1.5": [-35, 145] as [number, number], "2": [-10, -35] as [number, number] },
    };
    const body = flattenPlacements("box", "pro", placements, "seed");
    expect(body.gridMode).toBe("box");
    expect(body.motionType).toBe("pro");
    expect(body.placements.pro_to_layer1_alpha["1.5"]).toEqual([-35, 145]);
    expect(unflattenValue(body.placements, "pro_to_layer1_alpha", "1.5")).toEqual([-35, 145]);
    expect(unflattenValue(body.placements, "pro_to_layer1_alpha", "9")).toBeNull();
    expect(unflattenValue(body.placements, "missing_key", "1.5")).toBeNull();
  });

  it("parses a valid doc body and rejects a malformed one", () => {
    const ok = DefaultArrowPlacementDocSchema.safeParse({
      id: "box_pro",
      gridMode: "box",
      motionType: "pro",
      placements: { k: { "1": [1, 2] } },
      updatedBy: "seed",
    });
    expect(ok.success).toBe(true);
    const bad = DefaultArrowPlacementDocSchema.safeParse({ id: "box_pro", gridMode: "box" });
    expect(bad.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — cannot resolve module `DefaultArrowPlacement`.

- [ ] **Step 3: Write the domain module**

Create `src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts`:

```ts
import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";
import type { Timestamp } from "firebase/firestore";

/** A single base adjustment, pre directional-tuple rotation. */
export type PlacementValue = [number, number];

/** placementKey → turns → [x, y]. The same shape ArrowPlacer builds in memory. */
export type PlacementsMap = Record<string, Record<string, PlacementValue>>;

/** One Firestore doc = one (gridMode, motionType) file's worth of placements. */
export interface DefaultArrowPlacementDoc {
  readonly id: string; // "{gridMode}_{motionType}"
  readonly gridMode: string;
  readonly motionType: string;
  readonly placements: PlacementsMap;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

const PlacementValueSchema = z.tuple([z.number(), z.number()]);

export const DefaultArrowPlacementDocSchema = z
  .object({
    id: z.string(),
    gridMode: z.string(),
    motionType: z.string(),
    placements: z.record(z.string(), z.record(z.string(), PlacementValueSchema)),
    updatedAt: firestoreDate,
    updatedBy: z.string(),
  })
  .passthrough();

/** Doc id is the 1:1 mirror of the static file: "{gridMode}_{motionType}". */
export function generateDefaultDocId(gridMode: string, motionType: string): string {
  return `${gridMode}_${motionType}`;
}

export function parseDefaultDocId(
  docId: string,
): { gridMode: string; motionType: string } | null {
  const parts = docId.split("_");
  if (parts.length !== 2) return null;
  const [gridMode, motionType] = parts;
  if (!gridMode || !motionType) return null;
  return { gridMode, motionType };
}

/** Build a doc body from an in-memory placements map (used by the seed + local writes). */
export function flattenPlacements(
  gridMode: string,
  motionType: string,
  placements: PlacementsMap,
  updatedBy: string,
): {
  gridMode: string;
  motionType: string;
  placements: PlacementsMap;
  updatedBy: string;
} {
  return { gridMode, motionType, placements, updatedBy };
}

/** Read a single base value out of a placements map; null if absent. */
export function unflattenValue(
  placements: PlacementsMap,
  placementKey: string,
  turns: string,
): PlacementValue | null {
  const byTurns = placements[placementKey];
  if (!byTurns) return null;
  const value = byTurns[turns];
  return value ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts
git commit -m "feat(arrow-positioning): default-override domain types + helpers" -- src/lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement.ts tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts
```

---

## Task 2: State module (`DefaultArrowPlacementState.svelte.ts`)

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts`

This mirrors `SpecialArrowPlacementState.svelte.ts` (the `new Map()` copy-on-write rune pattern) but stores whole placements maps keyed by doc id, and exposes a four-arg value getter. No standalone unit test — runes states are covered by the read-precedence test (Task 7) and `npm run check`.

- [ ] **Step 1: Write the state module**

Create `src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts`:

```ts
import {
  generateDefaultDocId,
  unflattenValue,
  type DefaultArrowPlacementDoc,
  type PlacementValue,
  type PlacementsMap,
} from "../domain/DefaultArrowPlacement";

export function createDefaultArrowPlacementState() {
  let docsMap = $state<Map<string, DefaultArrowPlacementDoc>>(new Map());
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() { return isInitialized; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get count() { return docsMap.size; },

    /** The merged placements map for a (gridMode, motionType), or null if no doc. */
    getMap(gridMode: string, motionType: string): PlacementsMap | null {
      return docsMap.get(generateDefaultDocId(gridMode, motionType))?.placements ?? null;
    },

    /** A single base value, Firestore-first; null if no override exists. */
    getValue(
      gridMode: string,
      motionType: string,
      placementKey: string,
      turns: string,
    ): PlacementValue | null {
      const map = this.getMap(gridMode, motionType);
      if (!map) return null;
      return unflattenValue(map, placementKey, turns);
    },

    /** Replace a whole doc (used by loadAll + onSnapshot). */
    setDoc(doc: DefaultArrowPlacementDoc): void {
      const newMap = new Map(docsMap);
      newMap.set(doc.id, doc);
      docsMap = newMap;
    },

    /** Merge a single placementKey/turns value into a doc's map (live preview + local write). */
    setValue(
      gridMode: string,
      motionType: string,
      placementKey: string,
      turns: string,
      value: PlacementValue,
      updatedBy: string,
    ): void {
      const id = generateDefaultDocId(gridMode, motionType);
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
      motionType: string,
      placementKey: string,
      turns: string,
    ): void {
      const id = generateDefaultDocId(gridMode, motionType);
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
        for (const doc of docs) newMap.set(doc.id, doc);
        docsMap = newMap;
        isInitialized = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to load defaults";
      } finally {
        isLoading = false;
      }
    },

    clear(): void {
      docsMap = new Map();
      isInitialized = false;
    },

    setLoading(loading: boolean): void { isLoading = loading; },
    setError(error: string | null): void { lastError = error; },
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
```

> Note: `Date.now()` is fine in app/runtime code. It is only banned inside Workflow scripts. The other tiers use this exact `fakeTimestamp` idiom (`special-arrow-placement-repository.ts:102-108`).

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts
git commit -m "feat(arrow-positioning): default-override in-memory state" -- src/lib/shared/pictograph/arrow/positioning/default-override/state/DefaultArrowPlacementState.svelte.ts
```

---

## Task 3: Persister (`default-arrow-placement-persister.ts`)

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts`

Mirrors `prop-geometry-adjustment-persister.ts` but: `loadAll` reads the (≤10) docs of the collection; `saveValue` writes a single nested `placements.{key}.{turns}` via `firestoreSet(..., { merge: true })`; `deleteValue` removes the nested field via `updateDoc` + `deleteField` addressed by a `FieldPath` (required because the `turns` segment `"1.5"` contains a dot and a dotted-string path would mis-parse it).

- [ ] **Step 1: Write the persister**

Create `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts`:

```ts
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  FieldPath,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { firestoreList, firestoreSet } from "$lib/shared/firestore";
import {
  DefaultArrowPlacementDocSchema,
  generateDefaultDocId,
  type DefaultArrowPlacementDoc,
  type PlacementValue,
} from "../domain/DefaultArrowPlacement";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("DefaultArrowPlacementPersister");

const COLLECTION_NAME = "default_arrow_adjustments";

export class DefaultArrowPlacementPersister {
  private unsubscribe: Unsubscribe | null = null;

  async loadAll(): Promise<DefaultArrowPlacementDoc[]> {
    try {
      const docs = await firestoreList(COLLECTION_NAME, DefaultArrowPlacementDocSchema);
      logger.success(`Loaded ${docs.length} default placement docs`);
      return docs as unknown as DefaultArrowPlacementDoc[];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("permission")) {
        logger.warn("Insufficient permissions — using JSON baseline");
        return [];
      }
      logger.error("Failed to load default placement docs:", error);
      throw error;
    }
  }

  /** Merge a single base value into the {gridMode}_{motionType} doc. */
  async saveValue(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
    userEmail: string,
  ): Promise<void> {
    const id = generateDefaultDocId(gridMode, motionType);
    try {
      await firestoreSet(
        COLLECTION_NAME,
        id,
        {
          gridMode,
          motionType,
          placements: { [placementKey]: { [turns]: value } },
          updatedBy: userEmail,
        } as Record<string, unknown>,
        { merge: true },
      );
      logger.success(`Saved default ${id} ${placementKey}/${turns} → (${value[0]}, ${value[1]})`);
    } catch (error) {
      logger.error(`Failed to save default ${id} ${placementKey}/${turns}:`, error);
      throw error;
    }
  }

  /** Remove a single base value (revert that key/turns to the JSON baseline). */
  async deleteValue(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): Promise<void> {
    const id = generateDefaultDocId(gridMode, motionType);
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, id);
      // FieldPath, not a dotted string: the `turns` segment ("1.5") contains a dot.
      await updateDoc(docRef, new FieldPath("placements", placementKey, turns), deleteField());
      logger.success(`Deleted default ${id} ${placementKey}/${turns}`);
    } catch (error) {
      logger.error(`Failed to delete default ${id} ${placementKey}/${turns}:`, error);
      throw error;
    }
  }

  subscribe(onChange: (doc: DefaultArrowPlacementDoc) => void): () => void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    getFirestoreInstance()
      .then((firestoreDb) => {
        const colRef = collection(firestoreDb, COLLECTION_NAME);
        this.unsubscribe = onSnapshot(
          colRef,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") return; // docs are never deleted wholesale
              const data = change.doc.data();
              if (data.gridMode && data.motionType && data.placements) {
                onChange({
                  id: change.doc.id,
                  gridMode: data.gridMode,
                  motionType: data.motionType,
                  placements: data.placements,
                  updatedAt: data.updatedAt,
                  updatedBy: data.updatedBy ?? "unknown",
                });
              }
            });
          },
          (error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("permission")) {
              logger.warn("Default placement subscription not accessible (permissions).");
            } else {
              logger.error("Subscription error:", error);
            }
          },
        );
      })
      .catch((error: unknown) => {
        logger.error("Failed to initialize subscription:", error);
      });

    return () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}
```

- [ ] **Step 2: Typecheck the new file compiles in isolation (watch)**

The persister has no standalone unit test (it does live Firestore I/O). It is type-checked at the commit gate (Task 12). For now, confirm imports resolve by running the already-passing domain test again (it imports the same module tree is not required, but this ensures no syntax break in the package):

Run: `npx vitest run tests/unit/arrow-adjustment/DefaultArrowPlacement.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts
git commit -m "feat(arrow-positioning): default-override Firestore persister" -- src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-persister.ts
```

---

## Task 4: Repository (`default-arrow-placement-repository.ts`)

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts`

Mirrors `special-arrow-placement-repository.ts`: admin-gated persisted writes, in-memory preview writes, and a `getValue` passthrough the resolver uses.

- [ ] **Step 1: Write the repository**

Create `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts`:

```ts
import { authState } from "$lib/shared/auth/state/authState.svelte";
import type { PlacementValue } from "../domain/DefaultArrowPlacement";
import type { DefaultArrowPlacementPersister } from "./default-arrow-placement-persister";
import {
  createDefaultArrowPlacementState,
  type DefaultArrowPlacementState,
} from "../state/DefaultArrowPlacementState.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { globalAdjustmentVersion } from "../../global/state/global-adjustment-version.svelte";

const logger = createComponentLogger("DefaultArrowPlacementRepository");
const ADMIN_EMAIL = "austencloud@gmail.com";

export class DefaultArrowPlacementRepository {
  private readonly state: DefaultArrowPlacementState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: DefaultArrowPlacementPersister) {
    this.state = createDefaultArrowPlacementState();
  }

  get isInitialized(): boolean {
    return this.state.isInitialized;
  }

  async initialize(): Promise<void> {
    if (this.initializePromise) return this.initializePromise;
    if (this.state.isInitialized) return;
    this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.state.setLoading(true);
      logger.info("Initializing default placement overrides...");

      const docs = await this.persister.loadAll();
      this.state.loadAll(docs);

      if (docs.length > 0) {
        globalAdjustmentVersion.increment();
      }

      this.unsubscribe = this.persister.subscribe((doc) => {
        this.state.setDoc(doc);
        globalAdjustmentVersion.increment();
        logger.info(`Real-time update: ${doc.id}`);
      });

      logger.success(`Initialized with ${this.state.count} default placement docs`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize";
      this.state.setError(message);
      logger.error("Initialization failed:", error);
      throw error;
    } finally {
      this.state.setLoading(false);
      this.initializePromise = null;
    }
  }

  /** Firestore-first base value, or null when no override exists (resolver consumes this). */
  getValue(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): PlacementValue | null {
    return this.state.getValue(gridMode, motionType, placementKey, turns);
  }

  hasValue(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): boolean {
    return this.state.getValue(gridMode, motionType, placementKey, turns) !== null;
  }

  /** In-memory live preview during WASD (admin only). */
  saveDefaultLocal(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
  ): void {
    this.state.setValue(
      gridMode,
      motionType,
      placementKey,
      turns,
      value,
      authState.user?.email ?? "unknown",
    );
  }

  /** In-memory revert preview (admin only). */
  deleteDefaultLocal(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): void {
    this.state.removeValue(gridMode, motionType, placementKey, turns);
  }

  /** Persist a single base value (admin only). */
  async saveDefault(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
    value: PlacementValue,
  ): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can save default placement overrides");
    }
    await this.persister.saveValue(gridMode, motionType, placementKey, turns, value, email);
  }

  /** Persist a single delete (admin only). */
  async deleteDefault(
    gridMode: string,
    motionType: string,
    placementKey: string,
    turns: string,
  ): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can delete default placement overrides");
    }
    await this.persister.deleteValue(gridMode, motionType, placementKey, turns);
    this.state.removeValue(gridMode, motionType, placementKey, turns);
  }

  isAdmin(): boolean {
    return authState.user?.email === ADMIN_EMAIL;
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.state.clear();
    logger.info("Disposed");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts
git commit -m "feat(arrow-positioning): default-override admin-gated repository" -- src/lib/shared/pictograph/arrow/positioning/default-override/services/default-arrow-placement-repository.ts
```

---

## Task 5: ArrowPlacer read seam (injectable resolver)

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts`

Add a module-level resolver hook. Decoupling rationale: `ArrowPlacer` must NOT import the override singleton (it runs in the render worker, which never initializes Firebase). Instead the singleton *pushes* a resolver into ArrowPlacer on init. When the resolver is unset (workers, pre-auth), behavior is unchanged static-JSON.

- [ ] **Step 1: Add the resolver hook (top of file, after the `debug` logger at line 18)**

Insert immediately after `const debug = createComponentLogger("ArrowPlacer");`:

```ts
/**
 * Optional Firestore-first override for default base adjustments. Registered by
 * default-override-singleton on init. Unset in workers / pre-auth → pure JSON.
 * Returns the stored base [x, y] or null to fall through to the static map.
 */
export type DefaultOverrideResolver = (
  gridMode: string,
  motionType: string,
  placementKey: string,
  turns: string,
) => [number, number] | null;

let defaultOverrideResolver: DefaultOverrideResolver | null = null;

export function setDefaultOverrideResolver(fn: DefaultOverrideResolver | null): void {
  defaultOverrideResolver = fn;
}
```

- [ ] **Step 2: Consult the resolver inside `getDefaultAdjustment`**

In `getDefaultAdjustment` (`arrow-placer.ts:180-213`), replace the block from the `const turnsStr` line through the final return with the resolver-first version. The current code is:

```ts
    // Convert turns to string format used in JSON
    const turnsStr = this.formatTurnsForLookup(turns);
    const adjustment = placementData[turnsStr];

    if (!adjustment) {
      return { x: 0, y: 0 };
    }

    const [x, y] = adjustment;
    return { x, y };
```

But the resolver must be consulted even when there is no static entry, so move the resolver check to the top of the method. Replace the entire method body. The new `getDefaultAdjustment` is:

```ts
  async getDefaultAdjustment(
    motionType: MotionType,
    placementKey: string,
    turns: number | string,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<{ x: number; y: number }> {
    await this.ensureDataLoaded(gridMode);

    const turnsStr = this.formatTurnsForLookup(turns);

    // Firestore-first: an admin default override shadows the static JSON value.
    if (defaultOverrideResolver) {
      const override = defaultOverrideResolver(
        gridMode as unknown as string,
        motionType as unknown as string,
        placementKey,
        turnsStr
      );
      if (override) {
        return { x: override[0], y: override[1] };
      }
    }

    const gridPlacements = this.allPlacements[gridMode];
    if (!gridPlacements) {
      return { x: 0, y: 0 };
    }

    const motionPlacements = gridPlacements[motionType];
    if (!motionPlacements) {
      return { x: 0, y: 0 };
    }

    const placementData = motionPlacements[placementKey];
    if (!placementData) {
      return { x: 0, y: 0 };
    }

    const adjustment = placementData[turnsStr];
    if (!adjustment) {
      return { x: 0, y: 0 };
    }

    const [x, y] = adjustment;
    return { x, y };
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts
git commit -m "feat(arrow-positioning): Firestore-first default resolver hook in ArrowPlacer" -- src/lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer.ts
```

---

## Task 6: Singleton + resolver registration

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts`

Mirrors `special-override-singleton.ts`, and additionally registers/unregisters the resolver into ArrowPlacer.

- [ ] **Step 1: Write the singleton**

Create `src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts`:

```ts
/**
 * Default Arrow Placement Override Singleton
 *
 * Provides a singleton DefaultArrowPlacementRepository, initialized after
 * Firebase auth is ready. On init it registers a Firestore-first resolver into
 * ArrowPlacer so default base adjustments prefer admin overrides over the
 * static JSON. Mirrors special-override-singleton.ts.
 */

import { DefaultArrowPlacementRepository } from "./default-arrow-placement-repository";
import { DefaultArrowPlacementPersister } from "./default-arrow-placement-persister";
import { setDefaultOverrideResolver } from "../../placement/services/arrow-placer";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("DefaultOverrideSingleton");

let repositoryInstance: DefaultArrowPlacementRepository | null = null;
let initializationPromise: Promise<void> | null = null;

export function getDefaultOverrideRepository(): DefaultArrowPlacementRepository | null {
  return repositoryInstance;
}

export async function initializeDefaultOverrides(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  if (repositoryInstance?.isInitialized) return;
  initializationPromise = doInitialize();
  return initializationPromise;
}

async function doInitialize(): Promise<void> {
  try {
    logger.info("Initializing default placement override system...");
    const persister = new DefaultArrowPlacementPersister();
    const repository = new DefaultArrowPlacementRepository(persister);
    await repository.initialize();
    repositoryInstance = repository;

    // Register the Firestore-first resolver. Any new override now shadows JSON.
    setDefaultOverrideResolver((gridMode, motionType, placementKey, turns) =>
      repository.getValue(gridMode, motionType, placementKey, turns),
    );
    // Existing cached renders predate the resolver — invalidate so they repopulate.
    pictographPreparer.clearCache();

    logger.success("Default placement override system initialized");
  } catch (error) {
    logger.error("Failed to initialize default overrides:", error);
    // Don't throw — rendering continues on the static JSON baseline.
  } finally {
    initializationPromise = null;
  }
}

export function disposeDefaultOverrides(): void {
  if (repositoryInstance) {
    setDefaultOverrideResolver(null);
    repositoryInstance.dispose();
    repositoryInstance = null;
    logger.info("Default placement override system disposed");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts
git commit -m "feat(arrow-positioning): default-override singleton + resolver registration" -- src/lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton.ts
```

---

## Task 7: Read-precedence integration test

**Files:**
- Test: `tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts`

Proves: (a) with no resolver, `ArrowPlacer` returns the static JSON value; (b) with a resolver returning a value, the override wins; (c) with a resolver returning null, it falls through to JSON.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { ArrowPlacer, setDefaultOverrideResolver } from "$lib/shared/pictograph/arrow/positioning/placement/services/arrow-placer";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Minimal SimpleJsonCache stand-in: returns a fixed box/pro placements map.
const fakeCache = {
  async get(path: string) {
    if (path.includes("box") && path.includes("pro")) {
      return { pro_to_layer1_alpha: { "1.5": [-35, 145] } };
    }
    return {};
  },
} as unknown as import("$lib/shared/pictograph/shared/services/simple-json-cache").SimpleJsonCache;

afterEach(() => setDefaultOverrideResolver(null));

describe("default override read precedence", () => {
  it("returns the static JSON value when no resolver is registered", async () => {
    const placer = new ArrowPlacer(fakeCache);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: -35, y: 145 });
  });

  it("prefers the resolver value over the static JSON value", async () => {
    const placer = new ArrowPlacer(fakeCache);
    setDefaultOverrideResolver((grid, motion, key, turns) =>
      grid === "box" && motion === "pro" && key === "pro_to_layer1_alpha" && turns === "1.5"
        ? [7, 9]
        : null,
    );
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: 7, y: 9 });
  });

  it("falls through to JSON when the resolver returns null", async () => {
    const placer = new ArrowPlacer(fakeCache);
    setDefaultOverrideResolver(() => null);
    const result = await placer.getDefaultAdjustment(
      "pro" as MotionType,
      "pro_to_layer1_alpha",
      "1.5",
      GridMode.BOX,
    );
    expect(result).toEqual({ x: -35, y: 145 });
  });
});
```

- [ ] **Step 2: Run test to verify it passes (the seam already exists from Task 5)**

Run: `npx vitest run tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (3 tests). If `GridMode.BOX` is not the string `"box"`, the first/second assertions reveal it — read `src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts` and adjust the resolver's `grid === "box"` comparison to the actual enum value (and note it for Task 8/dock gridMode strings).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts
git commit -m "test(arrow-positioning): default override read precedence + JSON fallback" -- tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts
```

---

## Task 8: Init wiring (`auth-boot-orchestrator.ts`)

**Files:**
- Modify: `src/lib/shared/auth/services/auth-boot-orchestrator.ts`

- [ ] **Step 1: Register the new singleton alongside the special-override block**

After the special-override init block (`auth-boot-orchestrator.ts:63-72`), insert:

```ts
  // Initialize default arrow placement overrides (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton")
    .then(async ({ initializeDefaultOverrides }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializeDefaultOverrides();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Default placement overrides initialization failed:", error);
    });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/auth/services/auth-boot-orchestrator.ts
git commit -m "feat(arrow-positioning): initialize default overrides on auth boot" -- src/lib/shared/auth/services/auth-boot-orchestrator.ts
```

---

## Task 9: Diagnostics extension

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts`
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts`

The dock needs the Default lookup identity (gridMode, motionType, placementKey, turns) to address the right Firestore field. Today `DefaultTierInfo` only carries `value`.

- [ ] **Step 1: Extend `DefaultTierInfo`**

In `PipelineDiagnostics.ts`, replace the `DefaultTierInfo` interface (lines 48-50):

```ts
export interface DefaultTierInfo {
  value: TierValue;
  /** Lookup identity so the editor can address the Firestore default field. */
  gridMode: string;
  motionType: string;
  placementKey: string;
  turns: string;
}
```

- [ ] **Step 2: Extract a shared identity resolver in the calculator**

In `arrow-adjustment-calculator.ts`, the existing `calculateDefaultAdjustment` (line 641) computes gridMode + placementKey internally but returns only a `Point`. Add a private helper that returns the identity, and have `calculateDefaultAdjustment` reuse it (return type stays `Point`, so its 3 callers at lines 68, 385, 502 are unaffected).

Add this method immediately above `calculateDefaultAdjustment` (before line 641):

```ts
  /**
   * Resolve the Default-tier lookup identity (gridMode, motionType, placementKey,
   * turns) for a motion. Shared by calculateDefaultAdjustment and getDiagnostics
   * so the editor can address the exact Firestore default field.
   */
  private async resolveDefaultLookupIdentity(
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<{ gridMode: GridMode; motionType: MotionType; placementKey: string; turns: string }> {
    const gridMode = (motionData.gridMode ||
      (pictographData.motions.blue && pictographData.motions.red
        ? _deriveGridMode(pictographData.motions.blue, pictographData.motions.red)
        : GridMode.DIAMOND)) as GridMode;

    const keys = await this.DefaultPlacer.getAvailablePlacementKeys(
      motionData.motionType as MotionType,
      gridMode
    );
    const availableKeys = Object.keys(
      Object.fromEntries((keys || []).map((k: string) => [k, true]))
    );
    const placementKey = generatePlacementKey(motionData, pictographData, availableKeys);

    const rawTurns = motionData.turns ?? 0;
    const turns =
      typeof rawTurns === "string"
        ? rawTurns
        : rawTurns === Math.floor(rawTurns)
          ? Math.floor(rawTurns).toString()
          : rawTurns.toString();

    return { gridMode, motionType: motionData.motionType as MotionType, placementKey, turns };
  }
```

Then replace the body of `calculateDefaultAdjustment` (lines 641-687) to reuse it:

```ts
  private async calculateDefaultAdjustment(
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<Point> {
    try {
      const { gridMode, motionType, placementKey, turns } =
        await this.resolveDefaultLookupIdentity(motionData, pictographData);

      const adjustmentPoint = await this.DefaultPlacer.getDefaultAdjustment(
        placementKey,
        turns,
        motionType,
        gridMode
      );

      return new Point(adjustmentPoint.x, adjustmentPoint.y);
    } catch (error) {
      console.error("Error calculating default adjustment:", error);
      throw new Error(`Default adjustment calculation failed: ${error}`);
    }
  }
```

- [ ] **Step 3: Populate the extended `diagnostics.default` in `getDiagnostics`**

In `getDiagnostics`, replace the Tier-4 default block (lines 383-394):

```ts
    // --- Tier 4: Default (motion-type only) ---
    try {
      const identity = await this.resolveDefaultLookupIdentity(motionData, pictographData);
      const defaultResult = await this.calculateDefaultAdjustment(motionData, pictographData);
      diagnostics.default = {
        value: { x: defaultResult.x, y: defaultResult.y },
        gridMode: identity.gridMode as unknown as string,
        motionType: identity.motionType as unknown as string,
        placementKey: identity.placementKey,
        turns: identity.turns,
      };
    } catch (error) {
      console.warn("[getDiagnostics] Default tier probe failed:", error);
    }
```

- [ ] **Step 4: Verify the calculator still type-checks (watch) + run the precedence test**

Run: `npx vitest run tests/unit/arrow-adjustment/DefaultOverrideReadPrecedence.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (unchanged — this guards the read seam the diagnostics now relies on).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts
git commit -m "feat(arrow-positioning): expose default lookup identity in diagnostics" -- src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts src/lib/shared/pictograph/arrow/positioning/calculation/services/arrow-adjustment-calculator.ts
```

---

## Task 10: Dock 4th-tier wiring (`PipelineEditorDock.svelte`)

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte`

Every change mirrors the existing `special-json` / `prop-geometry` branches. The `editTarget` union and `selectEditTarget`/`syncNumericInputs`/`handleWASDMovement`/`handleSave`/`handleDelete`/`handleNumericChange` switches all gain a `"default"` arm.

- [ ] **Step 1: Import the repository singleton**

After the prop-geometry singleton import (line 42), add:

```ts
  import { getDefaultOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/default-override/services/default-override-singleton";
```

- [ ] **Step 2: Widen the `editTarget` union (line 63)**

Replace:

```ts
  let editTarget = $state<"global" | "special-json" | "prop-geometry">("global");
```

with:

```ts
  let editTarget = $state<"global" | "special-json" | "prop-geometry" | "default">("global");
```

- [ ] **Step 3: Add the Default option to `tierOptions` (lines 77-81)**

Replace:

```ts
  const tierOptions = [
    { value: "global" as const, label: "Global" },
    { value: "special-json" as const, label: "Special JSON" },
    { value: "prop-geometry" as const, label: "Prop Geometry" },
  ];
```

with:

```ts
  const tierOptions = [
    { value: "global" as const, label: "Global" },
    { value: "special-json" as const, label: "Special JSON" },
    { value: "prop-geometry" as const, label: "Prop Geometry" },
    { value: "default" as const, label: "Default" },
  ];
```

- [ ] **Step 4: Add a `defaultLookup` derived (the identity the writes need)**

After the `propGeometryHasValue` derived (after line 190), add:

```ts
  // The Default-tier lookup identity, surfaced by the diagnostics producer.
  const defaultLookup = $derived.by((): {
    gridMode: string;
    motionType: string;
    placementKey: string;
    turns: string;
  } | null => {
    if (!diagnostics?.default) return null;
    const d = diagnostics.default;
    if (!d.gridMode || !d.motionType || !d.placementKey) return null;
    return {
      gridMode: d.gridMode,
      motionType: d.motionType,
      placementKey: d.placementKey,
      turns: d.turns,
    };
  });

  // Reactive "an override exists here" flag for the Revert button.
  const defaultHasValue = $derived.by(() => {
    const _ = globalAdjustmentVersion.version;
    const lk = defaultLookup;
    if (!lk) return false;
    return (
      getDefaultOverrideRepository()?.hasValue(
        lk.gridMode,
        lk.motionType,
        lk.placementKey,
        lk.turns,
      ) ?? false
    );
  });
```

- [ ] **Step 5: Widen `tierLabel`'s parameter is already `PipelineTier` (no change). Update `defaultEditTargetForActiveTier` return + body (lines 235-240)**

Replace:

```ts
  function defaultEditTargetForActiveTier(): "global" | "special-json" | "prop-geometry" {
    const active = diagnostics?.activeTier;
    if (active === "special-json") return "special-json";
    if (active === "prop-geometry") return "prop-geometry";
    return "global";
  }
```

with:

```ts
  function defaultEditTargetForActiveTier(): "global" | "special-json" | "prop-geometry" | "default" {
    const active = diagnostics?.activeTier;
    if (active === "special-json") return "special-json";
    if (active === "prop-geometry") return "prop-geometry";
    if (active === "default") return "default";
    return "global";
  }
```

- [ ] **Step 6: Add the `default` arm to `syncNumericInputs` (inside the `else if` chain, after the prop-geometry block ends at line 293)**

Replace the closing of the chain:

```ts
    } else if (editTarget === "prop-geometry") {
      const repo = getPropGeometryRepository();
      const existing = repo && propGeometryKey ? repo.getAdjustment(propGeometryKey) : null;
      if (existing) {
        editX = existing.x;
        editY = existing.y;
      } else if (diagnostics?.propGeometry) {
        editX = diagnostics.propGeometry.value.x;
        editY = diagnostics.propGeometry.value.y;
      } else {
        editX = 0;
        editY = 0;
      }
    }
  }
```

with:

```ts
    } else if (editTarget === "prop-geometry") {
      const repo = getPropGeometryRepository();
      const existing = repo && propGeometryKey ? repo.getAdjustment(propGeometryKey) : null;
      if (existing) {
        editX = existing.x;
        editY = existing.y;
      } else if (diagnostics?.propGeometry) {
        editX = diagnostics.propGeometry.value.x;
        editY = diagnostics.propGeometry.value.y;
      } else {
        editX = 0;
        editY = 0;
      }
    } else if (editTarget === "default") {
      // diagnostics.default.value is already Firestore-first (resolver-sourced),
      // so it reflects any existing override; seed the inputs from it.
      if (diagnostics?.default) {
        editX = diagnostics.default.value.x;
        editY = diagnostics.default.value.y;
      } else {
        editX = 0;
        editY = 0;
      }
    }
  }
```

- [ ] **Step 7: Widen `selectEditTarget`'s parameter type (line 296)**

Replace:

```ts
  function selectEditTarget(tier: "global" | "special-json" | "prop-geometry") {
```

with:

```ts
  function selectEditTarget(tier: "global" | "special-json" | "prop-geometry" | "default") {
```

- [ ] **Step 8: Add the `default` arm to `handleWASDMovement` (lines 354-360)**

Replace:

```ts
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }
```

with:

```ts
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else if (editTarget === "prop-geometry") {
      handlePropGeometryNumericUpdate();
    } else {
      handleDefaultNumericUpdate();
    }
```

- [ ] **Step 9: Add the `default` dispatch to `handleSave` and `handleDelete`**

In `handleSave` (after the prop-geometry guard, line 370-372), insert before the global fallthrough:

```ts
    if (editTarget === "default") {
      return handleDefaultSave();
    }
```

In `handleDelete` (after the prop-geometry guard, line 404-406), insert before the global fallthrough:

```ts
    if (editTarget === "default") {
      return handleDefaultDelete();
    }
```

- [ ] **Step 10: Add the `default` arm to `handleNumericChange` (lines 427-435)**

Replace:

```ts
  function handleNumericChange() {
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else {
      handlePropGeometryNumericUpdate();
    }
  }
```

with:

```ts
  function handleNumericChange() {
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else if (editTarget === "special-json") {
      handleSpecialJsonNumericUpdate();
    } else if (editTarget === "prop-geometry") {
      handlePropGeometryNumericUpdate();
    } else {
      handleDefaultNumericUpdate();
    }
  }
```

- [ ] **Step 11: Add the three default handlers**

Immediately after `handlePropGeometryDelete` (after line 600, before `</script>`), add:

```ts
  function handleDefaultNumericUpdate() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    repo.saveDefaultLocal(lk.gridMode, lk.motionType, lk.placementKey, lk.turns, [editX, editY]);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  async function handleDefaultSave() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    try {
      saveState = "saving";
      await repo.saveDefault(lk.gridMode, lk.motionType, lk.placementKey, lk.turns, [editX, editY]);
      saveState = "saved";
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Default save failed:", error);
      saveState = "idle";
    }
  }

  async function handleDefaultDelete() {
    const repo = getDefaultOverrideRepository();
    const lk = defaultLookup;
    if (!repo || !lk) return;
    try {
      repo.deleteDefaultLocal(lk.gridMode, lk.motionType, lk.placementKey, lk.turns);
      await repo.deleteDefault(lk.gridMode, lk.motionType, lk.placementKey, lk.turns);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      getHapticFeedback()?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Default delete failed:", error);
    }
  }
```

- [ ] **Step 12: Add the Revert affordance for the default tier in the template (lines 632-638)**

Replace the `{#if ...}{:else if ...}{:else if ...}{/if}` delete-button chain:

```svelte
      {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
        <button class="btn btn-delete" onclick={handleDelete} title="Revert to original"><i class="fas fa-undo" aria-hidden="true"></i> Revert</button>
      {:else if editTarget === "prop-geometry" && propGeometryHasValue}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete prop geometry adjustment" title="Delete prop geometry adjustment"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete at this layer" title="Delete at this layer"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {/if}
```

with (adds the `default` arm):

```svelte
      {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
        <button class="btn btn-delete" onclick={handleDelete} title="Revert to original"><i class="fas fa-undo" aria-hidden="true"></i> Revert</button>
      {:else if editTarget === "prop-geometry" && propGeometryHasValue}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete prop geometry adjustment" title="Delete prop geometry adjustment"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {:else if editTarget === "default" && defaultHasValue}
        <button class="btn btn-delete" onclick={handleDelete} title="Revert to JSON baseline"><i class="fas fa-undo" aria-hidden="true"></i> Revert</button>
      {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
        <button class="btn btn-delete icon-only" onclick={handleDelete} aria-label="Delete at this layer" title="Delete at this layer"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
      {/if}
```

- [ ] **Step 13: Fix the Save button `disabled` predicate (line 639)**

The default tier has no `currentLayerValue`, and a fresh override starts from the JSON value (so `hasLocalChanges` is the right gate, identical to special-json/prop-geometry — those already rely on `hasLocalChanges`). No change needed; the existing predicate `disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}` already enables Save for the default tier once a WASD/numeric edit sets `hasLocalChanges`. Verify by reading the line; if it differs, leave it. (No edit in this step — it is a verification checkpoint.)

- [ ] **Step 14: Verify the dock compiles via check:watch (already running) and the existing tests still pass**

Run: `npx vitest run tests/unit/arrow-adjustment/ --config tests/config/vitest.config.ts`
Expected: PASS (all arrow-adjustment tests, including the prior special-override key tests).

- [ ] **Step 15: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte
git commit -m "feat(arrow-positioning): editable Default tier in pipeline editor dock" -- src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineEditorDock.svelte
```

---

## Task 11: Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the collection rule**

After the `special_arrow_placements` match block (`firestore.rules:988-993`), insert:

```
    // Default arrow placements — canonical baseline arrow positions (one doc per
    // {gridMode}_{motionType}). Readable by all (every arrow render needs them,
    // incl. guests / pre-auth), writable by admins.
    match /default_arrow_adjustments/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
```

> Read is `if true` (not `if isAuthenticated()` like special/global) because defaults underpin *every* arrow including guest/pre-auth renders — same rationale as `prop_geometry_adjustments` (`firestore.rules:116-121`).

- [ ] **Step 2: Validate the rules compile**

Run: `npx firebase deploy --only firestore:rules --dry-run`
Expected: "rules file ... compiled successfully" (no syntax error). If the CLI is not authenticated, validate locally instead with: `npx firebase firestore:rules:canary --help` is unavailable — fall back to deploying for real in Step 3 (the parse happens server-side).

- [ ] **Step 3: Deploy the rules**

Run: `npx firebase deploy --only firestore:rules`
Expected: "Deploy complete!" Without this deploy, admin writes to `default_arrow_adjustments` are denied and reads fall back to JSON (non-breaking, but the feature won't persist).

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(arrow-positioning): firestore rule for default_arrow_adjustments" -- firestore.rules
```

---

## Task 12: Seed + export scripts

**Files:**
- Create: `scripts/seed-default-arrow-placements.ts`
- Create: `scripts/export-default-arrow-placements.ts`

Mirrors `scripts/seed-prop-geometry-adjustments.ts` (Admin SDK, `firebase-service-account.json` at project root, run with `npx tsx`).

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-default-arrow-placements.ts`:

```ts
/**
 * Seed Default Arrow Placements to Firestore
 *
 * Usage: npx tsx scripts/seed-default-arrow-placements.ts
 *
 * Reads the 10 static default placement JSON files and writes one Firestore doc
 * per {gridMode}_{motionType} into default_arrow_adjustments. Idempotent — a
 * re-run overwrites the docs back to the committed JSON baseline (clean reset).
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

const GRID_MODES = ["box", "diamond"] as const;
const MOTION_TYPES = ["pro", "anti", "float", "dash", "static"] as const;

function staticFilePath(gridMode: string, motionType: string): string {
  return path.resolve(
    __dirname,
    `../static/data/arrow_placement/${gridMode}/default/default_${gridMode}_${motionType}_placements.json`,
  );
}

async function main() {
  const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(
      "Missing firebase-service-account.json in project root.\n" +
        "Download from Firebase Console → Project Settings → Service Accounts.",
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const collectionName = "default_arrow_adjustments";

  let written = 0;
  for (const gridMode of GRID_MODES) {
    for (const motionType of MOTION_TYPES) {
      const file = staticFilePath(gridMode, motionType);
      if (!fs.existsSync(file)) {
        console.warn(`  ⚠ missing ${file} — skipping`);
        continue;
      }
      const placements = JSON.parse(fs.readFileSync(file, "utf-8"));
      const docId = `${gridMode}_${motionType}`;
      await db.collection(collectionName).doc(docId).set({
        gridMode,
        motionType,
        placements,
        updatedAt: new Date(),
        updatedBy: "seed",
      });
      written++;
      console.log(`  ✓ ${docId} (${Object.keys(placements).length} placement keys)`);
    }
  }

  console.log(`\nDone. Seeded ${written} default placement docs.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Write the export script**

Create `scripts/export-default-arrow-placements.ts`:

```ts
/**
 * Export Default Arrow Placements from Firestore back to the static JSON files.
 *
 * Usage: npx tsx scripts/export-default-arrow-placements.ts
 *
 * Reads the default_arrow_adjustments docs and overwrites the 10 static JSON
 * files so the repo stays the long-term canonical record. Run after editing
 * defaults via the Inspect dock, then review + commit the JSON diff.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

const GRID_MODES = ["box", "diamond"] as const;
const MOTION_TYPES = ["pro", "anti", "float", "dash", "static"] as const;

function staticFilePath(gridMode: string, motionType: string): string {
  return path.resolve(
    __dirname,
    `../static/data/arrow_placement/${gridMode}/default/default_${gridMode}_${motionType}_placements.json`,
  );
}

async function main() {
  const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("Missing firebase-service-account.json in project root.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
  initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const collectionName = "default_arrow_adjustments";

  let written = 0;
  for (const gridMode of GRID_MODES) {
    for (const motionType of MOTION_TYPES) {
      const docId = `${gridMode}_${motionType}`;
      const snap = await db.collection(collectionName).doc(docId).get();
      if (!snap.exists) {
        console.warn(`  ⚠ no doc ${docId} — leaving JSON untouched`);
        continue;
      }
      const placements = snap.data()?.placements ?? {};
      const file = staticFilePath(gridMode, motionType);
      fs.writeFileSync(file, JSON.stringify(placements, null, 2) + "\n", "utf-8");
      written++;
      console.log(`  ✓ ${docId} → ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`\nDone. Exported ${written} docs to JSON. Review + commit the diff.`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the seed (requires `firebase-service-account.json` + deployed rules from Task 11)**

Run: `npx tsx scripts/seed-default-arrow-placements.ts`
Expected: 10 lines `✓ {gridMode}_{motionType} (N placement keys)` then `Done. Seeded 10 default placement docs.`
If `firebase-service-account.json` is absent, this is a physical blocker — report it; the credential is the user's. The rest of the feature still type-checks and the read path degrades to JSON.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-default-arrow-placements.ts scripts/export-default-arrow-placements.ts
git commit -m "feat(arrow-positioning): seed + export scripts for default placements" -- scripts/seed-default-arrow-placements.ts scripts/export-default-arrow-placements.ts
```

---

## Task 13: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: One full typecheck**

Run: `npm run check > /tmp/default-tier-check.log 2>&1; echo done`
Then: `grep -niE "default-override|DefaultArrowPlacement|PipelineEditorDock|arrow-placer|arrow-adjustment-calculator|PipelineDiagnostics" /tmp/default-tier-check.log`
Expected: no errors referencing the touched files. (Pre-existing unrelated errors in other modules may exist — confirm none are in this feature's files. Per `fast-iteration-loop.md`, capture once, grep many.)

- [ ] **Step 2: Full arrow-adjustment test sweep**

Run: `npx vitest run tests/unit/arrow-adjustment/ --config tests/config/vitest.config.ts`
Expected: all PASS (domain, read-precedence, and the pre-existing special-override key tests).

- [ ] **Step 3: Runtime verification (admin session, dev server :5173)**

This is the only step that needs the live UI. It requires Austen (admin auth + visual confirmation). Provide these exact steps:
1. Open a sequence in the step editor, open the Inspect panel.
2. Select an arrow whose active tier is **Default** (or any arrow — the Default segment is always selectable).
3. Click the **Default** segment in the tier control.
4. Press **W/A/S/D** — the pictograph arrow should move live (single arrow, per the prior per-arrow-key fix).
5. Click **Save**. Reload. The new default should persist (now sourced Firestore-first).
6. Open a *different* letter/sequence that resolves to the **same** `placementKey + turns + gridMode + motionType` — it should show the new default too (whole-motion-class breadth).
7. Click **Revert** — the value returns to the JSON baseline.

Because this is a runtime/visual claim, do NOT assert it works from code alone. Capture a screenshot or have Austen confirm. Per `verification-protocol.md`: state "I cannot verify the live UI without an admin session — please run steps 1-7 and confirm."

- [ ] **Step 4: Optional — export round-trip to commit the new baseline**

After admin edits, run: `npx tsx scripts/export-default-arrow-placements.ts`, review the JSON diff, and commit the changed `static/data/arrow_placement/**/default/*.json` files so the repo stays canonical.

---

## Self-Review

**Spec coverage:**
- Whole-motion-class breadth → the Default key carries no letter/location; the dock writes via `defaultLookup` (gridMode+motionType+placementKey+turns) ✓ (Task 9, 10).
- Firebase canonical, JSON fallback → resolver-first read in ArrowPlacer; persister `loadAll` swallows permission/offline → JSON ✓ (Task 5, 3).
- Admin-gated authoring → repository `ADMIN_EMAIL` gate ✓ (Task 4); rules `write: if isAdmin()` ✓ (Task 11).
- Doc-per-`{gridMode}_{motionType}` (10 docs) → `generateDefaultDocId` + dense `placements` map ✓ (Task 1, 3).
- Nested merge write / nested field delete → `firestoreSet({merge})` + `FieldPath` delete ✓ (Task 3).
- Live preview loop → `saveDefaultLocal` + `clearCache` + `globalAdjustmentVersion.increment` ✓ (Task 10).
- Diagnostics extension (only change outside the new module + dock) → `DefaultTierInfo` + producer ✓ (Task 9).
- Seed + export scripts → Task 12.
- Firestore rules → Task 11.
- Init wiring → Task 8.

**Deviations from spec (deliberate, grounded in the actual code):**
1. **Read seam is an injected resolver consulted in `ArrowPlacer.getDefaultAdjustment`, not a load-time overlay of `allPlacements`.** Reason: `defaultPlacer` constructs its *own* `ArrowPlacer` instance, and `ArrowPlacer` also runs in the render worker. A load-time overlay would need cross-instance cache invalidation on every Firestore update; a lookup-time resolver needs none and is worker-safe (resolver stays null in workers). Same canonical-source intent, less surface area.
2. **Scripts are `.ts` run with `npx tsx`, not `.mjs`.** Reason: matches the established `scripts/seed-prop-geometry-adjustments.ts` Admin-SDK convention (`never-hand-roll` — follow existing patterns).

**Type consistency:** `getValue`/`hasValue`/`saveDefault`/`deleteDefault` use the same `(gridMode, motionType, placementKey, turns[, value])` argument order in state, repository, persister, resolver, and dock handlers. `PlacementValue = [number, number]` is the single value type throughout. `DefaultTierInfo` field names (`gridMode`/`motionType`/`placementKey`/`turns`) match what the dock's `defaultLookup` reads.

**Verified:** `GridMode` is a const object (`grid-enums.ts:126-129`) with `DIAMOND: "diamond"`, `BOX: "box"`, `SKEWED: "skewed"` — so the resolver string comparison (`grid === "box"`) and the `{gridMode}_{motionType}` doc id hold exactly. Task 7 Step 2 keeps the guard as a regression check.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
