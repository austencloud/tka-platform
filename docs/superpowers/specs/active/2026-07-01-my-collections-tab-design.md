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

## Deferred

- Saving/favoriting OTHER people's public collections (needs a
  saved-reference model — a foreign collection isn't in your
  `users/{uid}/collections` subtree).
- Shared multi-editor collections (Google-Photos style).
- A "Discover collections" browse surface.
- Member reordering UI (`reorderSequences` exists in the manager).
- Collection cover thumbnails (see amendment 5).
