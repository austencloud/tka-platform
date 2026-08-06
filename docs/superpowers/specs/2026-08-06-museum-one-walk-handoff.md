---
status: handoff
value: 4
effort: M
remaining: 'The museum is one walkable building and the Moon is a place you can cross. Nothing in this session was verified by walking — DevTools cannot take pointer lock and the camera controller ignores synthetic keys. Austen has to walk the hallways, ride the Sun eye, and jump on the Moon.'
depends_on: 'docs/superpowers/specs/2026-08-05-vulcan-cave-sun-moon-handoff.md'
tags: [museum, vulcan-cave, moon, walk, corridors, handoff]
last_triaged: 2026-08-06
---

# The museum became one walk — Handoff (2026-08-06)

## Mission

Two jobs, one after the other.

**The Moon** got the ground it was always supposed to have: a lunar surface that
runs to the horizon, wearing the Cosmic scene's own authored regolith, walkable
for fifty metres in every direction, with lunar gravity you can bounce in.

**The museum** stopped being three disconnected grids. The 16-room graph the
module renders had the entire Vulcan Cave collapsed into a single placeholder
room; the eleven authored cave rooms — the six element chambers among them —
only existed on a review route, in a grid of their own; a lobby plan sat on a
third. They are now one building you can walk end to end, and the review routes
are deleted.

Predecessor: [2026-08-05-vulcan-cave-sun-moon-handoff.md](file:///E:/tka-platform/docs/superpowers/specs/2026-08-05-vulcan-cave-sun-moon-handoff.md).
Its loose end #2 ("the Sun→Moon transition does not exist") is closed here.

Walk it: [localhost:5173/museum](https://localhost:5173/museum). That is now the
ONLY door — `/test/museum-cave-3d` and friends are gone.

---

## Done — verified

All on `main` in the primary checkout. Every commit used an explicit pathspec.

### 1. The Moon has a horizon — `debeb54ebe`

The mare runs to 420 m past a 400 m sky shell (so no strip of clear colour shows
under the horizon), with 70 seeded crater lips, 40 tilted boulders and 26
highland domes in two ranges. The crater rim dropped 2.4 m → 1.05 m so you can
see over it. Fog got a `vacuum` override for this room: the cave wing's 0.06
`FogExp2` was swallowing everything past thirty metres, and there is no air on
the Moon to scatter light.

Evidence: 308 museum tests, `svelte-check` 0 errors, browser frames at 1920×1080
and 3840×2160 showing the mare and the highlands, `list_console_messages` empty.

### 2. The Cosmic scene's regolith, on the Moon's ground — `c617ede108`

`cosmic-reliquary.glb`'s terrain wears an authored `AR_LunarRegolith` material —
1024² diffuse, normal, roughness, all KTX2. The three maps were lifted out of the
GLB into `static/textures/moon-regolith/` and tiled at 5 m across the chamber
plain, the mare, the rim, the mounds and the far field.

The GLB stretches that texture across a 68 m patch ONCE. Here it tiles, and each
consumer derives its repeat from its own UV convention — `ShapeGeometry` writes
UVs in metres, everything else writes 0..1 across the shape. Palette constants
became near-white tints (they multiply the map now) and the key went 4.2 → 6
because the authored diffuse is a dark basalt.

Evidence: 308 tests, `svelte-check` clean, browser frame at 1920×1080 showing
textured regolith from underfoot to the highlands, no console messages.

### 3. The Moon is walkable and bounceable — `f5bf28c98e`

The bay went from a 22.5 m interior to 105 m, giving a **50.5 m walkable plain**
(`layout.walkRadius`) around the ⌀20 crater. The rim stopped being a wall and
became ground: `elevationAt` raises a smoothed ridge cresting at 0.45 m, under
the physics provider's 0.6 m step-up. `MOON_GRAVITY_SCALE` 0.32 → 0.18.

**Read the gravity comment before touching that number.** Museum gravity is 2.5×
the camera package's own 9.81, so 24.5 m/s². Jump velocity 5.0. Apex is v²/2g:
0.51 m museum, 1.27 m normal, 1.59 m at the old 0.32, 2.8 m at 0.18 with ~2.3 s
hang. The old figure was picked against museum gravity and read as a hop.

Evidence: 310 museum tests, two new — the plain unblocked AND low-gravity across
48 bearings at r=49.5 and blocked past it; the lip crests at 0.45, under the
step-up, monotonic, flat outside the band. `svelte-check` clean. Browser frame
shows the open plain with no wall ring.

### 4. One museum, one walk — `4a02c853ab`

`src/lib/features/museum/data/museum-walk.ts` splices the authored cave into the
museum graph in place of the `vulcan-cave` placeholder and rewires the three door
ids where they meet. `MuseumModule` builds from `MUSEUM_WALK_ROOMS` /
`MUSEUM_WALK_EDGES` and attaches the cave terrain (cache `layoutVersion` bumped
to 5). Route:

```
entrance → cave-threshold → squeeze → water approach → water gallery → water →
fire → earth → air → sun → moon → egypt-threshold → egyptian → renaissance →
victorian → digital → suppression → crumble → gallery → fear → isolation →
collaboration → gift-shop
```

plus the vtg-wing, construction-zone and janitor side branches.

Three genuine breaks had to be fixed, none visible on the plan:

1. **A door tile sits ON the wall line**, half a tile outside `interior`. The
   Moon's door band and the Sundial's approaches stopped at the interior, so the
   one tile joining a routed corridor to its door said no. Both now run to the
   shell.
2. **The Sundial's east approach assumed its door sat on the chamber's equator.**
   It lands 10.75 m off it on a 12 m radius, so the approach stopped 6 m short of
   the round wall and the Sun could not reach the corridor to the Moon. It now
   meets the chamber on the half-chord at the door's own offset (`halfChord`).
3. **A bay program could block a routed corridor.** Corridors now win over every
   bay in `composeCaveTerrain`.

Evidence: `tests/unit/museum/museum-walk.test.ts` floods the walkable tiles from
the spawn — terrain blocking included, four-connected — and requires >20 reachable
tiles inside all 26 rooms. 315 museum tests pass, `svelte-check` clean. In the
running app `/museum` built a 616×301 grid whose wings are the full 26 in walk
order, cave automatons registered as live stations, no console errors; top-down
frame shows one connected plan.

### 5. Hallways draw, the eye arrives, review routes deleted — `0d41fe2631`

**The void hallways.** A corridor tile belongs to no wing, so it goes to the
always-drawn corridor chunk — unless a "suppressed span" routes it to a room that
draws nothing. Those spans were the union box of EVERY PAIR of tile-suppressed
wings. Eight cave rooms suppress, so 28 boxes blanketed the museum and **1518 of
~3000 corridor tiles — over half, including hallways nowhere near a cave —
rendered as nothing while staying walkable.** A pair now only claims its box when
no other wing sits inside it.

**The Sun→Moon hall had no owner on either side.** Every other chamber draws its
own inbound corridor; the Moon never did. `moon-layout` now reads the grid's own
corridor tiles (`corridorFloors` / `corridorWalls`) and `MoonGraybox` floors,
walls and roofs them.

**The eye stopped at the ceiling.** `handleEyeLift` in `Museum3DScene` now
teleports the visitor to the Moon's arrival plinth at the top of the column,
facing the plain.

Deleted: `src/routes/test/museum-cave-3d`, `museum-cave-plan`, `museum-lobby-3d`,
`museum-lobby-plan`.

Evidence: 316 museum tests including a new one measuring the corridor chunk —
1906 tiles now, threshold 1800, above the 1495 the old spans left. `svelte-check`
0 errors. `/museum` loads and builds the 26-room grid; spawn `(29, 260)` verified
inside the entrance lobby's bounds `x 18–41, y 223–297`.

---

## Believed done — unverified

**Everything below needs Austen at the keyboard.** Chrome DevTools cannot take
pointer lock, and the camera controller ignores synthetic `KeyboardEvent`s — I
sampled the player position through 8 seconds of a held key and it never left the
spawn at (173.5, 73.0). The museum module's landing view is not the play camera
either, so no frame of the walk from inside it exists.

1. **The hallways, from inside one.** The fix is proven by tile counts, not by
   eyes. Walk Sun → Moon; that hall is the one that had no owner at all.
2. **The eye ride.** Stand at the dead centre of the Sundial, ride up, and see
   whether you surface on the Moon's plinth facing the stations.
3. **The lunar bounce.** 2.8 m apex, ~2.3 s hang is arithmetic. If the float
   feels slow, `MOON_GRAVITY_SCALE` in `moon-layout.ts` is the one number.
4. **Walking the whole route** end to end. The flood fill proves connectivity of
   tiles; it does not prove the character controller crosses every threshold.
5. **Frame cost of the merged grid.** Never measured. The museum grid went from
   16 rooms to 26, one of them a 210-tile Moon bay.

---

## In flight

**Nothing of mine.** Every path I touched is committed.

**Other sessions have uncommitted work in this tree — do not commit or revert
it.** At handoff time that included an uncommitted `SceneEffectsCoordinator3D`
addition inside `src/lib/features/museum/components/game/Museum3DScene.svelte`
(someone else's scene-effects work, in a file I also edited — coordinate before
touching it), plus `src/lib/features/assemble-lab/**`, `src/lib/features/write/**`,
`src/lib/shared/3d/effects/**` and `src/lib/features/create/**`.

---

## Loose ends (ranked)

1. **Walk it and report.** Everything in "Believed done" collapses into one lap
   of the museum. Start in the lobby, go all the way to the gift shop.
2. **Geometry streams in late.** Austen watched walls arrive after he was already
   standing in the room. That is the streamer's activation radius
   (`museum-geometry-streamer.ts`), untouched here, and it is the most visible
   remaining defect.
3. **The Sun's east door should die.** The design has the visitor leave the
   Sundial UP through the eye — which now works — making the east door redundant.
   It cannot be deleted casually: `buildCirculation` resolves the `sunToMoon`
   edge to a real door tile and **throws** without one, and the walk's own edge
   list carries that edge. Delete the door, the edge, and the Moon's west-door
   assumptions in one change, and re-run the flood test.
4. **The Sun's noon gate is still unproven** (inherited from the previous
   handoff): from the +6.0 summit, does the prop-shadow projection read as
   notation? Needs a human looking DOWN.
5. **The Moon has no design doc.** Its rationale lives in `moon-layout.ts`'s
   header and in these two handoffs.
6. **`lobby-floor-plan.ts` is now half-orphaned.** Its `CAVE_THRESHOLD_ROOM` is
   still imported by the cave plan, but `LOBBY_PLAN_ROOMS` / `LOBBY_PLAN_EDGES`
   have no route since the review pages went. Either fold the lobby's furniture
   into `entrance` or delete the plan.

---

## Decisions already made

Do not re-litigate these.

- **"I want you to make it so that the lobby and all of the different cave
  exhibits and everything is what we actually have set up in the real program
  when we really go to museum"** (2026-08-06). One grid, one door, `/museum`.
- **"Get rid of review tools"** (2026-08-06). The `/test/museum-*` routes are
  deleted, deliberately. Do not resurrect them to debug a room; debug it in the
  museum.
- **"allow me to walk on the moon and bounce around"** (2026-08-05). The Moon is
  a place to cross, not a chamber to stand in. The 50 m plain and the low gravity
  are the answer to this.
- **"I want you to make the moon have a HUGE lunar ground like in the 3d scene
  that goes on and on"** and then, pointing at the Cosmic scene, **"I'm talking
  about the moon ground texture"** (2026-08-05). The regolith maps come from that
  scene's GLB on purpose — do not substitute a different rock texture.
- **The cave-only plan builder stays.** `buildVulcanCaveFloorPlan` is still the
  fixture for the six chamber test suites even though no route renders it.

---

## Gotchas

- **A door tile sits ON the wall line, half a tile outside `interior`.** This bit
  twice in one session (Moon band, Sundial approaches). Any new walkable-region
  rect that stops at `interior` will silently seal its own doorway. Run to the
  shell.
- **Corridor tiles outside every wing are the museum's own circulation.** Nothing
  should block or steal them. If a hallway ever renders as void again, look at
  `bucketMuseumTilesByRoom`'s suppressed spans first.
- **`grid.terrain` does not survive serialization.** `MuseumModule` caches the
  grid in sessionStorage; `attachMuseumWalkTerrain` must run on the cached path
  too, or the chambers become flat floor with nothing visibly wrong.
- **Synthetic keyboard events do not drive the camera controller.** Do not burn
  an hour trying, as I did. Position CAN be seeded through
  `sessionStorage["museum-hmr-state"]` (`playerWorldX/Z`, `viewMode`,
  `topDownHeight`) followed by a reload — that is the only remote steering that
  works, and it drops you in place without walking there.
- **Deleting route directories can 500 the dev server** with
  `ENOENT ... .svelte-kit/types/src/routes/proxy+layout.server.ts`. `npx
  svelte-kit sync` alone did not clear it; touching `src/routes/+layout.server.ts`
  did.
- **Two other sessions were mid-edit in shared files** during this work (a
  `.by((` sweep across `src/lib/shared/3d/effects/**`, and `tab-definitions.ts`),
  which broke HMR repeatedly. If the page won't compile, check whether the broken
  file is even yours before debugging it.
- **`MOON_RIM_RIDGE_TOP_Y` must stay under 0.6 m.** Past the physics provider's
  step-up the Moon silently becomes a walled room again, and nothing looks wrong.
