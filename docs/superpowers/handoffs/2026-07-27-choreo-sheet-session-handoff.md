# Choreo Sheet — annotations, reading view, HMR recovery, playback highlight (handoff)

**Date:** 2026-07-27
**Branch:** `main` (everything below is committed AND pushed to `origin/main`)
**Picked up from:** `docs/superpowers/specs/2026-07-26-choreo-mcp-and-performance-variants-handoff.md`
**Design spec written this session:** `docs/superpowers/specs/2026-07-27-choreo-reading-view-design.md`

---

## Mission

This session picked up the 2026-07-26 Choreo handoff and executed its first move
— fixing annotation addressing — then took three follow-on pieces of work Austen
asked for directly: a phone reading view, a dev-loop reliability fix, and the act
playback highlight.

The through-line: **annotations used to be addressed relative to the print
layout.** Fixing that to absolute step indices is what made everything after it
possible — a mobile view that re-chunks the sheet, and a playback highlight that
maps the act's step onto a cell.

The 2026-07-26 handoff's moves #2–#5 (the MCP act-control surface and Part 2
performance variants) are **untouched**. See Loose ends.

---

## Done — verified

Test commands below all use the project config. `npx vitest run` without
`--config tests/config/vitest.config.ts` runs a DIFFERENT, jsdom-less config and
produces bogus failures — that cost time this session, don't repeat it.

### 1. Cues and notes address an absolute step — `67d4ca3103`

Annotations stored `band` (`"sequenceId:rowInSequence"`) plus, for notes, a
`count`. Both are functions of `layout.columns`, so changing pictograph size
re-chunked every band and re-pointed every annotation: a note pinned to step 12
silently became a full-width bullet, and a BPM-prefilled cue kept a timestamp
computed for a different step.

Now `CueMark` / `NoteMark` carry `{ sequenceId, stepIndex }` and the planner
derives `(band, count)` at render time. Legacy docs convert on load in
`toSheet()` using `doc.layout.columns` — the saved layout is the only surviving
record of the width the annotations were written against, so the conversion is
exact. New module: `src/lib/features/write/domain/annotation-migration.ts`.

Scope note: Austen approved widening this from notes-only to **notes + cues, one
migration** (see Decisions).

**Evidence:**
```
npx vitest run --config tests/config/vitest.config.ts \
  tests/unit/sheet-annotation-migration.test.ts tests/unit/sheet-band-planner.test.ts
```
Browser-verified on the real harness: a note at `stepIndex 4` resolved to
band 0/count 5 at 8 columns, band 0/count 5 at 6 columns, and band 1/count 1 at
4 columns — the same pictograph every time. Under the old scheme it unpinned.

### 2. Duplicate-roster crash — same commit `67d4ca3103`

Found while verifying the above. A roster may legitimately list the same
sequence twice; `bandKey(sequenceId, row)` collided for those two rows and the
keyed `{#each}` over bands threw `each_key_duplicate`, which **killed the
reactive update and froze the preview mid-render**. That is why column switches
appeared to do nothing.

`bandKey` now leads with the roster index. Free to change because after change #1
band keys are purely derived — nothing persisted depends on the format.

**Evidence:** `tests/unit/sheet-band-planner.test.ts` →
"gives the same sequence listed twice DISTINCT band keys". Console error captured
live before the fix, gone after.

### 3. Phone reading view — `fffbe0f5f7`

Every size in the page preview derives from `--pt: 100cqw / pageWidthPt`, so a
landscape letter sheet at 375px rendered **32px pictographs and 3.6–4.2px text**
(measured, not estimated). Uniform scaling IS the model, so it had to reflow.

New `SheetReadingView.svelte`: bands stacked vertically, sized in rem, 4
pictographs across on a phone / 8 once there is room. Toolbar `SegmentedControl`
(Reading | Page); phones default to Reading, desktop to Page; an explicit choice
persists to `localStorage` key `tka-choreo-view-mode` and **never touches
`sheet.layout`** (that is the print model).

`buildBands` was split out of `planBands` so chunking + annotation placement keep
exactly one implementation across both surfaces.

**Evidence:** `tests/unit/sheet-band-planner.test.ts` asserts
`buildBands(x) === planBands(x).flatMap(p => p.bands)`. Measured in-browser at
375: 79px cells, 16px inputs, no horizontal overflow, all touch targets ≥44px.
Screenshotted at 375 / 820 / 960×412 (Reading) and 1440 / 1920 / 2560 / 3840
(Page). Full detail in the design spec.

### 4. HMR no longer parks the sheet behind "Try again" — `b87b42c6bc`

Austen's report: *"sometimes when I hot module reload it suddenly goes back to
that screen where it says it cannot figure out how to load them."*

The resolver retries a failing row 3× over ~6s. An HMR can tear down the
Firestore connection or auth module for longer, and any row still failing when
the ladder runs out sticks in `error`. Because `planRows` is complete-or-empty,
**one** such row blanks the whole sheet.

Dev-only auto-retry in `choreo-sheet-state.svelte.ts`
(`DEV_AUTO_RETRY_LIMIT = 5`, `DEV_AUTO_RETRY_DELAY_MS = 2500`), triggered by the
failure landing rather than by the HMR event. `missing` is never auto-retried —
that is the server saying the doc is gone.

Also: `library-repository.getSequenceStrict` no longer swallows `hydrate()`
failures silently. It returns the un-hydrated document, which has NO steps and is
downstream indistinguishable from a genuinely empty sequence.

**Evidence:** `tests/unit/choreo-sheet-roster.test.ts` → 3 new tests (recovers,
never retries `missing`, bounded). Reproduced live against the real act by
injecting an unresolvable id into the `tka-choreo-sheet-draft` localStorage
draft: sheet went blank with *"The read didn't get through"* and `pages: 0`, then
logged `dev auto-retry 1/5, 2/5, 3/5` and recovered on its own.

### 5. Act playback highlights the playing pictograph — `68aa0c21a4`

`SheetCell` now carries `actStepIndex`. `buildActSequence` is a literal in-order
concatenation and `planBands` already tracked `firstBeatIndex` (running step
index across the sheet), so the two numberings were already the same one — this
writes it onto the cell. `AnimationPlayer` already reports the playhead via
`onStepChange`; `ActPlayer` forwards it. Highlight reuses the viewer's amber
language from `sequence-viewer/components/PictographCell.svelte`.

**Evidence:** `tests/unit/sheet-band-planner.test.ts` pins cell `actStepIndex` to
`buildActSequence`'s indices across BOTH the flow and band branches. Verified
live with index math twice: player at step 18 lit the 2nd cell of page 2 (page 1
holds act indices 0–15), and at step 11 lit the 7th cell of a row spanning 4–15.
Exactly one `.act-current` throughout; play / pause / close all correct.

### Suite state

```
npx vitest run --config tests/config/vitest.config.ts \
  tests/unit/sheet-*.test.ts tests/unit/choreo-sheet-*.test.ts
→ 11 files, 108 tests, all passing (2026-07-27)

npx svelte-check --threshold error → 0 errors
```

---

## Believed done — unverified

- **Reading view has never been tested on a real iPhone SE**, only a 375×667
  emulated viewport with `deviceScaleFactor: 1`. Real iOS Safari differs on
  input focus-zoom (inputs are 16px so it should not zoom) and on the URL bar
  eating viewport height. Worth one real-device pass.
- **The dev auto-retry has not been observed repairing an actual HMR failure.**
  It was proven against a synthetic stuck row (injected bad id). I never
  reproduced Austen's original HMR failure on his 6- or 13-sequence acts — a
  3-sequence act survived repeated HMRs cleanly. If he still sees a blank sheet
  after a hot reload, the underlying teardown is still unidentified; instrument
  `resolveSequence` outcomes rather than assuming the retry covers it.
- **PDF export was not re-run** after the annotation change. The exporter reads
  the planner-resolved `count` like the preview does, and its unit tests pass,
  but no actual PDF was generated and opened this session.

---

## In flight

Nothing of mine. All five changes are committed and pushed to `origin/main`.

The working tree is dirty with **other sessions'** work — notably
`src/lib/shared/notation/qft/` and `src/routes/test/qft-notation/` (untracked),
`src/lib/shared/auth/domain/*` (a `getMaxBeats` → `getMaxSteps` rename), and
`.agents/skills/fb/*` vs `.claude/skills/fb/*` mirror drift. Do not commit any
of it. Full-suite failures in `landing-route-morph`, `library-*`,
`mandala-overlay-guide-crossfade`, `notation-qft-diagram-contract` and
`codex-skill-sync` all belong to that work — verified none of those files import
anything from `features/write`.

---

## Loose ends (ranked)

1. **Adjacent pinned notes overlap in the PAGE view.** `.pin`
   (`SheetPreviewPages.svelte:1244`) has no width cap, so a default-width input
   plus the 44px remove button measures 239px against a ~140px column stride —
   notes on adjacent counts overlap by ~100px at 1920. Pre-existing, and I chose
   not to widen scope again. A correct fix must cover `sheet-pdf-exporter.ts`'s
   text drawing too, or preview and paper diverge. The reading view sidesteps it
   structurally (notes are a list).
2. **The 2026-07-26 handoff's moves #2–#5 are untouched:** decide the
   headless-vs-live MCP fork (that handoff recommends headless), stand up
   `mcp-server/src/tools/act-tools.ts`, then export/render, then performance
   variants. Part 2 of that doc is a design sketch and explicitly wants a
   brainstorm before speccing.
3. **Reading view has no print path**, by design — Page owns that. If someone
   asks to print what they see on a phone, that is a real decision, not a bug.
4. **`pictograph-cloud-cache` negative cache is still session-scoped** (carried
   over from the 2026-07-26 handoff, still true). Every reload re-probes the same
   un-warmed hashes → the 404 burst in the console.

---

## Decisions already made

- **Notes + cues in one migration** (Austen, 2026-07-26). I found cues had the
  identical band-relative defect and asked whether to widen scope; he chose
  covering both with a single migration rather than notes-only plus a second
  migration later.
- **Reading view is editable, not read-only** (Austen, 2026-07-27). I recommended
  read-only for simplicity; he chose editable.
- **4 pictographs across on a phone** (Austen, 2026-07-27), from a rendered
  comparison at 64/83/96/113px. 4 also chunks 4/8/16-step sequences without a
  ragged last row.
- **The View toggle exists at all widths**, not phone-only (Austen, 2026-07-27),
  so the reading view is inspectable on desktop.
- **Pausing keeps the playback highlight.** Austen asked for it to work "just
  like it normally does when we are doing playback in the sequence"; the viewer
  keeps its highlight when paused and clears only at the start position, so the
  sheet matches.

No expert agent in `.claude/rules/expert-routing.md` owns choreo-sheet canon
(the table covers arrows, props, TKA domain, decks, feedback, releases, audits),
so no expert `.md` needed updating for this work.

---

## Gotchas

- **Run vitest with `--config tests/config/vitest.config.ts`.** Without it you
  get a config with no jsdom and a pile of fake failures (`localStorage is not
  defined`, roster tests failing). This wasted real time this session.
- **`resize_page` could not go below ~500px** on the DevTools MCP setup here —
  Chrome enforces a minimum OS window width. Use
  `mcp__chrome-devtools__emulate` with `viewport: "375x667x1,mobile,touch"` for
  a true small viewport. `emulate` also resets page state, so re-drive the
  harness after changing it.
- **`list_console_messages` returned nothing** on the /choreo page even for an
  explicit `console.info`. Hook `console` in-page and collect into a global
  instead.
- **The act player and the music player both expose Play/Pause/Stop buttons.**
  I drove the music transport by mistake and got meaningless results. Filter by
  bounding box — the animation transport sits around y≈600–750, the music host
  near the bottom of the dock.
- **HMR'ing `ChoreoSheetView` remounts it**, so its builder is recreated and rows
  restart as `loading`. That is why retrying on `vite:afterUpdate` does NOT fix
  the stuck-row problem — I built that first, instrumented it, confirmed it
  fired, and found it mistimed. The trigger has to be the failure landing.
- **The public sequence fixture has duplicate ids.** `test/choreo-sheet` loads 8
  public sequences and two of them share `seq_1778552156088_6ifod02as`. A note on
  one shows on both — correct behavior (it describes the sequence), but it will
  look like a bug if you don't know.
- **The reading view's column count is a PROP, never a media query.** A CSS-only
  override leaves a 4-cell band sitting in an 8-track row. The caller owns the
  count and rebuilds bands when it changes (`ChoreoSheetView.svelte:636`).
- **Note badges in the reading view show the STEP NUMBER**, not `count`. `count`
  is a within-band column that changes with the column count; a badge reading "1"
  beside a pictograph labelled "5" is worse than no badge. I shipped that bug
  first and caught it on screen.

---

## Files that matter

```
src/lib/features/write/
  domain/types/choreo-sheet.ts            CueMark/NoteMark (stepIndex), bandKey
  domain/annotation-migration.ts          NEW — legacy band+count → stepIndex
  domain/sheet-page-layout.ts             geometry + railLineHeightPt
  services/sheet-row-planner.ts           buildBands / planBands / actStepIndex
  services/sheet-pdf-exporter.ts          reads the same resolved count
  services/choreo-sheet-repository.ts     migration runs in toSheet()
  state/choreo-sheet-state.svelte.ts      readingBands, dev auto-retry
  components/sheet/ChoreoSheetView.svelte view mode, actStepIndex, columns seam
  components/sheet/SheetReadingView.svelte NEW — the phone view
  components/sheet/SheetPreviewPages.svelte page preview + act highlight
  components/sheet/ActPlayer.svelte        forwards onStepChange

src/lib/shared/library/services/library-repository.ts   hydrate() now logs
src/routes/test/choreo-sheet/+page.svelte               harness: seed, cols, mode
tests/unit/sheet-band-planner.test.ts                   planner + act alignment
tests/unit/sheet-annotation-migration.test.ts           NEW
tests/unit/choreo-sheet-roster.test.ts                  + dev auto-retry
```
