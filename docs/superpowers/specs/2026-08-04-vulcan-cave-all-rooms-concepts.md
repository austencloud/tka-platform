---
status: active
value: 3
effort: M
remaining: 'Concepts + floor-plan programs for Earth, Air, Sun, Moon. Each still needs its own design doc and graybox gate. Air is next (Plan B, The Last Lift, chosen 2026-08-05 — updraft feel-prototype first). Moon rewritten 2026-08-05 as the surface-of-the-moon reality break; Still Room retired. Sun is the only room with no agreed mechanism — its beam was rejected in principle.'
depends_on: 'docs/superpowers/specs/2026-08-04-first-fire-design.md'
plan_path: ''
tags: [museum, vulcan-cave, floor-plan, concept]
last_triaged: 2026-08-05
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
- Not Moon: Earth is enclosed rock looking down into a pit; Moon is open sky
  looking out across a plain, and is the only room with no barrier object.

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
- Not Water/Sun: no water, no round plan.
- Not Moon: both rooms change how the visitor moves, and that rhyme is
  deliberate — but Air's lift is scripted, involuntary and happens once, where
  Moon's low gravity is a persistent property the visitor drives. Air is
  enclosed rock; Moon is open sky. Prototype the two movement changes together.

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
- Not Water: no water barrier.
- Not Moon: Sun's light is authored and moves; Moon's is fixed. Sun is enclosed
  and round; Moon is open and unbounded. NOTE — with Moon now taking the
  surface-of-the-moon concept, Sun is no longer the wing's biggest bright open
  space and does not have to compete for that job. Small, close and hot is a
  live alternative direction (see Addendum).

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

## Moon — "The Sea of Tranquility" (working title)

**Status: decided 2026-08-05.** This section replaces the earlier "Still Room"
concept (a small cold chamber whose only view of the performers was their
reflection in a black pool). Austen chose the surface-of-the-moon reality break:
*"put the fucking person on the moon ... make them think holy shit I just walked
through the door and I'm on the moon."* The Still Room's reflection-pool
mechanism is retired, not merged — see **Retired alternative** at the end of this
section for what was kept from it and what was dropped, and why.

**Concept.** The last tube in the wing opens onto the lunar surface. Stars, the
Earth hanging in the black, grey regolith to a hard close horizon, and three
performers out across a crater floor in absolute silence.

**Element first-person.** Moon is the wing's only reality break, and it is the
last room before the Egypt threshold — the wing ends by leaving the cave
entirely. The visitor comes through a crack expecting a sixth chamber and the
ceiling is simply gone. The reveal is not the opening; it is **turning around
and finding the Earth behind and above you.** Sound drops to nothing on the
threshold. The element felt is *stillness, silence, and reflected light* — the
three things the moon actually is — with the reflection now literal: the visitor
is standing on the reflector, lit by Earthshine.

**Unique mechanism.** *The room stops being a cave.* No other room in the wing
breaks the enclosure, and no other room removes its audio bed. Moon is also the
only room with no barrier object at all — nothing is between the visitor and the
performers except distance and vacuum.
- Not Water: no pool as barrier, no monumental moving grotto. Moon's water, if
  any survives as a mare-floor visual, is dry basalt, not liquid.
- Not Fire: Fire is enclosed, loud, and lit by the performers. Moon is open,
  silent, and lit by the sky.
- Not Earth: Earth looks *down* at a trio from a rim in an enclosed chamber.
  Moon looks *out* across an open plain with no rim and no drop.
- Not Air: Air's lift is scripted, involuntary, and happens once. Moon's low
  gravity is a persistent movement property the visitor drives. Passenger, then
  pilot — the rhyme is deliberate and the two rooms sit two apart.
- Not Sun: no round plan, no beam, no authored light sequencing. Moon's light
  never moves.

**Why this is cave-native after all (the lava-tube spine).** The reality break
does not need to be a gag. The moon has lava tubes — real, mapped, and a
seriously proposed habitat site — and this wing is Vulcan Cave, volcanic tube
the whole way. The last tube opening onto the lunar surface gives the break an
in-fiction spine, and nothing about the previous five rooms has to be
re-justified. Interpretation should carry this rather than leaving it as a
surprise with no logic behind it.

**Lighting — the two-source rule.** There is no atmosphere, so nothing
scatters. This is the room's signature and it is a lighting decision, not new
tech:

1. **Hard white key (the sun)** raking from one side, low. Everything it does
   not touch falls to near-black with no gradient. A performer reads as a lit
   edge and an absence.
2. **Soft blue-white fill (Earthshine)** from overhead-behind, where the Earth
   hangs. Earthshine is bright enough to read by on the real moon, and it is
   what keeps the shadow side legible instead of murky.

The result is a warm-white edge against a cold blue shadow side with nothing
muddy in between, which is both physically correct and the most distinctive
palette in the wing. `EarthGodRays.svelte` and `EarthSphere.svelte` already
exist and already do this. **Austen is skeptical of the no-fill look and wants
to see it before committing** — graybox ships the two-source setup, and if it
reads as murk, fill gets added and nothing is lost.

**Silence.** Vacuum carries no sound. Moon has **no audio bed at all** — no
wind, no water, no fire, no drips. Every other room in the wing has one, so
removing it at the end is the strongest closing move available and it costs
nothing. Retain only the visitor's own footfall, damped, and optionally a
suit-breath low enough to notice only in hindsight.

**Low gravity.** Approved. The visitor's jump is light and their fall is slow.
Two constraints:

1. **Awe before play.** The first ~30 seconds must not invite jumping. Arrive,
   silence, Earth overhead, no movement. The visitor should discover they are
   light *after* the room has landed, not during the reveal. Stage the arrival
   so nothing in frame reads as a platform.
2. **Crisp, not floaty.** Long airtime and slow falls make first-person low-g
   nauseating and make navigation tedious. Tune toward "light and controlled."
   This touches the same walker and ground-clamp code Air's climb is already
   stressing, so the two prototypes should share findings.

**Barrier — distance, and the honest caveat.** The design intent is that the
moon itself is the barrier: the performers are simply far, out across the crater
floor, with no wall, no drop, and no water telling the visitor no. Every other
room in the wing refuses you with an object; this one refuses you with scale.

There was a second, more specific idea attached to this — that with no
atmospheric haze to serve as a distance cue, the visitor would badly
underestimate the range and walk toward figures that never get closer. This is
true of the real moon, and the Apollo crews misjudged distances exactly this way.
**It is flagged as unproven for a game.** Players judge distance largely by
ground-texture parallax, and most rendered scenes lack strong haze anyway, so
removing it may register as nothing except slow walking. Do not build the room's
barrier on this effect. If a graybox test shows it lands, it is a bonus; the
room works on scale alone.

**Floor plan program.** Enter west (`sunToMoon`), exit east (`moonToEgypt`).
Dimensions below are a first pass and expect revision — this is the wing's only
open-sky room and the first whose plan is not bounded by rock.

| # | Station | Rough dims | Floor Y | Walkable |
|---|---|---|---|---|
| 1 | Final tube, cooling and silencing | 9 m run, 2.2 m wide | −0.8 → −1.4 | yes |
| 2 | Tube mouth / threshold (audio cuts here) | 4 × 3 m | −1.4 | yes |
| 3 | Regolith apron below the mouth | 10 × 8 m | −1.6 | yes |
| 4 | The turn-around (Earth first visible behind) | — | −1.6 | yes |
| 5 | Open crater floor | ~60 × 50 m, uncapped | −1.6 to −2.4 | yes |
| 6 | Three performer stations (M-P, N-Q, O-R) | ~35–50 m out, spaced ~12 m | −2.4 | blocked |
| 7 | Boulder field (scale cue + low-g play) | scattered, 0.5–3 m | varies | yes |
| 8 | Exit tube to Egypt threshold (east) | 6 m run | −1.6 → −0.8 | yes |

The performers are blocked by proximity radius rather than by geometry — there
is no fence and no drop. Reaching their immediate area should be *possible in
principle and impractical in fact*; the stations sit far enough out that the
walk reads as "across the plain," not "over there."

**Money shot.** From the regolith apron, having just turned around: Earth in
the upper third, the tube mouth as a black wound in grey rock, and the three
figures small and hard-edged out on the crater floor — each a white lit edge
and a blue-black absence, all landing on the same beat, in total silence.

**Reuse map.** Ground: `scenes/cosmic/LunarGroundPlane.svelte`. Earth:
`scenes/cosmic/EarthSphere.svelte` + `scenes/cosmic/EarthGodRays.svelte` (the
Earthshine fill — already written). Sky: `scenes/cosmic/Starfield.svelte`,
`scenes/cosmic/NebulaLayer.svelte` (dial well back — the real lunar sky is black
and star-dense, not nebulous), `scenes/cosmic/MeteorStreaks.svelte` for optional
distant impacts. Scatter and mineral detail: `scenes/cosmic/LunarCrystals.svelte`,
`scenes/cosmic/CrystalFormations.svelte`. Grade: `MuseumPostProcessing.svelte`
(this room wants the least bloom in the wing — vacuum has no glow). Stations:
`MuseumPerformerStation3D.svelte`. Audio: **none** — this is the one room that
does not get a `CURATED_WING_SOUNDSCAPES` entry, and that must be a deliberate
registry entry rather than an omission that looks like a bug.

**Risks / new tech.** (1) **Open sky on a tile-terrain system built for
enclosed bays.** Room streaming, fog walls and occlusion all assume rock
boundaries; an uncapped room is genuinely new and is the largest unknown here.
(2) **Low gravity is a movement-model change**, shared-risk with Air's updraft —
prototype together, and cap airtime. (3) **The no-fill lighting is unproven to
Austen's eye** and is an explicit graybox gate. (4) **Scale legibility** —
performers 35–50 m out is far beyond any range in the wing (Fire ~4 m, Earth
8–10 m); if the figures read as specks, pull the stations in before adding art,
and use the boulder field to give the eye a size ladder. (5) **The silence must
not read as broken audio** — interpretation and the threshold transition need to
make it obviously intentional. (6) Performer legibility now depends on the
shadow terminator falling usefully across each rig; the sun angle is a
composition decision, not a default.

**Retired alternative — the Still Room (reflection pool).** Kept for the record
because its reasoning was sound and parts of it survive. The original concept
put three performers on a shelf behind a rock brow, visible only as an inverted
image in a still black pool, with occlusion proven by a per-tile line-of-sight
test. It was retired for two reasons: it repeated Water's mirror pool as the
wing's *closing* image, and the distinction that made it different (Water's pool
is a barrier you look across, Moon's is the only view) was too fine a point to
hang an ending on. What survives into the new concept: stillness and silence as
the body channel, reflected light as the element's true subject (now literal —
the visitor stands on the reflector), the smallest emotional scale in the wing,
and one composed view rather than a tour. What is dropped: the pool, the brow,
the real-time planar `Reflector` cost, and the line-of-sight occlusion test.
Note that dropping the reflector removes the one genuine new rendering cost
flagged in this document, which partly offsets the open-sky risk taken on above.
If a mare-floor pool ever returns as set dressing, it is dry basalt or a
decorative detail — never the room's only view of a performer.
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
then breaks the pattern entirely: after five enclosed rooms the wing stops being
a cave, and the release is total — no ceiling, no barrier, no sound. Rhythm:
**compress (approach) → release (Water) → compress (bridge/crack) →
release (Fire) → compress (bedding passage) → contained (Earth) → compress
(chimney base) → release upward (Air) → open (Sun) → compress (final tube) →
break open (Moon)**. No two adjacent rooms share a dominant axis: Water horizontal-through,
Fire horizontal-across, Earth vertical-down, Air vertical-up, Sun radial, Moon
outward-and-unbounded.

One consequence worth stating plainly: Sun no longer has to be the wing's peak.
It was assigned that job because it was the only bright open room, and Moon has
now taken both adjectives. Sun's brief is open for revision on those grounds —
see the Sun section and the Addendum.

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
4. **Moon.** Last by design: it is the wing's closing image and its only
   reality break, so it wants every other room's enclosure established behind it
   for the contrast to land. Its cost profile changed with the 2026-08-05
   decision — it no longer carries the real-time planar reflector (retired with
   the Still Room), but it now carries an uncapped open-sky room on a tile
   system built for enclosed bays, plus a low-gravity movement change shared
   with Air. Build it after Air's updraft prototype has settled the movement
   work, and after the wing's performance budget is known.

Each room still owes: its own design doc, a plan sheet under `static/sketches/`,
a graybox with Water's six engineering invariants, and Austen's eye-level gate
before any art spend. One executor per phase, no fan-outs.

## Addendum — Austen's direct input, 2026-08-05 (brainstorm session)

Captured verbatim-in-substance so future agents design from his words, not
just this doc's proposals.

- **Air — updraft traversal.** Austen proposed the visitor being lifted by
  air: *"they have to jump on top of these air panels that are blowing
  upwards and causing them to float up ... it's a whole game mechanic [but]
  a million people have done that mechanic."* This supersedes this doc's
  "wind is audio + particles only, no camera push" conservatism as a live
  option. Three dosage tiers are drawn in
  `static/sketches/2026-08-05-air-room-floor-plans.html`: A = pure
  switchback (this doc as written), B = **The Last Lift** (ramp to landings
  A/B, a single updraft column replaces ramp 3 and doubles as the room's
  reveal — recommended), C = full updraft-pad hopping (Austen's literal
  pitch; flagged for platforming-feel and stranding risks). **Austen chose B
  on 2026-08-05** ("B definitely"); ramp 3 is preserved as the fallback if the
  lift prototype fails, and nothing else in the room moves if it does. Wing-grammar
  framing agreed in-session: Air should be the only
  room where the element moves the visitor (under water → around fire →
  atop earth → carried by air). Note that Moon's approved low gravity is a
  second movement change — the two are distinct (scripted-involuntary vs
  persistent-player-driven) but they touch the same walker and ground-clamp
  code, so the prototypes should share findings.
- **Moon — "be on the moon." DECIDED 2026-08-05.** Austen: *"put the fucking
  person on the moon ... put them in a room that suddenly has stars ceiling
  and has the earth in the background and make them think holy shit I just
  walked through the door and I'm on the moon."* The Still Room reflection
  pool is **retired**, not merged — the mare-pool combination was considered
  and dropped, because repeating Water's mirror pool as the wing's closing
  image was the main problem the surface concept solves. Directly buildable
  from `scenes/cosmic/` (`LunarGroundPlane`, `EarthSphere`, `Starfield`,
  `EarthGodRays`, `LunarCrystals`, `MeteorStreaks`, `NebulaLayer`) — all
  verified present on disk 2026-08-05. Full concept rewritten in the Moon
  section above. Decisions taken in the same session:
  - **Low gravity: approved.** Austen pushed back on the concern that it
    duplicated Air's updraft and he was right — Air's lift is scripted and
    involuntary, low-g is a persistent property the visitor drives. The real
    constraint is tonal, not mechanical: awe before play, so the first ~30
    seconds must not invite jumping.
  - **Silence: approved.** No audio bed at all, the only room in the wing
    without one.
  - **No-fill lighting: approved to prototype, Austen skeptical.** Hard sun
    key with near-black shadows, softened only by Earthshine. *"I'm a little
    bit skeptical but I would like to see how it goes."* Explicit graybox gate.
  - **Distance-misjudgement barrier: flagged unproven, do not build on it.**
    Austen found the idea confusing as first explained, and on re-examination
    it may not survive contact with a game engine. The room's barrier is
    plain scale — no wall, no drop. The perceptual effect is a bonus if a
    graybox shows it lands.
- **Sun — beam mechanism rejected in principle.** Austen on the Sundial's
  sweeping beam revealing one performer at a time: *"I'm not sold on the whole
  notion of a spotlight beam revealing one performer at a time ... but it's
  better than anything I have right now."* Parked rather than replaced — Sun is
  third in build order. Two live directions, neither chosen: (a) **glare
  inversion**, where the barrier and the light channel become the same thing —
  the lit performer is the one you *cannot* look at and you read the three dim
  ones, which makes the visitor turn and shade their eyes and gives Sun a body
  channel it currently lacks; (b) **small, close and hot**, now available
  because Moon has taken over the wing's bright-and-open role and Sun no longer
  has to be the peak.
- **Sun — undecided, and Austen knows it.** His sketch: standing "on the
  sun," engulfed but protected — *"you're in a bubble on the sun ... flames
  can't get past a certain barrier"* — immediately followed by *"I don't
  even know if I like that."* Log as a candidate beside the Sundial, not a
  decision. Reuse path if chosen: ember kit re-tinted white-gold
  (`VolcanicHaze`, `FireWisps`, `HeatDistortion`) + celestial `GodRays`.
- **Standing directive — reuse the elemental scene inventory.** Austen
  flagged that no graybox has used assets from the existing element scenes
  (`scenes/ember/`, `scenes/ocean/`, `scenes/cosmic/`, `scenes/celestial/`,
  `scenes/autumn/`) or the ~500 GLBs under `static/models/`. Grayboxes stay
  primitive by design, but every room's **Phase 2 art pass must start with
  an inventory pass over those libraries** before authoring anything new
  (`never-hand-roll.md`). Each future design doc's Reuse Map section is
  mandatory, not advisory.
