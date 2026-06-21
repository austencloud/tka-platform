# /1995 Foundation: Auth, DI Wiring, Rename, First Apps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire /1995 to real Firebase auth and DI services, rename SCRIBE → TKA Notation System, add soft-delete, and connect the two highest-impact apps (Notation System + File Manager) to real data.

**Architecture:** The retro route currently bypasses all app initialization (lines 309-320 of `src/routes/+layout.svelte`). We create a lightweight "retro mode" init path that loads Firebase + auth + DI container without the full app chrome (no banners, no prefetch, no modals). Each retro app gets a thin adapter that maps DI services to the retro component's needs.

**Tech Stack:** Svelte 5, ITI DI, Firebase Auth/Firestore, existing GenerationOrchestrator + LibraryRepository

**Spec:** `docs/superpowers/specs/2026-03-27-1995-route-elevation-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/routes/+layout.svelte` | Add retro init path (Firebase + auth + DI, no app chrome) |
| Create | `src/lib/features/retro/shared/services/retro-init.ts` | Lightweight retro bootstrap: init Firebase, auth, DI container |
| Create | `src/lib/features/retro/win95/components/shell/RetroLoginDialog.svelte` | Win95-styled auth dialog |
| Modify | `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte` | Add auth gate, receive DI container, rename references |
| Modify | `src/lib/features/retro/win95/state/desktop-state.svelte.ts` | Add auth state fields, soft-delete list |
| Create | `src/lib/features/retro/win95/adapters/notation-adapter.ts` | Maps GenerationOrchestrator to retro generate UI |
| Create | `src/lib/features/retro/win95/adapters/library-adapter.ts` | Maps LibraryRepository to retro file manager UI |
| Modify | `src/lib/features/retro/win95/components/apps/scribe/RetroScribe.svelte` | Rename to TKA Notation System, wire to real generation |
| Modify | `src/lib/features/retro/win95/components/apps/scribe/RetroGenerateTab.svelte` | Replace mock generation with real orchestrator |
| Modify | `src/lib/features/retro/win95/components/apps/scribe/RetroConstructTab.svelte` | Wire to real option picker logic |
| Modify | `src/lib/features/retro/win95/components/apps/filemgr/RetroFileManager.svelte` | Replace mock files with real library data |
| Modify | `src/lib/features/retro/shared/domain/era-types.ts` | Update title from "TKA-OS v1.0" to reflect Notation System |
| Modify | `src/lib/features/retro/shared/lore/order-references.ts` | Update SCRIBE references to Notation System |
| Modify | `src/lib/features/library/services/contracts/ILibraryRepository.ts` | Add soft-delete methods |
| Modify | `src/lib/features/library/services/implementations/LibraryRepository.ts` | Implement soft-delete (flag + restore + purge) |
| Modify | `src/lib/features/library/domain/models/LibrarySequence.ts` | Add `deletedAt` and `isDeleted` fields |

---

## Task 1: Retro Init Path

Wire the /1995 route to load Firebase, auth, and DI without the full app bootstrap.

**Files:**
- Create: `src/lib/features/retro/shared/services/retro-init.ts`
- Modify: `src/routes/+layout.svelte:306-320`

- [ ] **Step 1: Create retro init module**

Create `src/lib/features/retro/shared/services/retro-init.ts`:

```typescript
/**
 * Lightweight bootstrap for retro routes.
 * Loads Firebase + auth + DI container.
 * Skips: prefetch, analytics, moderation banners, modal state, web vitals.
 */
export async function initRetroMode(): Promise<{
  container: typeof import("$lib/shared/di").container;
  authState: typeof import("$lib/shared/auth/state/authState.svelte").authState;
}> {
  // 1. Load DI container (triggers service registration)
  const { container } = await import("$lib/shared/di");

  // 2. Initialize Firestore
  const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
  await getFirestoreInstance();

  // 3. Initialize auth state (sets up onAuthStateChanged listener)
  const { authState } = await import("$lib/shared/auth/state/authState.svelte");
  await authState.initialize();

  return { container, authState };
}
```

- [ ] **Step 2: Update layout to use retro init**

In `src/routes/+layout.svelte`, replace the standalone route bypass (lines 309-320) with a retro init path:

```typescript
// Replace this block:
const isStandaloneRoute = ["/1989", "/1995", "/1998", "/2003"].some(
  (r) => window.location.pathname.startsWith(r)
);
if (isStandaloneRoute) {
  const loadingScreen = document.getElementById("app-loading");
  if (loadingScreen) loadingScreen.remove();
  containerReady = true;
  return;
}

// With this:
const isRetroRoute = ["/1989", "/1995", "/1998", "/2003"].some(
  (r) => window.location.pathname.startsWith(r)
);
if (isRetroRoute) {
  const loadingScreen = document.getElementById("app-loading");
  if (loadingScreen) loadingScreen.remove();

  const { initRetroMode } = await import(
    "$lib/features/retro/shared/services/retro-init"
  );
  const { container: retroContainer } = await initRetroMode();
  containerRef = retroContainer;
  containerReady = true;
  return;
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: No errors. Retro routes still load, now with DI container available.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/retro/shared/services/retro-init.ts src/routes/+layout.svelte
git commit -m "feat(retro): add lightweight retro init path with Firebase + auth + DI"
```

---

## Task 2: Rename SCRIBE → TKA Notation System

Global rename across all retro files.

**Files:**
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte`
- Modify: `src/lib/features/retro/win95/components/apps/scribe/RetroScribe.svelte`
- Modify: `src/lib/features/retro/shared/domain/era-types.ts`
- Modify: `src/lib/features/retro/shared/lore/order-references.ts`
- Modify: Any other files referencing "SCRIBE.EXE" or "Scribe"

- [ ] **Step 1: Update era config**

In `src/lib/features/retro/shared/domain/era-types.ts`, update the win95 entry:
- Title: "TKA Notation System v1.0" (was "TKA-OS v1.0")
- Keep subtitle as Bellweather Technical Institute

- [ ] **Step 2: Update desktop icons**

In `RetroDesktop.svelte`, find the desktop icons array (around line 72-83). Change:
- `label: "SCRIBE.EXE"` → `label: "TKANOTTN.EXE"`
- `executable: "scribe"` → `executable: "notation"` (or keep internal ID, just change display)
- Window title references from "SCRIBE.EXE" → "TKA Notation System"

- [ ] **Step 3: Update RetroScribe component**

In `RetroScribe.svelte`:
- Window title: "TKA Notation System" (not "SCRIBE.EXE")
- Menu bar Help > About: "About TKA Notation System"
- Status bar references
- Any hardcoded "Scribe" strings in menus or dialogs

- [ ] **Step 4: Update Start menu**

In `RetroDesktop.svelte`, update Start menu Programs items that reference Scribe.

- [ ] **Step 5: Update lore references**

In `src/lib/features/retro/shared/lore/order-references.ts`, update any win95-era strings that mention "Scribe" to "Notation System".

- [ ] **Step 6: Update deep link route**

Verify `/1995/notation` works as a deep link (the `[...app]` catch-all maps path to executable ID).

- [ ] **Step 7: Build and verify**

Run: `npm run build`
Expected: Clean build, no "scribe" references remain in win95 user-facing text.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(retro): rename SCRIBE.EXE to TKA Notation System across win95 shell"
```

---

## Task 3: Auth Login Dialog

Win95-styled login that gates the desktop until Firebase auth succeeds.

**Files:**
- Create: `src/lib/features/retro/win95/components/shell/RetroLoginDialog.svelte`
- Modify: `src/lib/features/retro/win95/components/shell/RetroDesktop.svelte`
- Modify: `src/lib/features/retro/win95/state/desktop-state.svelte.ts`

- [ ] **Step 1: Add auth state to desktop state**

In `desktop-state.svelte.ts`, add fields:

```typescript
// Auth state
isAuthenticated = $state(false);
userDisplayName = $state<string | null>(null);
userEmail = $state<string | null>(null);
```

- [ ] **Step 2: Create RetroLoginDialog component**

Create `src/lib/features/retro/win95/components/shell/RetroLoginDialog.svelte`:

A Win95-styled modal dialog (centered, non-draggable, modal overlay) with:
- Title bar: "Log On to TKA Notation System"
- Icon: key or lock pixel art
- Two fields: Email (RetroTextInput), Password (RetroTextInput type="password")
- Two buttons: "OK" (submit), "Cancel" (disabled — you must log in)
- A "Sign in with Google" button styled as a Win95 button
- Error text area for login failures
- On success: sets `desktopState.isAuthenticated = true`, populates display name/email
- Calls `container.items.authenticator.signInWithEmail()` or `signInWithGoogle()`

The dialog appears AFTER the boot sequence completes, BEFORE the desktop becomes interactive. If the user is already authenticated (Firebase session persists), skip the dialog entirely.

- [ ] **Step 3: Wire auth check into RetroDesktop**

In `RetroDesktop.svelte`:

```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";

// Check if already authenticated on mount
$effect(() => {
  if (authState.user) {
    desktopState.isAuthenticated = true;
    desktopState.userDisplayName = authState.user.displayName;
    desktopState.userEmail = authState.user.email;
  }
});
```

Show `RetroLoginDialog` when `bootComplete && !desktopState.isAuthenticated`.

- [ ] **Step 4: Build and test manually**

Run: `npm run build`
Then test in browser: navigate to `/1995`, boot sequence plays, login dialog appears (or skips if already logged in from modern app).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/retro/win95/components/shell/RetroLoginDialog.svelte src/lib/features/retro/win95/components/shell/RetroDesktop.svelte src/lib/features/retro/win95/state/desktop-state.svelte.ts
git commit -m "feat(retro): add Win95-styled login dialog with Firebase auth"
```

---

## Task 4: Notation Adapter (Real Generation)

Wire RetroGenerateTab to the real GenerationOrchestrator.

**Files:**
- Create: `src/lib/features/retro/win95/adapters/notation-adapter.ts`
- Modify: `src/lib/features/retro/win95/components/apps/scribe/RetroGenerateTab.svelte`
- Modify: `src/lib/features/retro/win95/components/apps/scribe/RetroScribe.svelte`

- [ ] **Step 1: Create notation adapter**

Create `src/lib/features/retro/win95/adapters/notation-adapter.ts`:

```typescript
import { container } from "$lib/shared/di";
import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
import type { RetroPictographData } from "../../shared/domain/pictograph-types";

/**
 * Adapts the real GenerationOrchestrator for the retro generate UI.
 * Translates retro UI options (level, length, constraint preset)
 * into GenerationOptions, calls the real engine, and converts
 * the result back to RetroPictographData[] for the pixel renderer.
 */
export interface RetroGenerationResult {
  word: string;
  beats: RetroPictographData[];
  beatCount: number;
}

export async function generateSequence(options: {
  mode: "freeform" | "spell";
  word?: string;
  length?: number;
  level?: number;
  constraintPreset?: string;
}): Promise<RetroGenerationResult> {
  const orchestrator = container.items.generationOrchestrator as IGenerationOrchestrator;

  // Map retro options to real GenerationOptions
  // ... (implementation maps level/length/constraint to the orchestrator's API)

  const result = await orchestrator.generateSequence(/* mapped options */);

  // Convert SequenceData steps to RetroPictographData[]
  // ... (map each step's hand positions, motion types, etc.)

  return { word: result.word, beats: convertedBeats, beatCount: convertedBeats.length };
}
```

The key mapping work:
- Retro "level" (1-3) → maps to allowed motion types and turn amounts
- Retro "length" (4-16) → maps to `sequenceLength` option
- Retro "constraint" (smooth/reversal/none) → maps to `constraintPreset`
- Retro "mode: spell" + word → maps to `word` option with `constraintPreset: "smooth"`
- Result `SequenceData.steps[]` → map each step to `RetroPictographData` (extract blueHand/redHand positions, motion types, orientations)

- [ ] **Step 2: Wire RetroGenerateTab to real adapter**

In `RetroGenerateTab.svelte`, replace the fake generation block (around lines 98-150):

```typescript
// OLD: fake timeout + createMockPictographData
// NEW:
import { generateSequence } from "../../../adapters/notation-adapter";

async function handleGenerate() {
  isGenerating = true;
  statusText = "Initializing sequence engine...";

  try {
    const result = await generateSequence({
      mode: activeMode,
      word: activeMode === "spell" ? spellWord : undefined,
      length: selectedLength,
      level: selectedLevel,
      constraintPreset: selectedConstraint,
    });

    beats = result.beats;
    generatedWord = result.word;
    statusText = `Generated: ${result.word} (${result.beatCount} beats)`;
    dispatch("statuschange", { beatCount: result.beatCount, status: statusText });
  } catch (error) {
    statusText = "Generation failed. Try different settings.";
  } finally {
    isGenerating = false;
  }
}
```

Keep the FakeLoadingManager for the progress bar — it runs in parallel with the real generation, creating the theatrical experience while actual work happens.

- [ ] **Step 3: Update RetroScribe to pass container access**

Ensure RetroScribe (parent of RetroGenerateTab) provides access to the DI container. Since the adapter imports `container` directly from `$lib/shared/di`, no prop drilling needed — the container is a module-level singleton.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: Navigate to `/1995`, open TKA Notation System, go to Generate tab, enter a word, click Generate. Verify real pictograph data appears (not mock).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/retro/win95/adapters/notation-adapter.ts src/lib/features/retro/win95/components/apps/scribe/RetroGenerateTab.svelte
git commit -m "feat(retro): wire TKA Notation System generate tab to real GenerationOrchestrator"
```

---

## Task 5: Library Adapter (Real File Manager)

Wire RetroFileManager to the real LibraryRepository.

**Files:**
- Create: `src/lib/features/retro/win95/adapters/library-adapter.ts`
- Modify: `src/lib/features/retro/win95/components/apps/filemgr/RetroFileManager.svelte`

- [ ] **Step 1: Create library adapter**

Create `src/lib/features/retro/win95/adapters/library-adapter.ts`:

```typescript
import { container } from "$lib/shared/di";
import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
import { FileNameConverter } from "../services/implementations/FileNameConverter";

export interface RetroFile {
  id: string;
  dosName: string;        // 8.3 format: "FIRFLOWB.SEQ"
  fullName: string;       // "Fire Flow Basics"
  size: number;           // Derived from beat count
  date: Date;
  type: "SEQ" | "BAK";
  sequence: LibrarySequence;
}

const converter = new FileNameConverter();

/**
 * Load real library sequences and present them as DOS files.
 */
export async function listSequenceFiles(options?: {
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortDirection?: "asc" | "desc";
}): Promise<RetroFile[]> {
  const repo = container.items.libraryRepository as ILibraryRepository;
  const sequences = await repo.getSequences({
    sortBy: options?.sortBy ?? "updatedAt",
    sortDirection: options?.sortDirection ?? "desc",
  });

  const dosNames: string[] = [];
  return sequences.map((seq) => {
    const dosName = converter.convert(seq.name || seq.word || "UNTITLED", ".SEQ", dosNames);
    dosNames.push(dosName);
    return {
      id: seq.id,
      dosName,
      fullName: seq.name || seq.word || "Untitled",
      size: (seq.steps?.length ?? 0) * 128, // Fake bytes: 128 per beat
      date: seq.updatedAt?.toDate?.() ?? new Date(),
      type: "SEQ" as const,
      sequence: seq,
    };
  });
}

/**
 * Delete a sequence (calls real LibraryRepository.deleteSequence)
 */
export async function deleteFile(sequenceId: string): Promise<void> {
  const repo = container.items.libraryRepository as ILibraryRepository;
  await repo.deleteSequence(sequenceId);
}

/**
 * Subscribe to library changes for real-time updates.
 */
export function subscribeToLibrary(
  callback: (files: RetroFile[]) => void
): () => void {
  const repo = container.items.libraryRepository as ILibraryRepository;
  return repo.subscribeToLibrary((sequences) => {
    const dosNames: string[] = [];
    const files = sequences.map((seq) => {
      const dosName = converter.convert(seq.name || seq.word || "UNTITLED", ".SEQ", dosNames);
      dosNames.push(dosName);
      return {
        id: seq.id,
        dosName,
        fullName: seq.name || seq.word || "Untitled",
        size: (seq.steps?.length ?? 0) * 128,
        date: seq.updatedAt?.toDate?.() ?? new Date(),
        type: "SEQ" as const,
        sequence: seq,
      };
    });
    callback(files);
  });
}
```

- [ ] **Step 2: Rewrite RetroFileManager to use real data**

Replace the mock file generation in `RetroFileManager.svelte`:

```typescript
import { listSequenceFiles, deleteFile, subscribeToLibrary, type RetroFile } from "../../../adapters/library-adapter";

let files = $state<RetroFile[]>([]);
let isLoading = $state(true);

// Load real library data
$effect(() => {
  let unsubscribe: (() => void) | undefined;

  listSequenceFiles().then((result) => {
    files = result;
    isLoading = false;
  });

  // Subscribe to real-time updates
  unsubscribe = subscribeToLibrary((updated) => {
    files = updated;
  });

  return () => unsubscribe?.();
});
```

Map the directory tree to real data:
- `C:\SEQUENCES` → user's full library
- `C:\SEQUENCES\PRACTICE` → sequences tagged "practice" (or most recent)
- `C:\SEQUENCES\SHARED` → public sequences
- `C:\LIBRARY\LETTERS` → (could map to codex data later)
- `A:\` and `D:\` remain decorative (empty drives, period-accurate)

Right-click context menu on files: Open (→ opens in Notation System window), Delete (→ confirmation dialog → real `deleteFile()`), Properties (→ shows sequence metadata).

Double-click a .SEQ file: opens it in a new Notation System window with the sequence loaded.

- [ ] **Step 3: Wire file operations**

The key interactions:
- **Double-click file**: Call `windowManager.openWindow()` with sequence ID, Notation System loads it
- **Right-click > Delete**: Show RetroDialog confirmation, on confirm call `deleteFile(id)`
- **Sort by column header**: Pass sort options to `listSequenceFiles()`
- **Status bar**: Show real file count and total size

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: Navigate to `/1995`, open FILEMGR.EXE, verify real library sequences appear as DOS filenames.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/retro/win95/adapters/library-adapter.ts src/lib/features/retro/win95/components/apps/filemgr/RetroFileManager.svelte
git commit -m "feat(retro): wire File Manager to real LibraryRepository with DOS filenames"
```

---

## Task 6: Soft-Delete Infrastructure

Add soft-delete to LibraryRepository so the Recycle Bin can show and restore deleted sequences.

**Files:**
- Modify: `src/lib/features/library/domain/models/LibrarySequence.ts`
- Modify: `src/lib/features/library/services/contracts/ILibraryRepository.ts`
- Modify: `src/lib/features/library/services/implementations/LibraryRepository.ts`

- [ ] **Step 1: Add soft-delete fields to LibrarySequence**

In `LibrarySequence.ts`, add:

```typescript
/** When the sequence was soft-deleted. Null = not deleted. */
deletedAt?: Date | null;

/** Whether the sequence is in the recycle bin */
isDeleted?: boolean;
```

- [ ] **Step 2: Add soft-delete methods to ILibraryRepository**

In `ILibraryRepository.ts`, add to the interface:

```typescript
// ============================================================
// SOFT DELETE (RECYCLE BIN)
// ============================================================

/**
 * Soft-delete a sequence (move to recycle bin).
 * Sets isDeleted=true and deletedAt=now.
 * Removes from public index if public.
 */
softDeleteSequence(sequenceId: string): Promise<void>;

/**
 * Restore a soft-deleted sequence from the recycle bin.
 * Clears isDeleted and deletedAt.
 */
restoreSequence(sequenceId: string): Promise<void>;

/**
 * Permanently delete a soft-deleted sequence.
 * Only works on sequences where isDeleted=true.
 */
purgeSequence(sequenceId: string): Promise<void>;

/**
 * Get all soft-deleted sequences (recycle bin contents).
 */
getDeletedSequences(): Promise<LibrarySequence[]>;

/**
 * Permanently delete all soft-deleted sequences.
 */
emptyRecycleBin(): Promise<void>;
```

- [ ] **Step 3: Implement soft-delete in LibraryRepository**

In `LibraryRepository.ts`:

- `softDeleteSequence()`: Update doc with `{ isDeleted: true, deletedAt: serverTimestamp() }`. If public, call `unpublishSequence()` first.
- `restoreSequence()`: Update doc with `{ isDeleted: false, deletedAt: null }`.
- `purgeSequence()`: Check `isDeleted === true`, then call existing `deleteSequence()`.
- `getDeletedSequences()`: Query where `isDeleted == true`, ordered by `deletedAt desc`.
- `emptyRecycleBin()`: Get all deleted, batch delete.
- Update existing `getSequences()` to filter OUT soft-deleted by default. **Firestore gotcha:** `where("isDeleted", "!=", true)` would exclude documents that lack the `isDeleted` field entirely (all existing sequences). Instead, filter client-side: `sequences.filter(s => !s.isDeleted)`. Or add a migration step that sets `isDeleted: false` on all existing docs. Client-side filtering is simpler and sufficient for library-sized collections.
- Keep existing `deleteSequence()` as the hard-delete path (unchanged behavior for non-retro callers).

- [ ] **Step 4: Update library adapter to use soft-delete**

In `library-adapter.ts`, change `deleteFile()` to call `softDeleteSequence()` instead of `deleteSequence()`:

```typescript
export async function deleteFile(sequenceId: string): Promise<void> {
  const repo = container.items.libraryRepository as ILibraryRepository;
  await repo.softDeleteSequence(sequenceId);
}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Run: `npm run check`
Expected: Clean build. Existing library behavior unchanged (getSequences excludes deleted).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/library/domain/models/LibrarySequence.ts src/lib/features/library/services/contracts/ILibraryRepository.ts src/lib/features/library/services/implementations/LibraryRepository.ts src/lib/features/retro/win95/adapters/library-adapter.ts
git commit -m "feat(library): add soft-delete infrastructure for recycle bin support"
```

---

## Task 7: Save From Notation System

Wire the File > Save / Save As flow in TKA Notation System to real persistence.

**Files:**
- Modify: `src/lib/features/retro/win95/components/apps/scribe/RetroScribe.svelte`
- Modify: `src/lib/features/retro/win95/components/apps/scribe/RetroSaveDialog.svelte`
- Modify: `src/lib/features/retro/win95/adapters/notation-adapter.ts`

- [ ] **Step 1: Add save function to notation adapter**

In `notation-adapter.ts`, add:

```typescript
export async function saveSequence(
  sequenceData: SequenceData,
  name: string
): Promise<void> {
  const repo = container.items.libraryRepository as ILibraryRepository;
  await repo.saveSequenceWithMetadata(sequenceData, {
    name,
    visibility: "private",
    tags: [],
    notes: "",
  });
}
```

- [ ] **Step 2: Wire RetroSaveDialog to real save**

The save dialog already has a filename input. On "Save":
1. Convert the generated beats back to `SequenceData` format
2. Call `saveSequence(data, filename)`
3. Show success in status bar: "Saved: FILENAME.SEQ"
4. On error: show Win95 error dialog

- [ ] **Step 3: Wire File > Open to load from library**

File > Open shows a Win95 "Open" dialog that lists files from the library adapter. Selecting one loads the sequence into the current Notation System session.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: Generate a sequence, File > Save As, enter name, verify it appears in modern app's library.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/retro/win95/components/apps/scribe/RetroScribe.svelte src/lib/features/retro/win95/components/apps/scribe/RetroSaveDialog.svelte src/lib/features/retro/win95/adapters/notation-adapter.ts
git commit -m "feat(retro): wire TKA Notation System save/load to real LibraryRepository"
```

---

## Verification

After all tasks complete:

1. Navigate to `/1995` in browser
2. Boot sequence plays → login dialog appears (or skips if already authed)
3. Desktop shows "TKANOTTN.EXE" (not SCRIBE.EXE)
4. Open TKA Notation System → Generate tab → enter word → generates REAL sequence with pixel art
5. File > Save As → saves to Firebase → appears in modern app library
6. Open FILEMGR.EXE → see REAL library files as DOS filenames
7. Double-click a .SEQ file → opens in Notation System with real data
8. Right-click > Delete → soft-deletes (still in Firebase, just flagged)
9. All references say "TKA Notation System", not "SCRIBE"
