# Choreo 4K Reliability + Visual Rebuild — Design

**Date:** 2026-07-25
**Status:** ready for review
**Implements:** the mission in
[2026-07-25-choreo-gorgeous-4k-handoff.md](2026-07-25-choreo-gorgeous-4k-handoff.md)
**Honors:** locked contracts in
[the original sheet design](active/2026-06-30-choreo-sheet-design.md),
[v2 continuity/inline-picker](active/2026-07-01-choreo-sheet-v2-design.md),
[annotated sheet](2026-07-02-choreo-annotated-sheet-design.md).
**Implementer:** Opus 5. Work on `main`, no branch/worktree. Commit each phase
with explicit pathspecs (`commit-only-your-own-changes.md`). The shared tree is
dirty with other sessions' work — `git status --short` before every commit.

## Mission

`/choreo` must feel deliberate, calm, and trustworthy on a 4K monitor. Two
failures compound today: (1) a restored draft races Firebase auth restoration
and converts a temporary read miss into six red manual-retry rows while the
live sheet silently recomputes against the reduced roster; (2) the workspace is
a fixed desktop layout — 280px rail, 1100px-capped page, one 900px viewport
breakpoint — leaving 606px of dead rail and 331px of dead vertical at the
measured 2560×1249 (4K, DPR 1.5, DevTools docked). Fix the recovery model
first, then recompose for wide screens. Physical sheet geometry and
preview/PDF parity do not change.

Separate console-hygiene defects ride along: stale cloud-thumbnail 404 floods
and four requests for box half-placement files that should never exist.

## Evidence base (all verified this session, file:line)

- Draft hydration fires synchronously at state-factory construction with no
  auth gate: `choreo-sheet-state.svelte.ts:483-485`. Every other private-data
  consumer in the app gates on `authState.initialized` (e.g.
  `HallOfShameGallery.svelte:50-51`, `ScreenshotGallery.svelte:70-93`);
  Choreo is the sole outlier.
- `getUserId()` throws `LibraryError("UNAUTHORIZED")` from client state before
  any Firestore call (`library-repository.ts:193-199`); pre-settlement it is
  indistinguishable from signed-out (`auth-state.svelte.ts:166-171`). No
  `authStateReady()` promise exists anywhere; three call sites hand-roll
  50ms poll loops (`admin/+layout.ts:15-58`, `MyFeedbackTab.svelte:70-91`,
  `sequence-viewer-overlay-state.svelte.ts:67-73`).
- The view-layer loader swallows the first error in an empty catch
  (`ChoreoSheetView.svelte:75-78`), then falls back to the public loader,
  which cannot see private docs (`public-sequences-loader.ts:128-175`).
- `getSequence()` returns `null` for true not-found; throws typed
  `LibraryError` (`NOT_FOUND | UNAUTHORIZED | NETWORK | ...`) or rethrows raw
  `FirestoreError` (`.code === "permission-denied" | "unavailable" | ...`)
  otherwise (`library-error.ts:9-26`, `firestore-crud.ts:24-108`). Full
  classification is buildable; the only existing classifier is
  `isPermissionDeniedError()` (`auth/utils/is-permission-denied-error.ts`).
- Guests: anonymous users have a real uid and a private library at the same
  path (`guest-identity.ts:17-38`); the same restoration race applies.
- `hydratedSequences` filters unresolved ids out
  (`choreo-sheet-state.svelte.ts:153-157`) and every downstream derived —
  `normalizedRows` → `boundaries` → `loopStatus` → `pages`/`bandPages` →
  `actSequence` — recomputes against the reduced roster. Export and playback
  consume those deriveds (`ChoreoSheetView.svelte:381-389, 865`).
- Draft persistence round-trips the whole `ChoreoSheet` but zero per-sequence
  metadata (`choreo-sheet-state.svelte.ts:80-111`) — a cold restore has ids
  only, so rows can say nothing but "Loading…"/"Failed to load".
- Rail row labels violate `simplified-word-display.md` in the LIVE app:
  `rowLabel()` returns raw `displayName ?? word ?? name`
  (`ChoreoSheetView.svelte:121-125`) with no `simplifyRepeatedWord`, and the
  handoff's DOM snapshot shows the full repeated words on screen
  (`KECΦ-KECΦ-KECΦ-KECΦ-` where canon demands `KECΦ-`). Labels also render in
  the system font, not the TKA Letters webfont (`src/styles/tka-font.css`,
  class `.tka-font`, uppercase Greek only per
  `reference_tka_font_uppercase_greek`).
- Layout hard limits: rail `width: 280px` (`ChoreoSheetView.svelte:1187`),
  dock `min(460px, 42vw)` (`:1036`), page `max-width: 1100px`
  (`SheetPreviewPages.svelte:478-492`), single `@media (max-width: 900px)`
  (`ChoreoSheetView.svelte:1428-1442`). The annotated branch already proves
  the container-query technique (`--pt: calc(100cqw / pageWidthPt)`,
  `SheetPreviewPages.svelte:190,594-595`).
- Thumbnails: `handleImageError` calls weak `invalidateUrl` (volatile URL
  cache only) instead of `markMissing` — the authoritative negative path that
  commit `f32cbdb89d` added for exactly this case
  (`PropAwareThumbnail.svelte:312-321`, `cloud-thumbnail-cache.ts:195-204`).
  `saveCloudBlobToLocal` writes fetch bodies to IndexedDB without checking
  `response.ok`, so a 404 body poisons the local cache
  (`thumbnail-render-orchestrator.ts:593-600`); the correct pattern already
  ships in `offline-cache-orchestrator.ts:314-321`. The error path never
  deletes the poisoned local blob (its sibling `forceRerender()` does, line
  528 — drifted duplicates). No per-hash memory eviction exists, which is why
  one dead object floods: every mount rediscovers it independently.
- Half placements: diamond `_half` files exist
  (`static/data/arrow_placement/diamond/default/default_diamond_{pro,anti,dash,static}_half_placements.json`);
  box `_half` files are architecturally redundant — segment nudges are
  authored glyph-local and grid-mode-invariant by design
  (`arrow-positioning-orchestrator.ts:73-77`); every authoring/verification
  tool (`half-domain-coverage.mjs:54,69`, `test/half-movements/save/+server.ts:6,22`,
  `extract-half-glyphs.mjs`) is diamond-only on purpose. `filesFor()` blindly
  builds `${gridMode}`-keyed paths (`arrow-placer.ts:75-88`), and
  `ensureLoaded` has no in-flight dedup (`arrow-placer.ts:113-126`), which is
  what turns 1 missing file into "×26" console groups under
  `Promise.all`-driven batch prepare (`pictograph-preparer.ts:36-49`).

## Approaches considered

1. **Patch in place** — gate the existing `ensureHydrated` behind an
   `$effect` on `authState.initialized`, keep `failedIds` semantics.
   Fixes the headline race but leaves the deeper defect: the derived pipeline
   still silently collapses the roster, retry stays manual-per-row, and the
   first error stays unclassified. Rejected as below the bar.
2. **Roster state machine + resolver service** (chosen) — introduce an
   explicit per-row status model that the whole derived pipeline respects,
   move sequence resolution out of the view into a classified, auto-retrying,
   cancellable service, and gate it once per batch on a real auth-settled
   promise. Larger, but it is the model the handoff's required tests describe,
   and it makes the failure states designable UI instead of accidents.
3. **Suspense-style rewrite of the module** (new shell component, route-level
   load functions) — rejected: the module shape is already correct
   (`ChoreoSheetView` is the reference workspace composition per the
   primitive sweep), and `sequence-viewer-shell.md` teaches that wholesale
   re-shelling is only earned by multi-host drift, which Choreo doesn't have.

For the stage fit, CSS transform scaling (`scale()`) was considered and
rejected: it blurs text/SVG at non-integer scales and fights the existing
container-query point system. The chosen fit uses pure CSS sizing math with
`cqw`/`cqh`, extending the `--pt` technique the annotated branch already uses.

---

## Phase 1 — Self-recovering hydration + roster truth

The user-blocking defect. Everything else waits behind it.

### 1.1 `awaitAuthSettled()` — the shared readiness boundary

`src/lib/shared/auth/state/auth-state.svelte.ts` gains one export:

```ts
/** Resolves once auth restoration has settled (authState.initialized === true).
 *  Resolves immediately if already settled. Never rejects. */
export function awaitAuthSettled(): Promise<void>
```

Implementation constraint: a module-scoped deferred resolved at the exact
points that assign `initialized: true` (all four branches — desktop fast-path
`:401-409`, persistent listener `:485-491`, error handler `:643-652`, and the
already-true fast path). **No polling loop.** The three existing 50ms poll
sites are NOT migrated in this work (flagged as a follow-up cleanup so this
change stays reviewable); new code must use the promise or a reactive
`authState.initialized` gate, never a new poll.

`initialized === true` covers signed-in, guest-restored, AND settled-signed-out
— so after the gate, `UNAUTHORIZED` genuinely means "no identity", which the
resolver treats as "private tier unavailable", not an error.

### 1.2 `sheet-sequence-resolver.ts` — classified, retrying, cancellable

New: `src/lib/features/write/services/sheet-sequence-resolver.ts`. The
private-then-public logic moves here from `ChoreoSheetView.svelte:65-97`
(which shrinks to wiring). Pure DI per the state-management skill — the
factory receives functions, resolves nothing internally:

```ts
export type ResolveFailure = "transient" | "permission" | "missing";

export interface ResolveOutcome {
  sequence: SequenceData | null;      // non-null iff resolved
  source: "private" | "public" | null;
  failure: ResolveFailure | null;     // non-null iff sequence is null
  attempts: number;
}

export interface SheetSequenceResolverDeps {
  loadPrivate: (id: string) => Promise<SequenceData | null>; // throws LibraryError/FirestoreError
  loadPublic: (id: string) => Promise<SequenceData | null>;  // null = not found, never throws for miss
  awaitAuthSettled: () => Promise<void>;
  delay?: (ms: number, signal: AbortSignal) => Promise<void>; // injectable for fake timers
  onStatusChange?: (id: string, status: RowStatus, failure: ResolveFailure | null, attempts: number) => void;
}

export function createSheetSequenceResolver(deps: SheetSequenceResolverDeps): {
  resolve(id: string, signal: AbortSignal): Promise<ResolveOutcome>;
}
```

Resolution algorithm per id:

1. `await deps.awaitAuthSettled()` — one shared promise; six concurrent ids
   await the same settlement, they do not race it six times.
2. **Private attempt.** Success with steps → done (`source: "private"`).
   `null` → private-not-found; continue. Thrown error → classify:
   - `LibraryError UNAUTHORIZED` (post-settle = genuinely no identity) →
     private tier unavailable; continue to public. Not a failure.
   - permission (`isPermissionDeniedError` or `LibraryError` semantics) →
     remember `permission`; still try public (the id may be public).
   - transient (`LibraryError NETWORK`, `FirestoreError` code
     `unavailable` / `deadline-exceeded` / `resource-exhausted`, fetch/network
     errors) → the whole attempt is retryable.
   - anything unrecognized → treat as transient (fail open toward retry, never
     toward "deleted").
3. **Public attempt** (`loadPublic`). Success → done (`source: "public"`).
   `null` → public-not-found.
4. Terminal classification:
   - private-not-found + public-not-found → `missing` (confirmed — the ONLY
     path allowed to present as deleted/not-found).
   - remembered permission + public-not-found → `permission` (never
     masquerades as deletion — handoff requirement).
   - transient after retries exhausted → `transient` (UI offers Retry all).

Retry policy (transient class only): 4 total attempts (1 + 3 automatic),
delays 500ms / 1500ms / 4000ms with ±25% jitter, all cancellable via the
`AbortSignal`. Single-flight per id: an in-flight map keyed by id (mirror
`SimpleJsonCache.loadingPromises`, `simple-json-cache.ts:17-41`) so overlapping
batches and per-row retries share one resolution. The classification helper
lives beside the resolver as `classifyResolveError(error): "transient" |
"permission" | "unauthorized"` with its own unit tests.

Never-hand-roll accounting: repo grep confirmed no exponential-backoff
primitive exists (`retry-authenticated-firestore-operation.ts` is
single-retry; `library-sync-retry.ts` is a bounded reconnect pass). The
backoff loop here is ~20 lines, private to the resolver, injectable-clock —
justified new code, not a new shared "util".

### 1.3 Roster state machine in `choreo-sheet-state.svelte.ts`

The filtered-list model is replaced by an explicit roster. `cache`,
`failedIds`, and the single `isHydrating` boolean give way to:

```ts
export type RowStatus = "loading" | "retrying" | "ready" | "missing" | "error";

export interface RosterRow {
  id: string;
  status: RowStatus;
  sequence: SequenceData | null;                    // canonical, library-loaded steps
  meta: { name: string; stepCount: number } | null; // non-authoritative display cache
  failure: ResolveFailure | null;
  attempts: number;
}
```

- `roster: RosterRow[]` derived from `sheet.sequenceIds` joined with per-id
  status/sequence/meta maps (`SvelteMap`s). **Roster order = sheet order,
  always, regardless of status.** Rows are never dropped, reordered, or
  collapsed by load state.
- `rosterComplete: boolean` derived — every row `ready`.
- Hydration coordinator: per-id state (status, attempts) — replacing the
  single `isHydrating` boolean the handoff flags. A **generation token**
  increments on `replaceSheet()` and on factory teardown; each batch carries
  an `AbortController` tied to its generation, so sheet swaps cancel pending
  retries and stale completions are dropped (compare generation before
  applying results).
- The construction-time kick (`:483-485`) stays fire-and-forget but now runs
  through the resolver, whose first act is the auth gate — the race is closed
  at the service layer, not with a view-level bandage, so `replaceSheet`,
  retry, and any future caller inherit the same protection.
- `retryAll()` replaces blanket `retryHydration()`: re-resolves every
  non-ready row. Per-row `retryHydration(id)` remains for isolated failures.
  Status flips `error → retrying` in place — the row's geometry never changes
  (the current `failedIds.delete → row flips to loading` reflow is exactly
  what the handoff forbids).

**Derived pipeline gating** — sheet truth while any row is unresolved:

- `normalizedRows`, `boundaries`, `breakSequenceIds`, `loopStatus`, `pages`,
  `bandPages`, `actSequence` compute **only from a complete roster**. While
  incomplete, they return the **last complete snapshot** if and only if its
  id-order still equals the current `sheet.sequenceIds`; otherwise they
  return empty and the preview enters placeholder mode (1.5). Sequence N+1 is
  never normalized against N−1 across a hole — structurally impossible now,
  not merely discouraged.
- Export and playback are disabled while `!rosterComplete` (button disabled
  state + tooltip "Waiting for N sequences to load"). No reduced-act export,
  ever. With automatic recovery this window is seconds, not a workflow.

### 1.4 Sequence metadata cache (draft + cloud doc)

`persistDraft`/`loadDraft` gain an optional `sequenceMeta:
Record<string, { name: string; stepCount: number }>` snapshot taken from
ready rows. `ChoreoSheetRepository`'s zod schema gains the same optional
field (back-compat: absent → `{}`; existing docs and drafts parse
unchanged — extend `tests/unit/choreo-sheet-persistence.test.ts`). Because
cache fills don't reassign `sheet`, a small debounced effect persists meta
when rows become ready. Meta feeds **display only** — row labels, counts, and
skeleton row reservation. Canonical steps always come from the library record
(handoff requirement).

### 1.5 Failure UX — calm by default

- **Loading (cold restore):** rail rows show `meta.name` + step count
  immediately with a `ShimmerBlock` status chip (the gold-standard skeleton
  primitive, `src/lib/shared/components/loading/ShimmerBlock.svelte`);
  "Loading…" text only when no meta exists. The preview renders a reserved
  skeleton sheet: per sequence, `ceil(stepCount / columns)` rows of
  shimmer cells at exact cell geometry (skeletons-match-layout convention);
  unknown stepCount reserves one row. No layout shift when real cells arrive.
- **Retrying:** visually identical to loading (subtle spinner glyph). No red.
  Automatic recovery is invisible recovery.
- **Error (auto-retries exhausted, transient/permission):** row gets a
  warning glyph + reserved-slot retry button (slot always reserved via
  `visibility`, not conditional render — kills the `popIn` reflow), and ONE
  toolbar-level surface appears: "N sequences didn't load — Retry all".
  Routed through `getErrorHandler().showUserError({ severity: "warning",
  context: { module: "choreo", tab: "sheet", action: "hydrate-roster" },
  technicalDetails: <ids, error classes, attempt counts> })` — non-blocking
  toast, telemetry-reported. The inline `saveMessage`/`exportError` strips
  (which shift layout today) also migrate to this surface.
- **Missing (confirmed not-found both tiers):** distinct presentation —
  "Not in your library or the gallery" + a remove affordance. Never shares
  copy with transient failure; permission errors never show as missing.
- **Word display (fixes a live rule violation):** every sequence-word surface
  in the module — rail row labels, `meta.name` display, tooltips, any future
  caption — routes through `simplifyRepeatedWord`
  (`src/lib/shared/foundation/utils/word-simplifier.ts`) and renders in the
  TKA Letters webfont (`.tka-font`, sized ≥16px for glyph legibility; the
  full word stays available as the tooltip/`title`). Stored data (`meta.name`,
  `sequence.word`) stays raw — display-layer simplification only, per
  `simplified-word-display.md`.

### 1.6 Phase 1 tests (the handoff's required list, mapped)

New `tests/unit/sheet-sequence-resolver.test.ts` +
`tests/unit/choreo-sheet-roster.test.ts`, using the existing DI seams
(`createChoreoSheetState({ loadSequence… })` pattern from
`choreo-sheet-annotations.test.ts:37-74`; no component mounting):

1. Restored draft with ids does not call `loadPrivate` until a deferred
   `awaitAuthSettled` resolves.
2. Six concurrent ids → `awaitAuthSettled` awaited once, no id observes
   settlement later than another (shared gate, not six races).
3. Transient first attempt (`FirestoreError unavailable`) → automatic retry
   (fake timers via injected `delay`) → success, status `ready`, attempts 2.
4. Private `null` + public `null` → terminal `missing` (no retries burned).
5. Permission error + public `null` → terminal `error`/`permission`, message
   class ≠ missing.
6. `UNAUTHORIZED` post-settle → public fallback path, no failure recorded
   when public resolves.
7. Generation bump / abort mid-backoff → timers cancelled, stale completion
   dropped, no state mutation from the dead batch.
8. Roster: mixed statuses preserve order; deriveds return snapshot only when
   id-order matches; export gate flips with `rosterComplete`.
9. Draft + repository parse with and without `sequenceMeta` (back-compat).

---

## Phase 2 — Wide-screen recomposition

Keep `ChoreoSheetView` as the workspace owner (the primitive sweep confirmed
it IS the reference rail+stage+dock composition — extend in place, no new
shell). All work is container-query-driven; **zero new viewport-only
breakpoints**. The root `.choreo-sheet-view` becomes a named container
(`choreo-workspace`); the current `@media (max-width: 900px)` stack becomes
`@container` on it, which also fixes the DevTools-docked case (a 2560px
container behaves like the wide desktop it is).

### 2.1 The stage is the hero

- `.preview-pane` becomes `container-type: size`. The page's on-screen size
  derives from the stage box, not a magic cap. Delete `max-width: 1100px`.
- **Fit policy** (default `fit-page`): each `.page` sizes to
  `min(100cqw − 2·pad, calc((100cqh − 2·pad) · pageAspect))` — the whole
  sheet fills the stage's limiting dimension. At the measured 2560×1249
  workspace this yields a ~1500×1160 page (vs 1100×850 today); at full 4K it
  is limited by height and centered large. `fit-width` mode sizes to
  `100cqw − 2·pad` and scrolls vertically — better for reading a long
  multi-page sheet. A two-option `SegmentedControl`
  (`src/lib/shared/ui/components/SegmentedControl.svelte` — note the current
  path; `chip-primitives.md` cites a stale one) in the toolbar switches
  modes; preference persists in the existing picker-UI prefs object
  (`PICKER_PREFS_KEY`, `ChoreoSheetView.svelte:184`).
- **Two-page spread:** in `fit-page` mode, when `pageCount > 1` AND the stage
  is wide enough that two fit-height pages fit side by side (container-query
  threshold on the stage), pages lay out 2-up (deliberate column count — a
  pinned composition decision, not `auto-fill`). Display-only; planner, page
  geometry, and PDF are untouched, so parity is preserved by construction.
  Below the threshold, the existing single stack stands.
- Existing per-page virtualization (IntersectionObserver,
  `SheetPreviewPages.svelte:125-154`) is retained; the aspect-ratio frame
  reservation already prevents shift.
- Stage styling: page gets elevated shadow and breathing room on a slightly
  deeper backdrop than the chrome panels, so the composition reads
  chrome | artifact | chrome instead of four equal dark columns.

### 2.2 Rail: resizable + collapsible

Mirror `ViewerContentRail`'s established convention
(`sequence-viewer/components/ViewerContentRail.svelte:1-107`): pointer-drag
resize via the shared `ResizeHandle` primitive
(`src/lib/shared/panels/ResizeHandle.svelte`), range 240–360px, width
persisted to `localStorage("tka-choreo-rail-width")`, double-click snap +
explicit collapse button to a 48px icon strip (sequences count badge +
expand). In the stacked narrow layout the rail is full-width as today.
Do not hand-roll a new drag handle.

### 2.3 Toolbar hierarchy

One row, three zones (zone pattern per `ButtonPanel` precedent):

- **Identity (left):** sheet-name input (type scale steps up via container
  query at wide widths), loop badge (`Loops ✓ / Open`, width reserved for the
  wider label per `no-layout-shift.md`), unsaved dot (reserved slot).
- **Primary (right):** Add sequences, Export PDF, Save — full label buttons.
- **Secondary (between):** Acts, Play act, fit control — icon+label at wide
  container, icon-only in the middle range (aria-labels always present).

Inline error strips are gone (moved to `showUserError`, 1.5), so the toolbar
never reflows on error.

### 2.4 Browse dock at 4K

Width goes container-relative: `clamp(400px, 30cqi, 640px)` against the
workspace container — at 4K the picker earns real columns instead of a fixed
460px sliver. The `dockSlide` width-pin perf contract is kept by pinning dock
children to the same computed width via a shared CSS custom property
(`--dock-w`) consumed by both rules (`dock-slide.ts` contract,
`ChoreoSheetView.svelte:1046-1051`). Locked decisions stand: inline column,
never an overlay, whole page visible while open — guaranteed structurally,
because fit-page sizing recomputes from the shrunken stage container.

### 2.5 What does NOT change

Page geometry (`sheet-page-layout.ts`), planner (`planSheet`/`planBands`),
cell rendering, PDF exporter, Study/Annotated modes, the 8-column contract,
picker inline-ness, `SheetPreviewPages`' annotated `--pt` container system.
The preview/PDF parity argument is unchanged: both consume the same planner +
geometry; Phase 2 only changes how large the page is drawn on screen.

### 2.6 Phase 2 verification (per `verification-protocol.md` + `4k-native-layout.md`)

Screenshot evidence at all of: 3840×2160 (DPR 1), ~2560×1249 (4K DPR 1.5,
DevTools docked — the reported failure case), 1920×1080, and the ~900
container transition; each with picker open AND closed; both Study and
Annotated modes. Checks: no dead rail beyond intentional padding, page is the
visual anchor, no orphan/overflow rows, no layout shift cycling
loading→ready→error states (toggle via test stub), toolbar states stable.
Export a PDF after the layout work and compare page count + slot geometry
against preview (parity gate). Browser interaction beyond read-only requires
Austen's explicit permission in-conversation.

---

## Phase 3 — Thumbnail 404 hygiene

Minimal fix set (seams verified; the authoritative negative path already
exists and is simply not wired):

1. **`PropAwareThumbnail.svelte`** — extract the duplicated
   `handleImageError` / `forceRerender` reset logic into one shared repair
   helper (module-local `repairThumbnail(kind: "cloud-404" | "blob-decode" |
   "manual")`), then: on cloud-URL image error call
   `markMissing(cloudKey)` (replacing `invalidateUrl`) AND
   `localCache.delete(key.hash)`; on blob-URL error delete the local blob +
   skip cache (the blob was likely a poisoned body); manual force keeps
   current behavior. Preserve the other session's uncommitted comment edit at
   the top of the file — do not revert it; coordinate if touched.
2. **`thumbnail-render-orchestrator.ts`** — `saveCloudBlobToLocal` gains the
   `response.ok` gate mirroring `offline-cache-orchestrator.ts:314-321`:
   404 → `markMissing(buildCloudKey(key))`, no write; other non-ok → no
   write, no negative cache (5xx/permission stay retryable — only 404 enters
   the negative cache). Add a public `evictHash(hash)` that removes the
   single memory-cache entry, called from the repair path so sibling mounts
   stop re-serving the stale entry (the flood mechanism).
3. **Tests** — update the three mocks that stub the cloud-cache module to
   include `markMissing` (`thumbnail-render-orchestrator.test.ts`,
   `thumbnail-render-orchestrator-failures.test.ts`,
   `thumbnail-cache-keys.test.ts` — they will throw on the new import
   otherwise). New focused tests: (a) `saveCloudBlobToLocal` on 404 → no
   `localCache.set`, `markMissing` called once; on 500 → neither; on 200 →
   set, no negative entry. (b) One dead persisted positive produces at most
   one network 404 per negative-cache TTL, then falls through to local
   render (orchestrator-level, stubbed deps — the existing no-fake-indexeddb
   harness pattern).

Only 404 is authoritative-missing. Permission/quota/server errors never enter
the negative cache (matches `cloud-thumbnail-cache.ts`'s existing `getUrl`
discipline, lines 311-385).

## Phase 4 — Half-placement requests

Canon verdict (arrow-positioning expert, evidence above): box `_half` data
must NOT be authored — segment adjustments are glyph-local and
grid-mode-invariant; a box dataset would create a second source of truth the
entire pipeline (coverage oracle, WASD harness, extractor) contradicts.

1. **`arrow-placer.ts` `filesFor()`** — segment motion-type paths stop keying
   on grid mode; all grid modes load the diamond files:
   `/data/arrow_placement/diamond/default/default_diamond_${mt}_half_placements.json`
   (note the `_half` suffix). Comment cites the invariance contract at
   `arrow-positioning-orchestrator.ts:73-77`.
2. **`ensureLoaded`** — track the in-flight promise per bucket key (mirror
   `SimpleJsonCache.loadingPromises`) so concurrent batch prepares share one
   load. This kills the ×26 amplification for ANY future missing bucket, not
   just this one.
3. **Verification:** unit test that `filesFor(GridMode.BOX, …)` returns
   diamond `_half` paths; `/choreo` console clean of placement warnings on
   reload (screenshot/console capture). Note the behavior change: box-mode
   half segments move from the `{x:0,y:0}` fallback to real diamond nudges —
   spot-check one box half-motion pictograph on the existing
   `/test/half-movements` page before/after. Pictograph rendering for
   evidence goes through the approved TKA MCP tools only.
4. **Knowledge flow-back (`expert-routing.md` rule 2):** update
   `arrow-positioning-expert`'s agent file with the now-explicit canon:
   segment half-placements are grid-mode-invariant, diamond files are the
   single source, `filesFor` must not grid-key them.

---

## File plan (reuse accounting per `never-hand-roll.md`)

**New files (justified):**

| File | Justification |
|---|---|
| `src/lib/features/write/services/sheet-sequence-resolver.ts` | No retry/backoff/classification primitive exists (grep-proven); logic currently lives untestably in a view file |
| `tests/unit/sheet-sequence-resolver.test.ts`, `tests/unit/choreo-sheet-roster.test.ts` | No hydration/retry coverage exists (only annotation/persistence suites) |

**Edited:** `auth-state.svelte.ts` (+`awaitAuthSettled`),
`choreo-sheet-state.svelte.ts` (roster model, meta persistence, gated
deriveds), `ChoreoSheetView.svelte` (wiring, toolbar zones, rail
resize/collapse, dock width, container queries, failure UX),
`SheetPreviewPages.svelte` (fit policy, 2-up, skeleton sheet),
`choreo-sheet-repository.ts` (+optional `sequenceMeta`),
`PropAwareThumbnail.svelte`, `thumbnail-render-orchestrator.ts`,
`arrow-placer.ts`, three thumbnail test files, persistence test,
`.claude/agents/arrow-positioning-expert.md`.

**Reused, not rebuilt:** `ResizeHandle`/`PanelGroup`, `ViewerContentRail`
width-persist convention, `ShimmerBlock`, `Crossfade` + `DURATION` +
`dockSlide` (with width-pin contract), `SegmentedControl` + `FilterChipBase`,
`getErrorHandler().showUserError`, `isPermissionDeniedError`, `LibraryError`
codes, `markMissing`, `SimpleJsonCache`'s in-flight pattern, the annotated
branch's `--pt` container technique, existing IntersectionObserver
virtualization.

## Implementation ledger (Opus 5: keep current; `- [x]` done, `- [~]` deferred+reason)

- [x] 1.1 `awaitAuthSettled()` in auth-state (no polling) — `31d5c5e296`
- [x] 1.2 resolver service + classification + backoff + single-flight — `3c39a891f3`
- [x] 1.3 roster state machine, generation cancellation, gated deriveds, export/playback gate — `d7f502c333`
- [x] 1.4 `sequenceMeta` in draft + repository (back-compat parse) — `376a8f5a83`
- [x] 1.5 failure UX: skeleton rows/sheet, reserved slots, Retry all, showUserError routing, missing-vs-error copy — `8270e8b8ba` + `c808c22c9f`
- [x] 1.5b word display: `simplifyRepeatedWord` + `.tka-font` on every sequence-word surface (fixes live rail violation) — `c808c22c9f`
- [x] 1.6 all Phase-1 tests green — 42/42 across 6 files; full check clean for touched files
- [x] 2.1 stage fit policy (fit-page default, fit-width toggle, 1100px cap deleted, 2-up spread) — `6cbcbc2557`
- [x] 2.2 rail resize + collapse (ResizeHandle, persisted width) — `8c36547b3a` + `4f7c4841ed`
- [x] 2.3 toolbar zones + no-shift audit — `8c36547b3a`
- [x] 2.4 dock container-relative width (dockSlide pin kept via shared `--dock-w`) — `8c36547b3a`
- [~] 2.5 container-query migration — toolbar is a real `@container choreo-workspace`; body/dock use a ResizeObserver-fed `--workspace-w` instead of root containment, because `container-type` on the root would have offset every `position: fixed` popover (filter Drawer, dropdown chips) rendered inside the view. Element-relative semantics preserved, zero new viewport breakpoints. Data-parity gate passed: zero diffs under `services/` + `domain/`.
- [x] 2.6 visual verification DONE (2026-07-26, live browser): frames at 3840×2160, 2560×1440 (picker open + closed), 1920×1080, 1440×900, 820×1180, 375×667; Study + Annotated; loading + ready. Restore repro: draft reload → full roster resolves in ~1.4s, zero manual clicks, zero red. Console clean of placement warnings + thumbnail 404s throughout. PDF exported live: 3 pages matching preview, title block + running headers correct. Three composition defects found and fixed during the pass: unreachable 2-up threshold (`8614dfa78a`), 2-up firing on short stacked stages + full-width stacked segmented controls (`1e632d4320`). Plus a live data bug found + fixed: corrupted serverTimestamp sentinels made an existing library doc parse as null → classified missing (`54eecd99d7`).
- [x] 3.1 thumbnail repair helper: markMissing + local delete + evictHash — `c23988c21c`
- [x] 3.2 `response.ok` gate in saveCloudBlobToLocal — `c23988c21c`
- [x] 3.3 thumbnail tests (mock updates + new cases) — 35/35 across 5 files
- [x] 4.1 `filesFor` diamond-invariant segment paths — `ee0b810569`
- [x] 4.2 `ensureLoaded` in-flight dedup — `ee0b810569` (9 loads for 26 concurrent callers, proven)
- [x] 4.3 console-clean evidence: zero placement warnings across every /choreo load in the live pass (previously 4 warnings ×26). Unit test proves box buckets load diamond `_half` paths. Live box half-motion VISUAL check deferred honestly: the WASD harness is diamond-only by design and no box halved content was on hand to render — revisit when box halved-LOOP content exists.
- [x] 4.4 arrow-positioning-expert file updated — `ee0b810569` (Codex mirror `.codex/agents/arrow-positioning-expert.toml` = open one-line follow-up)
- [ ] Final: one full `npm run check` (respect machine-wide gates in `resource-budget.md`), scoped commits per phase

## Gotchas carried forward (from the handoff — still binding)

- Reproduce through **draft restoration** (persisted six-sequence draft +
  reload), not `handleBrowseSelect` — picker adds seed already-held data and
  hide the bug.
- `hydratedSequences`' downstream consumers are all inside the state file +
  `ChoreoSheetView`; the exporter re-plans from `normalizedRows` — audit both
  when changing shapes.
- Port 5173 is Austen's dev server — never start/stop/kill. Own server:
  `vite --port 5174` behind `resource-budget.md` gates.
- Browser navigation/clicking/typing/reload needs Austen's explicit
  permission in-conversation; read-only evaluation is allowed for page review.
- The shared index is dirty with other sessions' work: `git status --short`
  before every commit, explicit pathspecs only, never stage unrelated files.
- `PropAwareThumbnail.svelte` carries another session's uncommitted comment
  edit — retain it.
- The 4-placement warnings and thumbnail 404s are separate defects from
  hydration; verify each independently.

## Follow-ups (out of scope, recorded)

- Migrate the three 50ms auth-poll sites to `awaitAuthSettled()`.
- Fix `chip-primitives.md`'s stale `SegmentedControl` path.
- Optional: extend `half-domain-coverage.mjs` to sweep box-mode synthetic
  steps now that the path is shared.
