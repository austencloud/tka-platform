# Remove Sequences From Library + Purge One-Count Sequences

**Date:** 2026-06-28
**Status:** Design approved, pending spec review

## Problem

Two related needs:

1. **Per-card removal.** A user should be able to right-click a sequence in the
   browse gallery and remove it from the library, behind a confirmation. The
   owner can remove their own; an admin (Austen) can remove anyone's.
2. **One-count purge.** Sequences with one or zero motion steps are junk that
   shouldn't exist. All of them must be deleted everywhere — including private
   ones on other users' profiles — and new ones must be blocked at creation.

## Decisions (locked)

| Decision | Choice |
|---|---|
| What "one-count" means | `count <= 1` — exactly one motion step **or** start-position-only (zero steps) |
| Cross-user purge mechanism | **Admin Cloud Function** (Firebase Admin SDK; bypasses security rules) |
| Right-click scope | Owner removes own + **admin removes any** |
| Scope | **Purge existing now + prevent new ones** at save/publish |

## Ground truth (verified)

- **Count source of truth.** `SequenceData.steps` is derived at load and **never
  persisted** (`sequence-data.ts:47-50`). The persisted compositional fields are
  `blueSoloProp`, `redSoloProp`, `stepPairings` (`sequence-data.ts:170-180`).
  `stepPairings` is one entry per motion step, so **`stepPairings.length` is the
  canonical persisted step count**. `sequenceLength` (`sequence-data.ts:60`) is
  optional and may be absent/stale on legacy docs — do not trust it alone.
- **Existing context menu.** The gallery card already has a right-click menu:
  `handleContextMenu` + `oncontextmenu` (`ChoreoCardThumbnail.svelte:237-244,252`),
  items built at `ChoreoCardThumbnail.svelte:152-235`, including admin-only items
  gated by `featureFlagService.isAdmin` (`ChoreoCardThumbnail.svelte:173`).
- **Context menu primitive.** `ContextMenuItem` supports `danger` + async `action`
  (`context-menu/context-menu-types.ts:1-43`).
- **Confirm primitive.** `src/lib/shared/foundation/ui/ConfirmDialog.svelte`
  (`bind:isOpen`, `title`, `message`, `confirmText`, `variant="danger"`,
  `onConfirm`/`onCancel`). Delete-confirm precedent: `CompositionBrowseTab.svelte:230-239`.
- **Client admin check.** `featureFlagService.isAdmin`
  (`post-hog-feature-flag-service.svelte.ts:544-546`).
- **Rules admin check.** `isAdmin()` = caller's `users/{uid}.role == 'admin' ||
  isAdmin == true` (`firestore.rules:34-38`).
- **Client delete (own).** `LibraryRepository.deleteSequence(id)`
  (`library-repository.ts:650-719`): deletes `users/{uid}/sequences/{id}`,
  fire-and-forget removes `publicSequences/{id}` via
  `PublicIndexSyncer.removeFromPublicIndex` (which also calls
  `browseLoader.removeFromCache(id)`), decrements `sequenceCount`. Already
  permitted by rules for the owner.
- **Public index mapping.** `publicSequences/{sequenceId}` carries `ownerId`,
  `sourceRef = users/{ownerId}/sequences/{id}`, and `sequenceLength`
  (`public-index-syncer.ts:131-175`, `public-sequence-index.ts:37,59`).
- **Cloud Functions pattern.** v1 `functions.https.onCall(async (data, context) => …)`,
  Admin SDK init `admin.initializeApp(); const db = admin.firestore()`
  (`firebase-functions/src/index.ts:8-11`). `HttpsError` for failures. Recursive
  / batched deletes already used (`cleanupStaleAnonymousAccounts.ts`,
  `index.ts:137-150`). Deploy: `npm --prefix firebase-functions run build` then
  `firebase deploy --only functions`. Region default `us-central1`.
- **Client callable wiring.** `getFunctionsInstance()`
  (`src/lib/shared/auth/firebase.ts:480-496`) → dynamic-import `httpsCallable`
  (precedent: `transcription-client.ts:6-23`).

No security-rules change is required: the owner self-delete path is already
allowed, and every cross-user / admin action runs through the Admin SDK, which
bypasses rules.

---

## Part A — Right-click "Remove from library" (client)

### Behavior

Add a single `danger` item ("Remove from library", trash icon) to the existing
card context menu. Show it when:

```
sequence.ownerId === myUid   // owner removing own
  || featureFlagService.isAdmin  // admin removing any
```

On select → open a `ConfirmDialog` (`variant="danger"`). On confirm:

- **Owner removing own** (`sequence.ownerId === myUid`): call existing client
  `LibraryRepository.deleteSequence(sequence.id)`. The browse cache is updated by
  the existing syncer path.
- **Admin removing another's** (`sequence.ownerId !== myUid`): call callable
  `adminDeleteSequence({ ownerId: sequence.ownerId, sequenceId: sequence.id })`,
  then call `browseLoader.removeFromCache(sequence.id)` so the card disappears
  immediately (the server cannot touch the client cache).

### Confirm host (card-local — revised from the grid-lift idea)

Cards render through **two** independent paths — `BrowseGrid.svelte` (flat /
sections) and `VirtualizedSequenceGrid.svelte` (50+ items). Lifting the dialog to
a grid would mean wiring it twice or prop-drilling from `BrowseModule`. Instead,
keep the whole remove flow **inside `ChoreoCardThumbnail.svelte`**: all
dependencies are singleton getters the card can import directly
(`getLibraryRepository`, `getBrowseLoader`, `authState`, the callable wrappers),
exactly as the card already imports `toast` / `sharer` / `getClaudeCodeCopier`.
No imperative confirm service exists, so the card hosts a `ConfirmDialog`
instance bound to local `removeConfirmOpen` state. bits-ui `Dialog` renders
nothing while closed, so one-per-card is inert — and the card already mounts a
per-card `ContextMenu`, so this matches the existing structure. Neither grid
needs a new prop.

### Current-user uid source

`authState.user?.uid` (`auth/state/auth-state.svelte`). `isOwner = sequence.ownerId === authState.user?.uid`.

### Cache removal

`getBrowseLoader()` (`browse/get-browse-loader.ts`) returns the singleton
`PublicSequencesLoader`; `removeFromCache(id)` is synchronous. After any
successful delete, call `getBrowseLoader().removeFromCache(sequence.id)` so the
card vanishes immediately (the owner client-delete path may invalidate a
different injected loader instance, so call it explicitly here regardless).

### Files

- Modify `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte`
  — add the menu item (visibility + `onRequestDelete` call).
- Modify `src/lib/features/browse/sequences/display/components/BrowseGrid.svelte`
  — host `ConfirmDialog`, own delete state, dispatch owner-vs-admin path, update cache.
- New `src/lib/shared/library/services/admin-sequence-actions.ts` — thin callable
  wrappers (`adminDeleteSequence`, `purgeOneCountSequences`) via `getFunctionsInstance()`.

---

## Part B — Prevent new one-count sequences (client guards)

Reject any save/publish where `count <= 1`, with
`count = stepPairings?.length ?? steps?.length ?? 0` (minimum valid sequence is 2
steps).

### Guard points

| Location | File | Purpose |
|---|---|---|
| Explicit "Save to library" | `create/shared/state/save-panel-state.svelte.ts` (`handleSave`) | early toast feedback |
| Viewer save | `sequence-viewer/state/library-action-handler.svelte.ts` (`handleSave`) | early toast feedback |
| Repository backstop | `library-repository.ts` `saveSequence` | hard guarantee (throws `LibraryError` `INVALID_DATA`) |
| Publish backstop | `public-index-syncer.ts` `syncToPublicIndex` | block gallery publish |

Reuse `LibraryError` (`library/domain/library-error.ts`) with code `INVALID_DATA`;
existing handlers surface it as a toast. Message copy follows the project writing
guide (state what's wrong: too short, needs at least one full motion step) —
finalized in implementation.

### Risk to verify before arming the repo-level backstop

A platform-wide `saveSequence` throw would also reject any **programmatic** writer
(deck seeders, imports, migrations). Verify no legitimate path writes a 1-step
doc. If one exists, scope the hard guard to the user-facing save paths and keep
the backstop for the publish path only. Confirm in planning.

---

## Part C — Admin Cloud Function: purge one-count sequences (server)

New module `firebase-functions/src/adminPurgeOneCount.ts`, exported from
`firebase-functions/src/index.ts`. Two v1 callables, both admin-gated.

### Admin gate (both functions)

```
const uid = context.auth?.uid;
if (!uid) throw new HttpsError("unauthenticated", "...");
const caller = (await db.doc(`users/${uid}`).get()).data();
const isAdmin = caller?.role === "admin" || caller?.isAdmin === true;
if (!isAdmin) throw new HttpsError("permission-denied", "Admin only");
```

This mirrors `firestore.rules:34-38` server-side.

### `purgeOneCountSequences({ dryRun: boolean })`

1. `collectionGroup("sequences")` scan across all users.
2. For each doc, `count = data.stepPairings?.length ?? data.sequenceLength ?? 0`.
   Candidate if `count <= 1`.
3. `dryRun: true` → return `{ scanned, candidates, sample: [{ id, ownerId, word }] }`,
   **no writes**.
4. `dryRun: false` → for each candidate:
   - delete `users/{ownerId}/sequences/{id}`
   - delete `publicSequences/{id}` if it exists
   - decrement `users/{ownerId}.sequenceCount` (clamp ≥ 0)
   - (optional) delete thumbnail / animation storage assets via stored paths
   - batch ≤ 500 writes per `WriteBatch`; log running totals
5. Return `{ scanned, candidates, deleted, publicRemoved }`.

### `adminDeleteSequence({ ownerId, sequenceId })`

Single-target admin delete for Part A's admin-any path: delete
`users/{ownerId}/sequences/{id}`, delete `publicSequences/{id}` if present,
decrement that owner's `sequenceCount`. Returns `{ deleted: boolean }`.

### Trigger UI

Admin-only button (gated by `featureFlagService.isAdmin`) on an admin /
diagnostics surface (exact placement chosen in planning). Flow:

1. Click → call `purgeOneCountSequences({ dryRun: true })`.
2. Show `ConfirmDialog`: "N one-count sequences across M users will be permanently
   deleted. This cannot be undone."
3. Confirm → `purgeOneCountSequences({ dryRun: false })`, then surface the result
   summary toast.

### Cost / safety notes

- A full `collectionGroup("sequences")` scan reads every user sequence. **Verify
  the large enumerated deck sets are not stored under `users/*/sequences`** before
  running, or the read volume balloons. One-time admin op; acceptable but logged.
- Cross-user, irreversible mass delete. Always dry-run first. The live purge will
  not be executed without Austen's explicit go after seeing the dry-run count.
- The client browse cache is not invalidated by the server; the gallery reflects
  the purge on next load. Acceptable for a one-time admin sweep.

---

## Testing

- **Guards (Part B):** unit tests — `saveSequence` / `syncToPublicIndex` reject
  `count <= 1`, accept `count >= 2`.
- **Cloud Function (Part C):** validate against the Firestore emulator or via the
  dry-run summary; assert non-admin callers get `permission-denied`.
- **Part A:** runtime verification in the gallery — owner item appears on own
  cards, admin item on all cards, confirm → card removed; non-owner non-admin
  sees no item.

## Verification (before any "done" claim)

- `npm run check` green.
- Dry-run output showing the candidate count.
- Runtime evidence (DevTools / screenshot) of the right-click item + removal.

## Out of scope

- No `firestore.rules` edits.
- No soft-delete / recycle-bin UI (separate existing system).
- No scheduled/automatic recurring purge (the callable can be scheduled later if
  needed).
