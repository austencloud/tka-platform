---
status: handoff
value: 4
effort: M
remaining: 'Earth room graybox built and walkable; ONE open defect — the pit renders pure black from the rim (sampled 0,0,0) with the sightline proven clear. Diagnosis narrowed, cause not found.'
depends_on: 'docs/superpowers/plans/2026-08-04-earth-canyon-graybox.md'
plan_path: 'docs/superpowers/plans/2026-08-04-earth-canyon-graybox.md'
tags: [museum, vulcan-cave, earth-room, graybox, handoff]
last_triaged: 2026-08-05
---
# The Earth Room (Canyon Overlook) Graybox — Handoff (2026-08-05)

## Mission

Build the third authored Vulcan Cave bay: a grass gully that turns once and
opens onto a canyon rim, with three Tog-Same performers (GGGG / HHHH / IIII) six
metres below on a floor there is no way down to, a fallen slab cantilevered over
the drop, and shelves receding north into haze. Exit south to Air.

- Plan (all four phases, with the ledger I filled in):
  [2026-08-04-earth-canyon-graybox.md](file:///E:/tka-platform/docs/superpowers/plans/2026-08-04-earth-canyon-graybox.md)
- Design (station table, section profile, sightline math — authority):
  [2026-08-04-earth-room-floor-plan-draft.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-04-earth-room-floor-plan-draft.md)
- Reference implementation for every pattern: the Fire build
  (`first-fire-layout.ts`, `FirstFireGraybox.svelte`, `first-fire-*.test.ts`).

**The room's entire thesis is the overhead read** — three figures performing
together, seen from above, across a barrier that is a vertical drop. If that
frame does not land, nothing else about the room matters. It does not land yet.
See Loose end #1.

## Done — verified

All work is on `main` in the primary checkout `E:/tka-platform`. Every claim
below carries the command and its actual result.

### `d462b23c06` — layout, floor plan, terrain, performers, tests (P1 + P3)

- New `src/lib/features/museum/data/earth-canyon-layout.ts`: gully (mouth ramp →
  north-running bend → lower run), rim ring, parapet, slab overlook, void,
  floor disc, three bosses, canyon shelves, exit ramp. Every rect derived from
  compiled wing bounds and real door tiles; no absolute world coordinates.
- **`Disc` is the new shared circle primitive** (`center`, `radius`, `inDisc`).
  `blockedAt`, the floor-rect rasteriser and the graybox all read the SAME
  records — there is no rect approximation of a circle anywhere.
- `vulcan-cave-floor-plan.ts`: `cave-earth` resized to `minInteriorWidth: 45 /
  minInteriorHeight: 32` (compiles to **34 × 24 m** interior),
  `suppressTileGeometry: true`, west door `fireToEarth` (`center`), south door
  `earthToAir` (`end`), layout-driven performer anchors, third bay wired into
  `composeCaveTerrain`.
- `museum-exhibit-sequences.ts`: `cave-earth-seq-g/-h/-i`, transcribed VERBATIM
  from `static/data/hero/tnd-base-words.json` (`tnd-tog-same-gggg/-hhhh/-iiii`),
  4 steps each plus a leading β static step. `CAVE_MODE_ROOMS` and
  `museum-room-content.ts` migrated to three-element arrays.

Evidence: `npx vitest run tests/unit/museum/` → **25 files, 268 passed** at that
commit (271 now, after the fix commit added 3 more).

### `a828740e57` — graybox component + light plan (P2)

- New `src/lib/features/museum/components/game/EarthCanyonGraybox.svelte`,
  mounted in `Museum3DScene.svelte` behind `hasEarthCanyon`. Renders only from
  `buildEarthCanyonLayout(grid)`.
- Evidence: `npm run check` → **`svelte-check found 0 errors and 0 warnings`**.

### `202a500908` — sightline fixes found by the browser walk

Three separate, independently proven causes of "the pit does not read":

1. **Rock fill stood across the slab approach.** `subtractTiles` only carves a
   tile whose WHOLE cell sits inside one hole rect; the slab and exit rects come
   off metre offsets that miss tile-cell boundaries. Three blocks survived and
   rendered from y −8.4 to +3.6 — a 12 m wall in front of the viewing line.
   Evidence (runtime dump of `layout.rockFill`, before): blocks at
   `x[103.75,108.25] z[18.25,18.75]`, `x[103.75,104.25] z[18.75,19.25]`,
   `x[107.75,108.25] z[18.75,19.25]`. After the fix the same dump reports
   `rockFill 5, in chamber: 0`.
2. **The daylight shaft stood 0.4 m from the eye.** The apron sits 6.45 m from
   the void centre; I had widened the column to r = 6, so its translucent
   DoubleSide wall was inside the visitor's face. Evidence: a scene raycast
   pitch sweep from the apron eye returned `daylight-shaft` as the FIRST hit at
   every pitch from −0.35 to −1.16, colour `eaf2ff`, distance 0.4–1.0 m. Radius
   is now derived in the layout (`avenShaftRadius`, 1.5 m apron clearance) and
   the material is BackSide.
3. **The slab nose was a level 2 m tongue at apron height** — exactly where the
   eye→boss line crosses apron level (~0.5 m out). It now falls away to
   `SLAB_NOSE_OUTER_Y` (−4.5).

Also in this commit: rock palette darkened (the rim was blowing out and crushing
the pit), canyon shelves pushed back to 9/19/33/52 m, darkened and grounded to
−46 so they read as masses not sheets, gully bend given cue lights at both ends
and at the turn.

Evidence, current `main`:
- `npx vitest run tests/unit/museum/` → **25 files, 271 passed**
- `npm run check` → **`svelte-check found 0 errors and 0 warnings`**

Three regression tests added in `tests/unit/museum/earth-canyon-terrain.test.ts`
so none of the three can come back:
`"puts no rock fill inside the chamber"`,
`"leaves the sightline from the slab apron to every boss unobstructed"`
(walks eye→boss in 0.1 m steps against rock, walls, parapet, lip and the tilted
nose), `"keeps the daylight column clear of the slab apron"`.

## Believed done — unverified

- **The room reads as green, not as Fire's basalt.** Gully grass tufts,
  wildflower flecks and the green fill lights exist and typecheck, but I never
  got a clean first-person frame of the gully to judge it. Needs a walk from
  Fire's east door east through the bend.
- **The canyon shelves read as receding depth.** Repositioned and re-toned on
  reasoning, not on a frame. The design itself flags this as a look-at-it
  question (risk 6).
- **The 0.90 m parapet's 8.5° sightline margin at eye level.** Asserted
  arithmetically in the terrain test; never confirmed with a frame from the
  standard rim, because of Loose end #1. This is the specific thing the graybox
  gate exists to confirm.
- **Exit ramp and Air handoff at datum 0.** Tests assert
  `elevationAt(door) ≈ 0` and the traversal walks it, but no human has walked
  Earth → Air.

## In flight

Nothing uncommitted. `git status --short src/lib/features/museum tests/unit/museum`
returns clean.

Branch: **`main`**, primary checkout `E:/tka-platform`. All three commits are
ancestors of HEAD (verified with `git merge-base --is-ancestor`). Other sessions
have committed on top since; the newest Earth commit is `202a500908`.

**`main` is 71 commits ahead of `origin/main` and unpushed.** That backlog is not
mine and I did not push it. Do not force anything; check with Austen before
pushing a batch that size.

## Loose ends (ranked)

### 1. The pit renders pure black from the rim — START HERE

This is the room's whole purpose and it is unsolved. Do not polish anything else
until this is closed.

**Symptom.** From the slab apron (`106, 17.9`, yaw π, pitch −0.85) the void
region samples exactly `0, 0, 0` in the framebuffer while the rim beside it
reads `61, 66, 66`. Not dim — *nothing drawn*.

**Already ruled out, with evidence — do not re-run these:**

- *Occlusion.* After the three fixes, a scene raycast from the apron eye reaches
  `floor-disc` at 10–14 m and `boss-ring-inner-1` at 8.7–9.2 m across the middle
  of the frame. The sightline is clear.
- *Lighting reach.* Boosting the in-pit point lights to 4000 floods the entire
  frame white (through bloom), so the lights unquestionably reach those
  surfaces. At 320 the pit is still `0,0,0`, which is not a falloff curve.
- *Fog.* Scene is `FogExp2`, density ~0.076, colour `#1a1008`, driven by the
  atmosphere system (it overwrites direct writes — install a getter to pin it).
  Forcing 0.012 changes nothing.
- *Frustum culling, visibility, material state.* Checked live: `visible: true`,
  `frustumCulled` toggled off, world scale `[14, 0.3, 14]`, layers mask 1
  matching the camera.
- *A `MeshBasicMaterial` magenta disc with `depthTest: false`,
  `renderOrder: 999`, `fog: false`, `toneMapped: false`, `frustumCulled: false`
  STILL samples `0,0,0`.* That combination draws over everything, so the mesh is
  not being submitted to the renderer at all.

**Where I would look next.** The evidence points away from my component and
toward the render path: a second scene/composer pass, an effect-composer render
that re-renders with a different camera or layer set, or the geometry streamer
excluding the region. Worth checking `MuseumPostProcessing.svelte` and
`geometryStreamer.updateStreaming(...)` — note the latter is called with
`fpsActive`, which is FALSE in a scripted session (see Gotchas), so streaming may
never run and chunk visibility may be stale. That is my best untested lead.

### 2. Confirm the parapet height at eye level, then answer the design's five gate questions

`docs/.../2026-08-04-earth-room-floor-plan-draft.md` ends with five look-at-it
questions (parapet 0.90 vs a 0.45 lip everywhere; four shelves or three; grass on
the rim; fireflies in a daylit room; keep the felt downbeat). All five need
frames, and all five are blocked on #1.

### 3. Felt downbeat (deferred, not cut)

Design risk 5. Camera-shake infra is new tech; the plan deliberately deferred it
rather than block the walk. Judge it at the gate.

### 4. `/sequence/[id]`-style follow-up: none for Earth

No known debt beyond the above.

## Decisions already made

Do not re-litigate these.

- **Austen, 2026-08-04:** keep "The Weight" mechanism — the only room viewed from
  above, the barrier is a vertical drop, there is no way down — and re-skin it as
  lush nature (grass gully, canyon overlook). Direction approved; the concept
  sheet with all three variants is
  `static/sketches/2026-08-04-earth-room-floor-plans.html`.
- **Recommended variant is Plan B (Balcony + open north) with Plan A's rim
  circuit closed across the parapet.** Built as specified.
- **Parapet stays 0.90 m, build cap 1.07 m.** The design's sightline math says a
  reflex 1.1 m guard rail consumes the whole clearance. Do not "safety up" the
  parapet; if the walk reads badly the fix is the slab's 0.45 m lip everywhere
  plus a wider rim.
- **Sequence data comes from the catalog, never the MCP generator's variation-0
  default** (memory: `reference_tnd_catalog_variation_authority`). This shipped
  wrong once in Fire.
- **The compiled north wall stays** for collision; the graybox omits its visual
  and the boulder parapet stands in for it. No wall-stamper change.
- **Circles are Disc records consumed by both blocking and rendering.** No rect
  approximation beside circular rendered geometry (Codex review, gotcha 8).

## Gotchas

**The teleport recipe does not reproduce real first-person rendering.**
`window.__gameBridge.bindings.camera.setMode('first_person')` does NOT set
`Museum3DScene`'s own `fpsActive` flag. So in any scripted session the top-down
player marker (`Museum3DScene.svelte` ~line 1319, gated on `!fpsActive`) stays
mounted, and its 12 cm heading cone sits 0.35 m in front of the eye, first-hitting
every ray in the lower half of the frame. Part of the original "dome" bug report
was this cone. Suppress it by scaling that group to ~0 — **setting `visible` is
overwritten every frame by the reactive binding**; `scale` is not bound, so it
sticks. Better: teach the bridge to drive `fpsActive`.

**The same overwrite trap applies to materials.** Cloning a mesh's material to
probe it silently fails, because Threlte re-assigns `material={materials.x}` on
the next reactive pass. Mutate the shared material object in place instead.

**Getting a Three.js handle in the page.** There is no global. Use
`await import('/node_modules/.vite/deps/three.js?v=<hash>')` — find the hash from
`performance.getEntriesByType('resource')`. `raycaster.setFromCamera(...)` did
NOT work (the camera object reachable by traversal has a stale rotation); build
rays manually from the eye position instead. I left `name={...}` on every
graybox mesh and a DEV-only `window.__earthGraybox` group handle in
`EarthCanyonGraybox.svelte` specifically so the next session can bisect the scene
without re-deriving any of this.

**Yaw convention:** yaw π faces NORTH (−z), yaw 0 faces SOUTH. Confirmed by
screenshot, not assumed.

**Rect cell math is the recurring killer in this file family.** Layout rects
cover tile-CENTRED cells; the physics provider looks tiles up with
`Math.round(world / 0.5)`. Any carve that must match the floor exactly has to use
the tile-CENTRE test (`rasterise` in `earth-canyon-layout.ts`), not
`subtractTiles`, which needs a tile's whole cell inside one hole rect. That
mismatch is what produced the 12 m rock wall.

**Lights use `decay = 2`.** A value that must read at r metres needs ≈ target·r².
And the inverse bite: what reads at 12 m blinds at 2 m. The museum runs ~69 point
lights total; roughly 20 are near the Earth bay.

**Do not run `npm run check` while another `svelte-check` is running** (5–8 GB
each). Gate with the PowerShell census in `.claude/rules/resource-budget.md`.

**Port 5173 is Austen's dev server.** Never start or kill it. All browser
verification above ran against it via the shared debug Chrome
(`scripts/launch-chrome-debug.ps1`), page opened in the background and closed at
the end; the shared window was left untouched.
