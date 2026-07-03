# Library Home — Collections as the Home for Your Stuff

**Date:** 2026-07-02
**Status:** Approved (brainstormed in-session; Austen: "spec it all, achieve it all")

## Problem

The gallery's Community | My Library source toggle feels off. Diagnosis: Community
and My Library are different jobs wearing one surface. Community = discovery
(hundreds of sequences, drill, filters). My Library = retrieval (find MY thing
again). The toggle makes your stuff a *mode of the discovery machine* instead of
a *place*. Industry pattern (Spotify, Instagram Saved, Pinterest): your stuff is
a destination; discovery of others' curation happens inside discovery surfaces,
and followed/saved items land in your library.

The Collections module already IS the right home: collections store
`sequenceIds` as references into your library (library = the pile, collections =
views), and Favorites is already a system collection
(`system_favorites`, `collection.ts:32`). What's missing is the pile itself as a
browsable shelf, and the follow mechanic that makes discovery feed the library.

## Decisions (made with Austen in-session)

1. **All shelf opens the full grid** — full `BrowsePanel`, not a lighter list.
   "Consistent UI experience."
2. **No forced collection pick at save.** One-tap save lands in the library
   (= visible in All). Collections optional. No "Uncategorized" folder.
3. **Favorites stays a system collection** + heart action. Not a separate concept.
4. **Discovery of others' collections moves INTO discovery** (gallery drill
   category + creator profiles), not a module of its own. Nothing retires —
   discovery gets promoted into the gallery.
5. **Module renames Collections → Library** once it can hold followed
   collections (Phase 2). Internal id `collections`, routes, persistence keys
   unchanged.
6. Both phases build now.

## Phase 1 — All shelf + gallery goes pure-discovery

### 1a. "All" shelf in the Mine list

`MyCollectionsPanel.svelte` renders a synthetic pinned card at the very top
(above Favorites — All is the superset):

- Reuses `CollectionCard` with a synthetic `LibraryCollection`
  (`id: "all"`, `name: "All"`, `icon: "fa-layer-group"`, `readonly`), count =
  live library size.
- Tap → `browseNavigationState.viewCollectionDetail("all", "All")`. The
  existing detail derivation already treats a colon-free contextId as an own
  collection; `"all"` routes to the new view instead of `CollectionDetailView`.
- **NEW `AllLibraryView.svelte`** (collections/components): composes the
  existing primitives — `BrowsePanel` (fullpage) + `GalleryFilterSheet` +
  variation picker — around its own engine:
  `createBrowseEngine({ persistKey: "tka-browse-library-all",
  initialSource: "my-library", sources: ["my-library"], sections: true })`.
  Sort, filters pill, search chip, word-collapse, variation drawer all
  inherited. Justification gate: composition of existing primitives, zero new
  ones (same composition GalleryTab uses).
- `onSelect` → `openSequenceViewer` with `returnPath: "/browse/collections"`,
  `returnLabel: "Library"`.

### 1b. Gallery drops the source toggle

- `GalleryTab.svelte`: remove `showSourceToggle`.
- `BrowseModule.svelte` engine config: `sources: ["community"]`,
  drop `allowSourceToggle`.
- **Guard (required):** persisted `tka-browse-gallery` state may hold
  `source: "my-library"`. `create-browse-engine` must sanitize a restored
  source that isn't in `config.sources` back to `initialSource`, or users who
  last used My Library get stranded in a library-scoped gallery with no toggle.
- Cleanup: `navigation-coordinator.svelte.ts` writes legacy
  `tka-gallery-source` (~lines 598-607, 638-647, 735-744) that nothing reads —
  the "library" legacy redirect now just lands on Browse; delete the dead key
  writes.
- **Not touched:** `my-library` engine source and its other consumers
  (SequencePickerModal, CovenSequencePicker, AddSequencesSheet,
  ChoreoSheetView's 3-way source). All create their own engines; verified
  isolated.

## Phase 2 — follow, drill discovery, rename

### 2a. Collection follow

- **Data:** `users/{uid}/followedCollections/{ownerId}_{collectionId}` →
  `{ ownerId, collectionId, followedAt }`. Mirrors the existing user-follow
  subcollection pattern (`users/{uid}/following/`).
- **Rules:** new match block — owner-only read/write (same shape as
  `firestore.rules:320-327`). Public collection docs are already
  world-readable (`firestore.rules:486`), so rendering a followed collection
  needs no further rule changes. **Rules must be deployed** — flagged at ship.
- **State:** `collections-state.svelte.ts` gains a followed-collections
  subscription; for each follow doc, fetch the public collection doc + owner
  displayName. Dead follows (deleted/unpublished collections) filter out
  silently at render, list them under a lazy "clean up" affordance later —
  out of scope.
- **UI:**
  - Foreign `CollectionDetailView` header gets a Follow / Following button
    (real button per clickables-look-like-buttons).
  - Mine list renders followed collections after your own, `readonly`, with
    "by {ownerName}", kebab → Unfollow.
- Collaboration (multi-editor collections) is explicitly future — the
  membership-decides-your-library model is designed for it, not built here.

### 2b. Gallery drill "Collections" category

- `GalleryDrill.svelte`: new `Section` `"collections"`, mini-tile on the
  chooser (icon `fa-folder`, color `#c084fc` — module color), value screen
  listing community collections (name, count, "by owner"), loaded via
  `communityCollectionsState`.
- Tap → new prop `onOpenCollection(ownerId, collectionId, name, ownerName)`.
  **Gating:** the tile + screen render only when `onOpenCollection` is
  provided. BrowseModule (page variant) provides it; `GalleryFilterSheet` does
  not — a filter sheet must never navigate away.
- BrowseModule handler: `browseNavigationState.navigateTo({ tab:
  "collections", view: "detail", contextId: "ownerId:collectionId", filter:
  { type: "collectionName", value, displayName } })` — same encoding
  `MyCollectionsPanel.openCommunityCollection` uses — plus whatever
  activeTab sync BrowseModule needs to actually show the collections tab.

### 2c. Community tab relocates, module renames

- `MyCollectionsPanel`: remove the Mine | Community `SegmentedControl` and the
  community list — the panel is now just your library: **All, Favorites, your
  collections, followed collections**. `community-collections-state` survives
  as the drill screen's loader. Foreign-detail routing (`ownerId:collectionId`)
  unchanged.
- Rename surfaces (label only; ids/routes/keys frozen):
  - `tab-definitions.ts:130` label → `"Library"`, description → "Your saved
    sequences and collections", icon → `fa-book`.
  - `messages/en.json`: `tab_browse_collections` → "Library",
    `tab_desc_browse_collections` → "Your saved sequences and collections".
    Other 7 locales go stale → flagged for the local-LLM translation pass.
  - `MyCollectionsPanel.svelte:145` h2 → "Library".
  - `app-capabilities-manifest.ts:96`, `analytics-config.ts:53`.
  - **Keep as-is (feature nouns, not the module label):** CreatorLibraryCard's
    "Collections" tab, ChoreoSheetView picker option, CollectionPickerContent
    aria-label, "Add to collection" copy.

## v2 — Pickers speak the library grammar (2026-07-02, same session)

Austen: pickers still ran pre-redesign UI. Two surfaces flagged by screenshot:
the Library Add Sequences sheet (toolbar magnifier) and the Choreo sheet's
inline picker (3-way My Library | Community | Collections slider + old inline
dropdown-chip filter bar + floating count). His key correction, sharper than
my first proposal: **collections are the PRIMARY organization of the library**
— they don't belong in the same slider as the two pools, and they don't belong
buried in the filter sheet either.

Landed design:

- **Engine grows `BrowseFilterType.COLLECTION`** — value = collection id,
  one-per-type (picking replaces, re-tap clears). Membership resolves through
  `setCollectionMembershipResolver` registered by `collections-state`
  (browse-filter stays pure of feature imports; the resolver reads live
  `$state`, so member changes recompute any applied pipeline). No resolver /
  unknown id → empty result: a stale persisted filter surfaces as a
  dismissible zero-result chip, never as silently unfiltered data.
- **NEW `CollectionChipsRow.svelte`** (library/components/collection-picker):
  All + one FilterChipBase per collection (live composed counts, collection
  colors), driving the engine filter. **Ownership routes the candidates:** the
  My Library source shows your own collections, the Community source shows
  collections you follow — counts only PRUNE within the routed set (drop a chip
  whose live count is zero), they never route. (An earlier build gated purely
  on count; because your published sequences also live in the community pool,
  your own collections intersected it and surfaced under Community, reading as a
  bug — hence explicit ownership routing.) A `$effect` clears a COLLECTION
  filter whose id leaves the candidate set on a pool switch / unfollow.
  At-most-one-that-clears semantics → FilterChipBase toggles per
  chip-primitives routing, not SegmentedControl.
- **Choreo sheet picker rebuilt on the grammar:** 3-way slider deleted; source
  = the toolbar's standard Community | My Library toggle
  (`showSourceToggle`); chips row above the grid; Filters pill →
  GalleryFilterSheet (search lives there), `hideToolbarSearch`. The entire
  hand-built collections path (client-side id filter, own scroll persistence,
  own error/retry states, bare BrowseGrid) deleted. Picker prefs shrink to
  open/player/acts — the engine already persisted source/sort/filters.
- **Library Add Sequences sheet:** `hideToolbarSearch` + the same chips row —
  pull from one collection into another without leaving the sheet.
- **AllLibraryView deliberately gets NO chips row** — the Library list itself
  is the collection picker there; a row would duplicate navigation.

Principle: pickers hunt POOLS (My Library | Community — toolbar toggle);
collections are views over the library pool and lead it as chips.

## Addendum — collection-group discovery (shipped same session)

"Build a bigger fishbowl": the two N+1 read patterns behind discovery were
replaced with scale-right shapes now rather than at migration time.

- **Community feed** was `getUsers()` → `getUserPublicCollections` per creator
  (grew with the whole user base). Now ONE `getAllPublicCollections(max=200)` in
  `public-collection-loader.ts`: `collectionGroup("collections")` where
  `isPublic == true`, `orderBy(updatedAt desc)`, `limit`. Owner id is the parent
  user-doc path (`docSnap.ref.parent.parent.id`), authoritative over the stored
  `ownerId` field; root-level `/collections` docs (no parent user) are skipped.
- **Owner names** resolve in one batched pass — NEW `getUserDisplayNames(ids)`
  in user-repository: 30-chunk `in` query on `documentId()` over the
  world-readable users collection, `displayName ?? name ?? "Someone"`. Both
  `community-collections-state` and `followed-collections-state` use it (the
  latter dropped its per-ref `getUserProfile`). Followed collection DOCS still
  read per-path in parallel — inherent to the pointer model (no cross-path batch
  get), fine at follow-list scale.
- **Index:** COLLECTION_GROUP on `collections` (`isPublic ASC, updatedAt DESC`),
  created live + tracked in `firestore.indexes.json`. Rules already
  world-readable on both `collections` paths (`firestore.rules:486`), so the
  collection-group query adds no new exposure.

## Audit + hardening (2026-07-03)

Full-dimension audit of the collection-group work (3 parallel reviewers: security,
scale, reactivity) + live Firebase verification. The top-suspected defect —
`orderBy("updatedAt")` silently dropping docs that lack the field — was **refuted
as a live bug**: every collection writer stamps `updatedAt` since the feature's
inception, and there is no code path that sets `isPublic` without also writing
`updatedAt`, so a public collection can never be dropped. Latent tripwire only:
add an `updatedAt` guard before collaborative/import writers land. Index verified
live + READY; rules verified **deployed** (`collections: allow read: if true` and
the owner-scoped `followedCollections` block are live) — resolves the earlier
"rules deploy pending" flag.

Fixes shipped (7 files + regression test, all type-clean):

- **HIGH — `followed-collections-state.resolve()` had no error handling.** One
  `getPublicCollection` rejection (network, or a rule denying a now-private doc)
  rejected the `Promise.all`, wedging `loading = true` forever — the "Following"
  section silently never rendered and the chips-row stale-filter guard never
  cleared. Now each read is `.catch(() => null)` (drops just that entry) and the
  method is wrapped in try/catch/finally so `loading` always clears. This also
  makes the state resilient if the read rule is ever tightened (below).
- `refs` → `$state` so `isFollowed()` recomputes the foreign Follow/Unfollow
  button reactively after a snapshot.
- `collectionsState` + `followedCollectionsState` `teardown()` wired into
  `authState` sign-out — they were leaking Firestore listeners past logout.
- System collections (a Favorites doc flipped public) excluded from
  `getAllPublicCollections`, and `updateCollection` now blocks `isPublic` on
  system collections — Favorites publicness is `settings.favoritesPublic`, a
  separate signal, and must not leak the whole favorites list into discovery.
- NEW `getVisibleOwnerNames` suppresses hidden/guest/deleted owners from the
  community feed (matches the Browse Creators listing); the feed filters to
  owners the map still contains.
- `invalidate()` self-heals — refetches immediately (or defers via a pending
  flag if a load is in flight) so an in-view publish/unpublish updates without a
  navigation.
- `batchFetchSequences` caps at 500 — guards against read-amplification when a
  viewer opens a hostile public collection with an oversized `sequenceIds`.
- Removed dead `communityCollectionsState.find()`.

**Open security decision (NOT changed unilaterally — outward-facing).**
`firestore.rules` `users/{uid}/collections/{id}` is `allow read: if true`,
unconditional (not gated on `isPublic`). A `collectionGroup("collections")`
query with the `where` clause dropped therefore enumerates **every** collection,
private included, for anyone with the SDK. Documented as by-design
(`firestore.rules:175-211`), and the exposure is collection **metadata**
(names/descriptions/sequence-id lists), not private sequence bodies (those gate
on `visibility=='public'`). If "private" must mean server-private, tighten to
`allow read: if resource.data.isPublic == true || isOwner(userId) || isAdmin();`
— the resilience fix above means the app already tolerates the denied reads that
rule would introduce.

## Follow-ups (out of scope, on record)

- Profile becomes collection-first (public collections as the profile spine) —
  own spec.
- Collaborative collections (multi-member editing).
- Locale files for the rename.
- "Clean up dead follows" affordance.
- Higher-up organization over the community-collection pile (curation, sort,
  search) — its own spec once the pile is big enough to need it.
