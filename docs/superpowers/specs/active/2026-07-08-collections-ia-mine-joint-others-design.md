# Collections IA — Distinguish Mine / TKA Core / Others'

**Date:** 2026-07-08
**Status:** Approved (design)
**Related:** `project_collections_module`, `2026-07-07-founding-smart-collections-design.md`

## Problem

The Library tab shows all a user's collections in one undifferentiated pile:
their own, the founding "everybody's joint" decks (TKA 1/2/3, Book), and a
Following shelf — with no header separating owned from joint. And there is no
obvious destination for browsing OTHER creators' public collections: that
browser already exists but is buried three taps deep as a `section` inside the
Gallery drill front door.

Both backend and the discovery screen already exist. This is an
information-architecture / surfacing fix, not new capability:
- `getAllPublicCollections` (collection-group feed, capped, newest-first) +
  `communityCollectionsState` — consumed today only inside `GalleryDrill`.
- `followedCollectionsState` + `followCollection`/`unfollowCollection` — the
  follow system, already rendered as Library's "Following" shelf.

## Non-Goals

- No rename of Library (keeps the convention Library = your stuff; matches
  Spotify/YouTube/Pinterest).
- No new bottom-nav root — the discovery destination is a Browse sub-tab.
- No backend / Firestore query / index changes.
- No new follow mechanics.

## Architecture

### Unit 1 — Library: three labeled sections

`MyCollectionsPanel` renders, per host (phone grid + desktop rail), via the
`ownShelves` and `followedShelves` snippets. Today `ownShelves` emits the All
shelf, then the founding cards, then the user's own collections, with no group
headers. Split into three headed sections (headers render only when the section
is non-empty):

1. **My Collections** — the All shelf + the user's own smart/manual collections.
2. **TKA Core** — the founding set (`FOUNDING_SMART_COLLECTIONS` →
   `toSyntheticCollection`). Visually distinct group, so "everybody's joint"
   decks read as curated-by-TKA, not user-made.
3. **Following** — followed creators' collections (existing `followedShelves`,
   gains a peer header consistent with the other two).

Label chosen: **TKA Core**. Section headers reuse the existing
`.following-title` heading style (rename the shared class to a neutral
`.shelf-heading` so all three match).

### Unit 2 — New "Collections" discovery tab

- `BrowseModuleType` gains `"discover"` (the id `"collections"` is already the
  Library tab's frozen id, so the new tab cannot reuse it). Label: **"Collections"**.
- `TAB_ORDER` becomes `["gallery", "collections", "discover", "creators",
  "hall-of-shame"]` — the tab bar shows **Gallery | Library | Collections |
  Creators**.
- New `CommunityCollectionsPanel.svelte` (in `browse/collections/components/`)
  lifts the discovery rendering currently inside `GalleryDrill`'s
  `section === "collections"` branch into a standalone panel: lazy
  `communityCollectionsState.ensureLoaded()`, loading/empty/error states, a grid
  of public-collection cards (`CollectionCard`) → open `CollectionDetailView`
  (read-only, follow/unfollow inline). `BrowseModule` renders it when
  `activeTab === "discover"`.
- The Gallery-drill "Collections — Curated by the community" mini-tile
  **repoints** to the new tab instead of switching to its own in-drill section,
  making the new tab the single home (the in-drill `section === "collections"`
  branch and its state wiring are removed from `GalleryDrill`). The drill tile
  requests the tab switch through the existing nav seam BrowseModule already uses
  for tab changes.
- Nav mapping: `BrowseModule`'s nav→tab effect and its tab→location persistence
  learn `"discover"` so the tab is routable, restorable, and back-stack correct,
  exactly like `"creators"`.

## Data Flow

Open Collections tab → `communityCollectionsState.ensureLoaded()` (cap 200,
newest first) → grid of `{collection, ownerId}` → tap → `CollectionDetailView`
(read-only rule/members, Follow button via `followedCollectionsState`) → a follow
then surfaces that collection in Library's Following shelf on its live snapshot.

## Components / Boundaries

| Unit | File | Responsibility |
|---|---|---|
| 1 | `MyCollectionsPanel.svelte` (modify) | Three headed sections in both hosts |
| 2 | `CommunityCollectionsPanel.svelte` (new) | Standalone public-collection discovery grid + detail routing |
| 2 | `BrowseModule.svelte` (modify) | `"discover"` tab: type, TAB_ORDER, render, nav mapping |
| 2 | `GalleryDrill.svelte` (modify) | Remove in-drill collections section; repoint tile to the tab |

`CommunityCollectionsPanel` depends only on `communityCollectionsState`,
`CollectionCard`, `CollectionDetailView`, `followedCollectionsState` — all
existing. It does not import `GalleryDrill` internals; the shared rendering moves
INTO the panel and the drill loses its copy (no duplication).

## Testing

- Unit: Library grouping — given a mixed set (own + founding + followed), the
  three sections receive the right collections; a section with none renders no
  header.
- Unit / static: `TAB_ORDER` contains `"discover"`; the nav→tab map resolves it.
- Runtime acceptance (browser): four tabs present; Collections tab lists public
  collections, opens one, follow adds it to Library → Following; Library shows the
  three headed groups; Gallery-drill tile lands on the Collections tab.

## Risks

- **Frozen tab id.** `"collections"` is Library. The new tab MUST be `"discover"`
  (or similar) — reusing `"collections"` collides. Verified against
  `BrowseModule.svelte:55`.
- **Drill section removal.** Removing `GalleryDrill`'s `section === "collections"`
  must also drop its `onOpenCollection` gate and the `communityCollectionsState`
  import there, or dead code/props linger. The panel becomes the only consumer.
- **Nav persistence.** Missing the tab→location wiring would make the tab
  non-restorable across reloads (cosmetic, but fix in the same pass).
