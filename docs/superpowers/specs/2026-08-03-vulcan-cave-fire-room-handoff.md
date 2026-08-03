---
status: active
value: 4
effort: L
remaining: 'Water room (Drowned Gallery Ring) PASSED the eye-level gate 2026-08-03. Next: the Fire room graybox, same process. Water follow-ups ranked below the Fire start.'
depends_on: 'docs/superpowers/specs/2026-08-03-drowned-gallery-ring-flow-design.md'
plan_path: ''
tags: [museum, handoff, fire-room, drowned-gallery]
last_triaged: 2026-08-03
---
# Vulcan Cave — Water room SHIPPED, Fire room next — Handoff (2026-08-03)

## Mission

The Vulcan Cave wing is being built room by room as walkable grayboxes with a
hard gate: Austen approves layout/flow/scale at eye level BEFORE any art
spend. The Water room ("The Drowned Gallery", Ring flow v2) **passed that
gate on 2026-08-03** — Austen: *"I'm going to go ahead and give this a
passing grade... it really does indeed communicate to me what the experiences
may be like once we actually start putting in better models."* The next
deliverable is the **Fire room** (`cave-fire`) taken through the same
process. Water's design spec:
`docs/superpowers/specs/2026-08-03-drowned-gallery-ring-flow-design.md`;
overall room/roster canon:
`docs/superpowers/specs/backlog/2026-08-02-vulcan-cave-water-room-drowned-gallery-design.md`
(19-performer roster, per-room letter map — Fire's letters are listed there;
read it, don't trust memory).

## Done — verified

- **Ring graybox v2 built by an Opus executor** (`df52cef9bf` P1–P5,
  `1e7ea136d3` P6, `56e5d337f9` ledger): sump + corridor replaced by
  `cave-water-gallery` (13.5 × 24 m S-path, floor −4.5, rock roof −1.9 which
  is BELOW the −1.5 waterline → no visible surface), surfacing stair with
  landing at −3.1 (surface break happens ON it, derived from eye math),
  grotto ring (center-south arrival, channel, procession walkway past
  A/B/C at 5–6 m, carved threshold, Fire exit), seeded bloom (plants + fish
  stand-ins). Evidence: my own re-run `npx vitest run tests/unit/museum/` →
  21 files, **218/218**; `npm run check` (executor's captured run) → 0/0;
  longest contiguous submerged walk **28.85 m** asserted with the submersion
  trigger's own arithmetic (`y + 0.75 < −1.5`).
- **Engineering invariants from the cold reviews are IN the build**: door
  gaps derived from real door tiles (no `DOOR_GAP`), one geometry source
  (layout drives terrain zones AND graybox AND performer anchors),
  `elevationAt` throws in dev on uncovered in-bay points, coupling tests
  (rendered-vs-walkable floor coverage, door coverage, neighbor elevation
  sweep, ring circuit, blocked-edge probes). Evidence: the tests exist in
  `tests/unit/museum/drowned-gallery-traversal.test.ts` and pass.
- **Lighting fix** (`803ff4d792`): executor sized intensities 2–4 against
  `decay={2}` (quadratic falloff) → grotto read near-black. Intensities now
  ~target·r²; 12th light added at the descent mouth. Evidence: before/after
  browser frames read in-session — arrival apron now shows the three doubled
  firelight streaks; bloom/landing/stair frames legible.
- **Browser walk at 1920** (frames read in-session, not saved): descent,
  bloom (glowing plants + fish school in an enclosed submerged tube — the
  build's best frame), landing (warm risers, surface break), apron arrival
  (symmetric doubling), procession (defect — see loose end #2).
- **Cold-review corpus committed** (context for Fire too):
  `2026-08-02-drowned-gallery-cold-review-opus.md` (40 findings, browser),
  `2026-08-02-drowned-gallery-cold-review-codex.md` (44 findings, geometry
  math), synthesis `2026-08-02-drowned-gallery-aesthetic-push-plan.md`.
  The Ring design + executor plan: `2026-08-03-drowned-gallery-ring-flow-design.md`,
  `docs/superpowers/plans/2026-08-03-drowned-gallery-ring-graybox.md`
  (ledger closed, 7 recorded deviations), plan sheet
  `static/sketches/2026-08-03-drowned-gallery-ring-plan.html`.

## Believed done — unverified

- Nothing material. (The executor's full `npm run check` 0/0 predates my
  lighting commit; the component compiled and rendered under HMR afterward —
  runtime evidence, but the next full check will confirm formally.)

## In flight

- Nothing uncommitted from this workstream. The checkout carries MANY other
  sessions' dirty files (shop, CAPS, notation, agent-hub...) — do not touch,
  stage, or revert them. `main` has many unpushed local commits from several
  sessions; do not push without confirming ownership of every one.

## Loose ends (ranked)

1. **Fire room graybox** — the next deliverable. Process that worked for
   Water (follow it): brainstorm with Austen (gate: `brainstorming-gate.md`)
   → HTML plan sheet in `static/sketches/` (he loves these; see the Ring
   sheet for format) → design doc + executor plan → ONE Opus executor →
   audit + browser walk → his eye-level gate. Fire today: wing `cave-fire`
   in `vulcan-cave-floor-plan.ts`, entered through the grotto's east door
   (world z 21–23 on the grotto's east wall — the Ring delivers visitors
   there through the carved threshold). Check the design spec's roster for
   Fire's letters/performers. Note `CAVE_MODE_ROOMS`'s fire entry still uses
   the old single `performerId`/`sequenceId` shape — the Water entry was
   migrated to `performerIds`/`sequenceIds` arrays; migrate Fire's the same
   way when touching it.
2. **Water: procession niche read** (top Water defect, small): from the
   procession walkway the niches/performers above the channel reflections
   barely read. Geometry + anchors are correct; the niche lighting/presence
   isn't. Candidates: raise niche light y, add glyph-disc emissive presence,
   light the niche back wall. Austen passed the gate anyway — this is
   polish-tier, not gate-tier.
3. **Water: Phase-2 shell requirements** are collected in
   `2026-08-02-drowned-gallery-aesthetic-push-plan.md` (dome vault numbers,
   black-mirror water, niche depth, waterfall-as-water, light hierarchy).
   Blender-first per `blender-first-3d-scenes.md`. Not started; gated on
   Austen scheduling Phase 2.
4. **Money-shot choreography note**: first air lands on the stair landing,
   the doubled-firelight reveal ~3 s later at the crest (upper flight blocks
   it). Reported to Austen before his pass; treat two-beat emergence as
   accepted unless he says otherwise.
5. **Orphaned `cave-water-seq` movement data** kept in the floor plan
   (executor deviation #7) — harmless; delete when convenient.

## Decisions already made (Austen)

- **2026-08-03: Water gate PASSED** (quote in Mission). Graybox communicates
  the experience; next models come later.
- **2026-08-03 Ring design decisions**: submersion is sacred and REAL (~30 m
  walked underwater, no sign of air); walk-the-bottom locomotion (no swim
  controller); cave-native underwater life only (no reef/tropical — standing
  since 2026-08-02); close reads via procession-across-channel; performers
  stay unreachable (pool/channel as barrier); gate reworked as carved
  threshold. Full record in the Ring design spec.
- **Budget discipline (2026-08-02, still standing)**: no fan-outs/panels for
  execution — one Opus executor per phase ("half the price"); Fable does
  synthesis + visual verification. Cold-review panels only for wide-open
  decisions (the two-reviewer cold review was Austen's explicit ask).
- **Graybox-first with hard gates** — his explicit process after a prior
  beautiful-spec/disappointing-3D experience.
- **Meshy-via-Codex asset workflow** speced for Phases 2–4, deliberately not
  started.

## Gotchas

- **Teleporting the player**: synthetic KeyboardEvents do nothing. Use
  `navigate_page` with `initScript` setting
  `sessionStorage.setItem("museum-cave-3d-state-v1", JSON.stringify({playerWorldX, playerWorldZ, viewMode:"first-person", topDownHeight:12, playerYaw}))`
  — a plain `setItem` + `location.reload()` from `evaluate_script` can lose a
  race against the app's own persist-on-unload. Yaw: north = π, east = π/2,
  `atan2(dx, dz)`. Wait for the text "Click to look around" after each
  reload, never on the loading percent (it sits at 93% for a while).
- **Graybox lights use `decay={2}`** — an intensity that must read at r
  metres needs roughly target·r². Values of 2–4 are invisible beyond ~2 m.
  This bit the Opus executor; it will bite the Fire build too.
- **Rect geometry convention**: layout rects cover tile-CENTERED cells
  (executor deviation #5). The physics provider looks tiles up with
  `Math.round(world / 0.5)` — rects built as `[tileRef, tileRef+0.5]` put
  walkable tile centers exactly on blocked edges and the walk wedges. Copy
  the Water layout's cell math for Fire.
- **`suppressedSpans` heuristic** (`museum-geometry-builder.ts` ~line 465):
  tile suppression between suppressed wings uses bounding boxes of every
  PAIR of suppressed wings. Water's three wings already cover a huge box; if
  `cave-fire` also gets `suppressTileGeometry`, check nothing outside it
  loses its tile floor silently.
- **Removed wing**: `cave-water-sump` no longer exists; a regression test
  asserts its absence. Route is squeeze → approach → gallery → grotto → fire.
- **Eye math**: eye = floor + 0.85 (physics STANDING_Y) + 0.75 (camera) =
  floor + 1.60. The submersion trigger is `position.y + 0.75 < waterlineY`.
  Any "the player sees/is under X" claim must use these numbers — a wrong
  landing depth shipped once already because of it.
- **Browser**: shared instance only via
  `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`;
  own tab, `emulate` per viewport, webp/70, close only your tab. The test
  route has no audio (expected). One svelte-check machine-wide; check free
  RAM ≥ 4 GB before heavy spawns (`resource-budget.md`).
- **Commits**: explicit pathspec ONLY (`git commit -m "..." -- paths`); the
  index is shared with parallel sessions. New files need `git add <paths>`
  first (pathspec commit alone doesn't pick up untracked files).
