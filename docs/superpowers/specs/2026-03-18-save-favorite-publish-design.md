# Save / Favorite / Publish — Context-Aware Action Bar

**Date:** 2026-03-18
**Status:** Draft

---

## Problem

The sequence viewer action bar shows the same buttons regardless of context. "Save" appears on sequences you already own. "Save to Library" on someone else's sequence is ambiguous — does it copy the sequence or bookmark it? There's no way to unpublish a sequence. The word "Publish" never appears despite the system having a public gallery.

Users need different actions depending on three variables:
1. **Who owns the sequence** (mine vs someone else's)
2. **Whether it's already saved** (new/modified vs persisted)
3. **Whether it's published** (in the public gallery or not)

---

## Goals

- Save button only appears when there's something new to persist
- Favorite is a bookmark (heart icon), works on any sequence, backed by Firestore
- Default visibility is public — saving automatically publishes
- Original creator keeps permanent attribution in the public gallery
- Unpublish is available but tucked away (not a primary action)
- Eliminate the concept of "forking" from the UI (backend fork fields left inert)

---

## Non-Goals

- Fork genealogy / sequence lineage tracking
- Separate "publish" step after saving (save = save + publish)
- Private-by-default workflow
- Changes to the create module's save flow

---

## Data Model & Interface Changes

### 1. Fork default visibility

**File:** `LibraryRepository.ts` line 284

Change fork default from `"private"` to `"public"`:
```typescript
// Before
visibility: overrides?.visibility ?? "private",
// After
visibility: overrides?.visibility ?? "public",
```

### 2. New method on ILibraryRepository

```typescript
// ILibraryRepository.ts
hasMatchingContent(contentHash: string): Promise<boolean>;
```

Implementation queries `users/{userId}/sequences` where `contentHash == hash`, limit 1. This is a single indexed Firestore read. The `contentHash` field is already written on every save, so the query should hit an existing index. If not, a composite index on `(contentHash)` within the user's subcollection will need to be created (Firestore will prompt with a link if missing).

Cache the result per sequence per session to avoid repeated queries.

### 3. Favorite storage for cross-user sequences

**Problem:** `CollectionManager.toggleFavorite(sequenceId)` stores IDs in `system_favorites.sequenceIds`. But `getFavorites()` resolves those IDs by fetching from `users/{currentUser}/sequences/{id}` — which won't find someone else's sequence.

**Solution:** Store the **public index doc ID** (which is the same as the sequence's `id` in the `publicSequences` collection). The favorites collection is a document at `users/{userId}/collections/system_favorites` (a system-managed collection with `systemType: "favorites"`), not a separate top-level Firestore collection.

Modify `CollectionManager.getCollectionSequences()` (which `getFavorites()` delegates to via `batchFetchSequences()`) to resolve IDs in two passes:

1. Batch-fetch from `users/{currentUser}/sequences/` (own sequences)
2. For any IDs not found in pass 1, batch-fetch from `publicSequences/` (others' sequences)

This keeps `toggleFavorite(id)` simple — callers pass whatever ID they have. Resolution happens at read time in the batch fetch layer.

**Alternative considered:** Storing a `{id, source}` tuple instead of bare IDs. Rejected because it changes the Firestore schema for all collections, not just favorites, and the two-pass resolution is simple enough.

### 5. Canonical favorite system

**Problem:** Two favorite systems exist in parallel:
- `CollectionManager.toggleFavorite()` — collection-based, stores IDs in `system_favorites.sequenceIds`
- `LibraryRepository.toggleFavorite()` — field-based, sets `isFavorite: boolean` on the sequence document itself

**Decision:** `CollectionManager` is canonical. The `LibraryRepository.isFavorite` field and its `toggleFavorite()`/`getFavorites()` methods should be deprecated and eventually removed. The collection-based approach supports cross-user favorites (the whole point of this spec) and doesn't require the sequence to exist in the user's library.

During this implementation, `LibraryRepository.toggleFavorite()` should NOT be called. The `isFavorite` field on `SequenceData` is already marked deprecated in the codebase.

### 4. No new Firestore collections

The `system_favorites` collection and `publicSequences` collection already exist. No new collections needed.

---

## Action Bar Logic

### Decision Tree

```
Is the user logged in?
├─ No → Show: [Get App]
└─ Yes →
    Does the user own this sequence?
    ├─ No → Show: [Favorite] [Share]
    └─ Yes →
        Is this sequence already saved (content hash matches library)?
        ├─ No → Show: [Save] [Favorite] [Share]
        └─ Yes →
            Is the sequence published (visibility === "public")?
            ├─ Yes → Show: [Favorite] [Edit] [Share] + overflow: [Unpublish, Delete]
            └─ No  → Show: [Favorite] [Edit] [Share] + overflow: [Publish, Delete]
```

### Action Bar Per Context

| Context | Primary Actions | Secondary (overflow) |
|---------|----------------|----------------------|
| **Browse: someone else's sequence** | Favorite, Share | -- |
| **Browse: my sequence, published** | Favorite, Edit, Share | Unpublish, Delete |
| **Browse: my sequence, unpublished** | Favorite, Edit, Share | Publish, Delete |
| **Route viewer: someone else's** | Favorite, Share | -- |
| **Route viewer: mine, published** | Favorite, Edit, Share | Unpublish, Delete |
| **Route viewer: mine, unpublished + saved** | Favorite, Edit, Share | Publish, Delete |
| **Route viewer: mine, unsaved** | Save, Favorite, Share | -- |
| **Create module: new/modified sequence** | Save | -- |
| **Not logged in** | Get App | -- |

**Note on unsaved → saved transition:** After clicking Save, the Save button disappears and Edit appears (since the sequence is now persisted). Favorite is present in both states so the button set doesn't change drastically.

### Button Definitions

| Button | Icon | Label | Behavior |
|--------|------|-------|----------|
| **Favorite** | Heart (outline/filled toggle) | -- (icon only) | Toggle `system_favorites` collection via `CollectionManager.toggleFavorite()`. Works on any sequence — your own (curate a highlights list) or someone else's (bookmark for later). |
| **Save** | Floppy/save icon | "Save" | Persist to `users/{uid}/sequences/{id}`, auto-publish to public gallery. Only shown when content is new or modified (no matching content hash in user's library). |
| **Edit** | Pencil icon | "Edit" | Load full sequence → localStorage → navigate to create module construct tab. Owner only. In Browse context, the detail panel may only have summary data; Edit triggers `sequenceDetailLoader.loadFullSequence()` to fetch from Firestore before navigating. This fetch already exists in the current Edit flow. |
| **Share** | Share icon | "Share" | Existing share flow (link copy, etc.) |
| **Unpublish** | Eye-slash icon | "Make Private" | Set `visibility: "private"`, remove from public index via `PublicIndexSyncer`. Confirmation dialog required. |
| **Publish** | Eye icon | "Make Public" | Set `visibility: "public"`, sync to public index. No confirmation needed (public is the default/expected state). |
| **Delete** | Trash icon | "Delete" | Existing delete flow with confirmation. Owner only. |
| **Get App** | Download icon | "Get App" | Existing unauthenticated CTA. |

### What's Removed

| Old Button | Replacement | Why |
|------------|------------|-----|
| **Fork** | Gone | Forking is not a user concept. Editing someone else's sequence and saving creates a new sequence (via content hash divergence). No explicit fork action needed. |
| **Save to Library** (on others' sequences) | **Favorite** | Bookmarking, not copying. Public gallery stays deduplicated. |

---

## Unpublish UX

**Location:** Overflow menu (three-dot icon) on owner-only sequences. Contains visibility toggle + Delete. Keeps the primary action bar clean.

**Confirmation dialog for unpublish:**
> "Remove from community gallery? This sequence will still be in your library but won't appear in Browse."
> [Cancel] [Make Private]

**Re-publish:** Same menu, label reads "Make Public". No confirmation needed.

---

## Optimistic UI Updates

| Action | Immediate UI response | On error |
|--------|----------------------|----------|
| **Favorite toggle** | Heart fills/unfills instantly | Revert heart state, show toast |
| **Save** | Save button shows loading spinner, then disappears. Edit button appears. | Save button reappears, show error toast |
| **Unpublish** | Sequence removed from browse gallery cache immediately. Overflow label changes to "Make Public". | Re-add to cache, revert label, show toast |
| **Publish** | Sequence added to browse gallery cache immediately. Overflow label changes to "Make Private". | Remove from cache, revert label, show toast |
| **Delete** | Sequence removed from view immediately | Show error toast, re-add to view |

---

## Component Changes

### 1. SequenceActionButtons.svelte (Browse)

**Current:** Shows Favorite/Edit/Fork/Share/SendTo/Videos/Delete/Maximize based on `isOwned`.

**Changes:**
- Remove Fork button entirely
- Replace Save/Favorite logic per decision tree above
- Add overflow menu for secondary actions (Unpublish/Publish, Delete)
- New props: `isPublished: boolean`, `isSaved: boolean`, `isFavorite: boolean`
- New callbacks: `onPublish`, `onUnpublish`, `onFavorite` (replaces old favorite behavior)

### 2. ViewerFooter.svelte + ViewerMorphToolbar.svelte (Route Viewer)

**Current:** Shows Save/Edit/Video/Delete/GetApp based on `isLoggedIn` and `isOwned`.

**Changes:**
- Same action logic as SequenceActionButtons
- New props threaded through both desktop layout and ViewerMorphToolbar: `isPublished`, `isSaved`, `isFavorite`, `onFavorite`, `onPublish`, `onUnpublish`
- ViewerMorphToolbar needs the same conditional button rendering

### 3. SequenceDetailContent.svelte (Browse Detail Panel)

**Changes:**
- Pass `isPublished`, `isSaved`, `isFavorite` to action buttons
- Derive `isSaved` by calling `LibraryRepository.hasMatchingContent()` when opening detail
- Derive `isFavorite` from `CollectionManager.isFavorite()`
- **Loading state:** While `isSaved` resolves (async Firestore check), hide the Save button and show Favorite + Share. This is the correct default — most sequences in Browse are already saved. If `isSaved` returns false, Save fades in. No jarring button rearrangement.
- **Caching:** Cache `isSaved` results by content hash for the session. Once checked, the same hash never hits Firestore again.

### 4. New: OverflowMenu.svelte

Small component: three-dot icon button that opens a positioned dropdown. Receives an array of `{ label: string, icon: string, action: () => void, variant?: "danger" }` items. Delete gets `variant: "danger"` for red text.

---

## Architecture Notes

### What's NOT Changing
- Create module save flow (already works correctly)
- `PublicIndexSyncer` logic (already handles publish/unpublish)
- `LibraryRepository.saveSequence()` (already auto-publishes when visibility is public)
- Content hash computation and deduplication
- Firestore schema (no new collections or fields)

### Services Involved
- `CollectionManager` — favorite toggle (needs `getFavorites()` two-pass resolution)
- `LibraryRepository` — save, visibility changes, new `hasMatchingContent()` method
- `PublicIndexSyncer` — add/remove from public index (already works)
- `BrowseEventHandler` — wire new actions (publish, unpublish, favorite)

### State Changes
- `browse-state-factory.svelte.ts` — add `isSaved` and `isFavorite` derivations
- Action button components — new conditional rendering logic

---

## Success Criteria

- [ ] Save button only appears on new/modified sequences (content hash check)
- [ ] Favorite heart appears on all sequences (own and others')
- [ ] Favoriting someone else's sequence stores a reference resolvable from public index
- [ ] `getFavorites()` resolves both own library and public index sequences
- [ ] Saving a sequence automatically publishes it to the gallery
- [ ] Fork button is gone from all action bars
- [ ] "Save to Library" label is gone — replaced by Favorite heart
- [ ] Owner can unpublish via overflow menu with confirmation
- [ ] Owner can re-publish via same menu without confirmation
- [ ] Unpublished sequences disappear from Browse gallery immediately (optimistic)
- [ ] Re-published sequences reappear in Browse gallery immediately (optimistic)
- [ ] Fork default visibility changed to "public"
- [ ] Someone else's published sequence: only Favorite + Share shown
- [ ] Not-logged-in user: only Get App shown
- [ ] Overflow menu contains Publish/Unpublish toggle + Delete for owned sequences
- [ ] ViewerMorphToolbar receives and renders the same conditional buttons as ViewerFooter
