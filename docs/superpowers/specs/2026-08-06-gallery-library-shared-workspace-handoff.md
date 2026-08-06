# Gallery + Library Shared Filter Workspace — Handoff (2026-08-06)

## Mission

The gallery's split-pane filter workspace shipped 2026-08-05. The Library was
still reaching the same drill through the old sheet drawer, and every smart
collection reported a count of 0. This session unified the two surfaces onto
one shared `FilterWorkspace`, fixed smart-collection membership, put the last
engine-less browse surface on the engine, and deleted the dead filtering
directory.

**The next agent's job is loose end #1: the app-wide 4K root font ramp.** It is
the systemic cause of the "now make it work on 4K" cycle Austen has been in for
weeks, it is one CSS rule away from fixed, and this handoff carries the two
things that make it non-trivial (the height-floor hazard and the in-app
workarounds that must come out with it).

Predecessor handoff (gallery split pane, all its context still valid):
[2026-08-05-gallery-split-pane-workspace-handoff.md](2026-08-05-gallery-split-pane-workspace-handoff.md)

## Done — verified

One commit: **`dd6af0d101`**, on `main` and pushed to `origin/main`
(push output: `88243ef08a..dd6af0d101  main -> main`).

| What | Evidence |
|---|---|
| **Smart collections resolve their members.** Membership came from the stored `sequenceIds` array; a smart collection's is `[]` by construction, so the filter matched nothing and reported 0 — and because the id *was* known, `filterByCollection`'s unknown-id guard never fired, making it indistinguishable from an empty manual collection. The resolver in `collections-state.svelte.ts` now evaluates `filterSpec` via `deriveSpecMembers` against the candidate set. | Live in the app at 1920. **Gallery** (1413-match pool, filters cleared): Level 2 `0 → 516`, Level 2 Max1 16-step Quartered `0 → 95`, 4-Elements `0 → 17`. **Library** (516 pool): `0 → 102 / 44 / 17`. Manual collections unchanged (Favorites 6, Poi-Legal 7, C2C 6). |
| Remaining zeros are correct, not residual bugs | Sick Mandalas / Bella / 1940 / Quintessence read 0 in the gallery and 2 / 2 / 1 / 1 in the Library — they hold the user's own sequences, absent from the community pool. VTG is 0 in both (genuinely empty). C2C reads 6 in the gallery, 0 in the Library, same reason inverted. |
| Resolver contract locked by tests | `npm run test:ci -- tests/unit/browse/collection-filter.test.ts` → 10/10. Three new cases: the resolver receives the candidate set; a rule-based collection resolves members instead of reporting none; a rule-based collection intersects when stacked. |
| **`FilterWorkspace.svelte` extracted** from `BrowseModule` and rendered by BOTH hosts. Hosts own only their results pane and `onEject`. BrowseModule shrank 330 lines. | `svelte-check` 0 errors / 0 warnings. Gallery screenshotted at 1920 after extraction: catalog, editor, rule strip, 1413-match live grid — composition unchanged from the pre-extraction baseline. |
| **Library runs the workspace.** `AllLibraryView` renders `FilterWorkspace` with `source: my-library`; `GalleryFilterSheet` is gone from it. | Measured at 1920: left pane 440, results 959, header "516 matches", 20 cards live, Collections category present and filterable. Screenshotted at 1920, 3840, 1440, 960×412, 375×667. |
| No horizontal overflow at any required viewport | `scrollWidth > innerWidth` false at 3840, 2560, 1920, 1440, 960×412, 375×667. Measured, not eyeballed. |
| **`CollectionDetailView` on the engine** — was the last surface with no search, sort or filters. Members still load by id (a collection can hold sequences no browsable pool contains) and are handed over by the new `engine.setPool()`. | Screenshotted at 1920 on "Book Variations": toolbar with Level / Favorites / Length / LOOP chips, search, zoom, count. Members render. |
| **`BrowseSortMethod.CURATED`** keeps a collection's curated order (identity sort — falls through the sorter's existing `default` branch) and leads its sort menu. Offered only when a host passes `curatedSortLabel`. | Sort control reads "Collection order" as the default on collection detail; no other surface gained the option. |
| Selection still works on collection detail, with ONE toolbar | Long-press on a card entered selection: `1 selected · Select all · Remove from this collection · Add to collection…`, and `document.querySelectorAll("[class*='selection-toolbar']").length === 1`. (I broke this mid-session by dropping the wiring, caught it re-reading my own diff, fixed it with `hideSelectionToolbar`.) |
| **Deleted `src/lib/features/browse/sequences/filtering/**`** — 9 components, zero importers, superseded by `shared/browse/components/BrowseFilterBar.svelte`. | Verified before deleting: per-filename grep across `src` + `tests` returned 0 importers for 7 of 9; the 2 hits on `ActiveFilterBar` / `FilterChipRow` were both a single comment line in `BrowseFilterBar.svelte:3`. |
| Whole suite green | `npm run test:ci` → **930 test files, 7577 tests passed**, 2 skipped. Two files (`guide-reflow-contract`, `settings-account-sync`) hit 5s timeouts under full-suite load and pass in isolation (`2 passed / 20 tests`) — load artifacts, not regressions. |

## Believed done — unverified

- **`SectionedVirtualGrid`'s `collectionContext` passthrough.** I threaded the
  prop through all three of `BrowseGrid`'s render paths, but collection detail
  runs with `sections: false`, so the sectioned path is not exercised by any
  current caller. It typechecks; it has not run.
- **Foreign / shared collection detail** (`foreignOwnerId` set — someone else's
  public collection, or one shared with you). I verified the owned path only.
  The engine is configured `initialSource: "my-library"`, which is irrelevant
  because `setPool` supplies the pool directly and `initialize()` is never
  called — but that reasoning has not been confirmed against a live foreign
  collection. **Check this first if collection detail misbehaves.**
- **A smart collection whose `filterSpec.source` is `my-library`, viewed inside
  the gallery.** The resolver intersects with `ownerId === getEffectiveUserId()`
  so it cannot start matching other people's sequences. Every smart collection
  in Austen's live data is `source: "community"`, so the branch never executed
  during verification.

## In flight

**Nothing of mine.** Every file I touched is in `dd6af0d101` and pushed. No
branches, no worktrees — all work on `main` in the primary checkout.

The working tree holds a large set of modified files from other sessions
(assemble-lab, museum, write, 3D effects, keyboard). I did not stage, commit,
or revert any of them. The commit used an explicit pathspec listing all 17 of
my paths.

## Loose ends (ranked)

### 1. The app does not scale at 4K. START HERE.

At a 3840 viewport, `getComputedStyle(document.documentElement).fontSize` is
**still 16px** for every in-app route. I re-measured it this session on
`/browse/library` at 3840 — it has not changed since the previous handoff
flagged it.

The lockstep ramp exists and works. It is just scoped to three shells
(`src/app.css:770-788`):

```css
@media (min-width: 1680px) {
  html:has(.mkt-shell),
  html:has(.legal-container) {
    font-size: clamp(16px, calc(16px + (100vw - 1680px) * 8 / 2160), 24px);
  }
}
/* QfT takes the same ramp WITH a height floor */
@media (min-width: 1680px) and (min-height: 45rem) {
  html:has(.qft-app) { font-size: clamp(...same...); }
}
```

`.mkt-shell` is MarketingChrome; app routes never mount it. So create, browse,
learn, museum, practice, lab and the whole authenticated product render at
1080p proportions on a 4K monitor at 100% scaling. Everything I screenshotted
at 3840 this session reads as a thumbnail of itself.

**Two things make this more than a one-line change — both are already solved
precedents in the file, do not rediscover them:**

**(a) The height floor is mandatory, and the QfT comment says why.** Scrolling
pages can spend a ramped rem on height and just grow taller. Surfaces that fit
themselves to the window cannot: a 3840×412 window asked QfT to lay out 24px
type in 412px of height and the notation ran under the footer. That is why the
`.qft-app` rule carries `and (min-height: 45rem)`. The app is *full* of
fit-to-window surfaces — the browse split pane (`height: 100%`, its own
internal scrollers), the create workspace, every 3D canvas, the sequence viewer
drawer. **Ship the app-wide ramp with the same `min-height` floor**, and treat
the Z Fold landscape viewport (960×412) as the case that proves it.

**(b) Five surfaces already hand-rolled a local ramp because the root one
never reached them, and they will DOUBLE-SCALE once it does.** Each carries a
comment naming the missing root ramp as its reason. I read all five — this
list is the audited set, not a grep dump:

| File | Local workaround to reconcile |
|---|---|
| `features/creators/components/CreatorsPanel.svelte:648` | container-scaled root, descendants in `em` |
| `features/creators/components/UserProfilePanel.svelte:343` | `font-size: clamp(1rem, 0.62cqi, 1.5rem)` at panel scope |
| `features/lab/tabs/combinator/CombinatorLab.svelte:709` | hand-stepped `@media (min-width: 2600px)` sizes |
| `routes/test/effect-grid/+page.svelte:138` | `.harness` local type ramp, everything below in `em` |
| `routes/endless-spinner/+page.svelte:470` | a full copy of the ramp formula scoped to `html:has(.endless-spinner-page)` |

Reconciling them is part of the job, not a follow-up. A panel-scoped `cqi`
ramp *multiplied* by a ramped root is exactly the disjointed-4K failure
`4k-native-layout.md` exists to prevent. The `endless-spinner` case is the
easy one — an identical formula on a different selector, so it just becomes
redundant. `UserProfilePanel`'s `cqi` ramp is the dangerous one: it tracks the
panel rather than the viewport, so it compounds rather than duplicates.

Do NOT touch `features/store/components/ShopComingSoon.svelte` or
`features/landing/components/SpinnerModeToggle.svelte`. They turn up in a
`grep "root ramp"` but they *consume* the ramp correctly (`max-width: 35rem`,
`min(100%, 28rem)`) on routes where it already fires. I nearly listed them as
workarounds; they are the pattern to keep.

**This needs its own spec** — blast radius is every app surface, and the
verification set is the full viewport table in
`.claude/rules/visual-verification-mandatory.md` across create / browse /
learn / museum / practice. Austen has said repeatedly he does not want to keep
asking for 4K after the fact; arriving there is the job.

### 2. BrowsePanel sparse results

Sections holding 1–4 sequences leave most of their row empty at 2560/3840.
Named as a fast-follow since 2026-08-04 and now the dominant visual defect in
the results pane — visible in this session's 3840 Library screenshot, where the
"4 steps" row stops around 40% of the pane width. BrowsePanel internals were
out of scope for both the split-pane project and this one.

### 3. Phone-sheet feel test

Open since 2026-08-04. Decide on a real phone whether `GalleryFilterSheet`
stays for phones or phones also get the in-page workspace. Two
`TODO(phone-sheet-feel)` markers in `GalleryTab.svelte`. Note this session
narrowed the question: the Library no longer uses that sheet at all, so
`GalleryFilterSheet` is now a phone-only component with exactly one consumer.
If phones get the workspace, the component is deletable.

### 4. The unexercised paths from "Believed done — unverified"

Foreign/shared collection detail, and the sectioned `collectionContext` path.
Cheap to confirm; do it opportunistically when next in that code.

### 5. Smart-collection `size` sorting still reads the stale field

`collection-options.svelte.ts` orders the Collections list by
`c.sequenceCount ?? c.sequenceIds?.length ?? 0`. For user-created smart
collections `sequenceCount` is whatever `syncSmartCollectionCount` last wrote,
and for founding ones it is a hardcoded constant. The *displayed* count is now
correct (it comes from the engine via `getCount`), but the **sort order** can
still put a large smart collection low in the list. Fixing it means sorting by
the resolved count, which is only known inside the engine — a small seam, not
a one-liner.

## Decisions already made

Austen's calls. Do not re-litigate.

- **2026-08-05: shared shell, two sources.** Gallery and Library are the same
  workspace differing only by source. He chose this over (a) folding the
  Library into the gallery as the single front door and (b) adding a
  collections side-rail to the gallery. The rail was rejected because it
  competes with the left column's shared height budget and thins the results
  pane at 1920.
- **Collections stay a stackable filter in both surfaces; the Library tab
  stays the management home** (create, rename, curate, share). Carried forward
  from 2026-08-04.
- **A collection's curated order is the point of a manual collection.** Hence
  `CURATED` as the default sort on collection detail rather than alphabetical.
- All decisions in the 2026-08-05 split-pane handoff remain in force —
  including no page-top search in the gallery, live-applying turn slider, and
  narrow screens (<~1200px) keeping the step-through flow.

## Gotchas

**Testing**

- **`npx vitest run <path>` without the project config fails ~73 files** on
  environment errors (`localStorage is not defined`). Always
  `npm run test:ci -- <paths>`. The previous handoff's "baseline protobufjs
  failures on main" were this artifact, not real failures — under the right
  config all 24 browse files pass. I lost time on it; you should not.
- One full-suite run costs ~2 minutes and two files time out at 5s under that
  load. Re-run those two in isolation before believing them.

**Code**

- **The engine has no injectable pool by design; `setPool()` is the new seam.**
  A host that calls it must NOT also call `initialize()` — the loader would
  overwrite the supplied pool. `setPool` sets `sectionsReady`/`isLoading`
  itself, otherwise the panel sits on its skeleton forever.
- **`BrowsePanel` renders its own `SelectionToolbar` whenever `selection` is
  passed.** A host with its own toolbar must pass `hideSelectionToolbar`, or
  two stack. This is exactly the bug I shipped and caught.
- **The gallery's `applyToGrid` warm-up is now the `onEject` prop.** If a new
  host needs the below-seam full-page grid, it supplies its own; omitting
  `onEject` makes the below-seam actions mutate in place, which is right for a
  host with no grid view.
- `filterByCollection` runs inside the engine's `$derived` pipeline, so the
  resolver is called on every filter recompute. `deriveSpecMembers` over the
  candidate set is O(pool × spec filters) — fine at 1413, worth remembering if
  the pool grows an order of magnitude.
- The `GalleryDrill` line cap in
  `tests/unit/browse/gallery-drill-split-contract.test.ts` is still a real
  constraint. It has been raised twice. Do not raise it again — extract instead.

**Automation / environment**

- `pwsh` is not on PATH in the Bash tool; use the PowerShell tool for
  `scripts/launch-chrome-debug.ps1`. The chrome-devtools MCP was healthy this
  session (the previous handoff's CDP workaround was not needed).
- **`emulate` ignores devicePixelRatio the way you expect** — pass target
  dimensions × 1.1 with `deviceScaleFactor: 1.1` to land on the intended CSS
  viewport (`reference_devtools_emulate_dpr`). 4224×2376×1.1 gives a true 3840
  CSS width.
- **Emulating a mobile viewport with `mobile,touch` reloads the whole app** (UA
  change). Poll for content before measuring or you screenshot the splash.
- **`/browse/<tab>` in the URL does not decide the rendered tab** — the browse
  module restores the last visited tab over it. I measured the Library twice
  believing I was on the gallery. Assert on `.library-split` presence (or click
  `button.section-button`) rather than trusting `location.pathname`.
- A naive back-button selector still matches a nav-rail button and navigates
  out of browse entirely. Scope selectors to `.drill` / the left pane.
