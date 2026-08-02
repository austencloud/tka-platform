---
status: active
value: 3
effort: M
remaining: "Unscored until triage 2026-07-25; spec body carries no status line. Needs a read-through to establish real state before this score is trusted."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---

# My Collections Tab — Design (2026-07-01)

## Problem

Browse > Collections showed a directory of every creator's library (the
creator-browser). Opening the tab told you nothing about YOUR collections:
no Favorites up front, no create/rename/delete, no way into a collection's
sequences. Discovering people already lives in the Creators tab, so the
Collections tab was both redundant and wrong.

## Decision

The Collections tab is **your collections**: in-tab master/detail, maximal
reuse of the gallery stack.

- **List view (default):** grid of collection cards — Favorites first
  (system collection, `sortOrder: -1000`, heart), then user collections —
  plus a dashed "New collection" tile with inline-input create. Card kebab
  (or right-click): Rename (inline) / Delete (confirm). Favorites shows no
  kebab: the backend refuses system-collection rename/delete, so the UI
  doesn't offer them.
- **Detail view:** header (back · icon · name · live count · options) over
  the same `BrowseGrid`/`ChoreoCardThumbnail` grid the gallery uses,
  showing that collection's members. Card menu gains
  `Remove from "<name>"`. Clicking a card opens the sequence viewer via
  `openSequenceViewer` (same as UserProfilePanel).
- **Navigation:** list/detail derives directly from
  `browseNavigationState.currentLocation` (the previously-unused
  `viewCollectionDetail` seam). Back/forward and localStorage restore work
  with zero sync wiring; a restore into a deleted collection bails to list
  when the live subscription reports null.
- **Signed out:** explanatory empty state (PersonalMuseumModule pattern) —
  collections are account-bound.

## Audit amendments (folded in from the plan review)

1. `getCollectionSequences` returns batched reads unordered → detail
   re-sorts members by the collection's `sequenceIds` order.
2. Collection cap (500) exceeds the virtualization threshold (50) →
   `collectionContext` threads through ChoreoCardThumbnail, BrowseGrid,
   AND VirtualizedSequenceGrid.
3. "Remove from this collection" is NOT gated on owning the sequence
   (collections can hold others' public sequences); it's gated on the
   collection being yours — always true in this MVP.
4. Detail liveness via `subscribeToCollection`: removals filter locally,
   additions refetch, deletion elsewhere bails back to list.
5. Cover thumbnails deferred: cards use the collection's icon + color
   (zero fetches). First-member covers are a fast-follow via one batched
   fetch if wanted.

Bonus fix found during implementation: collection icons are stored bare
("fa-heart") but rendered without the required `fas` style class — the
picker's icons were silently blank. Fixed in CollectionPickerContent and
handled in the new components.

## Components

- New: `features/browse/collections/components/MyCollectionsPanel.svelte`,
  `CollectionCard.svelte`, `CollectionDetailView.svelte`.
- Extended: `collections-state` (+`rename`, +`remove`),
  `ChoreoCardThumbnail` (+`collectionContext` prop + menu entry),
  `BrowseGrid` / `VirtualizedSequenceGrid` (prop pass-through).
- Unwired (not deleted): `CollectionsBrowsePanel`, `CreatorLibraryCard`,
  `collections-browse-state` — the creator-browser.

## Addendum (same day): Mine | Community split

Austen picked "Mine | Community" (AskUserQuestion, 2026-07-01). The tab
gains a SegmentedControl: **Mine** (default, everything above) and
**Community** — everyone's public collections as one flat grid, newest
activity first, browsable signed-out.

- Feed: `community-collections-state` aggregates per-creator
  (`getUsers()` → `getUserPublicCollections(uid)`), the same reads the
  old creator-browser used — rules already allow them
  (`firestore.rules:471`, `allow read: if true`). Own collections and
  empty collections are filtered out. Session-cached. A cross-user
  collectionGroup index is the scale-up path later.
- Publishing: "Make public / Make private" in the own-card menu
  (`collections-state.setPublic` → `updateCollection`), globe badge in
  the card's count line.
- Read-only foreign detail: contextId encodes `ownerId:collectionId`
  (own ids never contain a colon); `CollectionDetailView` gets
  `foreignOwnerId` — one-shot fetch via `public-collection-loader`
  (which enforces isPublic), no options menu, no remove entries, owner
  credit in the header. Back returns to the Community sub-view.
- List polish: centered 880px column; Mine sorts Favorites-first then
  most-recently-touched (all user collections share sortOrder 0, so the
  tie-break was arbitrary before). Picker keeps stable order — toggling
  bumps updatedAt and tiles would jump under your finger.

## Deferred

- Saving/favoriting OTHER people's public collections into your own
  account (needs a saved-reference model — a foreign collection isn't in
  your `users/{uid}/collections` subtree).
- Shared multi-editor collections (Google-Photos style).
- Cross-user collectionGroup query + index (replaces per-creator
  aggregation once creator count makes N+1 reads hurt).
- Member reordering UI (`reorderSequences` exists in the manager).
- Collection cover thumbnails (see amendment 5).

## Addendum (2026-08-01): contextual multi-select removal

Selection mode inside an owned collection exposes the action implied by that
context: **Remove from this collection**. It is a neutral, undoable membership
change. **Delete permanently** stays separate and keeps its confirmation.

The selection toolbar keeps batch filing as **Add to collection…** because its
picker is intentionally one-way in bulk mode. A collection that already contains
the whole selection is marked as such and disabled instead of accepting a no-op
that closes the picker. The direct removal path uses the collection manager's
chunked Firestore membership transactions and returns the exact committed ids so
Undo and partial failures remain accurate.
