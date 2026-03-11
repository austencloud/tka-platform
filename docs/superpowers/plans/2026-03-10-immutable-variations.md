# Immutable Variations via Content Hash — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user edits a saved sequence's motion content and re-saves, create a new document (new variation) instead of overwriting the original. Use a content hash to detect whether the motion content actually changed.

**Architecture:** A `SequenceContentHasher` service computes a SHA-256 hash from only the motion-defining fields of a sequence. `LibraryRepository.saveSequence()` compares the incoming hash against the stored hash. If different, it creates a new document with a new ID, birthday, and fork attribution pointing to the parent. If same, it does a normal metadata update.

**Tech Stack:** TypeScript, Web Crypto API (SHA-256), ITI DI, Firebase Firestore

---

## IMPORTANT: canonicalSignature vs contentHash

`SequenceData` already has a `canonicalSignature` field (line 82 of `SequenceData.ts`) described as "rotation-invariant." That's for equivalence detection across circular rotations — two sequences that are the same pattern but starting from different beats. **That is NOT what we're building.** Our `contentHash` is an exact identity: same steps in the same order with the same values. Two rotations of the same circular sequence should have DIFFERENT content hashes (they're different variations even if they're rotationally equivalent).

---

## File Structure

### Files to create:

| File | Purpose |
|------|---------|
| `src/lib/features/library/services/contracts/ISequenceContentHasher.ts` | Interface for the hasher |
| `src/lib/features/library/services/implementations/SequenceContentHasher.ts` | SHA-256 hash from motion fields |
| `tests/unit/library/SequenceContentHasher.test.ts` | Tests for deterministic hashing |

### Files to modify:

| File | Change |
|------|--------|
| `src/lib/features/library/domain/models/LibrarySequence.ts` | Add `contentHash?: string` field |
| `src/lib/features/library/services/implementations/LibraryRepository.ts` | Fork logic: compare hashes, create new doc if different |
| `src/lib/shared/di/containers/library-container.ts` | Register `SequenceContentHasher`, inject into `LibraryRepository` |

---

## Chunk 1: Content Hasher Service (with tests)

### Task 1: Create the ISequenceContentHasher interface

**Files:**
- Create: `src/lib/features/library/services/contracts/ISequenceContentHasher.ts`

- [ ] **Step 1: Create the interface**

```typescript
/**
 * ISequenceContentHasher - Computes a deterministic hash from a sequence's motion content
 *
 * The hash captures only the fields that define what the sequence IS as a physical
 * movement pattern: turn values, motion types, locations, positions, orientations.
 * Everything else (name, tags, thumbnails, visibility) is excluded because those are
 * user annotations on top of the motion content, not the content itself.
 *
 * Two sequences with the same content hash are the same variation — even if created
 * by different users with different names. Two sequences with different hashes are
 * different variations and deserve separate documents with separate birthdays.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceContentHasher {
  /**
   * Compute a SHA-256 hex digest from the motion-defining fields of a sequence.
   * Deterministic: same motion content always produces the same hash.
   */
  computeHash(sequence: SequenceData): Promise<string>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/library/services/contracts/ISequenceContentHasher.ts
git commit -m "feat(library): add ISequenceContentHasher interface"
```

---

### Task 2: Write failing tests for SequenceContentHasher

**Files:**
- Create: `tests/unit/library/SequenceContentHasher.test.ts`

The hasher must be:
1. **Deterministic** — same input always produces the same hash
2. **Content-sensitive** — changing a motion field changes the hash
3. **Metadata-insensitive** — changing name, tags, thumbnails does NOT change the hash
4. **Order-preserving** — steps in different order produce different hashes

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from "vitest";
import { SequenceContentHasher } from "$lib/features/library/services/implementations/SequenceContentHasher";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { MotionType, RotationDirection, Orientation, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: "step-1",
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.SOUTH,
        turns: 1,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.OUT,
        color: MotionColor.BLUE,
        gridMode: GridMode.DIAMOND,
      }),
    },
    ...overrides,
  } as any;
}

describe("SequenceContentHasher", () => {
  const hasher = new SequenceContentHasher();

  it("produces the same hash for identical motion content", async () => {
    const seq = createSequenceData({
      steps: [makeStep()],
      gridMode: GridMode.DIAMOND,
    });
    const hash1 = await hasher.computeHash(seq);
    const hash2 = await hasher.computeHash(seq);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("produces different hashes when a turn value changes", async () => {
    const seq1 = createSequenceData({ steps: [makeStep()], gridMode: GridMode.DIAMOND });
    const seq2 = createSequenceData({
      steps: [makeStep({
        motions: {
          [MotionColor.BLUE]: createMotionData({
            motionType: MotionType.PRO,
            rotationDirection: RotationDirection.CLOCKWISE,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.SOUTH,
            turns: 2, // Changed from 1 to 2
            startOrientation: Orientation.IN,
            endOrientation: Orientation.OUT,
            color: MotionColor.BLUE,
            gridMode: GridMode.DIAMOND,
          }),
        },
      })],
      gridMode: GridMode.DIAMOND,
    });
    expect(await hasher.computeHash(seq1)).not.toBe(await hasher.computeHash(seq2));
  });

  it("ignores metadata changes (name, tags, thumbnails)", async () => {
    const base = { steps: [makeStep()], gridMode: GridMode.DIAMOND as GridMode };
    const seq1 = createSequenceData({ ...base, name: "DABBLE", tags: ["fun"], thumbnails: ["url1"] });
    const seq2 = createSequenceData({ ...base, name: "DIFFERENT", tags: ["serious"], thumbnails: ["url2"] });
    expect(await hasher.computeHash(seq1)).toBe(await hasher.computeHash(seq2));
  });

  it("produces different hashes for different step order", async () => {
    const step1 = makeStep({ stepNumber: 1 });
    const step2 = makeStep({
      stepNumber: 2,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
          startLocation: GridLocation.EAST,
          endLocation: GridLocation.WEST,
          turns: 1,
          startOrientation: Orientation.OUT,
          endOrientation: Orientation.IN,
          color: MotionColor.BLUE,
          gridMode: GridMode.DIAMOND,
        }),
      },
    });
    const seqAB = createSequenceData({ steps: [step1, step2], gridMode: GridMode.DIAMOND });
    const seqBA = createSequenceData({ steps: [step2, step1], gridMode: GridMode.DIAMOND });
    expect(await hasher.computeHash(seqAB)).not.toBe(await hasher.computeHash(seqBA));
  });

  it("produces different hashes when grid mode changes", async () => {
    const seq1 = createSequenceData({ steps: [makeStep()], gridMode: GridMode.DIAMOND });
    const seq2 = createSequenceData({ steps: [makeStep()], gridMode: GridMode.BOX });
    expect(await hasher.computeHash(seq1)).not.toBe(await hasher.computeHash(seq2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/library/SequenceContentHasher.test.ts`
Expected: FAIL — cannot resolve `SequenceContentHasher` (file doesn't exist yet).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/library/SequenceContentHasher.test.ts
git commit -m "test(library): add failing tests for SequenceContentHasher"
```

---

### Task 3: Implement SequenceContentHasher

**Files:**
- Create: `src/lib/features/library/services/implementations/SequenceContentHasher.ts`

The implementation extracts only motion-defining fields, builds a canonical JSON string, and hashes it with SHA-256.

- [ ] **Step 1: Implement the hasher**

```typescript
/**
 * SequenceContentHasher - Computes a deterministic SHA-256 hash from motion content
 *
 * The hash is the sequence's identity as a physical movement pattern.
 * Same hash = same variation. Different hash = different variation.
 *
 * Only motion-defining fields contribute to the hash. Everything that's a user
 * annotation (name, tags, visibility, thumbnails) is excluded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { ISequenceContentHasher } from "../contracts/ISequenceContentHasher";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceContentHasher implements ISequenceContentHasher {
  async computeHash(sequence: SequenceData): Promise<string> {
    const content = this.extractContent(sequence);
    const json = JSON.stringify(content);
    const buffer = new TextEncoder().encode(json);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private extractContent(sequence: SequenceData): unknown {
    return {
      gridMode: sequence.gridMode ?? null,
      startPosition: this.extractStartPosition(
        sequence.startPosition ?? sequence.startingPosition
      ),
      steps: sequence.steps.map((step) => this.extractStep(step)),
    };
  }

  private extractStartPosition(
    sp: StartPositionData | undefined
  ): unknown {
    if (!sp) return null;
    return {
      motions: this.extractMotions(sp.motions),
      gridMode: sp.gridMode ?? null,
    };
  }

  private extractStep(step: StepData): unknown {
    return {
      letter: step.letter ?? null,
      blueReversal: step.blueReversal,
      redReversal: step.redReversal,
      isBlank: step.isBlank,
      duration: step.duration,
      motions: this.extractMotions(step.motions),
      gridMode: step.gridMode ?? null,
    };
  }

  private extractMotions(
    motions: Partial<Record<MotionColor, MotionData | undefined>>
  ): unknown {
    // Sort by color key for determinism (BLUE before RED alphabetically)
    const sorted = [MotionColor.BLUE, MotionColor.RED]
      .filter((color) => motions[color])
      .map((color) => [color, this.extractMotion(motions[color]!)]);
    return Object.fromEntries(sorted);
  }

  private extractMotion(m: MotionData): unknown {
    return {
      motionType: m.motionType,
      rotationDirection: m.rotationDirection,
      startLocation: m.startLocation,
      endLocation: m.endLocation,
      turns: m.turns,
      startOrientation: m.startOrientation,
      endOrientation: m.endOrientation,
      handPath: m.handPath ?? null,
      gridMode: m.gridMode,
      skewSteps: m.skewSteps ?? null,
      skewDir: m.skewDir ?? null,
    };
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/unit/library/SequenceContentHasher.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/library/services/implementations/SequenceContentHasher.ts
git commit -m "feat(library): implement SequenceContentHasher with SHA-256"
```

---

## Chunk 2: Wire Into LibraryRepository

### Task 4: Add contentHash to LibrarySequence model

**Files:**
- Modify: `src/lib/features/library/domain/models/LibrarySequence.ts`

- [ ] **Step 1: Add the field**

Add after the `_version` field (line 114), within the SYNC & CONFLICT DETECTION section:

```typescript
  /**
   * SHA-256 hash of the sequence's motion content (steps, positions, turns,
   * orientations). Two sequences with the same hash are the same physical
   * movement pattern. Used to detect when an edit creates a new variation
   * vs. a metadata-only update.
   *
   * Optional because legacy sequences saved before this feature won't have it.
   * Computed and stored on every save going forward.
   */
  readonly contentHash?: string;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/library/domain/models/LibrarySequence.ts
git commit -m "feat(library): add contentHash field to LibrarySequence"
```

---

### Task 5: Inject SequenceContentHasher into LibraryRepository

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`
- Modify: `src/lib/shared/di/containers/library-container.ts`

`LibraryRepository` needs the hasher as a constructor dependency.

- [ ] **Step 1: Add constructor parameter to LibraryRepository**

Read `LibraryRepository.ts` to find the constructor (around line 70-90). Add `ISequenceContentHasher` as the last parameter:

```typescript
import type { ISequenceContentHasher } from "../contracts/ISequenceContentHasher";

// In constructor:
constructor(
  achievementService: IAchievementManager,
  tagService: ITagManager,
  orientationCycleDetector: IOrientationCycleDetector,
  publicIndexSyncer: IPublicIndexSyncer | null,
  conflictResolver?: IConflictResolver,
  contentHasher?: ISequenceContentHasher  // NEW
) {
  // ... existing assignments ...
  this.contentHasher = contentHasher ?? null;
}

// Add field:
private readonly contentHasher: ISequenceContentHasher | null;
```

- [ ] **Step 2: Update library-container.ts**

Pass the hasher to `LibraryRepository`. Import `SequenceContentHasher` and instantiate it:

```typescript
import { SequenceContentHasher } from "$lib/features/library/services/implementations/SequenceContentHasher";

// Inside createLibraryContainer, before creating libraryRepository:
const contentHasher = new SequenceContentHasher();

// Update LibraryRepository constructor call:
const libraryRepository = new LibraryRepository(
  deps.libraryRepository.achievementManager,
  deps.libraryRepository.tagManager,
  deps.libraryRepository.orientationCycleDetector,
  publicIndexSyncer,
  deps.libraryRepository.conflictResolver,
  contentHasher  // NEW
);
```

Also register it in the container so tests or other services can access it:

```typescript
return createContainer().add({
  publicIndexSyncer: () => publicIndexSyncer,
  collectionManager: () => new CollectionManager(),
  contentHasher: () => contentHasher,  // NEW
  libraryRepository: () => libraryRepository,
  // ... rest unchanged
});
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean or only pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts \
  src/lib/shared/di/containers/library-container.ts
git commit -m "refactor(di): inject SequenceContentHasher into LibraryRepository"
```

---

### Task 6: Add fork-on-edit logic to saveSequence

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`

This is the core change. In `saveSequence()`, after fetching the existing doc, compute the content hash. If the doc exists and the hash differs, treat this as a new variation.

- [ ] **Step 1: Add the fork detection logic**

Read the current `saveSequence()` method (starts at line 234). The key change is in the existing-doc branch (line 255-271). Replace the existing update logic with:

```typescript
  async saveSequence(
    sequence: SequenceData,
    overrides?: { visibility?: SequenceVisibility; notes?: string }
  ): Promise<LibrarySequence> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const sequenceId = sequence.id || crypto.randomUUID();

    const sequenceDocRef = doc(
      firestore,
      getUserSequencePath(userId, sequenceId)
    );
    const userDocRef = doc(firestore, `users/${userId}`);

    // Compute content hash for the incoming sequence
    const incomingHash = this.contentHasher
      ? await this.contentHasher.computeHash(sequence)
      : undefined;

    // Check if this is a new or existing sequence using local cache
    const existingDoc = await getDoc(sequenceDocRef);

    // FORK DETECTION: If the motion content changed, this is a new variation.
    // The old document stays untouched. We create a fresh document with a new ID.
    if (existingDoc.exists() && incomingHash) {
      const existingHash = existingDoc.data()?.contentHash;
      if (existingHash && existingHash !== incomingHash) {
        // Motion content changed — fork into a new variation
        const existing = this.mapDocToLibrarySequence(
          existingDoc.data(),
          sequenceId
        );
        const newId = crypto.randomUUID();
        const forkedSequence: SequenceData = {
          ...sequence,
          id: newId,
        };
        return this.saveSequence(forkedSequence, {
          ...overrides,
          // The recursive call will hit the "new sequence" branch because
          // newId won't exist in Firestore. We pass fork attribution
          // through the overrides mechanism... but overrides doesn't have
          // forkAttribution. We need a different approach.
        });
      }
    }

    // ... rest of existing saveSequence logic ...
```

**Wait — the recursive approach won't carry fork attribution.** Better approach: extract the fork info and pass it through `createLibrarySequence`'s options. Here's the actual implementation:

Replace the entire `saveSequence` method body with logic that:
1. Computes the incoming hash
2. Checks for existing doc
3. If existing doc + different hash → create new doc with fork attribution
4. If existing doc + same hash (or no hash) → metadata update (existing behavior)
5. If no existing doc → new sequence (existing behavior)
6. Always store `contentHash` on the written document

The cleanest way: add a private helper `forkAsNewVariation()` that handles step 3, and call it from the existing-doc branch when hashes differ.

```typescript
  /**
   * When a user edits a saved sequence's motion content (turns, positions,
   * orientations) and saves, the steps are physically different — it's a new
   * variation. We create a brand new document with its own ID and birthday,
   * and record the parent sequence in forkAttribution so the lineage is tracked.
   * The original document stays exactly as it was.
   */
  private async forkAsNewVariation(
    sequence: SequenceData,
    parentId: string,
    parentOwnerId: string,
    parentOwnerName: string,
    contentHash: string,
    overrides?: { visibility?: SequenceVisibility; notes?: string }
  ): Promise<LibrarySequence> {
    const userId = this.getUserId();
    const newId = crypto.randomUUID();
    const forkedSequence: SequenceData = { ...sequence, id: newId };

    const libSeq = createLibrarySequence(forkedSequence, userId, {
      visibility: overrides?.visibility ?? "private",
      notes: overrides?.notes,
      source: userId === parentOwnerId ? "created" : "forked",
      forkAttribution: {
        originalSequenceId: parentId,
        originalCreatorId: parentOwnerId,
        originalCreatorName: parentOwnerName,
        forkedAt: new Date(),
      },
    });

    // Set the content hash on the new document
    const finalSeq = { ...libSeq, contentHash };

    // Use the existing write pipeline (everything after the libSeq construction
    // in saveSequence). To avoid duplicating the write logic, call saveSequence
    // with the new ID — it won't find an existing doc and will go through the
    // "new sequence" branch.
    // But we need to pass contentHash and forkAttribution through...
    //
    // Simplest: just do the Firestore write here directly, mirroring the
    // post-construction logic from saveSequence.
    return this.writeAndPostProcess(finalSeq, userId, true);
  }
```

**Actually, the cleanest approach is to restructure `saveSequence` to extract the write pipeline into a shared helper.** But that's a bigger refactor. For this task, the pragmatic approach:

In the existing-doc branch of `saveSequence()`, when hash differs:
1. Generate a new ID
2. Set `sequence.id` to the new ID
3. Clear the `existingDoc` reference (set `isNewSequence = true`)
4. Set fork attribution
5. Let the rest of the method proceed as if it's a new sequence

Here's the concrete edit to `saveSequence()`:

After line 250 (`const existingDoc = await getDoc(sequenceDocRef);`), add:

```typescript
    let isNewSequence = !existingDoc.exists();
    let actualSequenceId = sequenceId;
    let forkAttribution: ForkAttribution | undefined;

    // FORK DETECTION: If motion content changed, this is a new variation.
    // Create a new document — the original stays untouched in the user's library.
    if (existingDoc.exists() && incomingHash) {
      const existingHash = existingDoc.data()?.contentHash;
      if (existingHash && existingHash !== incomingHash) {
        const existingData = existingDoc.data();
        actualSequenceId = crypto.randomUUID();
        isNewSequence = true;
        forkAttribution = {
          originalSequenceId: sequenceId,
          originalCreatorId: existingData?.ownerId ?? userId,
          originalCreatorName: existingData?.ownerDisplayName ?? "",
          forkedAt: new Date(),
        };
      }
    }
```

Then update the rest of the method to use `actualSequenceId` instead of `sequenceId`, and pass `forkAttribution` into `createLibrarySequence`. And always set `contentHash` on the final document before writing.

**Read the full `saveSequence()` method before editing.** The exact line-by-line edits will depend on what the implementer sees. The key changes are:

1. **After fetching existingDoc**: Add the fork detection block above
2. **In the new-sequence branch** (`createLibrarySequence` call): Pass `forkAttribution` if set
3. **Before the Firestore write**: Add `contentHash: incomingHash` to the write data
4. **Use `actualSequenceId`** everywhere `sequenceId` was used for the doc ref and data

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean.

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts
git commit -m "feat(library): fork into new variation when motion content changes

When saving an existing sequence whose content hash differs from the stored
hash, creates a new document with a fresh ID, birthday, and fork attribution
pointing to the parent. The original document stays untouched.

Legacy sequences without a contentHash get one computed and stored on their
next save. If they have no stored hash to compare against, they're treated
as metadata updates (safe default)."
```

---

## Chunk 3: Update container-types and verify

### Task 7: Add contentHasher to container types

**Files:**
- Modify: `src/lib/shared/di/container-types.ts`

Check this file — if `contentHasher` was added to the library container's `.add()` block in Task 5, the container-types file may need updating to include `ISequenceContentHasher` in the type union. Read the file first to understand the pattern.

- [ ] **Step 1: Update container types if needed**

If `container-types.ts` uses manual type definitions for `IAppContainerItems`, add:

```typescript
contentHasher: ISequenceContentHasher;
```

If it uses `ItemsOf<LibraryContainer>` automatically, no change needed.

- [ ] **Step 2: Commit if changes were made**

```bash
git add src/lib/shared/di/container-types.ts
git commit -m "refactor(di): add contentHasher to container types"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: Clean or only pre-existing errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All pass (including the new SequenceContentHasher tests).

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Manual verification**

Tell the user to verify:
1. Create a new sequence (e.g., "ABC") → Save to library → Check Firestore: `contentHash` field exists
2. Load that sequence into the constructor → Change a turn value on one beat → Save
   - A NEW document should appear in the library with a different ID
   - The new document should have `forkAttribution` pointing to the original
   - The original document should be untouched
3. Load that same original sequence → Change nothing → Save
   - Should update the existing document (same ID, same hash)
4. Load that same original sequence → Change only the name → Save
   - Should update the existing document (hash didn't change, it's metadata only)

---

## Summary of What Changes

| Before | After |
|--------|-------|
| Re-saving an edited sequence overwrites the original document | Edited content creates a new document; original stays |
| No content identity concept | SHA-256 `contentHash` identifies each variation |
| No lineage tracking on edit | `forkAttribution` records parent sequence |
| Birthday preserved on update | New variation gets a fresh birthday |
| One document per sequence per user | Multiple variations can coexist in a user's library |

## What NOT to Change

- **`saveSequenceWithMetadata()`** — No changes needed. It delegates to `saveSequence()` which now handles forking.
- **`LibrarySaveService`** — Unchanged. The fork is invisible to the orchestration layer.
- **Public index sync** — Still works. New variations that are public get synced. Old variations keep their public status.
- **`canonicalSignature`** — Different purpose (rotation-invariant equivalence). Leave it alone.
