# Save Paths & Public Index Architecture

Key facts about how the system is wired. Read the actual source files — do not trust agent summaries of call chains.

## Two Separate Save Paths

There are two completely independent ways a sequence gets written to Firestore. They do NOT share logic.

| Path | Entry point | Post-write side effects |
|------|-------------|------------------------|
| **UI save** | `LibrarySaveService` → `SequencePersister` | Public index sync (added March 2026), thumbnail upload, tag creation |
| **Repository save** | `LibraryRepository.saveSequence()` | Public index sync, achievement tracking, conflict detection, tag migration |

`LibrarySaveService` uses `SequencePersister` for the actual Firestore write. `SequencePersister` is a focused persistence tool: it takes sequence data and metadata, writes a single document to `users/{uid}/sequences/{id}`, and returns the ID. No callbacks, no post-write hooks, no side effects. It does NOT call `LibraryRepository`. Adding logic to `LibraryRepository` does not affect the UI save path.

## Public Index Sync

The `publicSequences` Firestore collection is the community library. It is populated by `PublicIndexSyncer.syncToPublicIndex()`. This only runs when:
- `LibraryRepository.saveSequence()` is called with `visibility: "public"`, OR
- `LibrarySaveService.saveSequence()` is called with `visibility: "public"` (wired March 2026)
- `LibraryRepository.publishSequence()` / `unpublishSequence()` is called directly

`SequencePersister.saveSequence()` alone never syncs to the public index.

## Browse Gallery Cache

The community library UI reads from `PublicSequencesLoader` (`browse` module), which fetches the `publicSequences` collection once and caches the result in memory. The cache is NOT invalidated automatically — if the public index changes and the cache isn't updated, users see stale data until they refresh.

`PublicIndexSyncer` holds a reference to `IBrowseLoader` and updates the cache directly after every write:
- **Publish** (`syncToPublicIndex`): builds a `SequenceData` from the data already in memory and calls `browseLoader.addToCache()` — no extra Firestore fetch, sequence appears instantly
- **Unpublish/delete** (`removeFromPublicIndex`): calls `browseLoader.removeFromCache(id)` — gallery reflects the removal immediately

`IBrowseLoader` is injected into `PublicIndexSyncer` via the library container as an optional dep. If it's absent (e.g. SSR, test environments), publish/unpublish still work — the cache just won't be updated.

## Module Boundaries

- `create` module owns `SequencePersister` — it's a low-level write tool, no library concepts
- `library` module owns `LibraryRepository`, `LibrarySaveService`, `PublicIndexSyncer`
- `browse` module owns `PublicSequencesLoader` and `IBrowseLoader`
- `PublicIndexSyncer` depends on `IBrowseLoader` (interface only) to invalidate the browse cache after public index writes — this is intentional; the syncer is the authority on when the public index changes
- Do not add library-level concerns (visibility, public sync) to `SequencePersister`
