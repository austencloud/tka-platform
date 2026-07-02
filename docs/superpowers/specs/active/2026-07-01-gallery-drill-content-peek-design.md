# Gallery Drill — Content-Peek Visual Redesign

**Date:** 2026-07-01
**Status:** Approved (Austen: "go nuts")
**Surface:** `/browse/gallery` front door (`GalleryDrill.svelte`)

## Locked interaction model (unchanged)

Two-step drill ported from the legacy desktop app's InitialFilterChoiceWidget:
chooser (pick a filter category) → value screen (live counts) → filtered grid.
Search + "Show all" always available. "Explore by structure" advanced lane →
StartHere. This spec changes only the visual layer; the `GalleryDrill` props
contract (`pool`, `getCount`, `onApply`, `onShowAll`, `onSearch`) and the
BrowseModule wiring stay as-is.

## Design principle

Color/imagery carries data or it doesn't ship. Every visual maps to something
real:

| Visual | Data it carries |
|---|---|
| Thumbnail peeks on category tiles | Real sequences from that bucket (deterministic picks) |
| Level tile gradients | Canonical app-wide level coding (`DIFFICULTY_LEVELS`) |
| Density bars | Bucket size relative to the largest bucket on screen |
| Short + long thumb pair on the length tile | The length axis itself (thumbnail aspect scales with step count) |
| Six element dots on the structure lane | The six TnD families inside |
| 2×2 collage on Show All | First 4 sequences of the actual grid you land on |

2026 grounding: content-peek category tiles (Spotify genre cards / playlist
covers), monument numerals on value screens, counts as first-class density
bars, dark tonal surfaces with luminance borders. Skipped on principle:
ambient gradient orbs, drop shadows on dark, decorative asymmetry.

## Screen 1 — Chooser (fits 375×667, no scroll)

1. Search pill (existing behavior).
2. **By level** tile: dark tonal shell (1px luminance border, radius 18,
   overflow hidden). Left: title + "Beginner to advanced". Right: 3 real
   thumbnails — one per level, deterministic — fixed tilts (-8°/-2°/+6°),
   fanned, bleeding off the right edge. Each wears an 18px `DifficultyBadge`.
3. **By length** tile: same shell. Right: two peeks at equal height — one
   shortest-bucket (narrow box), one longest-bucket (wide box). Sub reads the
   computed truth, e.g. "4 to 16 steps".
4. **Show all** tile: "Show all N sequences" + 2×2 micro-collage of the first
   4 sequences in kinetic-alphabet order (the grid's default sort).
5. **Structure lane**: "Explore by structure" + 6 dots in `TND_ELEMENTS`
   accent colors. 44px target.

## Screen 2 — Pick a level

Per level tile: background = `DIFFICULTY_LEVELS[n].cssBg` (ice-blue / silver /
gold — the exact gradients on every difficulty badge and printed card), black
text per canonical config. Monument numeral (Cambria serif, same face as the
badge). "Level N" + density bar (fixed track, fill = count ÷ max bucket) +
tabular-nums count. One real thumbnail peek of that level. ≥72px tall.

## Screen 2 — Pick a length

Length has no canonical color → no fake one. Dark tonal rows (~60px):
monument step-count numeral (Cambria), "steps", density bar, tabular count.

## Motion

`<Crossfade>` primitive, `key={section}`, `DURATION.normal`. Content is cheap
(remount fine; thumbnails re-serve from memory/local cache). Reduced motion
owned by the primitive. Hover: border brightens + 1px lift. No idle animation.

## No layout shift

All peek boxes are fixed-dimension reserved boxes (thumbnails load into them;
`PropAwareThumbnail` letterboxes via object-fit: contain — never crops
meaning). Counts tabular-nums. Density tracks fixed width. Deterministic picks
mean the same thumbs every visit.

## Files

- **Rewrite** `src/lib/features/browse/gallery-home/GalleryDrill.svelte`
- **Create** `src/lib/features/browse/gallery-home/SequencePeek.svelte` —
  fixed-box tilted thumbnail wrapper (grep proof: no mosaic/collage/peek
  primitive exists; swept `mosaic|stack|collage|preview-grid`)
- **Create** `src/lib/features/browse/gallery-home/pick-representatives.ts` —
  pure deterministic pick fns (per-level rep, length pair, collage)
- **Reuse**: `PropAwareThumbnail` (eager), `DifficultyBadge`,
  `Crossfade`, `DIFFICULTY_LEVELS` (`$lib/shared/config/difficulty-styles`),
  `TND_ELEMENTS`, `resolveDifficultyLevel`/`resolveStepCount`,
  `sortSequencesByKineticAlphabet`
- **Delete** dead prior front door: `GalleryHome.svelte`, `ShelfRow.svelte`,
  `gallery-home-shelves.ts` (import-grep before delete)

## Perf

Chooser renders 9 eager thumbnails, level screen 3 — cloud-cached webp via the
existing orchestrator (max 3 concurrent renders on cold cache).

## Verification

DevTools :9222, iPhone SE 375×667: screenshots of chooser, level screen,
length screen; click-drill Level → grid + chip; back → counts reset. Desktop
pass. `npm run check` clean.

---

## v2 — AAA legacy port (2026-07-01, same day)

Austen: "read the legacy desktop app … we can make this a AAA port." Extended
the drill to the full legacy `FILTER_OPTIONS` catalog, keeping the newcomer
hierarchy: hero tier (Level / Length / Show all) unchanged; a "More ways to
browse" tier-2 mini-grid below it; structure lane last.

### Ported categories

| Legacy category | Web state |
|---|---|
| Start Letter | Letter grid of REAL TKA glyphs (`TKAWordGlyph`) + per-letter counts, canonical kinetic-alphabet order incl. dash variants — beyond legacy (it used text buttons) |
| Start Position | Alpha/Beta/Gamma tiles with the legacy diagrams (already in `static/images/position_images/`) + legacy descriptions verbatim ("Hands apart." / "Hands together." / "Hands form a right angle.") + density bars |
| Grid Mode | Diamond/Box tiles w/ legacy grid SVGs + descriptions; hidden while the catalog is single-mode (one-value pickers are dead ends) |
| Level (desc) | Legacy level descriptions added to the gradient tiles verbatim |
| Most Recent | Direct-apply mini ("Recently added · Last 30 days"), count-gated |
| Favorites | Direct-apply mini, count-gated (guests see none — honest) |
| Contains Letter | NOT ported — engine's contains = substring search; the search pill already is that |
| Author | NOT ported — community loader doesn't map `author`; would gate at 0 anyway. Revisit when the data lands |

Gating rule: a category mini renders only with ≥2 real values (single-value
categories) or count > 0 (direct-applies). Never a dead end.

### Canonical-source fixes shipped with the port

- `browse-filter.ts` `filterByStartingLetter`: dash variants ("W-", "Σ-") fell
  into the "A-D" range parser and no-op'd; now matched exactly, and a bare
  letter no longer swallows its dash variant.
- `browse-filter.ts` `filterByStartingPosition`: group fallback now derives
  alpha/beta/gamma from any position string (e.g. `gridPosition: "alpha3"`),
  not just the often-absent `startingPositionGroup`. Positions now partition
  the whole catalog (160+154+138 = 452 verified).
- `BrowseModule.svelte`: drill `onApply`/`onShowAll`/`onSearch` clear leftover
  user filters first — engine filters survive view remounts and silently
  compounded with the new pick (verified: stale "Level 1" + "Δ-" produced 5
  cards; post-fix pure "Δ-" = 19 cards, and value-screen counts match applied
  results exactly).
- `kinetic-alphabet-sort.ts`: exported `extractBaseLetter` for reuse.

### v2 verification

Runtime-verified on iPhone SE emulation: letter grid (46 letters, glyphs +
counts), position screen (legacy diagrams + bars), one-value grid-mode hidden,
"Recently added · 1" self-revealed, Δ- apply → 19 cards with a single active
chip, count↔result consistency. `check:fast` clean on every touched file.

---

## v3 — Creator category + count-pollution fix (2026-07-01)

- **Creator** fills the tier-2 second row (Austen: "one more thing in the
  second row"). It's the legacy Author category ported to the web data model:
  the `author` field is legacy tool attribution ("TKA Explore" ×356 / empty
  ×96 — census via galleryCache IndexedDB probe), while `ownerDisplayName`
  carries the real humans (Austen Cloud 424, Paul Langton 11, Elizabeth
  Dziadulewicz 8, Sky Guys Quest 6, Nina Salem 3). Added
  `BrowseFilterType.OWNER` + `filterByOwner` at canonical source; drill screen
  lists creators most-prolific first with density bars. Verified: apply
  "Paul Langton" → 11 cards, single chip.
- **Persisted-filter pollution fixed**: the engine restores persisted user
  filters on mount (`persistKey: "tka-browse-gallery"`), invisible on the
  drill but composing into every live count (Austen's session showed
  "MNO · 20 letters" instead of "ABC · 46"). BrowseModule now clears user
  filters + search at engine creation; sort/view/source persistence stays.
- **QR-less peeks**: SequencePeek forces
  `visibility={{ showQRCode: false, showMandala: false }}` — a baked QR is
  unscannable noise at 76px.

---

## v4 — Browse-all grid mobile top-tier pass (2026-07-01)

Austen (with mobile screenshots): "really not digging what I'm seeing here."
The grid spent ~350px of a 667px phone on FOUR stacked control bands before
any content, cards baked QR codes into a beat cell, variation pills sat
centered over pictographs, and search existed twice (toolbar + FAB).

Shipped (all shared-surface changes are additive props — picker consumers
unchanged):

1. **Back-into-toolbar**: `BrowseToolbar` gained `onBack`/`backLabel` (leading
   back pill; icon-only <520px); `BrowsePanel`/`GalleryTab` pass through;
   BrowseModule's dedicated "← Start here" band deleted. One band saved on
   every width.
2. **One chip row**: `BrowseFilterBar`'s duplicate "active filters" second row
   deleted. Selector chips (Level/Favorites/Length/LOOP) already display +
   control their filter; non-selector actives (drill picks: letter, position,
   owner, recent) + locked constraints render inline in the same row, with
   Clear all at the end. `BrowseToolbar`'s ≥900px inline filters got the same
   extra-chips + Clear all treatment (previously drill chips were invisible on
   wide containers).
3. **QR out of grids**: `allowQR` prop added to `PropAwareThumbnail` (gates
   `qrAllowed`), passed through `ChoreoCardThumbnail` +
   `VirtualizedSequenceGrid`; `BrowseGrid` passes `allowQR={false}` on all
   three render paths. QR stays in the viewer/export/share paths. Bonus: grid
   renders now share the guest cloud-cache key.
4. **Variation pill** moved bottom-center → bottom-right corner (was covering
   pictograph cells on 2-col mobile grids).
5. **Single search on mobile**: `hideToolbarSearch` — GalleryTab hides the
   toolbar search when its floating FAB + TKA notation keyboard is the entry.
6. **Result count** visible on mobile again (number keeps, word drops <520px).
7. **Grid gutters** tighten under 640px containers.

Verified (DevTools, iPhone SE + 1280px): mobile content starts ~110px (was
~350px), one toolbar + one chip row, QR-free cards, corner pills, single
search; desktop single-row toolbar with drill chips + letter rail intact;
runtime checks: 159 cards Level 1, back pill present, filter bar = 1 row,
search slot hidden with FAB present. `check:fast` clean on all touched files.

## v5 — Bottom-sheet filter pattern (2026-07-01)

Austen disliked the chip-toggle header ("Not a big fan of the chip toggles and
the spacing") and asked for the pattern name. Answer: the mobile bottom-sheet
filter (Airbnb/ASOS standard) — one Filters entry point with a count badge, a
sheet owning ALL selectors, and a slim applied-chips row on the grid.

1. **The sheet IS the drill.** `GalleryDrill` gained `variant: "page" | "sheet"`.
   Sheet variant drops search + the explorer lane and retitles to "Filter
   sequences / Counts update with your current filters." GalleryTab hosts it in
   a Drawer (bottom on mobile, right panel ≤480px on desktop), remounted fresh
   per open.
2. **Different apply semantics per variant.** Drill page pick = "exactly this
   slice" (clear, then add). Sheet pick = ADDITIVE (`engine.addFilter`, no
   clear) — `getFilteredCount` composing candidates with active filters turns
   from a drill bug into the sheet's live-count feature.
3. **Toolbar**: `onOpenFilters` renders a Filters pill (fa-sliders +
   `activeUserFilterCount` badge) and hides the inline selector chips;
   `BrowseFilterBar` gained `chipsOnly` (applied chips + Clear all only, at
   every width, zero height when nothing applied).
4. **FAB + VirtualKeyboard removed from gallery** (Austen: "we don't really
   need the magnifying glass and the virtual keyboard"). Toolbar search stays;
   VirtualKeyboard component itself kept (Spell/feedback/ExpandableSearchBar).
5. **Chip height fix**: global 44px button floor inflated the 16px chip-dismiss
   glyph → chips rendered 48px. Explicit `min-width/min-height: 16px` on
   `.chip-dismiss` (both bars); WCAG target lives on the `::before` 44×44 hit
   zone. Chip now 25px visual, tap zone unchanged.

Verified: sheet flows apply/dismiss correctly on iPhone SE; chip 48→25px with
44×44 hit zone intact (runtime style inspection); full `svelte-check` clean on
touched files.

## v6 — Structure filter + stackable loop components (2026-07-01)

Austen: "why can't I filter by length and then explore by structure?" Root
cause: "Explore by structure" was the StartHere taxonomy explorer (generated
alphabet seed cards — not a catalog filter, can't compose), and the sheet
pattern had hidden the only composable structure entry (LOOPFilterChip). Then:
"multiple loops can be possible for a sequence... both mirrored and inverted."
Catalog census (452): 67 sequences carry compound structures via `loopType`
strings (rotated_swapped 34, mirrored_swapped 22, inverted_rotated_swapped 8…)
parsed by the existing `parseLoopComponents` fallback.

1. **Structure category** in the drill (both variants): mini-tile with dots in
   the canonical loop-component colors (only components present in the pool);
   value screen rows carry `LOOP_COMPONENT_MAP` icon/color/description +
   component-tinted density bars. Applies the composable `cap_type` filter.
   Rotated splits halved/quartered exactly like LOOPFilterChip. Page lane
   renamed "Explore the alphabet" (it browses generated taxonomy, not the
   catalog — the old "Explore by structure" label caused the confusion).
2. **Loop filters STACK.** Engine `addFilter` keys LOOP_TYPE filters as
   `${type}:${value}` (every other type stays one-per-type); `applyFilters`
   reads type from the filter value, so stacked entries AND with zero filter-
   service changes. `removeFilter` is prefix-aware: `"cap_type"` clears the
   whole stack (LOOPFilterChip keeps single-select replace semantics),
   full composite key clears one. `allFilterChips` now carries each filter's
   map key; both chip bars key + dismiss by it.
3. **Sheet toggles in place.** Structure rows show active state (component-
   color border/tint + reserved-slot check, `aria-pressed`), tap again removes,
   sheet stays open, counts recompose live ("of the mirrored ones, how many
   also swap"). Zero-intersection rows drop out — no dead ends. New GalleryDrill
   props `activeLoopValues` + `onToggleLoop`; GalleryTab derives value→key from
   `engine.activeFilters` so the key scheme lives only in the engine.

Verified (DevTools, iPhone SE): Mirrored 44 / Swapped 66 → tap Mirrored →
Swapped recomposes to 22 → tap Swapped → both active, grid = 22 sequences, two
chips in canonical colors; dismissing the Mirrored chip alone → 66; reopened
sheet shows only Swapped active; untoggle works. 8-steps + Mirrored composition
= 8 results with two dismissible chips. Full `svelte-check`: zero errors in all
touched files.

## v7 — One browse grammar: Timing & Direction unification (2026-07-02)

The gallery had two machines wearing one surface. The drill browsed the saved
community catalog (pick value → filtered grid); the StartHere explorer browsed
the GENERATED canonical space (six TnD families → a screen organized by
blue/red turn knobs). Same card language, different grammar — and the turn-knob
screen felt "off" precisely because knobs organized the screen instead of the
data. Decision (Austen): unify on the drill grammar; turns become per-letter
depth, not a screen's organizing principle.

1. **`BrowseFilterType.TND_FAMILY`** — a real, composable, stackable catalog
   filter. `browse-filter.ts` derives each sequence's families per step from
   arc geometry (`deriveTnDFromPictograph`, WeakMap-memoized as
   `getSequenceTnDFamilies`) — contains-semantics: a sequence matches a family
   when ANY step classifies into it. No Firestore backfill needed; the planned
   `tndFamily` denormalization is now optional (client derives it live).
   Engine stacks TND_FAMILY under composite keys exactly like LOOP_TYPE.
2. **Drill "Timing & Direction" category** (page AND sheet): six family rows
   wearing element icon + accent + live count + tinted density bar; sheet rows
   toggle-stack (`activeFamilyValues`/`onToggleFamily`, mirroring LOOPs).
3. **AlphabetBand** (`gallery-home/AlphabetBand.svelte`): whenever a family
   filter is active, the grid pins the family's CANONICAL letters above
   community results — resolved from the base seed catalog at 0|0 only
   (`resolveTnDFamilyCards` gained `{patterns, seedId}` scoping; no more
   eager 49-combo resolution). Rendered via a new `aboveGrid` snippet prop on
   BrowsePanel (scrolls with the grid, shows even at zero community results).
4. **TurnExplorerModal** (`gallery-home/TurnExplorerModal.svelte`): tapping a
   canonical letter opens its defined 7×7 turn space — blue/red
   SegmentedControls + ONE live-rerendering card in a fixed slot (no 49-card
   wall, no layout shift), card tap → viewer. Lazy-loads one seed's matrix,
   caches per letter.
5. **StartHere retired.** `features/browse/start-here/` deleted (StartHere,
   ElementFamilyPicker, FamilyCardRow, state + test); GalleryDrill's
   `structure` section and the wrapper branch removed. One browse system.
   `/test/gallery-redesign` harness repointed at GalleryDrill → BrowsePanel.

Also shipped earlier in v6.x but previously undocumented: drill crossfade moved
to `fill` mode (fixed stage, per-screen scroll — no vertical stacking shift);
persistent Back bar outside the crossfade (constant position, visibility-
reserved); "Structure" renamed **LOOPs** ("Pick a LOOP type", stack hint); the
2026-07-01 multi-agent audit fixes (variationSource on virtualized grid, sheet
close-animation remount epoch, search-composed counts, position exact-match
guard, length fallback, 44px keyboard keys, aria-live filter announcements).

Verified (DevTools, 1600×1000 + iPhone SE): six family rows with live counts
(135/85/117/153/150/134 of 452); Split-Same → chip + "Split-Same alphabet" band
(A/B/C) + community grid (135); sheet intersection counts recompose live
(Split-Same ∧ Tog-Opp = 63 in sheet = toolbar count); both families stack with
two chips + two band sections; chip dismiss drops its band section (63 → 135);
turn explorer at rest: dialog 560×650 / slot 300×521 constant across combo
switches, card re-renders per combo, title = resolved word ("AAAA"). Full
`svelte-check` 0 errors 0 warnings; 9/9 node unit tests pass.

## v7.1 — Sloppiness fixes + session persistence (2026-07-02)

Austen's screenshot review of v7 ("idea was great, execution was slightly
sloppy") + his persistence directive drove four fixes:

1. **Explorer card clipped / QR noise.** The modal now has a definite height
   (`dialog.turn-explorer-modal { height: min(780px, 90dvh) }`) so the
   height-driven card chain (body flex → `.card-slot` flex → height-100%
   thumbnail with inline aspect-ratio deriving width) has something to resolve
   against — without it the 100% chain collapsed to min-content. Body
   `overflow: hidden`: a scrolling explorer means the card is clipped, which
   is the bug. `allowQR={false}` on the explorer card (reading surface; the
   viewer one tap away owns sharing).
2. **AlphabetBand box hugged.** `.band-section { width: fit-content;
   max-width: 100% }` + band `flex-flow: row wrap` — a 3-letter section no
   longer stretches an empty accent box across the whole panel; sections sit
   side by side when two families stack. Cards 176px, `allowQR={false}`
   (unscannable at that size = noise cell).
3. **Family row copy**: description = just the element ("Water"), not
   "The Water family".
4. **Gallery session persistence** (`browse/shared/services/
   gallery-view-persister.ts`, pattern: `sub-drawer-state-persister.ts`).
   sessionStorage records `{view, search}` (`tka_gallery_view`) + the drill
   sub-screen (`tka_gallery_drill_section`, page variant only — sheet always
   opens fresh). BrowseModule restores on mount: mid-`browse-all` → keep the
   engine's localStorage-restored filters + re-apply search; otherwise the
   existing fresh-drill wipe runs (`clearUserFilters` + empty search), so the
   "fresh drill counts" invariant holds for new sessions while reload/HMR
   lands you exactly where you were. GalleryDrill validates the stored
   section against its Section union (stale value → chooser). Filters
   themselves were ALREADY persisted by the engine — the bug was the module
   unconditionally wiping them on every remount.

Verified: full `svelte-check` — zero errors in all touched files (23 errors in
the log are other sessions' in-flight StepData-migration files). Browser
verification of explorer height + persistence deferred to Austen (parallel-
session HMR churn made DevTools reads unreliable; his call).

## v8 — Canonical T&D cards become first-class citizens (2026-07-02)

Austen killed the band one day after it shipped, for the right reason: *"we are
kind of treating them like a different kind of citizen here by giving them
their own special layout and their own special modal... there is a word that is
'AAAA', shortened to 'A', which is just like any of the other words in the
system... all of its variations of turn patterns could be explored via 1
variation picker which we already have access to. We don't need to create new
user interface stuff."*

**AlphabetBand + TurnExplorerModal DELETED. BrowsePanel `aboveGrid` snippet
reverted.** Replacement is pure data:

- `gallery-home/canonical-tnd-pool.ts` — resolves all six families × all 49
  turn patterns via `resolveTnDFamilyCards` (session-cached promise, rejection
  clears for retry), flattens each `SeedMatrix.byTurn` into normal
  `SequenceData`s with three overrides: unique per-combo id
  (`{seedId}__t_{safeTurn}` — token order matches ascending turns, so stable
  sorts and the variation grouper's id tiebreak put 0|0 first), `dateAdded` +
  `birthday` = **2022-03-27** (Austen: "that's when they came to me"), `level`
  = 1 at 0|0 / 2 for any turned combo (radial-only resolution; browse-filter
  reads `seq.level` first, so the level drill buckets honestly).
- Engine config gained `extraCommunitySequences?: () => Promise<readonly
  SequenceData[]>` — appended to the community pool asynchronously AFTER the
  loader's results (first paint never waits), deduped by id, guarded on
  `source === "community"` so a mid-resolve switch to my-library never
  pollutes the library view. BrowseModule passes `loadCanonicalTnDSequences`.

Everything else is emergent from existing machinery, zero new UI:
- Grid word-collapse (`dedupeByWord`) → one card per canonical word; JS sort
  stability + append order make 0|0 the representative face.
- Card tap → existing `VariationPickerDrawer` with the 49 combos (standard
  `handleViewDetail` path: >1 variations → picker).
- Word display simplifies "AAAA" → "A" via the existing
  `simplifyRepeatedWord` in PropAwareThumbnail.
- Search/filters/sorts/sections/counts all apply — family filter matches them
  (turns don't change TnD classification: same locations/timing), search "A"
  finds them, date sort clusters them at 2022-03-27.
- If a community save shares a canonical word, they merge into one card whose
  picker holds both — exactly the citizenship Austen asked for.

Count semantics: canonical variants count as sequences (~6 families' seeds ×
49), same as community variations do. The known toolbar-count vs collapsed-
cards discrepancy applies to them equally — still Austen's open decision.

Verified: full `svelte-check` — zero errors in all touched files (3 remaining
errors in log = other sessions' in-flight files). Runtime verification
deferred to Austen per his directive (parallel-session HMR churn; he checks).

## v8.1 — Variation grouping keys on the SIMPLIFIED word (2026-07-02)

Austen spotted two cards both labeled "G" that didn't merge: his community save
stores word `"G"` while the canonical seed stores `"GGGG"` — grouping keyed on
the raw word, the label shows the simplified word. Policy call (Austen):
*"grouping by the simplified word all the time is the way to go."*

- `variation-grouper.ts` exports `variationGroupKey(seq)` =
  `simplifyRepeatedWord((word || name).trim())` — the single canonical
  grouping key, identical to the card label. `groupByWord` buckets on it.
- All three grid-local lookups/dedupes now use it (shared `BrowseGrid`
  `getVariationsForSequence` + `dedupeByWord`, `VirtualizedSequenceGrid`,
  features `BrowseGrid`) — a raw-word `.get()` against the simplified-key map
  would silently orphan every collapsed variant.
- Generalizes: "ABAB" saves merge with "AB" saves (same material repeated,
  same label); palindromic halving ("ABBA" → "AB") follows the label too,
  since the simplifier is what the label wears.

Verified: full `svelte-check` 0 errors 0 warnings repo-wide; new
`variation-grouper.test.ts` locks the G-merge regression (6/6 pass, including
community-"G" + canonical-"GGGG" → one group, no "GGGG" bucket).

## v8.2 — Toolbar search retired from the gallery grid (2026-07-02)

Austen: the toolbar's magnifying-glass search entry is redundant now that the
drill is the front door. Removed from the GALLERY only:

- `GalleryTab` passes `hideToolbarSearch` to BrowsePanel (prop + plumbing to
  BrowseToolbar's `hideSearch` already existed). Other BrowsePanel hosts
  (pickers, collections) keep their toolbar search — scoped removal.
- The drill front door's search field is now the gallery's single search entry.
- **Search chip** added to BrowseFilterBar (chipsOnly mode only): an active
  query renders as a dismissible chip (magnifier glyph + query + ×) in the
  applied-filters row, same treatment as filter chips. Without it a drill-set
  search would be an invisible, unclearable filter on the grid. "Clear all"
  now clears the search too, and shows when only a search is active. Gated to
  chipsOnly because hosts with the toolbar input visible already show the
  live query there.
- `ExpandableSearchBar` stays (still used by non-gallery BrowsePanel hosts).

Verified: full `svelte-check` 0 errors 0 warnings repo-wide.

## v8.3 — Toolbar count into the Filters pill; drill-bar removed; sheet gains search (2026-07-02)

Austen's mobile screenshot review (iPhone SE):

1. **Bare "482" at the toolbar edge → INTO the Filters pill.** A floating
   number read as noise; on the button it means "482 behind this filter set,
   tap to tune". Pill = sliders icon + result count (tabular-nums,
   word appears ≥520px) + active-filter badge; sr-only live region keeps the
   count announced. Standalone `.result-count` now renders only for
   non-sheet-pattern hosts. Sliders glyph KEPT (magnifier promises typing;
   sliders is the honest filter affordance — search lives inside the sheet
   instead, see 3).
2. **Drill-bar deleted.** The persistent Back bar above the crossfade stage
   reserved ~44px on the chooser where Back doesn't exist — dead space
   shoving "How do you want to browse?" down on phones. Back now renders IN
   each value screen's header (`valueHead` snippet: 44px circular arrow —
   left column of a `44px 1fr 44px` grid, title stays truly centered, hint
   spans below). Same spot on every value screen, part of the crossfading
   layer, zero space on the chooser.
3. **Filter sheet gains the drill's search field.** GalleryDrill renders
   search whenever the host wires `onSearch` (was page-variant-only);
   GalleryFilterSheet wires it → `engine.setSearch` + close. With the
   toolbar search retired (v8.2), the sheet is the grid's complete
   find-surface; the applied query still surfaces as the dismissible chip.

Verified: full `svelte-check` 0 errors 0 warnings repo-wide.
