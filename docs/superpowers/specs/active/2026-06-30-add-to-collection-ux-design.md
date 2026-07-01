# Add-to-Collection UX — Design

**Date:** 2026-06-30
**Status:** Active
**Author:** Austen Cloud (brainstormed with Claude)

## Problem

A user asked to "put things in collections more comfortably." Investigation
(three parallel explore agents, 2026-06-30) found the collections **data layer
is 100% built and unused by the UI**:

- `src/lib/shared/library/services/collection-manager.ts` — full CRUD,
  bidirectional sequence↔collection sync, cascade delete, real-time
  `subscribeToCollections` (`onSnapshot`). `addSequenceToCollection` works today.
- Model `LibraryCollection` (`src/lib/shared/library/domain/models/collection.ts`)
  — name, `sequenceIds`, `sequenceCount`, color, icon, `isPublic`, cover,
  `sortOrder`, `systemType`, `deckMetadata`.
- Favorites is the system collection `system_favorites` (not a boolean).
- Firestore `users/{uid}/collections/{collectionId}` (+ nested `/sequences`),
  rules provisioned (`firestore.rules:471-486`). Caps: 100 collections/user,
  500 sequences/collection. Cloud-only, no Dexie cache.

The gap is **pure UI**:

- `SaveToLibraryDialog.svelte` shows a placeholder: *"Collection management
  coming soon"*; save hardcodes `collectionIds: []`.
- The browse card menu (`ChoreoCardThumbnail`) has no "add to collection".
- `moveToCollection()` in `library-batch-operations.ts:119` has zero callers.

Note: the **Browse > Collections tab** (`src/lib/features/browse/collections/`)
is a *separate* surface — a read-only browser of *other* creators' public
collections. This spec does NOT touch it. This spec is about organizing the
user's **own** library.

## Goal

Let a user drop their own sequences into named collections with minimal
friction, from where they already are (browsing their library, saving a new
sequence). Reuse existing primitives; hand-roll nothing that exists.

## Approach (chosen: "shared picker sheet")

One picker component, invoked from every entry point, backed by a live state
singleton over the existing `collection-manager`. The MVP ships the two
highest-frequency entry points; bulk and build-from-inside reuse the identical
picker in later phases.

Rejected alternatives:

- *Library manager first* — front-loads the heaviest UI; the per-card add is the
  higher-frequency action, so this delays first comfort.
- *Minimal ContextMenu submenu* — cramped, right-click/desktop-biased, no room
  for a "new collection" input, weak on mobile, dead-ends at bulk.

## Scope

### MVP (Phase 1) — two entry points, sequences the user OWNS

1. **Owner card menu** — browse gallery `ChoreoCardThumbnail` context menu gains
   an owner-scoped "Add to collection…" entry that opens the picker sheet.
2. **Save dialog** — `SaveToLibraryDialog` replaces its placeholder with the
   inline picker; chosen collections are written into `collectionIds` at save.

### Deferred (reuse the same picker)

- **Phase 2 — Bulk:** selection mode in `BrowseGrid` + a toolbar "Add N to…"
  that opens the sheet with multiple sequence ids.
- **Phase 3 — Build-from-inside:** a real Collections view (library
  `activeSection: "collections"`) where opening a collection shows its sequences
  and a "＋ Add sequences" affordance reuses the sheet in reverse.

### Out of scope (YAGNI)

Reordering collections, cover-art upload, public-share toggle UI, deck
promotion (all backend-present, none part of "comfortably add things"). Adding
*other users'* public sequences to your collection (needs save-to-library-first
semantics — a separate feature).

## Components

### New

**`src/lib/features/library/state/collections-state.svelte.ts`** — singleton
`$state<LibraryCollection[]>`, hydrated + kept live via
`collection-manager.subscribeToCollections`, calls `ensureSystemCollections`
on init so Favorites always exists. Mirrors the shape of
`mandala-collection-state.svelte.ts`. Exposes:

- `collections` (derived, sorted by `sortOrder`; Favorites first via its
  `sortOrder: -1000`).
- `loading` (true until first snapshot resolves).
- `isIn(sequenceId, collectionId): boolean` — membership test.
- `toggle(sequenceId, collectionId): Promise<void>` — optimistic flip, calls
  `addSequenceToCollection` / `removeSequenceFromCollection`, reverts on failure.
- `create(name): Promise<LibraryCollection>` — `createUserCollection`.
- `createAndAdd(name, sequenceId): Promise<void>`.
- Cap guards: reject `toggle`-add at 500/collection and `create` at 100
  collections, surfacing a toast.

**`src/lib/features/library/components/collection-picker/CollectionPickerContent.svelte`**
— the picker UI, no Drawer chrome (so the save dialog can embed it inline):

- Header (title, optional sequence name).
- Collections as toggle chips using `FilterChipBase mode="toggle"`
  (`role="switch"` — no checkboxes). Active chip = sequence is a member.
  Favorites is the first chip (heart icon, its collection color).
- Each chip shows a `sequenceCount` badge with `font-variant-numeric:
  tabular-nums` (toggling must not jitter chip width).
- "＋ New collection" as a `FilterChipBase mode="action"` chip that expands to
  an inline text input **within reserved row height** (no layout shift on
  expand); Enter/✓ creates + adds the current sequence + selects it.
- States: loading = neutral skeleton chips; empty (no collections) = short
  prompt with the new-collection input focused.
- Props: `sequenceIds: string[]` (one for MVP; array-ready for bulk),
  `sequenceLabel?: string`.

**`src/lib/features/library/components/collection-picker/CollectionPickerSheet.svelte`**
— `Drawer` wrapper cloned from `PropSelectionSheet.svelte` (bottom sheet on
mobile, right drawer on desktop via `responsiveLayoutManager`, drag handle,
backdrop/escape close, definite height for the iOS collapse fix, 44px explicit
close, reduced-motion inherited). Hosts `CollectionPickerContent`. Props:
`isOpen` (`$bindable`), `sequenceIds`, `sequenceLabel?`.

### Reused (no new primitives)

`Drawer` (`shared/foundation/ui/Drawer.svelte`), `FilterChipBase`
(`shared/browse/components/filter-chips/FilterChipBase.svelte`),
`collection-manager` (`createUserCollection`, `addSequenceToCollection`,
`removeSequenceFromCollection`, `subscribeToCollections`,
`ensureSystemCollections`), `getHapticFeedback`, `toast`, design tokens.

### Modified

**`ChoreoCardThumbnail.svelte`** — add an owner-scoped "Add to collection…"
`ContextMenuEntry` (icon `fa-folder-plus`) inside the existing
`isOwner`-gated block (alongside "Remove from library", line ~272). Its action
opens a local `CollectionPickerSheet` instance for the displayed sequence.
Confirm/ensure the menu is reachable on touch (long-press), since the card
currently binds only `oncontextmenu`; add a long-press handler if right-click is
the only trigger today.

**`SaveToLibraryDialog.svelte`** — replace the placeholder block (~lines
210–218) with `CollectionPickerContent` bound to the not-yet-saved sequence.
Feed the selected collection ids into the save call, replacing the hardcoded
`collectionIds: []` (line ~90). At save time the sequence id may not exist yet,
so the dialog collects chosen collection ids locally and applies them to the
`LibrarySequence.collectionIds` on create (and adds the id to each collection's
`sequenceIds` via the manager) once the sequence is persisted.

## Data flow

```
collections-state (singleton)
  └── subscribeToCollections(uid)  ← live LibraryCollection[]

CollectionPickerContent
  ├── reads collections-state.collections + .isIn(seqId, colId)
  ├── toggle chip → state.toggle(seqId, colId)
  │       → addSequenceToCollection / removeSequenceFromCollection
  │       → manager syncs BOTH collection.sequenceIds AND sequence.collectionIds
  └── new collection → state.createAndAdd(name, seqId)

CollectionPickerSheet = Drawer + CollectionPickerContent   (card menu entry)
SaveToLibraryDialog   = inline CollectionPickerContent      (save flow)
```

Membership is multi (a sequence in many collections). Favorites toggling routes
through the same `toggle` against `system_favorites`, unifying the heart with
collections.

## Error handling (earned, not defensive)

- Toggle is optimistic; on a failed write, revert the chip state and
  `toast.error`. Network writes genuinely fail — this path is earned.
- `create` failure keeps the typed name in the input and toasts.
- Cap violations toast a specific message ("Collection is full (500)" /
  "Collection limit reached (100)") and do not attempt the write.

## Layout stability (no-layout-shift)

- Count badges `tabular-nums`.
- New-collection input expands within a reserved-height row.
- Definite sheet height (PropSelectionSheet's iOS fix), not `fit-content`.
- Chip grid wraps; a newly-created chip appends without reflowing the sheet size
  (sheet scrolls internally).

## Accessibility

- Toggle chips are `FilterChipBase` `role="switch"` / `aria-pressed`. No
  checkboxes anywhere.
- All targets ≥ 44px.
- Reduced-motion owned by `Drawer`; consumers do not re-implement it.
- Sheet has `aria-label`, focus trap and escape via `Drawer`.

## Testing

- **Component test** (vitest-browser-svelte) for `CollectionPickerContent`:
  toggling a chip adds/removes membership; "New collection" creates and selects;
  chips expose `role="switch"`. Justified per component-test-discipline — an
  interactive shared primitive with reactivity/ARIA surface.
- **Unit test** for `collections-state` membership helpers (`isIn`, `toggle`
  optimistic revert, cap guards) with a mocked `collection-manager`.
- Skip a test for `CollectionPickerSheet` (presentational Drawer wrapper).

## Files

Create:
- `src/lib/features/library/state/collections-state.svelte.ts`
- `src/lib/features/library/components/collection-picker/CollectionPickerContent.svelte`
- `src/lib/features/library/components/collection-picker/CollectionPickerSheet.svelte`
- Tests alongside per project convention.

Modify:
- `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte`
- `src/lib/features/create/shared/components/SaveToLibraryDialog.svelte`

Reuse (no change): `collection-manager.ts`, `Drawer.svelte`,
`FilterChipBase.svelte`.

## Success criteria

1. From the browse gallery, right-click / long-press an owned sequence card →
   "Add to collection…" → sheet lists my collections (Favorites first) →
   tapping a chip files the sequence; the chip reflects membership immediately
   and persists to Firestore.
2. "＋ New collection" creates a collection and files the sequence in one step.
3. In the save dialog, I pick collections before saving and the new sequence
   lands in them at creation (no second step).
4. No checkboxes, no layout shift on toggle/expand, 44px targets, works on
   mobile (bottom sheet) and desktop (right drawer).
5. `npm run check` clean; component + unit tests green.
