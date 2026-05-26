# Special JSON Firestore Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firestore-backed per-letter arrow placement overrides (Special JSON tier) editable from the construct-mode inspect panel via WASD + numeric input.

**Architecture:** New `special-override` service module mirrors the existing `global` module pattern — domain types, Firestore persister, repository with reactive state, singleton accessor. The pipeline calculator probes this new Firestore tier between Global Override and static JSON. The PipelineTraceSection UI gains a tier-target selector and numeric inputs alongside the existing WASD editor.

**Tech Stack:** Svelte 5 runes, Firebase Firestore, Zod schemas, existing `firestoreList`/`firestoreSet`/`firestoreDelete` CRUD helpers.

---

### Task 1: Domain Types + Zod Schema

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts`

- [ ] **Step 1: Create the domain types file**

```ts
// src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts

import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";
import type { Timestamp } from "firebase/firestore";

export interface SpecialArrowPlacement {
  readonly key: string;
  readonly gridMode: string;
  readonly oriFolder: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly motionType: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
  readonly originalX: number;
  readonly originalY: number;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SpecialArrowPlacementInput {
  readonly gridMode: string;
  readonly oriFolder: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly motionType: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
  readonly originalX: number;
  readonly originalY: number;
}

export const SpecialArrowPlacementSchema = z
  .object({
    key: z.string(),
    gridMode: z.string(),
    oriFolder: z.string(),
    letter: z.string(),
    turnsTuple: z.string(),
    motionType: z.string(),
    adjustmentX: z.number(),
    adjustmentY: z.number(),
    originalX: z.number(),
    originalY: z.number(),
    updatedAt: firestoreDate,
    updatedBy: z.string(),
  })
  .passthrough();

export function generateSpecialOverrideKey(input: {
  gridMode: string;
  oriFolder: string;
  letter: string;
  turnsTuple: string;
  motionType: string;
}): string {
  return `${input.gridMode}|${input.oriFolder}|${input.letter}|${input.turnsTuple}|${input.motionType}`;
}

export function parseSpecialOverrideKey(key: string): {
  gridMode: string;
  oriFolder: string;
  letter: string;
  turnsTuple: string;
  motionType: string;
} | null {
  const parts = key.split("|");
  if (parts.length !== 5) return null;
  const [gridMode, oriFolder, letter, turnsTuple, motionType] = parts;
  if (!gridMode || !oriFolder || !letter || !turnsTuple || !motionType) return null;
  return { gridMode, oriFolder, letter, turnsTuple, motionType };
}

export function extractOriFolderFromPath(filePath: string): string {
  // filePath format: "diamond/special/from_layer1/R_placements.json"
  const parts = filePath.split("/");
  // The oriFolder is the part after "special/" — index 2 in "diamond/special/from_layer1/..."
  if (parts.length >= 3) return parts[2];
  return "from_layer1";
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement.ts
git commit -m "feat(arrow): add SpecialArrowPlacement domain types and Zod schema"
```

---

### Task 2: Reactive State

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts`

- [ ] **Step 1: Create the reactive state module**

Follow the exact pattern from `GlobalArrowAdjustmentState.svelte.ts`: a factory function returning a closure over `$state` runes.

```ts
// src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts

import { Point } from "fabric";
import {
  generateSpecialOverrideKey,
  type SpecialArrowPlacement,
} from "../domain/SpecialArrowPlacement";

export function createSpecialArrowPlacementState() {
  let overridesMap = $state<Map<string, SpecialArrowPlacement>>(new Map());
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() { return isInitialized; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get count() { return overridesMap.size; },

    getOverride(key: string): Point | null {
      const entry = overridesMap.get(key);
      if (!entry) return null;
      return new Point(entry.adjustmentX, entry.adjustmentY);
    },

    getFullOverride(key: string): SpecialArrowPlacement | null {
      return overridesMap.get(key) ?? null;
    },

    hasOverride(key: string): boolean {
      return overridesMap.has(key);
    },

    setOverride(override: SpecialArrowPlacement): void {
      const newMap = new Map(overridesMap);
      newMap.set(override.key, override);
      overridesMap = newMap;
    },

    removeOverride(key: string): void {
      if (overridesMap.has(key)) {
        const newMap = new Map(overridesMap);
        newMap.delete(key);
        overridesMap = newMap;
      }
    },

    loadAll(overrides: SpecialArrowPlacement[]): void {
      isLoading = true;
      lastError = null;
      try {
        const newMap = new Map<string, SpecialArrowPlacement>();
        for (const override of overrides) {
          newMap.set(override.key, override);
        }
        overridesMap = newMap;
        isInitialized = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to load overrides";
      } finally {
        isLoading = false;
      }
    },

    clear(): void {
      overridesMap = new Map();
      isInitialized = false;
    },

    setLoading(loading: boolean): void { isLoading = loading; },
    setError(error: string | null): void { lastError = error; },
  };
}

export type SpecialArrowPlacementState = ReturnType<typeof createSpecialArrowPlacementState>;
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/special-override/state/SpecialArrowPlacementState.svelte.ts
git commit -m "feat(arrow): add SpecialArrowPlacement reactive state"
```

---

### Task 3: Firestore Persister

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementPersister.ts`

- [ ] **Step 1: Create the Firestore persister**

Follow `GlobalArrowAdjustmentPersister.ts` pattern exactly — `loadAll`, `save`, `delete`, `subscribe`.

```ts
// src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementPersister.ts

import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { firestoreList, firestoreSet } from "$lib/shared/firestore";
import {
  SpecialArrowPlacementSchema,
  generateSpecialOverrideKey,
  type SpecialArrowPlacement,
  type SpecialArrowPlacementInput,
} from "../../domain/SpecialArrowPlacement";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("SpecialArrowPlacementPersister");

const COLLECTION_NAME = "special_arrow_placements";

export class SpecialArrowPlacementPersister {
  private unsubscribe: Unsubscribe | null = null;

  async loadAll(): Promise<SpecialArrowPlacement[]> {
    try {
      const overrides = await firestoreList(
        COLLECTION_NAME,
        SpecialArrowPlacementSchema,
      );
      logger.success(`Loaded ${overrides.length} special placement overrides`);
      return overrides as unknown as SpecialArrowPlacement[];
    } catch (error) {
      logger.error("Failed to load overrides:", error);
      throw error;
    }
  }

  async save(input: SpecialArrowPlacementInput, userEmail: string): Promise<void> {
    const key = generateSpecialOverrideKey(input);
    try {
      await firestoreSet(
        COLLECTION_NAME,
        key,
        {
          key,
          gridMode: input.gridMode,
          oriFolder: input.oriFolder,
          letter: input.letter,
          turnsTuple: input.turnsTuple,
          motionType: input.motionType,
          adjustmentX: input.adjustmentX,
          adjustmentY: input.adjustmentY,
          originalX: input.originalX,
          originalY: input.originalY,
          updatedBy: userEmail,
        } as Record<string, unknown>,
      );
      logger.success(`Saved special override: ${key} → (${input.adjustmentX}, ${input.adjustmentY})`);
    } catch (error) {
      logger.error(`Failed to save override ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(firestore, COLLECTION_NAME, key);
      await deleteDoc(docRef);
      logger.success(`Deleted special override: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete override ${key}:`, error);
      throw error;
    }
  }

  subscribe(
    onAdd: (override: SpecialArrowPlacement) => void,
    onRemove: (key: string) => void,
  ): () => void {
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
              const data = change.doc.data();
              const key = change.doc.id;
              if (change.type === "added" || change.type === "modified") {
                if (
                  data.gridMode &&
                  data.letter &&
                  data.motionType &&
                  typeof data.adjustmentX === "number" &&
                  typeof data.adjustmentY === "number"
                ) {
                  onAdd({
                    key,
                    gridMode: data.gridMode,
                    oriFolder: data.oriFolder ?? "from_layer1",
                    letter: data.letter,
                    turnsTuple: data.turnsTuple ?? "",
                    motionType: data.motionType,
                    adjustmentX: data.adjustmentX,
                    adjustmentY: data.adjustmentY,
                    originalX: data.originalX ?? 0,
                    originalY: data.originalY ?? 0,
                    updatedAt: data.updatedAt,
                    updatedBy: data.updatedBy ?? "unknown",
                  });
                }
              } else if (change.type === "removed") {
                onRemove(key);
              }
            });
          },
          (error: unknown) => {
            logger.error("Subscription error:", error);
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

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementPersister.ts
git commit -m "feat(arrow): add SpecialArrowPlacement Firestore persister"
```

---

### Task 4: Repository + Singleton

**Files:**
- Create: `src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementRepository.ts`
- Create: `src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts`

- [ ] **Step 1: Create the repository**

```ts
// src/lib/shared/pictograph/arrow/positioning/special-override/services/implementations/SpecialArrowPlacementRepository.ts

import type { Point } from "fabric";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import {
  generateSpecialOverrideKey,
  type SpecialArrowPlacement,
  type SpecialArrowPlacementInput,
} from "../../domain/SpecialArrowPlacement";
import type { SpecialArrowPlacementPersister } from "./SpecialArrowPlacementPersister";
import {
  createSpecialArrowPlacementState,
  type SpecialArrowPlacementState,
} from "../../state/SpecialArrowPlacementState.svelte";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import { globalAdjustmentVersion } from "../../../global/state/global-adjustment-version.svelte";

const logger = createComponentLogger("SpecialArrowPlacementRepository");
const ADMIN_EMAIL = "austencloud@gmail.com";

export class SpecialArrowPlacementRepository {
  private readonly state: SpecialArrowPlacementState;
  private unsubscribe: (() => void) | null = null;
  private initializePromise: Promise<void> | null = null;

  constructor(private readonly persister: SpecialArrowPlacementPersister) {
    this.state = createSpecialArrowPlacementState();
  }

  get isInitialized(): boolean { return this.state.isInitialized; }

  async initialize(): Promise<void> {
    if (this.initializePromise) return this.initializePromise;
    if (this.state.isInitialized) return;
    this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      this.state.setLoading(true);
      logger.info("Initializing special placement overrides...");

      const overrides = await this.persister.loadAll();
      this.state.loadAll(overrides);

      if (overrides.length > 0) {
        globalAdjustmentVersion.increment();
      }

      this.unsubscribe = this.persister.subscribe(
        (override: SpecialArrowPlacement) => {
          this.state.setOverride(override);
          logger.info(`Real-time update: ${override.key}`);
        },
        (key: string) => {
          this.state.removeOverride(key);
          logger.info(`Real-time removal: ${key}`);
        },
      );

      logger.success(`Initialized with ${this.state.count} special placement overrides`);
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

  getOverride(key: string): Point | null {
    return this.state.getOverride(key);
  }

  getFullOverride(key: string): SpecialArrowPlacement | null {
    return this.state.getFullOverride(key);
  }

  hasOverride(key: string): boolean {
    return this.state.hasOverride(key);
  }

  saveOverrideLocal(input: SpecialArrowPlacementInput): void {
    const key = generateSpecialOverrideKey(input);
    this.state.setOverride({
      key,
      ...input,
      updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      updatedBy: authState.user?.email || "unknown",
    });
  }

  deleteOverrideLocal(key: string): void {
    this.state.removeOverride(key);
  }

  async saveOverride(input: SpecialArrowPlacementInput): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can save special placement overrides");
    }
    await this.persister.save(input, email);
    const key = generateSpecialOverrideKey(input);
    this.state.setOverride({
      key,
      ...input,
      updatedAt: null as unknown as import("firebase/firestore").Timestamp,
      updatedBy: email,
    });
  }

  async deleteOverride(key: string): Promise<void> {
    const email = authState.user?.email;
    if (email !== ADMIN_EMAIL) {
      throw new Error("Only admin can delete special placement overrides");
    }
    await this.persister.delete(key);
    this.state.removeOverride(key);
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.state.clear();
  }
}
```

- [ ] **Step 2: Create the singleton**

```ts
// src/lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton.ts

import { SpecialArrowPlacementRepository } from "./implementations/SpecialArrowPlacementRepository";
import { SpecialArrowPlacementPersister } from "./implementations/SpecialArrowPlacementPersister";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("SpecialOverrideSingleton");

let repositoryInstance: SpecialArrowPlacementRepository | null = null;
let initializationPromise: Promise<void> | null = null;

export function getSpecialOverrideRepository(): SpecialArrowPlacementRepository | null {
  return repositoryInstance;
}

export async function initializeSpecialOverrides(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  if (repositoryInstance?.isInitialized) return;
  initializationPromise = doInitialize();
  return initializationPromise;
}

async function doInitialize(): Promise<void> {
  try {
    logger.info("Initializing special placement override system...");
    const persister = new SpecialArrowPlacementPersister();
    const repository = new SpecialArrowPlacementRepository(persister);
    await repository.initialize();
    repositoryInstance = repository;
    logger.success("Special placement override system initialized");
  } catch (error) {
    logger.error("Failed to initialize special overrides:", error);
  } finally {
    initializationPromise = null;
  }
}

export function disposeSpecialOverrides(): void {
  if (repositoryInstance) {
    repositoryInstance.dispose();
    repositoryInstance = null;
    logger.info("Special placement override system disposed");
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/special-override/services/
git commit -m "feat(arrow): add SpecialArrowPlacement repository and singleton"
```

---

### Task 5: Boot Initialization

**Files:**
- Modify: `src/lib/shared/auth/services/auth-boot-orchestrator.ts`

- [ ] **Step 1: Add special override initialization alongside global adjustments**

Add this block after the existing "Initialize prop geometry adjustments" block (after line 61 in auth-boot-orchestrator.ts):

```ts
  // Initialize special arrow placement overrides (non-blocking)
  import("$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton")
    .then(async ({ initializeSpecialOverrides }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await initializeSpecialOverrides();
    })
    .catch((error) => {
      console.warn("⚠️ [authState] Special placement overrides initialization failed:", error);
    });
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/auth/services/auth-boot-orchestrator.ts
git commit -m "feat(arrow): initialize special placement overrides on auth boot"
```

---

### Task 6: Pipeline Diagnostics Update

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts`

- [ ] **Step 1: Add `firestoreOverride` field to `SpecialJsonTierInfo`**

Replace the existing `SpecialJsonTierInfo` interface:

```ts
// In PipelineDiagnostics.ts — replace lines 30-36

export interface SpecialJsonTierInfo {
  value: TierValue;
  /** e.g. "diamond/special/from_layer1/H_placements.json" */
  filePath: string;
  /** e.g. "(2.5, 2.5)" */
  turnsTupleKey: string;
  /** Non-null when a Firestore override exists for this key */
  firestoreOverride: {
    value: TierValue;
    original: TierValue | null;
    updatedBy: string;
  } | null;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in files that construct `SpecialJsonTierInfo` without the new field. Note them — they'll be fixed in Task 7.

- [ ] **Step 3: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/calculation/domain/PipelineDiagnostics.ts
git commit -m "feat(arrow): add firestoreOverride field to SpecialJsonTierInfo"
```

---

### Task 7: ArrowAdjustmentCalculator — Diagnostics Probe + Base Adjustment

**Files:**
- Modify: `src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts`

- [ ] **Step 1: Add import for special override singleton**

Add to the imports section at the top of the file:

```ts
import { getSpecialOverrideRepository } from "../../../special-override/services/special-override-singleton";
import {
  generateSpecialOverrideKey,
  extractOriFolderFromPath,
} from "../../../special-override/domain/SpecialArrowPlacement";
```

- [ ] **Step 2: Update the Special JSON probe in `getDiagnostics()` (lines 263-288)**

Replace the existing Tier 2 special JSON probe section with this version that also checks Firestore:

```ts
    // --- Tier 2: Special JSON (static per-letter files + Firestore overrides) ---
    if (letter) {
      try {
        const [, , attrKey] = this.generateLookupKeys(
          pictographData,
          motionData
        );
        const jsonResult =
          await this.SpecialPlacer.getSpecialJsonAdjustmentOnly(
            motionData,
            pictographData,
            arrowColor,
            attrKey
          );

        if (jsonResult) {
          const specialJsonInfo: SpecialJsonTierInfo = {
            value: { x: jsonResult.adjustment.x, y: jsonResult.adjustment.y },
            filePath: jsonResult.filePath,
            turnsTupleKey: String(jsonResult.turnsTupleKey),
            firestoreOverride: null,
          };

          // Check for Firestore override
          const specialOverrideRepo = getSpecialOverrideRepository();
          if (specialOverrideRepo?.isInitialized) {
            const oriFolder = extractOriFolderFromPath(jsonResult.filePath);
            const overrideKey = generateSpecialOverrideKey({
              gridMode: motionData.gridMode || (pictographData.motions.blue && pictographData.motions.red
                ? _deriveGridMode(pictographData.motions.blue, pictographData.motions.red) : "diamond"),
              oriFolder,
              letter: pictographData.letter || "",
              turnsTuple: String(jsonResult.turnsTupleKey),
              motionType: motionData.motionType?.toLowerCase() || "",
            });
            const fullOverride = specialOverrideRepo.getFullOverride(overrideKey);
            if (fullOverride) {
              specialJsonInfo.firestoreOverride = {
                value: { x: fullOverride.adjustmentX, y: fullOverride.adjustmentY },
                original: { x: jsonResult.adjustment.x, y: jsonResult.adjustment.y },
                updatedBy: fullOverride.updatedBy,
              };
              specialJsonInfo.value = { x: fullOverride.adjustmentX, y: fullOverride.adjustmentY };
            }
          }

          diagnostics.specialJson = specialJsonInfo;
        } else {
          // No static JSON entry — but there might be a Firestore-only override
          const specialOverrideRepo = getSpecialOverrideRepository();
          if (specialOverrideRepo?.isInitialized && pictographData.letter) {
            const rawOriKey = generateOrientationKey(motionData, pictographData);
            const oriKey = resolveEffectiveOriKey(rawOriKey, pictographData);
            const legacyOriKey = mapToLegacyBucket(rawOriKey);
            const gridMode = motionData.gridMode || (pictographData.motions.blue && pictographData.motions.red
              ? _deriveGridMode(pictographData.motions.blue, pictographData.motions.red) : "diamond");
            const turnsTupleArr = generateTurnsTuple(pictographData);

            // Try with oriKey first, then legacy
            for (const folder of [oriKey, legacyOriKey]) {
              const overrideKey = generateSpecialOverrideKey({
                gridMode,
                oriFolder: folder,
                letter: pictographData.letter,
                turnsTuple: turnsTupleArr.join(","),
                motionType: motionData.motionType?.toLowerCase() || "",
              });
              const fullOverride = specialOverrideRepo.getFullOverride(overrideKey);
              if (fullOverride) {
                diagnostics.specialJson = {
                  value: { x: fullOverride.adjustmentX, y: fullOverride.adjustmentY },
                  filePath: `${gridMode}/special/${folder}/${pictographData.letter}_placements.json`,
                  turnsTupleKey: turnsTupleArr.join(","),
                  firestoreOverride: {
                    value: { x: fullOverride.adjustmentX, y: fullOverride.adjustmentY },
                    original: null,
                    updatedBy: fullOverride.updatedBy,
                  },
                };
                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn("[getDiagnostics] Special JSON tier probe failed:", error);
      }
    }
```

- [ ] **Step 3: Update `lookupSpecialPlacement()` to check Firestore overrides**

In the private `lookupSpecialPlacement` method, add a Firestore override check before the static JSON lookup. Replace the method:

```ts
  private async lookupSpecialPlacement(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<Point | null> {
    try {
      // Check Firestore special overrides first
      const specialOverrideRepo = getSpecialOverrideRepository();
      if (specialOverrideRepo?.isInitialized && pictographData.letter) {
        // Get the JSON result to extract the key components
        const jsonResult = await this.SpecialPlacer.getSpecialJsonAdjustmentOnly(
          motionData,
          pictographData,
          arrowColor,
          attributeKey
        );

        if (jsonResult) {
          const oriFolder = extractOriFolderFromPath(jsonResult.filePath);
          const gridMode = motionData.gridMode || (pictographData.motions.blue && pictographData.motions.red
            ? _deriveGridMode(pictographData.motions.blue, pictographData.motions.red) : "diamond");
          const overrideKey = generateSpecialOverrideKey({
            gridMode,
            oriFolder,
            letter: pictographData.letter,
            turnsTuple: String(jsonResult.turnsTupleKey),
            motionType: motionData.motionType?.toLowerCase() || "",
          });

          const override = specialOverrideRepo.getOverride(overrideKey);
          if (override) {
            return new Point(override.x, override.y);
          }
        }
      }

      // Fall through to static JSON
      const adjustment = await this.SpecialPlacer.getSpecialAdjustment(
        motionData,
        pictographData,
        arrowColor,
        attributeKey
      );
      if (adjustment) {
        return new Point(adjustment.x, adjustment.y);
      }
      return null;
    } catch (error) {
      console.error("Error in special placement lookup:", error);
      return null;
    }
  }
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors (all `SpecialJsonTierInfo` constructions now include `firestoreOverride`).

- [ ] **Step 5: Commit**

```
git add src/lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowAdjustmentCalculator.ts
git commit -m "feat(arrow): add Firestore override probe to pipeline diagnostics and base adjustment"
```

---

### Task 8: PipelineTraceSection UI — Tier Target + Numeric Inputs + Special JSON Editing

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte`

- [ ] **Step 1: Add imports and state for Special JSON editing**

Add these imports to the `<script>` section:

```ts
import { getSpecialOverrideRepository } from "$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-singleton";
import {
  generateSpecialOverrideKey,
  extractOriFolderFromPath,
  type SpecialArrowPlacementInput,
} from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
  mapToLegacyBucket,
} from "$lib/shared/pictograph/arrow/positioning/key-generation/services/special-placement-ori-key-generator";
import { generateTurnsTuple } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/turns-tuple-key-generator";
import { deriveGridMode as _deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
```

Add new state variables after existing editing state:

```ts
  // Edit target: which tier we're editing
  let editTarget = $state<"global" | "special-json">("global");

  // Numeric input state for the editor
  let editX = $state(0);
  let editY = $state(0);
```

- [ ] **Step 2: Add special JSON key computation**

Add a derived that computes the special override key from current diagnostics:

```ts
  const specialOverrideKey = $derived.by((): string | null => {
    if (!diagnostics || !stepData.letter) return null;
    const motion = stepData.motions?.[color];
    if (!motion) return null;

    // If diagnostics has specialJson info, use its filePath for the oriFolder
    if (diagnostics.specialJson) {
      const oriFolder = extractOriFolderFromPath(diagnostics.specialJson.filePath);
      const gridMode = motion.gridMode || "diamond";
      return generateSpecialOverrideKey({
        gridMode,
        oriFolder,
        letter: stepData.letter,
        turnsTuple: diagnostics.specialJson.turnsTupleKey,
        motionType: motion.motionType?.toLowerCase() || "",
      });
    }

    // Fallback: compute from motion data directly
    const pictographData = {
      id: stepData.id,
      letter: stepData.letter,
      startPosition: stepData.startPosition,
      endPosition: stepData.endPosition,
      motions: stepData.motions as import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData["motions"],
    };
    const rawOriKey = generateOrientationKey(motion, pictographData);
    const oriKey = resolveEffectiveOriKey(rawOriKey, pictographData);
    const gridMode = motion.gridMode || (stepData.motions.blue && stepData.motions.red
      ? _deriveGridMode(stepData.motions.blue, stepData.motions.red) : "diamond");
    const turnsTupleArr = generateTurnsTuple(pictographData);
    return generateSpecialOverrideKey({
      gridMode,
      oriFolder: oriKey,
      letter: stepData.letter,
      turnsTuple: turnsTupleArr.join(","),
      motionType: motion.motionType?.toLowerCase() || "",
    });
  });
```

- [ ] **Step 3: Update `toggleEditing()` to sync numeric inputs**

Replace the existing `toggleEditing` function:

```ts
  function toggleEditing() {
    if (!isEditing) {
      if (!orchestrator) {
        orchestrator = getArrowAdjustmentOrchestrator() as ArrowAdjustmentOrchestrator;
      }
      const defaultLayer = orchestrator.getDefaultSaveLayer(thisPropType, otherPropType);
      activeLayer = defaultLayer;
      editTarget = "global";
      syncNumericInputs();
    }
    isEditing = !isEditing;
    hasLocalChanges = false;
    saveState = "idle";
  }

  function syncNumericInputs() {
    if (editTarget === "global") {
      const val = currentLayerValue;
      editX = val?.x ?? 0;
      editY = val?.y ?? 0;
    } else if (editTarget === "special-json") {
      const repo = getSpecialOverrideRepository();
      if (repo?.isInitialized && specialOverrideKey) {
        const override = repo.getOverride(specialOverrideKey);
        if (override) {
          editX = override.x;
          editY = override.y;
        } else if (diagnostics?.specialJson) {
          editX = diagnostics.specialJson.value.x;
          editY = diagnostics.specialJson.value.y;
        } else {
          editX = 0;
          editY = 0;
        }
      } else if (diagnostics?.specialJson) {
        editX = diagnostics.specialJson.value.x;
        editY = diagnostics.specialJson.value.y;
      }
    }
  }

  function selectEditTarget(tier: "global" | "special-json") {
    editTarget = tier;
    hasLocalChanges = false;
    saveState = "idle";
    syncNumericInputs();
  }
```

- [ ] **Step 4: Add Special JSON WASD + numeric + save/delete handlers**

Add these functions after the existing `handleDelete`:

```ts
  function handleNumericChange() {
    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else {
      handleSpecialJsonNumericUpdate();
    }
  }

  function handleGlobalNumericUpdate() {
    if (!orchestrator || !selectedArrowContext) return;
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return;
    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;
    repo.saveAdjustmentLocal({
      ...targetKey,
      adjustmentX: editX,
      adjustmentY: editY,
    });
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  function handleSpecialJsonNumericUpdate() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    const originalValue = diagnostics?.specialJson?.firestoreOverride?.original
      ?? (diagnostics?.specialJson ? diagnostics.specialJson.value : null);
    const input = buildSpecialJsonInput(editX, editY, originalValue);
    if (!input) return;
    repo.saveOverrideLocal(input);
    pictographPreparer.clearCache();
    globalAdjustmentVersion.increment();
    hasLocalChanges = true;
  }

  function buildSpecialJsonInput(
    x: number, y: number,
    original: { x: number; y: number } | null
  ): SpecialArrowPlacementInput | null {
    const motion = stepData.motions?.[color];
    if (!motion || !stepData.letter) return null;

    let oriFolder: string;
    let turnsTuple: string;
    let gridMode: string;

    if (diagnostics?.specialJson) {
      oriFolder = extractOriFolderFromPath(diagnostics.specialJson.filePath);
      turnsTuple = diagnostics.specialJson.turnsTupleKey;
      gridMode = motion.gridMode || "diamond";
    } else {
      const pictographData = {
        id: stepData.id,
        letter: stepData.letter,
        startPosition: stepData.startPosition,
        endPosition: stepData.endPosition,
        motions: stepData.motions as import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData["motions"],
      };
      const rawOriKey = generateOrientationKey(motion, pictographData);
      oriFolder = resolveEffectiveOriKey(rawOriKey, pictographData);
      const turnsTupleArr = generateTurnsTuple(pictographData);
      turnsTuple = turnsTupleArr.join(",");
      gridMode = motion.gridMode || (stepData.motions.blue && stepData.motions.red
        ? _deriveGridMode(stepData.motions.blue, stepData.motions.red) : "diamond");
    }

    return {
      gridMode,
      oriFolder,
      letter: stepData.letter,
      turnsTuple,
      motionType: motion.motionType?.toLowerCase() || "",
      adjustmentX: x,
      adjustmentY: y,
      originalX: original?.x ?? 0,
      originalY: original?.y ?? 0,
    };
  }

  async function handleSpecialJsonSave() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    const originalValue = diagnostics?.specialJson?.firestoreOverride?.original
      ?? (diagnostics?.specialJson && !diagnostics.specialJson.firestoreOverride
        ? diagnostics.specialJson.value : null);
    const input = buildSpecialJsonInput(editX, editY, originalValue);
    if (!input) return;
    try {
      saveState = "saving";
      await repo.saveOverride(input);
      saveState = "saved";
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Special JSON save failed:", error);
      saveState = "idle";
    }
  }

  async function handleSpecialJsonDelete() {
    const repo = getSpecialOverrideRepository();
    if (!repo || !specialOverrideKey) return;
    try {
      repo.deleteOverrideLocal(specialOverrideKey);
      await repo.deleteOverride(specialOverrideKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Special JSON delete failed:", error);
    }
  }
```

- [ ] **Step 5: Update `handleKeydown` and `handleWASDMovement` to support Special JSON target**

Replace the existing `handleWASDMovement`:

```ts
  async function handleWASDMovement(key: "w" | "a" | "s" | "d", increment: number) {
    const directionMap: Record<string, { dx: number; dy: number }> = {
      w: { dx: 0, dy: -increment },
      s: { dx: 0, dy: increment },
      a: { dx: -increment, dy: 0 },
      d: { dx: increment, dy: 0 },
    };
    const dir = directionMap[key]!;
    editX += dir.dx;
    editY += dir.dy;

    if (editTarget === "global") {
      handleGlobalNumericUpdate();
    } else {
      handleSpecialJsonNumericUpdate();
    }

    const haptic = getHapticFeedback();
    haptic?.trigger("selection");
  }
```

Also update the existing `handleSave` and `handleDelete` to dispatch based on `editTarget`:

```ts
  async function handleSave() {
    if (editTarget === "special-json") {
      return handleSpecialJsonSave();
    }
    // existing global save logic (keep as-is)
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !orchestrator || !selectedArrowContext) return;
    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;
    const adj = repo.getAdjustment(targetKey);
    if (!adj) return;
    try {
      saveState = "saving";
      await repo.saveAdjustment({
        ...targetKey,
        adjustmentX: adj.x,
        adjustmentY: adj.y,
      });
      saveState = "saved";
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("success");
      onDiagnosticsChanged?.();
      setTimeout(() => { saveState = "idle"; }, 2000);
    } catch (error) {
      logger.error("Save failed:", error);
      saveState = "idle";
    }
  }

  async function handleDelete() {
    if (editTarget === "special-json") {
      return handleSpecialJsonDelete();
    }
    // existing global delete logic (keep as-is)
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !orchestrator || !selectedArrowContext) return;
    const targetKey = orchestrator.generateTargetKey(
      selectedArrowContext, activeLayer, thisPropType, otherPropType
    );
    if (!targetKey) return;
    try {
      repo.deleteAdjustmentLocal(targetKey);
      await repo.deleteAdjustment(targetKey);
      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();
      hasLocalChanges = false;
      const haptic = getHapticFeedback();
      haptic?.trigger("warning");
      onDiagnosticsChanged?.();
    } catch (error) {
      logger.error("Delete failed:", error);
    }
  }
```

- [ ] **Step 6: Update the template — tier rows become clickable, special JSON shows override**

Replace the existing tier rows section (`{#each tiers ...}`) and everything below it through end of the editor section:

```svelte
    {#each tiers as { tier, info, detail }}
      {@const isActive = diagnostics.activeTier === tier}
      {@const isEditable = tier === "global" || tier === "special-json"}
      {@const isEditTarget = isEditing && editTarget === tier}
      <button
        class="tier-row"
        class:active={isActive}
        class:has-value={info != null}
        class:edit-target={isEditTarget}
        class:editable={isEditing && isEditable}
        style="--tier-color: {tierColor(tier)}"
        onclick={() => {
          if (isEditing && isEditable) {
            selectEditTarget(tier as "global" | "special-json");
          }
        }}
        disabled={!isEditing || !isEditable}
      >
        <span class="tier-icon">
          {#if isActive}
            <i class="fas fa-star" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-circle" aria-hidden="true"></i>
          {/if}
        </span>
        <span class="tier-name">{tierLabel(tier)}</span>
        {#if tier === "special-json" && diagnostics.specialJson?.firestoreOverride}
          <span class="tier-badge">(override)</span>
        {/if}
        {#if detail}
          <span class="tier-detail">{detail}</span>
        {/if}
        <span class="tier-value" class:none={!info}>
          {info ? formatValue(info.value) : "none"}
        </span>
      </button>

      <!-- Show original value when Special JSON has a Firestore override -->
      {#if tier === "special-json" && diagnostics.specialJson?.firestoreOverride?.original}
        <div class="original-row">
          <span class="original-icon">└</span>
          <span class="original-label">original</span>
          <span class="original-value">
            {formatValue(diagnostics.specialJson.firestoreOverride.original)}
          </span>
        </div>
      {/if}
    {/each}

    <!-- Summary row -->
    <div class="summary-row">
      <span class="summary-label">base</span>
      <span class="summary-value">{formatValue(diagnostics.baseAdjustment)}</span>
      <span class="summary-arrow">→</span>
      <span class="summary-label">rotated</span>
      <span class="summary-value">{formatValue(diagnostics.finalAdjustment)}</span>
    </div>
  {:else}
    <div class="loading">calculating...</div>
  {/if}

  <!-- Inline Editor -->
  {#if isEditing}
    <div class="editor-section">
      {#if editTarget === "global"}
        <LayerTabBar
          {activeLayer}
          onLayerChange={handleLayerChange}
          {layer1HasValue}
          {layer2HasValue}
          {layer3HasValue}
          {thisPropType}
          {otherPropType}
        />
      {:else}
        <div class="editor-target-label">
          Special JSON Override
        </div>
      {/if}

      <div class="editor-values">
        <label class="editor-input-label">
          X:
          <input
            type="number"
            class="editor-input"
            bind:value={editX}
            onchange={handleNumericChange}
          />
        </label>
        <label class="editor-input-label">
          Y:
          <input
            type="number"
            class="editor-input"
            bind:value={editY}
            onchange={handleNumericChange}
          />
        </label>
      </div>

      <div class="editor-hint">
        WASD to move · Shift = 20px · Ctrl+Shift = 200px
      </div>

      {#if hasLocalChanges}
        <div class="editor-unsaved">
          <i class="fas fa-circle" aria-hidden="true"></i> Unsaved
        </div>
      {/if}

      <div class="editor-actions">
        {#if editTarget === "special-json" && diagnostics?.specialJson?.firestoreOverride}
          <button class="btn btn-delete" onclick={handleDelete} title="Revert to original">
            <i class="fas fa-undo" aria-hidden="true"></i> Revert
          </button>
        {:else if editTarget === "global" && (currentLayerValue || layer1HasValue || layer2HasValue || layer3HasValue)}
          <button class="btn btn-delete" onclick={handleDelete} title="Delete at this layer">
            <i class="fas fa-trash-alt" aria-hidden="true"></i> Delete
          </button>
        {/if}
        <button
          class="btn btn-save"
          onclick={handleSave}
          disabled={!hasLocalChanges && !(editTarget === "global" && currentLayerValue)}
        >
          {#if saveState === "saving"}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if saveState === "saved"}
            <i class="fas fa-check" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-save" aria-hidden="true"></i>
          {/if}
          Save
        </button>
      </div>
    </div>
  {/if}
```

- [ ] **Step 7: Add new CSS styles**

Add these styles to the `<style>` section:

```css
  .tier-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 0.7rem;
    color: #484f58;
    transition: background 0.15s ease;
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    cursor: default;
    text-align: left;
    font-family: inherit;
  }

  .tier-row.editable {
    cursor: pointer;
  }

  .tier-row.editable:hover {
    background: rgba(56, 139, 253, 0.06);
    border-color: #30363d;
  }

  .tier-row.edit-target {
    background: rgba(56, 139, 253, 0.1);
    border-color: #58a6ff;
  }

  .tier-badge {
    font-size: 0.55rem;
    color: #a78bfa;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .original-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 6px 1px 24px;
    font-size: 0.6rem;
    color: #484f58;
  }

  .original-icon {
    color: #30363d;
    font-family: "SF Mono", Monaco, monospace;
  }

  .original-label {
    font-style: italic;
  }

  .original-value {
    margin-left: auto;
    font-family: "SF Mono", Monaco, monospace;
    text-decoration: line-through;
    color: #484f58;
  }

  .editor-target-label {
    text-align: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: #a78bfa;
    padding: 4px 0;
  }

  .editor-input-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #8b949e;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.85rem;
  }

  .editor-input {
    width: 70px;
    padding: 2px 6px;
    border: 1px solid #30363d;
    border-radius: 4px;
    background: #0d1117;
    color: #e6edf3;
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.85rem;
    text-align: right;
  }

  .editor-input:focus {
    outline: none;
    border-color: #58a6ff;
  }
```

Note: Remove the duplicate `.tier-row` base styles from the existing CSS — the new button-based `.tier-row` replaces the old `div`-based one. Keep only the `.active` and `.has-value` modifiers that aren't already covered.

- [ ] **Step 8: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 9: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 10: Commit**

```
git add src/lib/features/create/shared/components/sequence-actions/pictograph-inspect/PipelineTraceSection.svelte
git commit -m "feat(arrow): add Special JSON editing + numeric inputs to pipeline trace UI"
```

---

### Task 9: Firestore Security Rules

**Files:**
- Modify: `firestore.rules` (or wherever Firestore security rules are defined)

- [ ] **Step 1: Find and update Firestore rules**

Run: `grep -r "global_arrow_adjustments" --include="*.rules" .` to find the rules file, then add:

```
match /special_arrow_placements/{docId} {
  allow read: if true;
  allow write: if request.auth != null
    && request.auth.token.email == "austencloud@gmail.com";
}
```

Place it alongside the existing `global_arrow_adjustments` rule.

- [ ] **Step 2: Commit**

```
git add firestore.rules
git commit -m "feat(arrow): add Firestore security rules for special_arrow_placements"
```

---

### Task 10: Full Build Verification

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: Zero errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual verification**

Open construct mode, load a sequence with letter R (3,3 turns), open the inspect panel. Verify:

1. Pipeline section shows all 4 tiers with values
2. Click "Edit" — Global Override is default target
3. Click the Special JSON tier row — editor switches to Special JSON mode
4. WASD keys adjust the values, numeric inputs update
5. Save writes to Firestore `special_arrow_placements` collection
6. After save, the Special JSON row shows "(override)" badge with the new value
7. Original static file value appears struck-through below
8. "Revert" button deletes the override, restoring static file value
9. Arrow position updates in real-time during WASD adjustment

- [ ] **Step 4: Final commit if any fixes were needed**
