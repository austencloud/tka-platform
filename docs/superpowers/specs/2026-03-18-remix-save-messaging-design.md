# Remix Flow: Save Messaging for Remixed Sequences

**Date:** 2026-03-18
**Status:** Draft
**Triggered by:** User feedback requesting clarity on edit-vs-save-new behavior

## Problem

When a user loads a sequence from the browse gallery, modifies it in the constructor, and saves it, the system silently creates a new sequence (fork). The user has no indication this happened. They may believe they overwrote the original.

The word "Edit" on the browse gallery button reinforces this wrong expectation.

## Design Decisions (from brainstorming)

1. **No attribution checkbox.** We explored letting users opt in/out of fork attribution at save time, but every heuristic for when to show it had edge cases. The simplest solution won.
2. **No threshold logic.** We considered detecting "how much changed" (beat count, word overlap, content hash similarity) to decide whether attribution is meaningful. Every approach had false positives or negatives. Relatedness is subjective — no algorithm can capture it.
3. **Fork attribution stays silent.** The existing `forkAttribution` field in Firestore continues to be stored automatically on content hash mismatch. No UI changes to attribution. If lineage data becomes valuable later, it's already there.
4. **The fix is communication.** Tell the user what will happen. That's it.

## Changes

### 1. Rename "Edit" to "Remix" in Sequence Viewer

The "Edit" button appears in multiple sequence viewer components. All user-facing labels and aria-labels change from "Edit" to "Remix." Internal action strings (`onEdit`, `handleEdit`, `handleAction("edit")`) stay the same — this is a label-only change.

**Files to update:**

| File | Lines | Context |
|------|-------|---------|
| `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte` | ~141-144 | Toolbar "Edit" button (desktop) |
| `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte` | ~218, ~378-381 | Footer "Edit" button (mobile + desktop variants) |
| `src/lib/shared/sequence-viewer/components/SequencePreviewPanel.svelte` | ~273 | Preview panel "Edit" button |
| `src/lib/shared/sequence-viewer/components/SequencePanel.svelte` | ~456-460 | Legacy panel "Edit" button |

Keep the same icon (`fa-pen-to-square`) or switch to something more fitting (e.g., `fa-shuffle`, `fa-rotate`).

**Why "Remix":** Short enough for a button. Implies building something new from existing material. Doesn't suggest overwriting the original. Fits flow arts culture.

### 2. Show Informational Message at Save Time

**File:** `src/lib/features/create/shared/components/SaveToLibraryPanel.svelte`

When the save panel opens and the sequence was loaded via the pending-edit flow (remixed from browse), show a small info line above the save button:

> "Saves as a new sequence. The original stays unchanged."

**Detection:** Use the existing `DeepLinkSequenceHandler.wasPendingEditProcessedThisSession()` method. This returns `true` when the current session loaded a sequence from browse via `tka-pending-edit-sequence` localStorage.

**Placement:** Below the form fields, above the footer buttons. Styled as a subtle info note — not a warning, not a modal, not a banner. Just a line of text with an info icon.

**When NOT to show:** If the sequence was created fresh in the constructor (not loaded from browse), or if the exact duplicate check shows "Already saved."

### 3. Track Remix Origin in Create Module State

**File:** `src/lib/features/create/shared/state/create-module-state.svelte.ts` (or equivalent)

Add a `remixedFrom` field to the create module state:

```typescript
remixedFrom: { word: string; creatorName: string } | null
```

Set this when a pending-edit sequence is loaded (in `DeepLinkSequenceHandler.loadFromPendingEdit()`). Clear it when the user clears the sequence (clear button action). This gives SaveToLibraryPanel the info it needs without reading localStorage directly.

**Lifecycle:**
- Load sequence from browse → `remixedFrom` set (e.g., `{ word: "FIRE", creatorName: "@austencloud" }`)
- Edit beats, add beats, remove beats → preserved
- Clear sequence (clear button) → set to `null`
- Close app, reopen, sequence restored → preserved (persisted with state)
- Save → message shown if `remixedFrom` is not null

## What This Does NOT Change

- **Fork detection logic** — content hash comparison in `LibraryRepository.saveSequence()` stays identical
- **Fork attribution storage** — `forkAttribution` field in Firestore continues to be set automatically
- **Public index sync** — `isForked`, `originalCreatorId`, `originalCreatorName` continue to be synced
- **Save behavior** — saves always create new sequences when content differs. No "overwrite" option.
- **Internal action strings** — `handleAction("edit")` and `handleEditSequence()` keep their internal names. Only the user-facing label changes.

## Scope

- 4-5 sequence viewer files modified (label rename), SaveToLibraryPanel (message), create module state
- ~30 lines of new code
- Zero new services, no new components, no new Firestore fields

## Out of Scope

- Displaying fork lineage in the browse gallery ("Remixed from X")
- Source filter UI in the library (filter by created/forked/all)
- Any threshold-based attribution logic
- "Overwrite original" / true edit functionality
