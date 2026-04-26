---
status: backlog
value: 4
effort: S
remaining: Verify offline save-to-library e2e
depends_on: ""
plan_path: plans/backlog/2026-03-17-create-offline-persistence.md
tags: []
last_triaged: 2026-04-26
---
# Create Module Offline Persistence Design

**Date:** 2026-03-17
**Status:** Approved
**Goal:** Make sequence creation and saving work offline with optimistic local persistence and background Firestore sync.

---

## Problem

At a festival, someone creates a sequence offline. Currently:

- **Autosaver** writes to Firestore every 30s. Offline = silent failure. User closes tab = work lost.
- **Save to Library** blocks on Firestore write. Offline = error modal, can't save.
- **Session creation** requires Firestore. Offline = autosave never starts (no session ID).

The generation engine, pictograph rendering, and editing are already fully client-side. Only persistence breaks.

---

## Design

Three changes to existing services. No new tables, no new services.

### Change 1: Autosaver → Dexie-First

**Current flow:**
```
markDirty() → 30s interval → saveDraft() → Firestore write → done
                                              ↓ (offline)
                                          silent failure, data lost on reload
```

**New flow:**
```
markDirty() → 30s interval → saveDraft() → Dexie userWork write (instant)
                                          → Firestore write (non-blocking, via trackWrite)
                                              ↓ (offline)
                                          Dexie has the data. Firestore syncs when online.
```

**How it works:**

The `userWork` Dexie table already exists with `type` and `tabId` indexes, plus a compound index `[type+tabId]`. `UserWorkType.SEQUENCE_DRAFT` already exists as an enum value. The Autosaver stores drafts as a single `userWork` record:
- `type: UserWorkType.SEQUENCE_DRAFT`
- `tabId: "create"`
- `data: { sequenceData, stepCount, name }`

On `saveDraft()`:
1. Write to Dexie `userWork` table using `db.userWork.put()` with a well-known key (upsert pattern — always overwrites the single draft record for this tab). Instant, no auth required, survives page reload.
2. If authenticated, also fire the Firestore write via `trackWrite` (non-blocking, fire-and-forget). `trackWrite` handles the offline case — Firestore's `persistentLocalCache` (production) queues the write for replay when online. Errors are logged but don't block.
3. If not authenticated, skip Firestore entirely — Dexie is the sole persistence layer.

On `loadDraft()`:
1. Query Dexie by compound index: `db.userWork.where("[type+tabId]").equals([UserWorkType.SEQUENCE_DRAFT, "create"]).first()`
2. If not in Dexie and authenticated, try Firestore as fallback.
3. Return whichever has data.

**Session ID is no longer needed for draft lookup.** The draft is keyed by `[type+tabId]`, not session ID. A single draft record per tab is the right model — the user only has one work-in-progress sequence at a time in the Create module. The session ID inside the `data` payload is still stored for Firestore sync compatibility but is not the lookup key.

### Change 2: SessionManager → Lazy, Non-Blocking

**Current behavior:** `SessionManager.createSession()` is called on `CreateModule` mount, blocks on Firestore, and its session ID is passed to the Autosaver. If it fails (offline/no auth), autosave never starts.

**New behavior:** `SessionManager` is no longer called at mount time. Instead:
- The Autosaver starts immediately on mount with no dependency on `SessionManager` or auth.
- `SessionManager.createSession()` is called lazily — only when the user explicitly saves to library (which needs auth anyway) or when auth is confirmed and the app is online.
- `SessionManager.updateStepCount()` and `markAutosaved()` calls are removed from the hot autosave path. These are Firestore writes without `trackWrite` wrapping — they'd leak the offline problem. When a session is eventually created (online + authenticated), these metadata updates can fire in the same fire-and-forget block that sends the Firestore draft write. They are non-critical tracking data, not user-visible state.
- `SessionManager.abandonSession()` cleanup stays in `CreateModule`'s `onMount` return, but guards with `if (currentSession)` so it's a no-op when no session was created.

This means: offline users get autosave immediately. Session tracking in Firestore is a nice-to-have that activates when online + authenticated.

### Change 3: Save-to-Library → Optimistic Local

**Current flow:**
```
User taps Save → thumbnail → upload → tags → Firestore write (BLOCKS)
                                                ↓ (offline)
                                            error modal, save fails
```

**New flow:**
```
User taps Save → thumbnail (local canvas) → Dexie sequences write (instant)
               → toast "Saved!"
               → background: upload thumbnail + Firestore write (via trackWrite)
                   ↓ (offline)
               Dexie has sequence. NetworkStatusIndicator shows "1 pending".
               When online: Firestore persistence replays the write.
```

**How it works:**

Modify `LibrarySaveService.saveSequence()`:
1. **Step 1** (thumbnail): Generate locally as before — client-side canvas rendering, works offline.
2. **Step 2** (save to Dexie): Write the sequence to the Dexie `sequences` table immediately via `db.sequences.put()`. This is the optimistic save — the sequence appears in the user's library instantly.
3. **Step 3** (background sync): Fire the Firestore write + thumbnail upload non-blocking. Wrap in `trackWrite` so `syncStatusState` tracks the pending write. If offline, Firestore's persistent cache (production only) queues the write. If online, it goes through immediately.
4. **Steps 4-5** (tags, refresh): Non-critical, fire-and-forget as they already are.

**Error handling:** If the Firestore sync eventually fails (rare — bad data, permission denied), the sequence stays in Dexie. No data loss. `syncStatusState.markError()` shows the error state.

**Duplicate detection:** The `contentHash` duplicate check in `LibraryRepository` runs a Firestore query. Offline, this query hits the local Firestore cache which may be cold (festival first-timer). In that case, the duplicate check passes even for true duplicates. This is acceptable degradation — duplicates can be cleaned up when back online. The spec does not claim duplicate detection works reliably offline.

---

## Sync Status Indicator Behavior

`syncStatusState.pendingCount` is an **in-memory counter for the current page session only.** It resets to zero on page reload. This means:

- **During a session:** The `NetworkStatusIndicator` correctly shows "1 pending" → "Syncing..." → hidden (synced).
- **After reload offline:** The indicator shows nothing, even though the Firestore write may not have synced yet. This is acceptable — the data is safe in Dexie regardless, and the indicator will show pending again if a new write is attempted.
- **After reload online:** Firestore's `persistentLocalCache` (production) replays queued writes automatically. The `waitForPendingWrites` integration in `syncStatusState.handleOnline()` catches up.

No startup check against Dexie for unsynced entries is needed. The data safety guarantee comes from Dexie, not from the indicator.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/features/create/shared/services/Autosaver.ts` | Dexie-first draft persistence via `userWork` table, optional Firestore sync, `loadDraft` queries by `[type+tabId]` |
| `src/lib/features/library/services/implementations/LibrarySaveService.ts` | Optimistic Dexie save to `sequences` table, non-blocking Firestore sync |
| `src/lib/features/create/shared/components/CreateModule.svelte` | Start autosave immediately on mount (no session dependency), lazy session creation, remove `updateStepCount()`/`markAutosaved()` calls from autosave path |

No new files. No new Dexie tables. No schema changes.

---

## What This Does NOT Include

- **Conflict resolution for library sequences:** The existing `ConflictResolver` handles multi-device conflicts when both sync.
- **Offline thumbnail upload:** Thumbnails are generated locally (canvas) but uploaded to Firebase Storage. Upload is skipped offline — the local Dexie entry has no `thumbnailUrl`. Upload happens on next online session or can be regenerated.
- **Draft recovery UI:** Showing "you have unsaved drafts" on Create module load. The data is in Dexie `userWork` and can be surfaced later as a separate feature.
- **Post-reload pending indicator:** The sync status indicator resets on reload. This is documented above as acceptable.

---

## Success Criteria

1. User creates a sequence offline, autosave stores it in Dexie. Close tab, reopen = draft recovered from Dexie via `[type+tabId]` query.
2. User saves to library offline = sequence appears in library immediately (Dexie). No error modal.
3. When back online, Firestore syncs in background. NetworkStatusIndicator shows pending → synced within the same page session.
4. No data loss in any offline scenario.
