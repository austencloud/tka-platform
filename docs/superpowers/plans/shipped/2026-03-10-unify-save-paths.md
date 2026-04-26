# Unify Library Save Paths — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the dual save path by routing `LibrarySaveService` through `LibraryRepository.saveSequence()` instead of `SequencePersister.saveSequence()`, so every sequence write goes through one code path with consistent fields and side effects.

**Architecture:** `LibrarySaveService` keeps its orchestration role (thumbnail, upload, tags, progress). But instead of calling `SequencePersister` for the Firestore write, it calls `LibraryRepository.saveSequenceWithMetadata()` via DI. `SequencePersister` (the library saver at `create/shared/services/SequencePersister.ts`) is then retired — its Firestore write logic is already duplicated inside `LibraryRepository`. Kevin's manual public-index-sync wiring in `LibrarySaveService` is removed because `LibraryRepository` already handles it.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, Firebase Firestore

---

## Background: Why This Matters

Two independent code paths write to `users/{uid}/sequences/{id}`:

| | `SequencePersister` (UI save) | `LibraryRepository` (programmatic) |
|---|---|---|
| `birthday` | Missing | Set on creation, never changes |
| `_version` | Missing | Incremented for conflict detection |
| `ownerId` | Missing (writes `userId`) | Set correctly |
| `sequenceTags` / `tagIds` | Missing | Migrated on save |
| `orientationCycleCount` | Missing | Calculated for circular sequences |
| Offline tracking (`trackWrite`) | No | Yes |
| User stats (`sequenceCount`) | No | Yes |
| Achievement XP | No | Yes |
| Conflict detection | No | Yes |
| Public index sync | Added by PR #14 (duplicated) | Already handled |

Every sequence saved from the UI panel is missing fields the rest of the system depends on.

---

## IMPORTANT: Two Different SequencePersister Files

Do NOT confuse these:

| File | Purpose | Action |
|------|---------|--------|
| `src/lib/features/create/shared/services/SequencePersister.ts` | Library saver — writes sequences to Firestore | **RETIRE** |
| `src/lib/features/create/shared/services/implementations/SequencePersister.ts` | HMR state persistence — saves sequence state for hot reload via Dexie | **KEEP** |

Every reference below to "SequencePersister" means the library saver unless explicitly stated otherwise.

---

## File Structure

### Files to modify:

| File | Change |
|------|--------|
| `src/lib/features/library/services/contracts/ILibraryRepository.ts` | Add `saveSequenceWithMetadata()` method to interface |
| `src/lib/features/library/services/implementations/LibraryRepository.ts` | Implement `saveSequenceWithMetadata()` — single-write approach |
| `src/lib/features/library/services/implementations/LibrarySaveService.ts` | Replace `SequencePersister` with `ILibraryRepository` dep. Remove PR #14 public sync wiring. |
| `src/lib/shared/di/containers/library-container.ts` | Wire `libraryRepository` into `LibrarySaveService` constructor. Remove PR #14 `publicIndexSyncer` pass-through. |
| `src/lib/shared/di/browser-container.ts` | No `publicIndexSyncer` for `librarySaveService` needed anymore |
| `src/lib/shared/di/index.ts` | Same cleanup |

### Files to migrate (callers of library SequencePersister):

| File | Current Usage | Migration |
|------|--------------|-----------|
| `src/lib/features/create/shared/components/CreateModule.svelte` | `new SequencePersister()` at line 305, provides via context | Use `container.items.libraryRepository` instead |
| `src/lib/features/create/shared/context/create-module-context.ts` | Types `sequencePersister: SequencePersister \| null` at line 42 | Change type to `ILibraryRepository \| null` |
| `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte` | `ctx.sequencePersister.saveSequence()` at line 107 | Call `ctx.libraryRepository.saveSequenceWithMetadata()` |
| `src/lib/features/create/shared/components/panels/RecentSequencesPanel.svelte` | `getRecentSequences()`, `SavedSequence` type | Use `libraryRepository.getSequences()`, `LibrarySequence` type |
| `src/lib/features/create/shared/session-management-index.ts` | Re-exports `SequencePersister`, `SaveSequenceMetadata`, `SavedSequence` | Remove re-exports, check for downstream consumers |

### Files to delete:

| File | Why |
|------|-----|
| `src/lib/features/create/shared/services/SequencePersister.ts` | All callers migrated to `LibraryRepository` |

---

## Chunk 1: Extend LibraryRepository to Accept Metadata (Single-Write)

### Task 1: Add `saveSequenceWithMetadata` to ILibraryRepository interface

**Files:**
- Modify: `src/lib/features/library/services/contracts/ILibraryRepository.ts:76`

The existing `saveSequence(sequence: SequenceData)` takes raw sequence data with no metadata. The UI save path needs to pass name, visibility, tags, notes, thumbnailUrl. Rather than changing the existing signature (which would break `LibraryState` and other callers), add a new method.

- [ ] **Step 1: Add the method to the interface**

Add after the existing `saveSequence` method (~line 76):

```typescript
  /**
   * Save a sequence with explicit metadata from the UI save panel.
   * Like saveSequence(), but accepts name, visibility, tags, notes, and thumbnail.
   * All post-write side effects (public sync, achievements, conflict detection,
   * offline tracking) are handled identically to saveSequence().
   */
  saveSequenceWithMetadata(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<LibrarySequence>;
```

- [ ] **Step 2: Verify TypeScript catches the missing implementation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Error in `LibraryRepository.ts` — missing `saveSequenceWithMetadata` implementation.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/library/services/contracts/ILibraryRepository.ts
git commit -m "feat(library): add saveSequenceWithMetadata to ILibraryRepository interface"
```

---

### Task 2: Implement `saveSequenceWithMetadata` in LibraryRepository (single-write)

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`

**Why single-write:** The two-write approach (save with default visibility, then update) causes a race condition. `saveSequence()` defaults new sequences to `visibility: "public"` and fires `syncToPublicIndex`. If the user chose "private", the sequence briefly appears in the public gallery before the second write removes it. Single-write avoids this entirely.

**Approach:** Enrich the `SequenceData` with ALL metadata fields before calling the existing `saveSequence()` pipeline. The key change: `createLibrarySequence()` reads `visibility` from `options.visibility ?? "public"`. If we put the correct visibility on the enriched sequence, we need `saveSequence()` to pass it through. Looking at the code (line 231-236), `createLibrarySequence` is called with hardcoded `{ visibility: "public" }`. We need to change that to use the sequence's visibility if present.

- [ ] **Step 1: Modify `saveSequence` to respect incoming visibility**

In `LibraryRepository.saveSequence()`, change line ~231-236 from:

```typescript
    } else {
      libSeq = createLibrarySequence(
        { ...sequence, id: sequenceId },
        userId,
        { visibility: "public" }
      );
    }
```

To:

```typescript
    } else {
      libSeq = createLibrarySequence(
        { ...sequence, id: sequenceId },
        userId,
        {
          visibility: (sequence as any).visibility ?? "public",
          notes: (sequence as any).notes,
        }
      );
    }
```

Note: `SequenceData` doesn't have `visibility` or `notes` fields. We cast through `any` here because `saveSequenceWithMetadata` will spread these into the `SequenceData` object. This is a pragmatic choice — the alternative is adding a second optional parameter to `saveSequence()` which is cleaner but changes more call sites. The `as any` is contained to this one spot.

**Better alternative if you prefer type safety:** Add an internal optional second parameter:

```typescript
  async saveSequence(
    sequence: SequenceData,
    overrides?: { visibility?: SequenceVisibility; notes?: string }
  ): Promise<LibrarySequence> {
```

Then change the `createLibrarySequence` call:

```typescript
      libSeq = createLibrarySequence(
        { ...sequence, id: sequenceId },
        userId,
        {
          visibility: overrides?.visibility ?? "public",
          notes: overrides?.notes,
        }
      );
```

Existing callers (`LibraryState`) pass no second argument, so they're unaffected.

- [ ] **Step 2: Implement `saveSequenceWithMetadata`**

Add after the existing `saveSequence` method (~line 357):

```typescript
  async saveSequenceWithMetadata(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<LibrarySequence> {
    // Build the thumbnail array: new thumbnail first, then existing ones.
    const thumbnails = metadata.thumbnailUrl
      ? [metadata.thumbnailUrl, ...(sequence.thumbnails || [])]
      : (sequence.thumbnails || []);

    // Merge UI metadata into the sequence data so the existing saveSequence()
    // pipeline handles everything in a single write: birthday, _version,
    // offline tracking, achievements, public sync, conflict detection.
    const enrichedSequence: SequenceData = {
      ...sequence,
      name: metadata.name,
      displayName: metadata.displayName,
      word: sequence.word || metadata.name,
      thumbnails,
    };

    // Pass visibility and notes as overrides so createLibrarySequence()
    // gets the correct values on first write (no race condition).
    return this.saveSequence(enrichedSequence, {
      visibility: metadata.visibility,
      notes: metadata.notes,
    });
  }
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing ones).

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/LibraryRepository.ts
git commit -m "feat(library): implement saveSequenceWithMetadata with single-write approach

Avoids the visibility race condition by passing metadata through to
createLibrarySequence() on first write. No two-step save-then-update."
```

---

## Chunk 2: Rewire LibrarySaveService

### Task 3: Replace SequencePersister with LibraryRepository in LibrarySaveService

**Files:**
- Modify: `src/lib/features/library/services/implementations/LibrarySaveService.ts`

This is the core change. `LibrarySaveService` currently:
1. Generates thumbnail
2. Uploads thumbnail
3. Creates tags
4. Calls `SequencePersister.saveSequence()` ← replace this
5. (PR #14) Manually syncs public index ← remove this
6. Refreshes library state

After this change, step 4 calls `LibraryRepository.saveSequenceWithMetadata()` which handles everything: the Firestore write, birthday, _version, conflict detection, offline tracking, achievements, AND public index sync.

- [ ] **Step 1: Update imports and constructor**

Remove these imports (the SequencePersister import and PR #14 additions):

```typescript
// REMOVE:
import { SequencePersister } from "$lib/features/create/shared/services/SequencePersister";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";
import { getAuthSync } from "$lib/shared/auth/firebase";
```

Add:

```typescript
import type { ILibraryRepository } from "../contracts/ILibraryRepository";
```

Update the class fields and constructor:

```typescript
export class LibrarySaveService implements ILibrarySaveService {
  private readonly shareService: ISharer | null;
  private readonly uploadService: IFirebaseVideoUploader | null;
  private readonly tagService: ITagManager | null;
  private readonly libraryRepository: ILibraryRepository;

  constructor(
    shareService: ISharer | null,
    uploadService: IFirebaseVideoUploader | null,
    tagService: ITagManager | null,
    libraryRepository: ILibraryRepository
  ) {
    this.shareService = shareService ?? null;
    this.uploadService = uploadService ?? null;
    this.tagService = tagService ?? null;
    this.libraryRepository = libraryRepository;
  }
```

- [ ] **Step 2: Replace the save call and remove PR #14 public sync wiring**

In `saveSequence()`, replace the `SequencePersister.saveSequence()` call AND delete the entire public-index-sync block that Kevin added (the `if (visibility === "private" && this.publicIndexSyncer)` / `else if (visibility === "public" && this.publicIndexSyncer)` block):

```typescript
    // Step 4: Save sequence to Firestore (through LibraryRepository, which
    // handles birthday, _version, offline tracking, achievements, public
    // index sync, and conflict detection — all in one write path).
    emitProgress(4);
    const savedSequence = await this.libraryRepository.saveSequenceWithMetadata(
      sequence,
      {
        name,
        displayName: displayName || undefined,
        visibility,
        tags,
        notes,
        thumbnailUrl,
      }
    );

    const sequenceId = savedSequence.id;
```

Remove the entire block from `// The sequence is saved. Now update the community library` through the closing `}` of the public sync block. `LibraryRepository.saveSequence()` already handles public index sync internally.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in DI container files (constructor signature changed). Fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/library/services/implementations/LibrarySaveService.ts
git commit -m "refactor(library): route LibrarySaveService through LibraryRepository

Replaces SequencePersister with LibraryRepository.saveSequenceWithMetadata()
so all saves get birthday, _version, offline tracking, achievements, and
public index sync. Removes redundant PR #14 manual sync wiring."
```

---

### Task 4: Update DI container wiring

**Files:**
- Modify: `src/lib/shared/di/containers/library-container.ts`
- Modify: `src/lib/shared/di/browser-container.ts`
- Modify: `src/lib/shared/di/index.ts`

`LibrarySaveService` now takes `ILibraryRepository` as its 4th parameter (replacing the PR #14 `IPublicIndexSyncer`). The library container already creates `libraryRepository` — we just need to pass it to `LibrarySaveService`.

- [ ] **Step 1: Update library-container.ts**

Move `LibraryRepository` instantiation out of the `.add()` call so it can be shared:

```typescript
  // Create LibraryRepository before the container so LibrarySaveService
  // can receive the same instance.
  const libraryRepository = new LibraryRepository(
    deps.libraryRepository.achievementManager,
    deps.libraryRepository.tagManager,
    deps.libraryRepository.orientationCycleDetector,
    publicIndexSyncer,
    deps.libraryRepository.conflictResolver
  );

  return createContainer().add({
    publicIndexSyncer: () => publicIndexSyncer,
    collectionManager: () => new CollectionManager(),
    libraryRepository: () => libraryRepository,
    librarySaveService: () =>
      new LibrarySaveService(
        deps.librarySaveService.sharer ?? null,
        deps.librarySaveService.firebaseVideoUploader ?? null,
        deps.librarySaveService.tagManager ?? null,
        libraryRepository
      ),
  });
```

This replaces the existing `.add()` block (which currently creates `libraryRepository` inline and passes `publicIndexSyncer` to `LibrarySaveService`).

- [ ] **Step 2: Update browser-container.ts**

The `publicIndexSyncer` deps block for `createLibraryContainer` stays (it's still needed for `LibraryRepository`). But remove any `publicIndexSyncer`-to-`librarySaveService` wiring that PR #14 added. The library container factory now handles this internally.

Check: `browser-container.ts` currently passes `publicIndexSyncer: { browseLoader: browseContainer.items.browseLoader }` at the top level of `createLibraryContainer`. This stays — it's for `PublicIndexSyncer` construction, not for `LibrarySaveService`.

- [ ] **Step 3: Update index.ts**

Same as browser-container: the `publicIndexSyncer` config block in the `createLibraryContainer` call stays (for `PublicIndexSyncer` + `LibraryRepository`). The `browseLoader` addition from PR #14 stays. No `librarySaveService`-specific changes needed because `library-container.ts` handles the wiring internally now.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean (or only pre-existing errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/di/containers/library-container.ts src/lib/shared/di/browser-container.ts src/lib/shared/di/index.ts
git commit -m "refactor(di): wire LibraryRepository into LibrarySaveService"
```

---

## Chunk 3: Retire SequencePersister (Library Saver)

### Task 5: Migrate ALL callers away from SequencePersister

**Files:**
- Modify: `src/lib/features/create/shared/context/create-module-context.ts`
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`
- Modify: `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte`
- Modify: `src/lib/features/create/shared/components/panels/RecentSequencesPanel.svelte`
- Modify: `src/lib/features/create/shared/session-management-index.ts`

There are **five** files that reference the library SequencePersister. Three use it for reads, two use it for writes. All must migrate.

#### Step 1: Update the context type

**File:** `src/lib/features/create/shared/context/create-module-context.ts`

- [ ] **1a: Change the type**

Line 21: Replace `import type { SequencePersister } from "../services/SequencePersister";`
With: `import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";`

Line 42: Replace `sequencePersister: SequencePersister | null;`
With: `libraryRepository: ILibraryRepository | null;`

This is a **breaking rename** — every file that reads `ctx.sequencePersister` must change to `ctx.libraryRepository`. There are exactly two: `CreateModule.svelte` (provides it) and `VideoRecordCoordinator.svelte` (consumes it).

#### Step 2: Update CreateModule.svelte (the provider)

**File:** `src/lib/features/create/shared/components/CreateModule.svelte`

- [ ] **2a: Replace the import**

Line 69: Replace `import { SequencePersister } from "../services/SequencePersister";`
With: `import { container } from "$lib/shared/di";`

(Or use the existing container import if one exists in the file.)

- [ ] **2b: Replace the state variable**

Line 105: Replace `let sequencePersister: SequencePersister | null = $state(null);`
With: Remove this state variable entirely. The repository comes from the DI container.

- [ ] **2c: Replace the instantiation**

Line 305: Replace `sequencePersister = new SequencePersister();`
With: Remove. The repository is already available via `container.items.libraryRepository`.

- [ ] **2d: Update the context provider**

Lines 180-181: Replace `get sequencePersister() { return sequencePersister; }`
With: `get libraryRepository() { return container.items.libraryRepository ?? null; }`

#### Step 3: Update VideoRecordCoordinator.svelte (the consumer)

**File:** `src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte`

- [ ] **3a: Update the save call**

Line 107: Replace `ctx.sequencePersister.saveSequence(currentSequence, metadata)`

The old `SequencePersister.saveSequence()` takes `(SequenceData, SaveSequenceMetadata)` and returns `Promise<string>` (the ID).

The new `ILibraryRepository.saveSequenceWithMetadata()` takes `(SequenceData, { name, displayName?, visibility, tags, notes, thumbnailUrl? })` and returns `Promise<LibrarySequence>`.

Map the old metadata shape to the new one:

```typescript
const saved = await ctx.libraryRepository!.saveSequenceWithMetadata(
  currentSequence,
  {
    name: metadata.name,
    displayName: metadata.displayName,
    visibility: metadata.visibility ?? "private",
    tags: metadata.tags ?? [],
    notes: metadata.notes ?? "",
    thumbnailUrl: metadata.thumbnailUrl,
  }
);
const sequenceId = saved.id;
```

Read the file first to understand the full context around line 107 — there may be additional metadata fields or error handling to preserve.

#### Step 4: Update RecentSequencesPanel.svelte

**File:** `src/lib/features/create/shared/components/panels/RecentSequencesPanel.svelte`

- [ ] **4a: Replace imports**

Replace `import { SequencePersister } from "../services/SequencePersister";` and the `SavedSequence` type import with:

```typescript
import { container } from "$lib/shared/di";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
```

- [ ] **4b: Replace the data fetching**

Replace `new SequencePersister().getRecentSequences(limit)` with:

```typescript
container.items.libraryRepository.getSequences({
  limit: 10,
  sortBy: "updatedAt",
  sortDirection: "desc",
})
```

Note: `getSequences()` returns `LibrarySequence[]` (richer than `SavedSequence`). Update any type annotations in the component accordingly.

#### Step 5: Update session-management-index.ts

**File:** `src/lib/features/create/shared/session-management-index.ts`

- [ ] **5a: Remove SequencePersister re-exports**

Lines 23-27: Remove the exports of `SequencePersister`, `SaveSequenceMetadata`, and `SavedSequence`.

First check for downstream consumers:

Run: `grep -r "from.*session-management-index" src/ --include="*.ts" --include="*.svelte"`

If any file imports `SaveSequenceMetadata` or `SavedSequence` from this barrel, update those imports to use `LibrarySequence` directly.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/create/shared/context/create-module-context.ts \
  src/lib/features/create/shared/components/CreateModule.svelte \
  src/lib/features/create/shared/components/coordinators/VideoRecordCoordinator.svelte \
  src/lib/features/create/shared/components/panels/RecentSequencesPanel.svelte \
  src/lib/features/create/shared/session-management-index.ts
git commit -m "refactor(create): migrate all callers off library SequencePersister

Updates context type, CreateModule provider, VideoRecordCoordinator consumer,
RecentSequencesPanel reads, and session-management-index exports."
```

---

### Task 6: Delete the library SequencePersister

**Files:**
- Delete: `src/lib/features/create/shared/services/SequencePersister.ts`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "services/SequencePersister" src/ --include="*.ts" --include="*.svelte" | grep -v "implementations/SequencePersister"`

Expected: No matches. The HMR persister at `implementations/SequencePersister.ts` is the only remaining file with that name.

Also check for the types that lived in the library saver:

Run: `grep -r "SaveSequenceMetadata\|SavedSequence" src/ --include="*.ts" --include="*.svelte"`

Expected: No matches (or only the types defined in `SaveSequenceMetadata` if they've been moved elsewhere).

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/features/create/shared/services/SequencePersister.ts
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean.

- [ ] **Step 4: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(create): delete retired library SequencePersister

All library writes now go through LibraryRepository. The HMR
SequencePersister (implementations/SequencePersister.ts) is unaffected."
```

---

## Chunk 4: Cleanup and Verification

### Task 7: Verify PR #14 wiring is fully cleaned up

**Files:**
- Verify: `src/lib/features/library/services/implementations/LibrarySaveService.ts`

- [ ] **Step 1: Grep for leftover PR #14 references**

Run: `grep -n "PublicIndexSyncer\|syncToPublicIndex\|removeFromPublicIndex\|getAuthSync" src/lib/features/library/services/implementations/LibrarySaveService.ts`
Expected: No matches.

- [ ] **Step 2: Commit if any cleanup was needed**

---

### Task 8: Verify the full pipeline

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: Clean (or only pre-existing errors).

- [ ] **Step 2: Run tests**

Run: `npm test 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Manual verification checklist**

Tell the user to verify:
1. Open the app → Create a sequence → Save to Library (private) → Check My Library: sequence appears with correct fields
2. Save to Library (public toggle on) → Check Browse gallery: sequence appears immediately
3. Re-save an existing sequence with a new word → Check that the word updates correctly
4. Check that the sequence has `birthday`, `ownerId`, and `_version` in Firestore
5. Record a video via VideoRecordCoordinator → Verify sequence saves correctly

---

## Summary of What Changes

| Before | After |
|--------|-------|
| UI save → `LibrarySaveService` → `SequencePersister` (minimal write) | UI save → `LibrarySaveService` → `LibraryRepository` (full write) |
| Video record → `ctx.sequencePersister.saveSequence()` (minimal write) | Video record → `ctx.libraryRepository.saveSequenceWithMetadata()` (full write) |
| Missing: birthday, _version, ownerId, achievements, offline tracking | All fields and side effects handled uniformly |
| PR #14 manually wired public sync into LibrarySaveService | Public sync handled by LibraryRepository (single code path) |
| Two Firestore write shapes for same collection | One consistent write shape |
| `SequencePersister` (library saver) exists alongside `LibraryRepository` | `SequencePersister` retired. All reads/writes moved to `LibraryRepository`. |
| Context exposes `sequencePersister` | Context exposes `libraryRepository` |

## What NOT to Change

- **`implementations/SequencePersister.ts`** (HMR state persistence) — Different class, different purpose. Keep it.
- **`ILibrarySaveService` interface** — Still the right abstraction for the UI save orchestration. No changes needed.
- **`LibraryRepository.saveSequence(sequence: SequenceData)` signature** — Existing callers (`LibraryState`) still use this overload with no metadata. Don't break them.
- **`PublicIndexSyncer`** — Still works correctly. The `browseLoader` cache injection from PR #14 stays. We're just removing the _duplicate_ wiring in `LibrarySaveService`.
