# Compositional Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread the 3-tier data model (hand path -> solo prop -> sequence) through browsing and saving, so users can browse and save at any compositional tier.

**Architecture:** Fire-and-forget artifact extraction on every sequence save writes deduplicated hand paths and solo props to Firestore. A 2x2 browse taxonomy (subject x granularity) lets users toggle between props/hands and combined/solo views. Progressive disclosure means zero change for existing users.

**Tech Stack:** Svelte 5, ITI DI, Firebase Firestore, existing SequenceHydrator/ensureComposition

**Spec:** `docs/superpowers/specs/2026-03-19-compositional-data-model.md`

---

## Phase 1: Artifact Extraction on Save

> **IMPORTANT: Task ordering.** Task 3 (ArtifactProvenance type) MUST be done before Task 1, since Task 1 imports it. Execute in order: 3 → 1 → 2 → 4 → 5.

### Task 1: ArtifactExtractor Interface and Implementation

**Files:**
- Create: `src/lib/features/library/services/contracts/IArtifactExtractor.ts`
- Create: `src/lib/features/library/services/implementations/ArtifactExtractor.ts`
- Create: `tests/unit/ArtifactExtractor.test.ts`

- [ ] **Step 1: Write the failing test**

The ArtifactExtractor takes a hydrated SequenceData and writes decomposed artifacts. Since this involves Firestore writes, the testable part is the extraction logic — verifying it correctly identifies the 4 artifacts to write.

```typescript
// tests/unit/ArtifactExtractor.test.ts
import { describe, it, expect } from "vitest";
import { ArtifactExtractor } from "$lib/features/library/services/implementations/ArtifactExtractor";

describe("ArtifactExtractor", () => {
  it("extracts 4 artifacts from a hydrated sequence", async () => {
    const mockHandPathRepo = { save: vi.fn().mockResolvedValue(undefined) };
    const mockSoloPropRepo = { save: vi.fn().mockResolvedValue(undefined) };

    const extractor = new ArtifactExtractor(mockHandPathRepo, mockSoloPropRepo);

    const sequence = {
      id: "seq-1",
      blueSoloProp: {
        handPath: { steps: [{ startLocation: "n", endLocation: "s" }], contentHash: "hp-blue-hash" },
        steps: [{ startLocation: "n", endLocation: "s", orientation: "in" }],
        contentHash: "sp-blue-hash",
      },
      redSoloProp: {
        handPath: { steps: [{ startLocation: "e", endLocation: "w" }], contentHash: "hp-red-hash" },
        steps: [{ startLocation: "e", endLocation: "w", orientation: "out" }],
        contentHash: "sp-red-hash",
      },
    } as any;

    await extractor.extract(sequence, "user-123");

    // Should write 2 hand paths and 2 solo props (save takes 1 param — the data object)
    expect(mockHandPathRepo.save).toHaveBeenCalledTimes(2);
    expect(mockSoloPropRepo.save).toHaveBeenCalledTimes(2);

    // Verify hand path data was passed with provenance embedded
    expect(mockHandPathRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ contentHash: "hp-blue-hash" })
    );
  });

  it("skips extraction when composition data is missing", async () => {
    const mockHandPathRepo = { save: vi.fn() };
    const mockSoloPropRepo = { save: vi.fn() };
    const extractor = new ArtifactExtractor(mockHandPathRepo, mockSoloPropRepo);

    const sequence = { id: "seq-2" } as any; // No compositional fields

    await extractor.extract(sequence, "user-123");

    expect(mockHandPathRepo.save).not.toHaveBeenCalled();
    expect(mockSoloPropRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ArtifactExtractor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the interface**

```typescript
// src/lib/features/library/services/contracts/IArtifactExtractor.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IArtifactExtractor {
  /**
   * Extracts hand paths and solo props from a hydrated sequence
   * and writes them to their respective Firestore collections.
   * Fire-and-forget — does not block the save flow.
   */
  extract(sequence: SequenceData, userId: string): Promise<void>;
}
```

- [ ] **Step 4: Write the implementation**

```typescript
// src/lib/features/library/services/implementations/ArtifactExtractor.ts
import type { IArtifactExtractor } from "../contracts/IArtifactExtractor";
import type { IHandPathRepository } from "$lib/shared/foundation/services/contracts/IHandPathRepository";
import type { ISoloPropRepository } from "$lib/shared/foundation/services/contracts/ISoloPropRepository";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ArtifactProvenance } from "$lib/shared/foundation/domain/models/ArtifactProvenance";

export class ArtifactExtractor implements IArtifactExtractor {
  constructor(
    private readonly handPathRepo: IHandPathRepository,
    private readonly soloPropRepo: ISoloPropRepository
  ) {}

  async extract(sequence: SequenceData, userId: string): Promise<void> {
    const { blueSoloProp, redSoloProp, id } = sequence;
    if (!blueSoloProp || !redSoloProp) return;

    const provenance: ArtifactProvenance = {
      sourceSequenceIds: [id],
      isOriginal: false,
      firstSeenAt: new Date(),
    };

    // Embed provenance into data before saving.
    // The repos take 1 param (the data object). Provenance is a field on the document.
    const blueHP = { ...blueSoloProp.handPath, provenance };
    const redHP = { ...redSoloProp.handPath, provenance };
    const blueSP = { ...blueSoloProp, provenance };
    const redSP = { ...redSoloProp, provenance };

    await Promise.allSettled([
      this.handPathRepo.save(blueHP as any),
      this.handPathRepo.save(redHP as any),
      this.soloPropRepo.save(blueSP as any),
      this.soloPropRepo.save(redSP as any),
    ]);
  }
}
```

**IMPORTANT: Repository interface mismatch.** The current `IHandPathRepository.save(path: HandPathData)` and `ISoloPropRepository.save(soloProp: SoloPropData)` take 1 parameter — just the data. They don't accept userId or provenance. Task 2 must extend these interfaces to support provenance. Until then, the `as any` casts work but aren't type-safe. The repos also need to know the userId for Firestore paths — check how they currently resolve the user (likely via an injected auth service).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/ArtifactExtractor.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/library/services/contracts/IArtifactExtractor.ts src/lib/features/library/services/implementations/ArtifactExtractor.ts tests/unit/ArtifactExtractor.test.ts
git commit -m "feat: add ArtifactExtractor for decomposing sequences into hand paths and solo props"
```

---

### Task 2: Extend Repository Interfaces and Implementations for Provenance

**Files:**
- Modify: `src/lib/shared/foundation/services/contracts/IHandPathRepository.ts`
- Modify: `src/lib/shared/foundation/services/contracts/ISoloPropRepository.ts`
- Modify: `src/lib/shared/foundation/services/implementations/HandPathRepository.ts`
- Modify: `src/lib/shared/foundation/services/implementations/SoloPropRepository.ts`

- [ ] **Step 1: Read both repository interfaces AND implementations**

Current signatures are `save(path: HandPathData): Promise<void>` and `save(soloProp: SoloPropData): Promise<void>` — 1 parameter each. Check how they resolve the userId (likely via injected auth service). Understand the Firestore document path pattern.

- [ ] **Step 2: Extend interfaces to accept optional provenance**

Add an optional `provenance` parameter to both interfaces:

```typescript
// IHandPathRepository.ts
save(path: HandPathData, provenance?: ArtifactProvenance): Promise<void>;

// ISoloPropRepository.ts
save(soloProp: SoloPropData, provenance?: ArtifactProvenance): Promise<void>;
```

- [ ] **Step 3: Update implementations to handle provenance**

Both repos need save logic that:
- Creates the document if it doesn't exist (with full provenance)
- If document already exists, uses `arrayUnion` to append to `sourceSequenceIds` without overwriting

```typescript
import { arrayUnion, setDoc, updateDoc, getDoc } from "firebase/firestore";

async save(data: HandPathData, provenance?: ArtifactProvenance): Promise<void> {
  const userId = this.authService.currentUserId; // however the repo resolves user
  const ref = doc(this.firestore, `users/${userId}/handPaths/${data.contentHash}`);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    // Append source sequence ID without overwriting
    if (provenance?.sourceSequenceIds.length) {
      await updateDoc(ref, {
        "provenance.sourceSequenceIds": arrayUnion(...provenance.sourceSequenceIds),
      });
    }
  } else {
    await setDoc(ref, { ...data, provenance });
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/services/implementations/HandPathRepository.ts src/lib/shared/foundation/services/implementations/SoloPropRepository.ts
git commit -m "feat: add provenance tracking with arrayUnion to HandPath and SoloProp repositories"
```

---

### Task 3: Create ArtifactProvenance Type

**Files:**
- Create: `src/lib/shared/foundation/domain/models/ArtifactProvenance.ts`

- [ ] **Step 1: Write the type**

```typescript
// src/lib/shared/foundation/domain/models/ArtifactProvenance.ts
export interface ArtifactProvenance {
  readonly sourceSequenceIds: readonly string[];
  readonly isOriginal: boolean;
  readonly firstSeenAt: Date;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/foundation/domain/models/ArtifactProvenance.ts
git commit -m "feat: add ArtifactProvenance type for tracking artifact origin"
```

---

### Task 4: Hook ArtifactExtractor into LibrarySaveService

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibrarySaveService.ts`
- Modify: DI container that registers LibrarySaveService

- [ ] **Step 1: Read LibrarySaveService to find the exact hook point**

The save flow is at `saveSequence()`. After the Firestore sync (around line 109), add a fire-and-forget call to `ArtifactExtractor.extract()`.

- [ ] **Step 2: Add ArtifactExtractor as a constructor dependency**

```typescript
constructor(
  // ... existing deps
  private readonly artifactExtractor: IArtifactExtractor
) {}
```

- [ ] **Step 3: Call extract after Firestore sync**

After the existing Firestore sync call, add:

```typescript
// Fire-and-forget: extract hand paths and solo props
this.artifactExtractor.extract(hydratedSequence, userId).catch((err) =>
  console.error("Artifact extraction failed (non-blocking):", err)
);
```

This must NOT block the save flow. The `.catch()` ensures errors are logged but don't propagate.

- [ ] **Step 4: Register ArtifactExtractor in DI container**

Find the container that registers LibrarySaveService and add:

```typescript
.add({ artifactExtractor: ({ handPathRepository, soloPropRepository }) =>
  new ArtifactExtractor(handPathRepository, soloPropRepository)
})
```

Update LibrarySaveService registration to receive `artifactExtractor`.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/library/services/implementations/LibrarySaveService.ts src/lib/shared/di/containers/*.ts
git commit -m "feat: hook ArtifactExtractor into save flow for automatic artifact decomposition"
```

---

### Task 5: Hook ArtifactExtractor into PublicIndexSyncer

**Files:**
- Modify: `src/lib/features/library/services/implementations/PublicIndexSyncer.ts`

- [ ] **Step 1: Read PublicIndexSyncer to find the public write point**

After the public sequence document is written (around lines 151-161), add writes to `publicHandPaths` and `publicSoloProps`.

- [ ] **Step 2: Add public artifact writes**

After writing to `publicSequences`, extract and write artifacts to the public collections:

```typescript
// After publicSequences write, fire-and-forget public artifact writes
if (sequence.blueSoloProp && sequence.redSoloProp) {
  const blueHP = sequence.blueSoloProp.handPath;
  const redHP = sequence.redSoloProp.handPath;

  Promise.allSettled([
    setDoc(doc(this.firestore, `publicHandPaths/${blueHP.contentHash}`), blueHP),
    setDoc(doc(this.firestore, `publicHandPaths/${redHP.contentHash}`), redHP),
    setDoc(doc(this.firestore, `publicSoloProps/${sequence.blueSoloProp.contentHash}`), sequence.blueSoloProp),
    setDoc(doc(this.firestore, `publicSoloProps/${sequence.redSoloProp.contentHash}`), sequence.redSoloProp),
  ]).catch(err => console.error("Public artifact sync failed:", err));
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/PublicIndexSyncer.ts
git commit -m "feat: sync decomposed artifacts to public collections on publish"
```

---

## Phase 2: Browse Taxonomy

### Task 6: BrowseViewMode Type and State

**Files:**
- Create: `src/lib/features/browse/shared/domain/BrowseViewMode.ts`

- [ ] **Step 1: Write the type**

```typescript
// src/lib/features/browse/shared/domain/BrowseViewMode.ts
export interface BrowseViewMode {
  subject: "props" | "hands";
  granularity: "combined" | "solo";
  color: "blue" | "red";
}

export const DEFAULT_BROWSE_VIEW_MODE: BrowseViewMode = {
  subject: "props",
  granularity: "combined",
  color: "blue",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/browse/shared/domain/BrowseViewMode.ts
git commit -m "feat: add BrowseViewMode type for 2x2 browse taxonomy"
```

---

### Task 7: ViewModeToggle Component

**Files:**
- Create: `src/lib/features/browse/shared/components/ViewModeToggle.svelte`

- [ ] **Step 1: Write the toggle component**

Two segmented controls: subject (Props/Hands) and granularity (Both/One). When granularity is "solo", a third control appears for color (Blue/Red).

```svelte
<script lang="ts">
  import type { BrowseViewMode } from "../domain/BrowseViewMode";

  interface Props {
    viewMode: BrowseViewMode;
    onViewModeChange: (mode: BrowseViewMode) => void;
  }

  let { viewMode, onViewModeChange }: Props = $props();

  function setSubject(subject: BrowseViewMode["subject"]) {
    onViewModeChange({ ...viewMode, subject });
  }

  function setGranularity(granularity: BrowseViewMode["granularity"]) {
    onViewModeChange({ ...viewMode, granularity });
  }

  function setColor(color: BrowseViewMode["color"]) {
    onViewModeChange({ ...viewMode, color });
  }
</script>

<div class="view-mode-toggle" role="toolbar" aria-label="Browse view mode">
  <div class="toggle-group" role="radiogroup" aria-label="Subject">
    <button
      class="toggle-chip"
      class:active={viewMode.subject === "props"}
      role="radio"
      aria-checked={viewMode.subject === "props"}
      onclick={() => setSubject("props")}
    >Props</button>
    <button
      class="toggle-chip"
      class:active={viewMode.subject === "hands"}
      role="radio"
      aria-checked={viewMode.subject === "hands"}
      onclick={() => setSubject("hands")}
    >Hands</button>
  </div>

  <div class="toggle-group" role="radiogroup" aria-label="Granularity">
    <button
      class="toggle-chip"
      class:active={viewMode.granularity === "combined"}
      role="radio"
      aria-checked={viewMode.granularity === "combined"}
      onclick={() => setGranularity("combined")}
    >Both</button>
    <button
      class="toggle-chip"
      class:active={viewMode.granularity === "solo"}
      role="radio"
      aria-checked={viewMode.granularity === "solo"}
      onclick={() => setGranularity("solo")}
    >One</button>
  </div>

  {#if viewMode.granularity === "solo"}
    <div class="toggle-group" role="radiogroup" aria-label="Which hand">
      <button
        class="toggle-chip blue"
        class:active={viewMode.color === "blue"}
        role="radio"
        aria-checked={viewMode.color === "blue"}
        onclick={() => setColor("blue")}
      >Blue</button>
      <button
        class="toggle-chip red"
        class:active={viewMode.color === "red"}
        role="radio"
        aria-checked={viewMode.color === "red"}
        onclick={() => setColor("red")}
      >Red</button>
    </div>
  {/if}
</div>

<style>
  .view-mode-toggle {
    display: flex;
    gap: var(--spacing-sm, 8px);
    align-items: center;
    flex-wrap: wrap;
    padding: var(--spacing-xs, 4px) 0;
  }

  .toggle-group {
    display: flex;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-md, 8px);
    padding: 2px;
    gap: 2px;
  }

  .toggle-chip {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-chip:hover {
    color: var(--theme-text, #ffffff);
  }

  .toggle-chip.active {
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
  }

  .toggle-chip.blue.active {
    background: var(--prop-blue, #4a90d9);
  }

  .toggle-chip.red.active {
    background: var(--prop-red, #d94a4a);
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-chip {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/shared/components/ViewModeToggle.svelte
git commit -m "feat: add ViewModeToggle component for 2x2 browse taxonomy"
```

---

### Task 8: BrowseDataSource Interface and Implementation

**Files:**
- Create: `src/lib/features/browse/shared/services/contracts/IBrowseDataSource.ts`
- Create: `src/lib/features/browse/shared/services/implementations/BrowseDataSource.ts`

- [ ] **Step 1: Write the interface**

```typescript
// src/lib/features/browse/shared/services/contracts/IBrowseDataSource.ts
import type { BrowseViewMode } from "../../domain/BrowseViewMode";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";

export type BrowseResult =
  | { kind: "sequences"; items: SequenceData[] }
  | { kind: "soloProps"; items: SoloPropData[] }
  | { kind: "handPaths"; items: HandPathData[] };

export interface IBrowseDataSource {
  load(
    viewMode: BrowseViewMode,
    filters: Record<string, unknown>,
    pagination: { limit: number; startAfter?: unknown }
  ): Promise<BrowseResult>;
}
```

- [ ] **Step 2: Write the implementation**

Route to the correct Firestore collection based on view mode. For `hands + combined`, query sequences but mark result for different rendering.

```typescript
// src/lib/features/browse/shared/services/implementations/BrowseDataSource.ts
import type { IBrowseDataSource, BrowseResult } from "../contracts/IBrowseDataSource";
import type { BrowseViewMode } from "../../domain/BrowseViewMode";
import type { IHandPathRepository } from "$lib/shared/foundation/services/contracts/IHandPathRepository";
import type { ISoloPropRepository } from "$lib/shared/foundation/services/contracts/ISoloPropRepository";

export class BrowseDataSource implements IBrowseDataSource {
  constructor(
    private readonly existingLoader: { load: (...args: any[]) => Promise<any[]> },
    private readonly handPathRepo: IHandPathRepository,
    private readonly soloPropRepo: ISoloPropRepository
  ) {}

  async load(
    viewMode: BrowseViewMode,
    filters: Record<string, unknown>,
    pagination: { limit: number; startAfter?: unknown }
  ): Promise<BrowseResult> {
    const { subject, granularity, color } = viewMode;

    if (subject === "props" && granularity === "combined") {
      // Current behavior — delegate to existing loader
      const items = await this.existingLoader.load(filters, pagination);
      return { kind: "sequences", items };
    }

    if (subject === "hands" && granularity === "combined") {
      // Same data as sequences, different rendering
      const items = await this.existingLoader.load(filters, pagination);
      return { kind: "sequences", items };
    }

    if (subject === "props" && granularity === "solo") {
      // Build typed SoloPropFilters from generic filters — don't spread raw filters
      const soloPropFilters = this.buildSoloPropFilters(filters);
      const items = await this.soloPropRepo.list(soloPropFilters);
      // Filter by color client-side (repos don't have a color field)
      return { kind: "soloProps", items };
    }

    if (subject === "hands" && granularity === "solo") {
      const handPathFilters = this.buildHandPathFilters(filters);
      const items = await this.handPathRepo.list(handPathFilters);
      return { kind: "handPaths", items };
    }

    // Fallback — should never reach
    const items = await this.existingLoader.load(filters, pagination);
    return { kind: "sequences", items };
  }
}
```

- [ ] **Step 3: Register in DI container**

Find the browse-related container and add:

```typescript
.add({ browseDataSource: ({ publicSequencesLoader, handPathRepository, soloPropRepository }) =>
  new BrowseDataSource(publicSequencesLoader, handPathRepository, soloPropRepository)
})
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/shared/services/contracts/IBrowseDataSource.ts src/lib/features/browse/shared/services/implementations/BrowseDataSource.ts src/lib/shared/di/containers/*.ts
git commit -m "feat: add BrowseDataSource for routing browse queries by view mode"
```

---

### Task 9: Integrate ViewModeToggle into BrowseLayout

**Files:**
- Modify: `src/lib/features/browse/shared/components/BrowseLayout.svelte`
- Modify: Browse module state (wherever viewMode state lives)

- [ ] **Step 1: Read the browse module's state factory to understand where viewMode fits**

Find the browse state factory and add `viewMode` as a reactive field with the default value.

- [ ] **Step 2: Add viewMode to browse state**

```typescript
let viewMode = $state<BrowseViewMode>(DEFAULT_BROWSE_VIEW_MODE);

return {
  // ... existing getters
  get viewMode() { return viewMode; },
  setViewMode(mode: BrowseViewMode) { viewMode = mode; },
};
```

- [ ] **Step 3: Add ViewModeToggle to BrowseLayout**

Import and render `ViewModeToggle` above the existing gallery grid content. Wire `onViewModeChange` to the state setter.

- [ ] **Step 4: Run typecheck and verify build**

Run: `npm run check && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/browse/shared/components/BrowseLayout.svelte src/lib/features/browse/**/state/*.svelte.ts
git commit -m "feat: integrate ViewModeToggle into browse gallery layout"
```

---

### Task 10: Cache Key View Mode Injection

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/implementations/CellCacheKeyDeriver.ts`

- [ ] **Step 1: Read CellCacheKeyDeriver to understand current key format**

The current format is `lsp5-{params}`. Add viewMode components to the key.

- [ ] **Step 2: Add viewMode to cache key derivation**

Add `subject`, `granularity`, and `color` from BrowseViewMode to the pipe-delimited key string. This ensures the same sequence renders differently in different view modes without cache collisions.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/CellCacheKeyDeriver.ts
git commit -m "feat: inject BrowseViewMode into cache key to prevent stale cross-mode thumbnails"
```

---

## Phase 3: Solo Prop Save from Assemble Lab

### Task 11: SoloPropSaveOrchestrator

**Files:**
- Create: `src/lib/features/library/services/contracts/ISoloPropSaveOrchestrator.ts`
- Create: `src/lib/features/library/services/implementations/SoloPropSaveOrchestrator.ts`

- [ ] **Step 1: Write the interface**

```typescript
// src/lib/features/library/services/contracts/ISoloPropSaveOrchestrator.ts
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

export interface ISoloPropSaveOrchestrator {
  save(data: SoloPropData, userId: string, name?: string): Promise<void>;
}
```

- [ ] **Step 2: Write the implementation**

Orchestrates: build SoloPropData, generate thumbnail, write to user's soloProps collection, extract hand path, mark as `isOriginal: true`.

```typescript
// src/lib/features/library/services/implementations/SoloPropSaveOrchestrator.ts
import type { ISoloPropSaveOrchestrator } from "../contracts/ISoloPropSaveOrchestrator";
import type { ISoloPropRepository } from "$lib/shared/foundation/services/contracts/ISoloPropRepository";
import type { IHandPathRepository } from "$lib/shared/foundation/services/contracts/IHandPathRepository";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";
import type { ArtifactProvenance } from "$lib/shared/foundation/domain/models/ArtifactProvenance";

export class SoloPropSaveOrchestrator implements ISoloPropSaveOrchestrator {
  constructor(
    private readonly soloPropRepo: ISoloPropRepository,
    private readonly handPathRepo: IHandPathRepository
  ) {}

  async save(data: SoloPropData, userId: string, name?: string): Promise<void> {
    const provenance: ArtifactProvenance = {
      sourceSequenceIds: [],
      isOriginal: true,
      firstSeenAt: new Date(),
    };

    // Save solo prop (provenance is optional second param after Task 2)
    await this.soloPropRepo.save(data, provenance);

    // Extract and save hand path
    if (data.handPath) {
      await this.handPathRepo.save(data.handPath, provenance);
    }
  }
}
```

- [ ] **Step 3: Register in DI container**

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/library/services/contracts/ISoloPropSaveOrchestrator.ts src/lib/features/library/services/implementations/SoloPropSaveOrchestrator.ts src/lib/shared/di/containers/*.ts
git commit -m "feat: add SoloPropSaveOrchestrator for saving individual prop paths"
```

---

### Task 12: "Save as Solo Prop" in Assemble Lab

**Files:**
- Modify: `src/lib/features/assemble-lab/components/BuilderControls.svelte`
- Read: Assemble lab state to understand how single-hand builds are tracked

- [ ] **Step 1: Read BuilderControls and assemble state to understand current save flow**

Determine how the assemble tab tracks when only one hand has steps. The save button is already present but grayed out for incomplete sequences.

- [ ] **Step 2: Add "Save as Solo Prop" button**

When only one hand has steps (or user explicitly chooses), show a "Save Solo Prop" action alongside the existing save. This button calls `SoloPropSaveOrchestrator.save()` with the single-hand data.

- [ ] **Step 3: Wire to SoloPropSaveOrchestrator via DI container**

- [ ] **Step 4: Run typecheck and build**

Run: `npm run check && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/assemble-lab/components/BuilderControls.svelte
git commit -m "feat: add 'Save as Solo Prop' option in Assemble Lab for single-hand builds"
```

---

## Phase 4: SequenceFuser (Data Transformation)

### Task 13: SequenceFuser Interface and Implementation

**Files:**
- Create: `src/lib/features/fuse/services/contracts/ISequenceFuser.ts`
- Create: `src/lib/features/fuse/services/implementations/SequenceFuser.ts`
- Create: `tests/unit/SequenceFuser.test.ts`

- [ ] **Step 1: Write the failing test**

The SequenceFuser is pure data transformation — perfect for unit testing. Test LCM tiling and input normalization.

```typescript
// tests/unit/SequenceFuser.test.ts
import { describe, it, expect } from "vitest";
import { SequenceFuser } from "$lib/features/fuse/services/implementations/SequenceFuser";

describe("SequenceFuser", () => {
  const fuser = new SequenceFuser();

  it("fuses two equal-length hand paths", () => {
    const blue = {
      steps: [
        { startLocation: "n", endLocation: "s" },
        { startLocation: "s", endLocation: "e" },
      ],
      contentHash: "blue-hash",
    } as any;

    const red = {
      steps: [
        { startLocation: "e", endLocation: "w" },
        { startLocation: "w", endLocation: "n" },
      ],
      contentHash: "red-hash",
    } as any;

    const result = fuser.fuse(blue, red);

    expect(result.stepPairings).toHaveLength(2);
    expect(result.blueSoloProp).toBeDefined();
    expect(result.redSoloProp).toBeDefined();
  });

  it("tiles mismatched lengths to LCM", () => {
    const blue = {
      steps: Array.from({ length: 3 }, (_, i) => ({
        startLocation: "n", endLocation: "s",
      })),
      contentHash: "blue-3",
    } as any;

    const red = {
      steps: Array.from({ length: 4 }, (_, i) => ({
        startLocation: "e", endLocation: "w",
      })),
      contentHash: "red-4",
    } as any;

    const result = fuser.fuse(blue, red);

    // LCM(3, 4) = 12
    expect(result.stepPairings).toHaveLength(12);
  });

  it("truncates when LCM exceeds 64 beats", () => {
    const blue = { steps: Array(37).fill({ startLocation: "n", endLocation: "s" }), contentHash: "b" } as any;
    const red = { steps: Array(41).fill({ startLocation: "e", endLocation: "w" }), contentHash: "r" } as any;

    // LCM(37, 41) = 1517, which exceeds 64
    const result = fuser.fuse(blue, red);
    expect(result.stepPairings!.length).toBeLessThanOrEqual(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/SequenceFuser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the interface**

```typescript
// src/lib/features/fuse/services/contracts/ISequenceFuser.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

export interface FuseOptions {
  readonly alignmentOffset?: number;
  readonly maxBeats?: number;
}

export interface ISequenceFuser {
  fuse(
    blue: HandPathData | SoloPropData,
    red: HandPathData | SoloPropData,
    options?: FuseOptions
  ): SequenceData;
}
```

- [ ] **Step 4: Write the implementation**

```typescript
// src/lib/features/fuse/services/implementations/SequenceFuser.ts
import type { ISequenceFuser, FuseOptions } from "../contracts/ISequenceFuser";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

export class SequenceFuser implements ISequenceFuser {
  private readonly DEFAULT_MAX_BEATS = 64;

  fuse(
    blue: HandPathData | SoloPropData,
    red: HandPathData | SoloPropData,
    options?: FuseOptions
  ): SequenceData {
    const maxBeats = options?.maxBeats ?? this.DEFAULT_MAX_BEATS;
    const blueHP = this.extractHandPath(blue);
    const redHP = this.extractHandPath(red);

    const blueLen = blueHP.steps.length;
    const redLen = redHP.steps.length;
    const targetLen = Math.min(this.lcm(blueLen, redLen), maxBeats);

    // Tile steps to fill target length
    const blueSteps = this.tile(blueHP.steps, targetLen);
    const redSteps = this.tile(redHP.steps, targetLen);

    // Build step pairings
    const stepPairings = blueSteps.map((bs, i) => ({
      blueStep: bs,
      redStep: redSteps[i],
      beatIndex: i,
    }));

    // Build SoloPropData wrappers if input was HandPathData
    const blueSoloProp = this.isSoloProp(blue)
      ? this.tileSoloProp(blue, targetLen)
      : { handPath: { ...blueHP, steps: blueSteps }, steps: blueSteps, contentHash: "" };

    const redSoloProp = this.isSoloProp(red)
      ? this.tileSoloProp(red, targetLen)
      : { handPath: { ...redHP, steps: redSteps }, steps: redSteps, contentHash: "" };

    return {
      blueSoloProp,
      redSoloProp,
      stepPairings,
      length: targetLen,
    } as SequenceData;
  }

  private extractHandPath(input: HandPathData | SoloPropData): HandPathData {
    return "handPath" in input ? input.handPath : input;
  }

  private isSoloProp(input: HandPathData | SoloPropData): input is SoloPropData {
    return "handPath" in input;
  }

  private tile<T>(arr: readonly T[], targetLen: number): T[] {
    const result: T[] = [];
    for (let i = 0; i < targetLen; i++) {
      result.push(arr[i % arr.length]);
    }
    return result;
  }

  private tileSoloProp(sp: SoloPropData, targetLen: number): SoloPropData {
    return {
      ...sp,
      steps: this.tile(sp.steps, targetLen),
      handPath: { ...sp.handPath, steps: this.tile(sp.handPath.steps, targetLen) },
    } as SoloPropData;
  }

  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  private lcm(a: number, b: number): number {
    return (a * b) / this.gcd(a, b);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/SequenceFuser.test.ts`
Expected: PASS

- [ ] **Step 6: Register in DI container**

```typescript
.add({ sequenceFuser: () => new SequenceFuser() })
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/fuse/services/contracts/ISequenceFuser.ts src/lib/features/fuse/services/implementations/SequenceFuser.ts tests/unit/SequenceFuser.test.ts src/lib/shared/di/containers/*.ts
git commit -m "feat: add SequenceFuser for combining two hand paths into a sequence with LCM tiling"
```

---

## Phase 5: Thumbnail Rendering Per View Mode

### Task 14: PreviewCellRenderer View Mode Support

**Files:**
- Modify: `src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts` (or wherever choreo card thumbnails are rendered)
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCardThumbnail.svelte` (if separate)

- [ ] **Step 1: Read PreviewCellRenderer to understand current rendering**

Understand how pictograph thumbnails are generated. The renderer needs to accept a `viewMode` and adjust rendering:
- `props + combined`: Today's pictograph grid (no change)
- `props + solo`: Single-prop pictograph (one colored prop, other hand absent)
- `hands + combined`: Paired hand dots (two colored dots at grid locations, lines between consecutive positions)
- `hands + solo`: Single hand path (one colored dot tracing grid locations)

- [ ] **Step 2: Add viewMode to PreviewCellRenderOptions**

```typescript
interface PreviewCellRenderOptions {
  // existing fields...
  viewMode?: BrowseViewMode;
}
```

- [ ] **Step 3: Implement rendering branches**

When `viewMode.subject === "hands"`, draw hand dots instead of props. When `viewMode.granularity === "solo"`, draw only the selected color.

This is the most visually impactful task — without it, the browse toggles exist but show the same rendering in all modes. Implement the simplest viable rendering for each mode first (dots for hands, single prop for solo), then polish.

- [ ] **Step 4: Run typecheck and build**

Run: `npm run check && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts src/lib/shared/sequence-viewer/components/ChoreoCard.svelte
git commit -m "feat: render choreo cards differently per browse view mode (props/hands, combined/solo)"
```

---

### Task 15: Filter Behavior Per View Mode

**Files:**
- Modify: `src/lib/features/browse/sequences/display/components/FilterChipRow.svelte` (or equivalent)
- Modify: `src/lib/features/browse/shared/services/implementations/BrowseFilter.ts` (or `MultiFilter`)

- [ ] **Step 1: Read the filter components and services**

Understand how filter chips are rendered and how filters are applied.

- [ ] **Step 2: Hide inapplicable filters based on view mode**

Per the spec:
| Filter | props+combined | props+solo | hands+combined | hands+solo |
|--------|---------------|------------|---------------|------------|
| Level | Show | Show | Show | Hide |
| Letter | Show | Hide | Show | Hide |
| Position | Show | Show | Show | Show |
| Length | Show | Show | Show | Show |
| Favorites | Show | Show | Show | Show |

Filters that don't apply to the current view mode are hidden, not disabled.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/sequences/display/components/FilterChipRow.svelte src/lib/features/browse/shared/services/implementations/BrowseFilter.ts
git commit -m "feat: hide inapplicable browse filters based on active view mode"
```

---

## Phase 6: Detail View Composition

### Task 16: CompositionBreakdown Component

**Files:**
- Create: `src/lib/features/browse/shared/components/CompositionBreakdown.svelte`
- Modify: Sequence detail view (wherever `SequenceViewerActions.svelte` or equivalent lives)

- [ ] **Step 1: Write CompositionBreakdown**

Shows the four compositional elements of a sequence (blue hand path, red hand path, blue solo prop, red solo prop) as tappable previews. Tapping navigates to the appropriate browse cell.

```svelte
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    sequence: SequenceData;
    onNavigateToView: (subject: "props" | "hands", granularity: "combined" | "solo", color: "blue" | "red") => void;
  }

  let { sequence, onNavigateToView }: Props = $props();
</script>

<section class="composition-breakdown">
  <h3>Composition</h3>
  <div class="breakdown-grid">
    {#if sequence.blueSoloProp}
      <button class="breakdown-item blue" onclick={() => onNavigateToView("hands", "solo", "blue")}>
        Blue hand path
      </button>
    {/if}
    {#if sequence.redSoloProp}
      <button class="breakdown-item red" onclick={() => onNavigateToView("hands", "solo", "red")}>
        Red hand path
      </button>
    {/if}
    {#if sequence.blueSoloProp}
      <button class="breakdown-item blue" onclick={() => onNavigateToView("props", "solo", "blue")}>
        Blue solo prop
      </button>
    {/if}
    {#if sequence.redSoloProp}
      <button class="breakdown-item red" onclick={() => onNavigateToView("props", "solo", "red")}>
        Red solo prop
      </button>
    {/if}
  </div>
</section>
```

- [ ] **Step 2: Add CompositionBreakdown to sequence detail view**

Find the sequence detail/viewer component and add the breakdown section.

- [ ] **Step 3: Wire navigation**

When a user taps a breakdown item, navigate to the browse gallery with the appropriate view mode pre-selected and filtered to that specific artifact.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/shared/components/CompositionBreakdown.svelte
git commit -m "feat: add CompositionBreakdown section to sequence detail view"
```

---

## Phase 7: Hand Path Save Integration

### Task 17: HandPathSaveOrchestrator

**Files:**
- Create: `src/lib/features/library/services/contracts/IHandPathSaveOrchestrator.ts`
- Create: `src/lib/features/library/services/implementations/HandPathSaveOrchestrator.ts`

- [ ] **Step 1: Write the interface**

```typescript
export interface IHandPathSaveOrchestrator {
  save(data: HandPathData, name?: string): Promise<void>;
}
```

- [ ] **Step 2: Write the implementation**

```typescript
export class HandPathSaveOrchestrator implements IHandPathSaveOrchestrator {
  constructor(private readonly handPathRepo: IHandPathRepository) {}

  async save(data: HandPathData, name?: string): Promise<void> {
    const provenance: ArtifactProvenance = {
      sourceSequenceIds: [],
      isOriginal: true,
      firstSeenAt: new Date(),
    };
    await this.handPathRepo.save(data, provenance);
  }
}
```

- [ ] **Step 3: Register in DI container and wire into hand path builder**

The hand path builder at `src/lib/features/hand-path-builder/` already has components and state. Wire `HandPathSaveOrchestrator` into its save flow.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/contracts/IHandPathSaveOrchestrator.ts src/lib/features/library/services/implementations/HandPathSaveOrchestrator.ts
git commit -m "feat: add HandPathSaveOrchestrator and wire into hand path builder save flow"
```

---

## Phase 8: Infrastructure

### Task 18: Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add rules for new collections**

```
match /users/{uid}/handPaths/{pathId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /users/{uid}/soloProps/{propId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /publicHandPaths/{pathId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
}
match /publicSoloProps/{propId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for hand path and solo prop collections"
```

---

### Task 19: Firestore Indexes

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add composite indexes for new collections**

```json
{
  "collectionGroup": "publicHandPaths",
  "fields": [
    { "fieldPath": "impliedGridMode", "order": "ASCENDING" },
    { "fieldPath": "length", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "publicSoloProps",
  "fields": [
    { "fieldPath": "impliedGridMode", "order": "ASCENDING" },
    { "fieldPath": "length", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: add Firestore composite indexes for public hand path and solo prop queries"
```

---

### Task 20: Backfill Script

**Files:**
- Create: `scripts/backfill-artifacts.cjs`

- [ ] **Step 1: Write backfill script**

Reads all existing sequences from `publicSequences`, runs `ensureComposition()` on each, and writes decomposed artifacts to `publicHandPaths` and `publicSoloProps`. Uses batch writes for efficiency. Idempotent (safe to re-run).

- [ ] **Step 2: Test on a small sample**

Run: `node scripts/backfill-artifacts.cjs --limit 10 --dry-run`

- [ ] **Step 3: Run full backfill**

Run: `node scripts/backfill-artifacts.cjs`

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-artifacts.cjs
git commit -m "feat: add backfill script for populating artifact collections from existing sequences"
```

---

## Summary

| Phase | Tasks | What Ships |
|-------|-------|-----------|
| 1: Artifact Extraction | Tasks 1-5 (order: 3→1→2→4→5) | Every save writes decomposed artifacts to Firestore |
| 2: Browse Taxonomy | Tasks 6-10 | Users can toggle Props/Hands and Both/One in the gallery |
| 3: Solo Prop Save | Tasks 11-12 | Users can save individual prop paths from Assemble Lab |
| 4: SequenceFuser | Task 13 | Core data transformation for the Fuse tab |
| 5: Rendering | Tasks 14-15 | Gallery actually renders differently per view mode |
| 6: Detail View | Task 16 | Users can see composition breakdown and navigate to sub-views |
| 7: Hand Path Save | Task 17 | Users can save hand paths from the hand path builder |
| 8: Infrastructure | Tasks 18-20 | Firestore rules, indexes, and backfill |

Each phase is independently shippable. Phase 4 (SequenceFuser) is a prerequisite for the Fuse Tab plan.
