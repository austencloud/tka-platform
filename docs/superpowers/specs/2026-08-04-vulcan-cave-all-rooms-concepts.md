---
status: active
value: 3
effort: M
remaining: 'Broad-brush concepts + floor-plan programs for Earth, Air, Sun, Moon. Each still needs its own approved design doc and graybox gate. Earth is next.'
depends_on: 'docs/superpowers/specs/2026-08-04-first-fire-design.md'
plan_path: ''
tags: [museum, vulcan-cave, floor-plan, concept]
last_triaged: 2026-08-04
---
# Vulcan Cave — All Six Rooms, Concept + Floor-Plan Program

Broad brush, for iteration with Austen. Not executor-ready. Water and Fire are
summarized as built; Earth, Air, Sun and Moon are proposed at the level Water's
and Fire's concept sheets sat at before their plan sheets were drawn.

The wing graph is fixed and is the authority for entry/exit walls
(`src/lib/features/museum/data/vulcan-cave-floor-plan.ts`):
threshold → squeeze → approach → flooded gallery → **Water** (east) →
**Fire** (east, `fireToEarth`) → **Earth** (south, `earthToAir`) →
**Air** (south, `airToSun`) → **Sun** (east, `sunToMoon`) →
**Moon** (east, `moonToEgypt`) → Egypt threshold.

Roster verified against `static/data/hero/tnd-base-words.json` (22 entries; the
six quarter-opp phase-duplicates PMPM/QNQN/RORO collapse to three performers):
Water AAAA/BBBB/CCCC · Fire JDJD/KEKE/LFLF · Earth GGGG/HHHH/IIII ·
Air DJDJ/EKEK/FLFL · Sun SSSS/TTTT/UUUU/VVVV · Moon MPMP/NQNQ/OROR. 19 total.

Grammar every room obeys: **feel the element first-person, then read it
performed**; ONE unique spatial mechanism per room; performers unreachable
behind a barrier native to the element; walkable graybox first (per-tile
elevation, ramps, point lights decay=2, one layout module); cave-native
phenomena only; no Latin letters carved in rock.

---

## Built: the two rooms that set the bar

**Water — The Drowned Gallery (the Ring).** The visitor walks ~30 m along the
bottom of a rock-roofed flooded gallery whose ceiling sits below the waterline,
so there is no sign of air until a surfacing stair breaks the surface at a
mid-stair landing; that first breath is the money shot — a black mirror pool
doubling three firelights on a symmetric centre-south axis. The grotto is a
ring: apron → west walkway past the waterfall plunge → a procession walkway
that reads A, B, C at 5–6 m across 4 m of channel → carved threshold → east to
Fire. Unique mechanism: *you pass through the element*. Barrier: water.
Datums 0 / −1.5 waterline / −4.5 gallery floor / −0.3 walkways. Bay ≈ 47 × 29 m.

**Fire — The First Fire.** A basalt bridge over a lava stream (heat shimmer,
ember rain — the element felt first-person), then a bent darkening crack kills
the light behind you, and a stepped basalt amphitheatre opens onto three
automatons across a 4 m lava fissure, each at a fire pit, spinning burning
staves in the dark. A cold ash circle with abandoned charred staves sits behind
the benches: the visitor's side of the jam. Unique mechanism: *the performance
IS the light source*. Barrier: the fissure. Terraces −0.8/−1.3/−1.8, shore
−1.3, fissure bed −3.5. Bay ≈ 46.5 × 20.5 m.

---

## Earth — "The Weight" (working title)

**Concept.** The rock closes over your head and the downbeat arrives through
your feet before you see anyone; then the passage opens at the rim of a
sinkhole and you look *down* six metres at three figures hitting the same
beat, hands converging on the same point.

**Element first-person.** Headroom drops from Fire's amphitheatre to 1.9 m over
~14 m of low bedding-plane passage — the ceiling is close enough to read as
texture, not sky. A boulder choke narrows to 1.4 m and turns twice. Through the
last leg the floor pulses: a low, felt thud on the shared downbeat (audio +
camera micro-shake), source unseen. Earth is the room where the element is
*mass*, and mass is proven by putting it over you and under you.

**Unique mechanism.** *The only room the visitor views from above, and the only
room whose barrier is a vertical drop.* You never descend to the performers'
floor; the rim ledge is the whole viewing apparatus.
- Not Water: no water, and the barrier is air, not liquid.
- Not Fire: Fire looks horizontally across a fissure from stepped seating and
  is lit by the performers; Earth looks down from a single continuous rim under
  one dusty daylight shaft.
- Not Air: Air's vertical axis is climbed and its performers are met one at a
  time; Earth's is fixed — you stand still, they are all below you at once.
- Not Sun: Sun surrounds the visitor with performers at eye level on a round
  plan; Earth keeps them all on one plane, below.
- Not Moon: Moon is seen only in reflection.

**Floor plan program.** Enter west (`fireToEarth`), exit south (`earthToAir`).

| # | Station | Rough dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Descending bedding passage | 14 × 2.5 m, ceiling +1.9 above floor | 0 → −1.2 | yes |
| 2 | Boulder choke (two bends) | 6 × 1.4 m | −1.2 → −1.8 | yes |
| 3 | Rim arrival, north-west | 4 × 4 m | −1.8 | yes |
| 4 | Rim ledge ring (continuous) | 2.6 m wide, ~52 m circuit | −1.8 | yes |
| 5 | Sinkhole void | ⌀ 16 m | — | **blocked** |
| 6 | Performer floor (visual) | ⌀ 16 m disc | −7.8 | blocked |
| 7 | Three station bosses (G/H/I) | ⌀ 2.5 m each, on the floor disc | −7.8 | blocked |
| 8 | Rubble apron + fallen slab overlook | 6 × 4 m, south rim | −1.5 (+0.3 step) | yes |
| 9 | Exit crack to Air | 5 × 2.5 m, south wall | −1.8 → −1.2 | yes |

Chamber bay ≈ 24 × 24 m; total with passage ≈ 24 × 34 m. Deliberately smaller
in plan than Water and Fire, and the only one whose drama is in **section**.

**Performers + barrier.** G, H and I stand on three low bosses at the centre of
the sinkhole floor, spaced ~4.5 m, facing up-and-out. Unreachable because there
is no stair down — the rim is continuous and the drop is 6 m. Tog-Same is the
easiest family to *misread* on a horizontal stage (three people doing nearly
the same thing side by side); from directly above, the reading is free: three
identical figures, downbeats landing simultaneously, and beta-to-beta hands
converging to a single point per figure — a plan view turns "the same point"
into a literal dot. Add a shallow carved concentric ring under each station so
the convergence lands on a visible target.

**Money shot.** From the rim's south overlook: one dust-loaded daylight shaft
from a ceiling aven falls through the void onto the three bosses; the rim
foreground is dark rock, the floor is bright, and all three figures hit the
downbeat in the same frame.

**Reuse map.** God rays: `scenes/ocean/runtime/atmosphere/GodRayShafts.svelte`
or `scenes/autumn/runtime/atmosphere/GodRayShafts.svelte` (both hardcode their
scene's sun — re-derive). Falling dust/grit:
`environments/primitives/FallingParticles.svelte`. Rock mass and floor bosses:
graybox meshes from an `EarthWeightLayout` module in the pattern of
`data/first-fire-layout.ts` (`ramp-x` / `ramp-z` zone kinds already carry ramps
and stairs). Lighting/postprocessing seams:
`museum/components/game/MuseumPostProcessing.svelte`, `MuseumTorchLight.svelte`.
Audio: `shared/3d/audio/ocean-audio-engine.ts` (track-swap precedent) for the
sub-bass downbeat bed. Stations: `MuseumPerformerStation3D.svelte`.

**Risks / new tech.** (1) Vertical framing — the camera pitch and the rim
balustrade height must let a 1.6 m eye see the floor 6 m down without leaning;
graybox has to prove it, nothing in Water or Fire looks down. (2) Distance
legibility: 8–10 m slant range to a performer is farther than Fire's fissure;
if figures read too small, tighten the sinkhole to ⌀ 12 m before adding art.
(3) Felt-downbeat via camera shake is new and easy to overdo — cap amplitude,
make it a toggle. (4) A ⌀ 16 m blocked disc inside a square bay is a new
blocking shape for the tile terrain (circular predicate, not rects).

---

## Air — "The Chimney" (working title)

**Concept.** A draft you can feel pulls you up a switchback ledge inside a
tall chimney, and you meet Fire's three partners again one at a time at eye
level as you climb — same pairs, now landing together.

**Element first-person.** At the base, cold air moves: audible draft, drifting
motes visibly lifting, a hanging curtain of dry roots stirring, the torchlight
leaning. The floor is bright at the top and dark where you stand — the only
light comes from a surface crack ~22 m up. You feel air as the thing that
moves before you see anything move deliberately.

**Unique mechanism.** *The only room whose circulation is a vertical climb, and
the only room where the performers are met serially at eye level* — three
ledges at three heights, each read alone from the ramp landing beside it, all
three visible together only from the top overlook, looking back down.
- Not Earth: Earth is a fixed rim looking down at a simultaneous trio; Air
  climbs past a staggered trio and only assembles them at the end.
- Not Fire: same three letter pairs, deliberately — but Fire is a dark
  horizontal amphitheatre lit by the performers, Air is a bright vertical shaft
  where they are silhouettes against daylight. The echo is the point: same
  partners, opposite room in every axis.
- Not Water/Sun/Moon: no water, no round plan, no reflection.

**The Fire echo, designed.** Air's three ledges carry the same station
silhouette as Fire's three pits (same boss profile, same carved ring motif) and
appear in the same left-to-right order. Fire's stations sit at one elevation
and fire apart; Air's sit at three elevations and land together. Interpretation
(pictograph cave-art, no Latin letters) repeats the Fire glyph pair beside each
Air ledge.

**Floor plan program.** Enter north (`earthToAir`), exit south (`airToSun`).

| # | Station | Rough dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Draft vestibule (north door) | 5 × 4 m | −1.2 | yes |
| 2 | Root curtain squeeze | 4 × 1.6 m | −1.2 | yes |
| 3 | Chimney floor, rubble cone | 12 × 10 m | −1.4 | yes |
| 4 | Ramp leg 1 (west wall) | 11 m run, 2.2 m wide | −1.4 → +1.6 | yes |
| 5 | Landing A (ledge D-J opposite) | 3 × 2.5 m | +1.6 | yes |
| 6 | Ramp leg 2 (north wall) | 10 m run | +1.6 → +4.6 | yes |
| 7 | Landing B (ledge E-K opposite) | 3 × 2.5 m | +4.6 | yes |
| 8 | Ramp leg 3 (east wall) | 10 m run | +4.6 → +7.6 | yes |
| 9 | Landing C (ledge F-L opposite) | 3 × 2.5 m | +7.6 | yes |
| 10 | Top overlook (south) | 5 × 3.5 m | +8.4 | yes |
| 11 | Shaft void | ~9 × 9 m core | — | **blocked** |
| 12 | Three performer ledges | 3 × 2 m each, opposite each landing | +1.6 / +4.6 / +7.6 | blocked |
| 13 | Exit crack down to Sun | 8 m run, 2.5 m wide | +8.4 → 0 | yes |

Chamber bay ≈ 16 × 15 m in plan — the smallest footprint in the wing — and
~24 m of authored height. Ceiling crack at ≈ +22.

**Performers + barrier.** Each ledge faces its landing across ~7 m of open
shaft: the barrier is the void plus the draft, and the ledges have no
connecting path. Eye-level pairing is the whole point — a Tog-Opp pair reads as
two props mirroring each other on the same downbeat, and that mirror only reads
when the pair is at your height and isolated from the other two. The top
overlook then stacks all three verticaly: three mirrors on three floors, all
landing on the same beat.

**Money shot.** From Landing B: the E-K figure at eye level 7 m away,
silhouetted against the daylight crack far above, with Landing A's figure small
and dark below-left and Landing C's small and bright above-right — one frame
that says "three heights, one beat."

**Reuse map.** Lifting motes:
`environments/primitives/FallingParticles.svelte` (invert velocity) and
`scenes/autumn/runtime/atmosphere/AutumnParticles.svelte`. Daylight shaft:
`scenes/celestial/GodRays.svelte` or the ocean/autumn `GodRayShafts`. Wisps for
the draft cue: `scenes/autumn/runtime/wisps/WillOWisps.svelte`. Ramps/landings:
`ramp-x`/`ramp-z` zones exactly as `data/first-fire-layout.ts` builds the crack
and exit stair. Audio: ocean audio engine with a wind bed +
`CURATED_WING_SOUNDSCAPES` entry.

**Risks / new tech.** (1) +8.4 m of authored climb is the largest elevation
range yet (Fire spans 1.8, Water 4.5) — the walker, ground clamp and neighbour
elevation sweep (≤0.6 m) must hold over ~30 m of ramp. (2) Room streaming and
fog walls are tuned for horizontal bays; a tall bay may need its ceiling and
occlusion handled explicitly. (3) Wind as *felt* is audio + particles only — no
new physics; do not attempt camera push. (4) Performers at three elevations
means the station anchor list needs per-station `elevation`, which Water
already does (`SHELF_Y`) — extend, don't invent.

---

## Sun — "The Sundial" (working title)

**Concept.** The only round room and the only daylight: the visitor stands on a
central stone boss and a beam from an oculus sweeps the chamber, lighting one
of the four performers at a time, a quarter-cycle apart, all the way around.

**Element first-person.** After four dark rooms, the approach rises toward warm
light through a narrowing crack: brightness on the walls before anything is
visible, then the chamber, then actual sun on your face at the centre. The
element is felt as warmth and as *time* — you notice the beam is moving before
you understand it is the exhibit.

**Unique mechanism.** *The performers surround the visitor, and a moving light
decides which one you can see.* The room is the only round plan, the only
centre-standing viewpoint, the only one with four stations, and the only one
whose sequencing is authored in light rather than in walking.
- Not Fire: Fire's light is made by the performers and shows all three at once;
  Sun's light is external and shows one at a time.
- Not Earth: Earth is one static overhead view of a simultaneous trio.
- Not Air: Air sequences performers by making you climb; Sun sequences them
  while you stand still.
- Not Water/Moon: no water barrier, no reflection.

**Floor plan program.** Enter north (`airToSun`), exit east (`sunToMoon`).

| # | Station | Rough dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Rising light crack (north) | 10 m run, 2.5 m wide | −1.2 → −0.4 | yes |
| 2 | Rim apron, north arc | 3 m wide, quarter arc | −0.4 | yes |
| 3 | Rib bridge to the centre | 6 × 2 m | −0.4 → −0.2 | yes |
| 4 | Central boss (visitor stands here) | ⌀ 6 m | −0.2 | yes |
| 5 | Annular collapse ring | 5 m wide, full circle | visual −4.0 | **blocked** |
| 6 | Four pillar stations S/T/U/V | ⌀ 2.2 m tops, at N/E/S/W of the ring | +0.4 | blocked |
| 7 | Outer rim walk (partial, N and E arcs) | 2.5 m wide | −0.4 | yes |
| 8 | Exit crack to Moon (east) | 7 m run, 2.5 m wide | −0.4 → −0.8 | yes |

Chamber ⌀ ≈ 26 m; bay ≈ 28 × 34 m including the two cracks. Oculus at ≈ +14.

**Performers + barrier.** Four stalagmite pillars rise out of the collapse ring
to just above the visitor's floor; the ring is a 5 m gap of broken floor with a
4 m drop, crossed only by the single rib bridge to the centre. Quarter-Same is
a phase relationship — four performers running the same-direction family a
quarter apart — and a ring is its literal diagram: put S/T/U/V at N/E/S/W and
the phase offset becomes an angle. Face them inward at the visitor. Put U
(leader-pro) and V (leader-anti) **opposite** each other so the leader/follower
inversion reads as a mirror across the boss, with S and T on the other axis.
The sweeping beam then walks the phase around the room in order.

**Money shot.** Standing at the centre facing the lit pillar: the beam column
lands on one performer, the other three are dim silhouettes at the compass
points, the oculus is visible overhead, and the shadow of the lit figure falls
across the boss toward the visitor's feet.

**Reuse map.** Beam: `scenes/celestial/GodRays.svelte` +
`scenes/ocean/runtime/atmosphere/GodRayShafts.svelte` (animate the sun
direction rather than the mesh). Pillars: `scenes/celestial/CelestialPillars.svelte`
and `scenes/ember/ObsidianPillars.svelte` as instancing/profile references;
`scenes/cosmic/CrystalFormations.svelte` for scattered mineral detail. Dust in
the beam: `environments/primitives/FallingParticles.svelte`. Warm-light grade:
`MuseumPostProcessing.svelte`. Four stations: `CAVE_MODE_ROOMS` `cave-sun`
already has the `performerIds`/`sequenceIds` array shape from the Fire
migration — it just needs four entries.

**Risks / new tech.** (1) Circular plan on a square tile grid — the annulus and
the round boss are new blocking predicates, and the rib bridge must be the only
crossing (route test must prove it). (2) A moving directional light with a
visible volumetric shaft is more animation than Fire's static pit lights;
graybox should ship the sweep as a slow rotating spotlight with no volumetrics
and judge legibility first. (3) Four stations means four rigs in one room —
first time; check performance against Fire's three. (4) Standing at the centre
of a round room is the easiest place in the wing to lose orientation; the exit
crack needs a permanent warm cue so the visitor can always find it.

---

## Moon — "The Still Room" (working title)

**Concept.** A small, cold, silent chamber where the only image of the three
performers is their reflection in a perfectly still black pool — the visitor
never sees them directly.

**Element first-person.** The approach cools and quiets: the Sun room's warmth
falls off, footfall damps on fine silt, and the last sound is a single slow
drip. The chamber is lit only by a glowworm ceiling — cold, dim, sourceless.
Water is present but ankle-deep and utterly still at the shore, and the visitor
walks a silt path along its edge; the element felt is *stillness and reflected
light*, the two things the moon actually is.

**Unique mechanism.** *The performers are visible only as reflections.* They
stand on a shelf above and behind an overhang; a low rock brow occludes them
from every walkable point, so turning around gains you nothing. The pool's
inverted image is the exhibit.
- Not Water: Water's pool is a barrier you look *across* at directly lit
  alcoves, in a monumental moving grotto; Moon's pool is the *only* view, in a
  small still room, and its water is centimetres deep at the shore.
- Not Earth: Earth looks down at real figures, not an image.
- Not Air/Fire/Sun: no climb, no fire, no beam, no round plan.

**Floor plan program.** Enter west (`sunToMoon`), exit east (`moonToEgypt`).

| # | Station | Rough dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Cooling crack (west) | 8 m run, 2.2 m wide | −0.8 → −1.4 | yes |
| 2 | Silt shore, west arc | 3 m wide | −1.4 | yes |
| 3 | Viewing shelf (the composed spot) | 5 × 3 m, south of the pool | −1.4 | yes |
| 4 | Mirror pool | 14 × 9 m | surface −1.5, visual bed −1.9 | **blocked** |
| 5 | Rock brow / overhang | spans the north half, underside +1.2 above shore | — | blocked |
| 6 | Performer shelf (M-P, N-Q, O-R) | 12 × 2.5 m, behind and above the brow | +1.6 | blocked |
| 7 | East shore path | 2.5 m wide | −1.4 | yes |
| 8 | Exit to Egypt threshold (east) | 5 m run | −1.4 → −0.8 | yes |

Bay ≈ 18 × 16 m — the smallest chamber in the wing, on purpose. Ceiling ≈ +5.

**Performers + barrier.** M-P, N-Q and O-R stand on the raised shelf, lit by
three small cold sources, facing the pool. The brow blocks the direct sightline
from every walkable tile; the pool blocks approach. Quarter-Opp with no
leader/follower is a symmetric, opposed-direction phase relation — an inverted
image is the correct diagram for it, and reflection turns each performer's
opposite-direction pair into a visually opposed twin. Space the three so their
reflections do not overlap from the viewing shelf.

**Money shot.** From the viewing shelf: black water filling the lower two
thirds of frame, three cold-lit figures inverted in it, glowworms doubled as a
second sky below, and the rock brow as a hard dark band where the real
performers are *not* visible.

**Reuse map.** Reflection: `museum/components/game/MuseumMirror.svelte` already
wires three.js `Reflector` into the Threlte scene correctly (it exists for the
lobby mirror) — reuse the pattern at pool scale, horizontal. Water surface and
opacity: `scenes/ocean/runtime/water/WaterSurface.svelte` (Water's noted
adaptations apply: centre uniform for the edge fade, exposed opacity). Cold
glow field: `scenes/cosmic/LunarCrystals.svelte`,
`scenes/cosmic/EnergyParticles.svelte`; drips via
`environments/primitives/FallingParticles.svelte`. Still-pool reference:
`scenes/autumn/runtime/water/AutumnPond.svelte`. Audio: ocean audio engine with
a near-silent drip bed.

**Risks / new tech.** (1) A large real-time planar reflector is the one genuine
new cost in this document — `Reflector` renders the scene twice. Mitigations:
small pool, low texture resolution, and a proven fallback (mirror-duplicate the
three station rigs below the pool plane with a flipped transform and skip the
reflector entirely — cheap, deterministic, and it only has to reflect three
figures and a glowworm ceiling). Decide at graybox. (2) Occlusion must be
*proven*, not assumed: a test that samples every walkable tile and asserts no
line of sight to any performer anchor. (3) Reflections of animated rigs can
read as a rendering bug rather than a design idea — the brow must be
unmistakably deliberate, and interpretation should say so in-fiction.

---

## Wing pacing — compression and release across six rooms

The wing must not read as six equal boxes, and the lever is footprint *and*
axis, not decoration. Water and Fire are the two spectacle rooms and they are
also the two largest bays (≈47 × 29 and ≈46 × 20) — the wing's front half spends
its scale budget deliberately, after a long compression (squeeze → approach →
30 m flooded gallery). Earth then breaks the pattern by getting *smaller in plan
and larger in section*: a genuinely tight passage, then a modest 24 × 24 chamber
whose drama is a 6 m drop. Air is the wing's narrowest footprint (16 × 15) and
its tallest space — pure vertical release after Earth's compression, and the
climb itself is the pacing. Sun is the second release and the wing's only bright,
round, open room: after Air's climb the visitor arrives at warmth and 360° of
space, which is where a wing should peak emotionally rather than in size. Moon
then closes hard — the smallest, quietest, coldest room, one composed view, and
out. Rhythm: **compress (approach) → release (Water) → compress (bridge/crack) →
release (Fire) → compress (bedding passage) → contained (Earth) → compress
(chimney base) → release upward (Air) → open (Sun) → contract to a single image
(Moon)**. No two adjacent rooms share a dominant axis: Water horizontal-through,
Fire horizontal-across, Earth vertical-down, Air vertical-up, Sun radial, Moon
frontal.

---

## Recommended build order

1. **Earth — next.** It follows two spectacle rooms, which is exactly why it
   should not attempt spectacle. Earth's job is contrast: quiet, heavy, one new
   idea (look down), and the smallest new-tech surface of the four (a circular
   blocked region and a camera-pitch check). It should **not** attempt an
   interactive tactile exhibit, moving light, four stations, reflections, or a
   long authored climb. If Earth reads as a relief after Fire rather than a
   let-down, the wing's pacing thesis is proven and the remaining three can each
   spend on one risky mechanism.
2. **Air.** Reuses Fire's letters and station motif (cheap narrative payoff) but
   introduces the wing's largest elevation range; build it after Earth has shown
   that a low-spectacle room can carry a beat, and while the ramp tooling from
   Fire is still warm.
3. **Sun.** Four rigs, a round plan, and moving light — the highest combined
   risk, and it wants Air's climb behind it so the arrival lands.
4. **Moon.** Last by design: it is the wing's closing image, it is cheap in
   plan, and it depends on a reflection decision that benefits from the other
   rooms' performance budget being known.

Each room still owes: its own design doc, a plan sheet under `static/sketches/`,
a graybox with Water's six engineering invariants, and Austen's eye-level gate
before any art spend. One executor per phase, no fan-outs.
