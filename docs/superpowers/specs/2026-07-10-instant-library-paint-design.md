# Instant Library Paint — Local Collection Mirror

**Date:** 2026-07-10
**Status:** Approved (approach A + boot pre-warm)

## Problem

Opening Library shows skeletons, then collections pop in once Firestore
resolves. The whole collection list is cheap text (names, icons, counts, ids)
yet the user waits on lazy `getFirestoreInstance()` + auth gate + first
snapshot every time. Dev has no Firestore persistence at all, so it is worst
there.

## Goal

Collections render on the first frame when Library opens — seeded synchronously
from a local mirror of last-seen text metadata — then reconcile silently when
the live Firestore snapshot lands (stale-while-revalidate). Members stay lazy on
collection-open, unchanged.

## Approach (chosen: A + boot pre-warm)

Mirror the own-collections list and the followed-collections list to
`localStorage`. Seed state synchronously on `ensureStarted`; overwrite from the
live `onSnapshot` and re-write the mirror each snapshot. Start the subscriptions
at auth-boot so the mirror is fresh before the user ever opens Library.

localStorage over Dexie: synchronous read paints before any `await`. Dexie reads
are async and would merely race Firestore's own IndexedDB cache — no latency win
for a few KB of regenerable text.

Rejected:
- **B (Dexie `collections` table):** async read, more code, durability not needed
  for regenerable text.
- **C alone (pre-warm + surface `fromCache` snapshot):** still gated on async
  init + auth; dead in dev (memory cache). Folded its pre-warm idea into A.

## Components

### `src/lib/features/library/services/collection-cache-mirror.ts` (new)

Pure localStorage read/write. Never throws.

- `readOwnMirror(uid): LibraryCollection[] | null`
- `writeOwnMirror(uid, cols): void`
- `readFollowedMirror(uid): FollowedCollection[] | null`
- `writeFollowedMirror(uid, items): void`
- `clearMirror(uid): void` — both keys, for sign-out.

Keys: `tka:collections-mirror:own:{uid}`, `tka:collections-mirror:followed:{uid}`.

Serialization: `createdAt`/`updatedAt` are `Date`; normalize to ISO on write,
revive to `Date` on read (the Firestore-Timestamp-doesn't-survive-clone gotcha
from `gallery-offline-cache.ts`). Everything else on `LibraryCollection` is
JSON-safe (`filterSpec`, `deckMetadata` are plain objects). `readOwnMirror`
returns `null` on miss, parse-fail, or any shape it can't revive — caller falls
back to skeleton. Writes swallow quota errors.

### `collections-state.svelte.ts` (edit)

`ensureStarted`:
1. Synchronous seed: `this.collections = readOwnMirror(uid) ?? []`. If seed
   non-empty, leave `loading = false` (have something to show); else `true`.
2. Open `onSnapshot` as today.
3. Each snapshot: set `this.collections = cols`, then `writeOwnMirror(uid, cols)`.

`teardown`: unchanged (does not clear the mirror — that's sign-out's job).

### `followed-collections-state.svelte.ts` (edit)

Same three-step seed in `ensureStarted` using `readFollowedMirror`. The mirror
stores resolved `FollowedCollection` items (`collection`, `ownerId`,
`ownerName`). `resolve()` writes `writeFollowedMirror(uid, this.items)` after it
sets `this.items`.

### `auth-boot-orchestrator.ts` (edit)

Add a non-blocking block that starts both subscriptions at boot (re-check auth
after the async gap), so the mirror is written ahead of Library open:

```ts
import("$lib/features/library/state/collections-state.svelte")
  .then(({ collectionsState }) => collectionsState.ensureStarted())
  .catch(...);
import("$lib/features/library/state/followed-collections-state.svelte")
  .then(({ followedCollectionsState }) => followedCollectionsState.ensureStarted())
  .catch(...);
```

`ensureStarted` is idempotent per-uid, so the Library panel's own call becomes a
no-op.

### Sign-out (edit)

Find the sign-out / account-switch teardown seam; call `clearMirror(uid)` so one
user's list never seeds the next. If teardown has the outgoing uid, clear there.

## Edge cases

- Empty seed → skeleton fallback (today's behavior).
- Corrupt/old-shape JSON → `read*` returns null → skeleton.
- Quota exceeded on write → swallowed; cache stays empty; degrades to today.
- Timestamp revival → ISO → `Date` on read.
- Multi-device change → live snapshot overwrites seed; deletes drop out.
- Sign-out → mirror cleared for that uid.

## Testing

- `collection-cache-mirror.test.ts`: round-trip own + followed, date revival,
  null on corrupt JSON, null on missing key, quota-error swallow, clear removes
  both keys.
- State test: `ensureStarted` seeds `collections` synchronously from the mirror
  (before any snapshot); a snapshot overwrites and re-writes the mirror.

## Out of scope

Member/thumbnail caching (stays lazy on open). Dexie migration. TKA Originals /
All-count shelves (separate reads; not part of the skeleton complaint).
