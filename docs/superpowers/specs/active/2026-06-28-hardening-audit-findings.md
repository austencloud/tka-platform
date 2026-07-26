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
# Titanium Hardening Wave — 2026-06-28

Fresh audit against **current `main`** (the 2026-06-19 wave-9 doc is 360 commits stale;
its multi-grid token findings are already fixed on main). Parallel auditors swept
`shared/**/services`, feature services, sync/lan-sync, persistence, library, community,
admin, and UI-chrome token drift. Every finding below was traced to its canonical source.

Branch: `claude/hardening-wave-history-tr5zsf` (rebased onto current `main`).

---

## Fixed this session (each verified: `npm run check` → 0 errors, traced to canonical source)

1. **Data integrity — LOOP-label delete orphaned every public sequence.**
   `features/loop-labeler/services/loop-labels-firebase-repository.ts` `deleteSequenceFromDatabase`
   read the `publicSequences` doc validated against `LabeledSequenceSchema` (which requires
   `designations`/`isFreeform`/`labeledAt`/`notes` — fields a publicSequences doc never has),
   so `firestoreGet` always returned null, the `firestoreDelete(publicSequences)` was dead
   code, and the call still returned `{ success: true }`. Fix: delete unconditionally
   (`deleteDoc` is idempotent). The sequence now actually leaves `publicSequences`.

2. **Privacy leak — hidden + anonymous users exposed in Browse Creators/Collections.**
   `shared/community/services/user-repository.ts` `getUsers` lacked the `if (data.isHidden) continue`
   and `if (isAnonymousGuest(data)) continue` guards that its three siblings
   (`getUsersPaginated`, `getFeaturedCreators`, `subscribeToUsers`) all apply. Consumed live by
   `collections-browse-state` and `community-collections-state` with the default `filter:"all"`,
   so users who opted to be hidden appeared. Fix: added the two guards to match the siblings.

3. **Broken action — single-item recycle-bin purge always threw.**
   Both `shared/library/services/library-recycle-bin.ts` and
   `features/library/services/library-recycle-bin.ts` `purgeSequence` guarded on
   `getSequence(id)` returning non-null, on the false premise (stated in a code comment) that
   `getSequence` filters out soft-deleted docs. Canonical source `library-repository.ts:611`
   is a bare `firestoreGet` with no `isDeleted` filter, so it returns soft-deleted docs → the
   guard fired for every recycle-bin item → `INVALID_DATA` every time. Fix: removed the broken
   early guard; the downstream raw `getDoc` + `isDeleted` check is the correct authority (it
   already rejects active sequences and allows soft-deleted ones).

4. **Admin display — cached announcements always showed empty audiences + forced "modal".**
   `features/admin/services/system-state-manager.ts` `loadAnnouncements` read `data["audiences"]`
   and `data["displayMode"]`, but `announcement-manager` writes `targetAudience` (single enum)
   and `showAsModal` (boolean). Fix: read the written fields — `audiences: targetAudience ? [targetAudience] : []`,
   `displayMode: showAsModal === true ? "modal" : "banner"`.

5. **Token drift (first slice) — sequence-viewer chrome now uses theme tokens.**
   `shared/sequence-viewer/components/ViewerHeader.svelte` (border) and `ExportPopover.svelte`
   (chip surface/border/hover) migrated from bare `rgba(255,255,255,0.0x)` to
   `var(--theme-stroke, …)` / `var(--theme-card-bg, …)` / `var(--theme-card-hover-bg, …)`, the
   pattern the rest of the app already uses. Identical when no theme is injected; adapts to the
   background when one is. **Visual result under active themes needs an eyeball pass** (headless
   check can't verify appearance).

---

## Remaining CONFIRMED bugs (triaged — not yet fixed; pick up here)

- **[HIGH] LAN-sync joiner is receive-only — can't send.** `shared/lan-sync/services/peer-connection-manager.ts:198-208`.
  `registerConnection` does `connections.set(peerId, conn)` inside a `conn.on('open')` that
  never fires on the joiner (the conn is already open; PeerJS/eventemitter3 doesn't replay
  `open`). So `broadcast()` iterates an empty map → joiner never sends `REQUEST_FULL_STATE`,
  heartbeats, or playback intents; host never replies. UI says "Connected." Fix: handle the
  already-open case (`if (conn.open) addToMap(); else conn.on('open', addToMap)`). Needs a
  2-device runtime verification after the fix.

- **[HIGH] Save syncs the wrong (un-resolved) sequence id → Firestore/Dexie divergence.**
  `features/library/services/library-save-service.ts:148` passes the original `sequence` (empty
  `id`) to `syncToFirestore`, while Dexie saved the resolved `sequenceToSave` (id minted at
  :124). `LibraryRepository.saveSequence` then mints a *different* UUID → cloud copy is a
  duplicate, local copy orphaned. Thumbnail upload (:303) also runs under the empty id. Fix:
  resolve the id first; pass `sequenceToSave` to sync + thumbnail.

- **[HIGH] Local-persistence failure reported as success.** `features/library/services/library-save-service.ts:131-137`.
  The Dexie write (the only guaranteed persistence in the offline-first flow) is wrapped in a
  catch that only `console.warn`s; Firestore sync is fire-and-forget; the method returns success
  regardless. Quota-exceeded / private-mode IndexedDB block → user sees "Saved!" for a sequence
  persisted nowhere. Fix: surface Dexie failure via the ErrorHandler (as the thumbnail path does).

- **[HIGH] Tika `saveSession` (merge:false) erases reviewer metadata.** `features/tika/services/tika-session-repository.ts:98`.
  `setDoc(..., { merge:false })` with a `createTikaSession` payload that omits `flaggedForReview`,
  `reviewStatus`, `reviewMetadata`, `flaggedAt`. A resumed conversation's next message wipes a
  reviewer's grade/notes and drops the item from the review queue. Fix: `{ merge: true }` (or
  carry the review fields forward).

- **[MED] Persisted browse state with no filter type is always discarded.** `shared/persistence/services/filter-persister.ts:47-52`.
  Guard requires `typeof parsed.filterType === "string"`, but `filterType` is `BrowseFilterType | null`
  and the default is `null`. A saved sort/state with no active filter never restores. Fix:
  `(parsed.filterType === null || typeof parsed.filterType === "string")`.

- **[LOW/latent] `getFavorites()` always returns [].** `features/compose/services/dexie-composition-repository.ts:205`.
  `.where("isFavorite").equals(1)` but `isFavorite` is stored as a boolean (IndexedDB can't
  index booleans). Currently unreferenced (browse filters in memory), so latent — breaks the
  moment it's wired. Fix: `db.compositions.filter(c => c.isFavorite === true).toArray()`.

## PLAUSIBLE (need one more check or a runtime repro before fixing)

- **Unauthenticated host reports sync started but is undiscoverable.** `shared/lan-sync/services/sync-room-broadcaster.ts:44-49` — `broadcast()` no-ops (console.warn) when `auth.currentUser` is null but resolves normally; host `toggleSync` returns `true`. Depends on whether a signed-out host is reachable.
- **Variation-group cache ignores content (word/name) changes.** `shared/browse/services/variation-grouper.ts:82-93` — validates cache only by ID-set equality; a rename with an unchanged ID set returns stale groups.
- **`createCheckoutSession` missing `return` after reject.** `shared/subscription/services/subscription-manager.ts:92` — latent; harmless unless a doc carries both `error` and `url`.
- **Save dispatches "added/updated" before the write resolves.** `shared/library/services/library-repository.ts:490,554` — inconsistent with `deleteSequence` (which awaits); defensible offline-first, low real-world impact.

## Minor (no behavioral bug)

- `shared/create/services/reversal-detector.ts:48` — `if (isLoop && i < steps.length)` inside `for (…; i < steps.length; …)`; the second clause is always true. Dead sub-condition only.

---

## Semantic-token drift — the campaign (user's explicit priority)

Scale: **500+ genuine chrome-drift occurrences** — dominated by hand-rolled
`rgba(255,255,255,0.0x)` surfaces/borders that map cleanly onto `--theme-stroke` /
`--theme-card-bg` / `--theme-card-hover-bg` (most literally equal to those tokens' fallbacks),
plus a smaller accent class (`#4338ca`, `#667eea`) that misses `--theme-accent`.

**Worst offenders (highest-traffic, cleanest targets):** `features/create`, `features/compose`,
`shared/sequence-viewer` (first slice done). `shared/3d` ranks high but much of its hex is 3D
material/scene data (exempt).

**Exempt — do NOT sweep:** canonical TKA hand colors (`#3575E2`/`#ED1C24`), grid/pictograph
colors, `var(--token, #fallback)` fallbacks, and data/art files (`retro-icons.ts`, `*-palettes.ts`,
`scene-configs.ts`, card-back art, `museum-geometry-builder.ts`, `GridSvg.svelte`, effect/shader
color data, status colors like `#ef4444`/`#22c55e`).

**Approach:** value-preserving migration (`bare rgba` → `var(--theme-x, <same rgba>)`), module by
module, high-traffic authoring chrome first. Each slice needs an eyeball pass under 1-2 background
themes since headless check can't verify appearance.

**Also surfaced (separate rule, `chip-primitives.md`):** `ExportPopover.svelte` `.chip` filter
buttons are hand-rolled `class="chip"` — should route through `FilterChipBase`. Flag for a
follow-up, not folded into the token slice.
