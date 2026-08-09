# First Fire Gate 1 floor-plan candidate

**Status:** CANDIDATE. Not approved, canonical, or authorized for implementation.

**Geometry authority:**
`src/lib/features/museum/data/first-fire-procession-plan.ts`, exported through
`2026-08-06-first-fire-blender-plan.json`. This document interprets that
coordinate chain; it does not replace it.

## Room brief

First Fire teaches through three isolated encounters: DJ, EK, and FL perform in
separate shrine habitats while the environment answers the visitor's movement,
then remembers each completed encounter as cooling coals. It differs from Water
by turning a damp, compressed threshold into a dry procession of choices and
consequences; it differs from Earth by surrendering every red source before
living green is allowed to answer. The room contains exactly three performers,
as every elemental room now does, but Fire alone withholds them one at a time.
**Emotional sentence:** the visitor enters damp and cautious, passes through a
fire that notices and remembers them, then leaves toward living green after the
room willingly gives up its heat.

The selected identities remain DJ, EK, and FL. This candidate does not claim
that their exact museum sequences are mounted in the current review route.

## Top-down plan

Plan coordinates are room-local metres. Origin `(0,0)` is the north-west
interior corner; `+X` runs west to east, Water to Earth; `+Z` runs north to
south. The 60 by 30 metre envelope and all geometry below are retained from the
current TypeScript/JSON contract. Diagram cells are approximately 2 metres.

```text
 NORTH / Z=0                         +X -> EARTH
 X=0       10        20        30        40        50       60
   +---------+---------+---------+---------+---------+---------+
 0 |          C  [3 DJ]|RR                      [7 FL]        |
   |          C  ppppp |RR           BBBBB      ppppp         |
 5 |          C pp   pp|RR          BBBBBB     pp   pp        |
   |       3>>C p DJ  p|RR         BBBBBB      p FL  p        |
10 |          C pp123pp|RR  BBBBBBBBBBBBB       pp123pp       |
   |             p4p   |    BBBBBBB               p4p         |
15 W==1 steam==2 EMBER=>3             RR             8        |
   |                     \             RR             \       |
20 |       BBBB           \    p4p     RR              \      |
   |       BBBB            \  pp321pp  RR               \     |
25 |       4===============> [5 EK]p  RR   6======>      9     |
   |                           pp   pp  RR                 GGG=>E
30 |                            ppppp   RR                 GGG  |
   +---------+---------+---------+---------+---------+---------+
 WATER W=(0,15)                                      EARTH E=(60,28)

 Route: 1 steam threshold -> 2 ember bridge -> 3 DJ orbit ->
        4 blind transfer -> 5 EK orbit -> 6 blind transfer ->
        7 FL orbit -> 8 total red extinction -> 9 green Earth pull

 [3 DJ] / [5 EK] / [7 FL] mark the numbered shrine encounters
 p      visitor orbit, radius 4.8 m, width 2.4 m, sweep 240 degrees
 1-4    four overlapping activation zones around each orbit
 C      dense 10-stem entry torch curtain, x=10.5-11.5, z=3.5-14.2
 RR/BBB full-height rock ribs and return baffles; blind-transfer owners
 =====  3 m transfer route with medium torch-density bands on both edges
 EMBER  short 3 m clear bridge, x=5.5-10
 GGG    green growth path; hidden and unlit until all red is extinguished

 State overlay:
 - Active shrine: tall perimeter fire and one hero fire volume.
 - Completed shrine: the same perimeter positions remain as low coals.
 - After FL: every red flame and coal is absent before GGG appears.
```

The ASCII cells are illustrative. Where a cell edge differs from the exact
rectangles below, the code/JSON coordinate is authoritative.

## Coordinates and dimensions

| Item | Retained contract | Candidate change | Reason |
|---|---:|---|---|
| Interior envelope | `x=0..60`, `z=0..30` | None | Existing circulation and sightline proof depend on it. |
| Water door | west, centre `(0,15)`, 2 m clear | None | Maintains the Water handoff. |
| Earth door | east, centre `(60,28)`, 2 m clear | None | Maintains the bent Earth reveal. |
| Steam threshold | `x=0..5.5`, 4 m clear | None | Low wet-to-dry transition. |
| Ember bridge | `x=5.5..10`, 3 m clear | None | Short threshold, not the room hero. |
| DJ shrine | centre `(16.5,8.5)` | None | Preserves the first isolated encounter. |
| EK shrine | centre `(31.5,21.5)` | None | Preserves the southward reversal. |
| FL shrine | centre `(47,8.5)` | None | Preserves the final northward return. |
| Each habitat | radius `2.2 m` | None | Performer-only interior. |
| Each trench | inner `2.75 m`, outer `3.5 m` | None | Maintains public/exhibit boundary. |
| Each orbit | radius `4.8 m`, width `2.4 m`, sweep `240°` | None | Four overlapping zones fit without a missable trigger. |
| Activation zones | 4 × `75°`, advancing every `55°` | None | Retains `20°` overlap and monotonic progression. |
| Field torches | 72 stems | Visual tiering only | Keep spatial density; replace triangular flame treatment. |
| Shrine torches | 18 per shrine, 54 total | Visual/state tiering only | Same anchors become tall fire, active response, or coals. |
| Detailed fire | maximum 1 shrine | Enforce visibly | Current review incorrectly shows detailed fire at all three. |
| Entry curtain | `x=10.5..11.5`, `z=3.5..14.2` | None | First pressure wall and DJ concealment. |
| DJ/EK rib | `x=22.5..24.8`, `z=0..19.5` | None | Blocks performer and walking sightlines. |
| DJ/EK baffle | `x=15..22.5`, `z=19.5..23.8` | None | Completes the blind south transfer. |
| EK/FL rib | `x=37.5..40.5`, `z=10.5..30` | None | Blocks performer and walking sightlines. |
| EK/FL baffle | `x=27.2..37.5`, `z=7.5..11.5` | None | Completes the blind north transfer. |
| Growth path | FL exit via `(53.5,13)`, `(54.5,26.5)` to `(60,28)` | None | Green originates from Earth and does not reclaim the room. |

No spatial change is proposed at Gate 1. The proposed changes are interaction,
fire ownership, and evidence requirements. The live production Fire room still
uses the superseded smaller amphitheatre, so this 60 by 30 metre plan cannot be
treated as integrated-room proof.

## Longitudinal section

The current Blender graybox does not define a single finished cave ceiling.
Its wall cores are 5.7 m high, irregular perimeter rocks reach approximately
7.4 m, and rib dressing reaches approximately 6.8 m. Those are graybox extents,
not an approved final ceiling profile.

```text
 HEIGHT
 7.4 m  . . irregular shell maximum / final ceiling silhouette unresolved . .
 6.8 m        /\ full-height dressed ribs /\       final sightline blocked
 5.7 m  ======== wall/rib core occlusion band ==============================
 3.5 m       tall entry-curtain flame envelope (approximate graybox maximum)
 3.2 m       tallest curtain stem
 2.3 m             performer head top and tallest transfer stem range
 2.0 m             DJ / EK / FL body silhouette and perimeter stems
 1.70 m  ---------- visitor eye line -------------------------------------->
 0.95 m             shortest transfer stem
 0.34 m       ember glow / flame anchor offset above each stem
 0.09 m             shrine rim and habitat top
 0.04 m  __________ walk floor / orbit / transfer ribbons _________________
 0.00 m             plan datum; trench fire occupies the ring at floor level

 WEST/WATER   steam -> ember -> DJ -> blind rib -> EK -> blind rib -> FL
                                                                |
 Final view after extinction: neutral floor at eye line -> green crack bends
 south toward Earth. No red source remains in that sightline.
```

Gate 2 must prove these heights from moving first-person eye level. The ribs
must block full performer silhouettes, not merely centre-to-centre plan rays.

## Route storyboard

| Beat | Visitor sees | Visitor does | Visitor understands | Environment changes |
|---:|---|---|---|---|
| 1. Water release | Drips, steam wisps, dark basalt; no full fire field yet | Walks through the 4 m threshold | Water is becoming heat | Hiss and steam localize, then the passage dries |
| 2. Ember bridge | A short incandescent crossing and first tall curtain beyond | Crosses without a puzzle | Fire is the route language, not scenery | Torch density gathers into a forward opening |
| 3. DJ | One isolated performer inside a trench; no EK or FL sightline | Enters DJ and follows the 240° orbit | The room notices forward movement | Four overlapping zones kindle behind the visitor; completion lowers tall fire to coals |
| 4. South blind transfer | Cooling DJ coals behind, rock and torch bands ahead | Backtracks if desired or follows the only legible forward thinning | Completion is remembered but does not trap them | DJ remains coal-lit; EK becomes the only strong red focus |
| 5. EK | EK alone, composed differently by its perimeter response | Completes the mirrored 240° orbit | The same walking verb can produce a distinct encounter | EK perimeter advances, then collapses to coals |
| 6. North blind transfer | EK disappears behind full-height rock; FL begins to leak through | Follows the northward return | The procession has a final destination | FL becomes the only detailed red source |
| 7. FL | FL alone inside the final trench | Completes the final orbit | The room is about to release its accumulated heat | Final response peaks; the state advances to total extinction |
| 8. Release | Safe neutral floor, smoke, and darkness without red | Stops or turns back freely | Fire is finished, not merely dimmed | Every flame and coal extinguishes; one quiet breath follows |
| 9. Earth answer | Green appears inside the existing gully, reaches the trench, then stays connected to Earth | Follows the green branch around the bend | Growth is an answer from the next room | Green completes the final ring and becomes the exit cue |

## Sightline and backtracking rules

1. At 0.2 m samples along the complete forward route and the same samples in
   reverse, the visitor may see at most one performer.
2. Test moving visibility windows, not only named stops. Rays must cover the
   lowest performer point that must remain readable through the entire intended
   window, plus head and active fire envelope.
3. DJ and EK are separated by both `dj-ek-rock-rib` and its return baffle. EK
   and FL are separated by both `ek-fl-rock-rib` and its return baffle. Dressing
   may enlarge these solids but may not perforate or lower their proven core.
4. The entry torch curtain may conceal DJ's reveal but cannot be the sole
   safety-critical occluder; fire changes state while rock does not.
5. Completed fire walls become coals rather than geometry. Every completed leg
   remains physically walkable in reverse.
6. From FL and the Earth growth path, DJ and EK remain hidden. From Water
   re-entry after completion, the visitor reads a cooled route, not three
   performers at once.
7. Audio follows the same isolation contract: only the local performer may be
   dominant from any route sample. This is measured later in the integrated
   room, not claimed by this plan.

## Conceptual interaction state map

This map consumes the existing monotonic owner; it does not add parallel state.

```text
 approach
   | threshold/bridge: step-following field ignition, no phase mutation
   v
 enter DJ -> dj-active
   | orbit zones 1..4: perimeter response follows visitor steps
   v
 dj-complete  [DJ tall fire -> coals; backtracking open]
   v
 enter EK -> ek-active -> zones 1..4
   v
 ek-complete  [EK tall fire -> coals; DJ coals remain]
   v
 enter FL -> fl-active -> zones 1..4
   v
 fire-extinguished
   | ALL red fire and coals off -> safe neutral pause -> smoke draws east
   v
 completeFirstFireGrowth()
   v
 growth-complete [green reaches final trench and remains linked to Earth]

 Same museum session re-entry: retain growth-complete.
 New museum run: createFirstFireProcessionState() resets to approach.
 Future shrine events, repeated zones, and reverse walking never regress state.
```

Ignition may respond to player steps and the active shrine's local timing, but
this candidate makes no new claim about DJ/EK/FL motion or sequence mounting.

## Fire-tier placement map

One shared production fire owner must select all tiers. The current triangular
billboard mask is excluded.

```text
 WATER  curtain/field      DJ       transfer       EK       transfer      FL  EARTH
   |   F F F F F F F   [ H/N ]   F F F F F F   [H/N]   F F F F F F   [H/N]  |

 H = exactly one active hero raymarched volumetric in the entire room
 N = proposed near pool, maximum 8 low-tier volumetric torch flames nearest
     the camera, assigned with distance hysteresis to prevent visible swapping
 F = cullable instanced far-field volumetric flipbook/impostor batches derived
     from the same blackbody palette, erosion, warp, and timing vocabulary
 L = six-position corridor light pool is the retained starting proposal;
     actual count must be measured, not canonized by this diagram
 S = exactly one active shrine shadow owner; inactive shrines cast no fire cube
     shadow and use coals/far tier only
```

Each tier must share irregular flame bases, detached tongues, internal
yellow/orange depth, extinction timing, reduced-motion behavior, lifecycle, and
disposal. No tier may resolve into a symmetric triangular outline at the
closest distance where it is allowed to render. There is never one point light
or shadow map per torch.

## Unresolved questions and risks

- The final cave ceiling and vertical silhouette are not approved. Current
  5.7–7.4 m graybox extents are evidence, not an art target.
- The live production room is 46.5 by 20.5 m and still renders the superseded
  amphitheatre. Resizing to 60 by 30 m moves downstream rooms and requires a
  complete museum connectivity review.
- The selected sequence IDs exist in current data, but this Gate 1 candidate
  does not prove source fingerprints, live playback, timing exposure, prop
  clearance, or performer audio.
- The proposed near pool cap of eight and retained six corridor-light anchors
  are hypotheses. Gate 4 performance evidence may lower or redistribute them.
- Step-following ignition needs a generous cadence definition so sprinting,
  stopping, reduced motion, and uneven frame rate produce stable responses.
- The neutral pause needs an authored duration and safe illumination floor. Too
  short loses the release; too long feels like a broken exit.
- Green must originate visibly from Earth without exposing Earth's larger room
  reveal through the door or gully bend.
- Close fire, smoke, transparent overdraw, and shadow refresh can dominate GPU
  cost even when draw-call counts look small.
- The current floor-plan SVG is broadly consistent with the retained plan, but
  its decorative curves are not geometry. Code/JSON win any coordinate dispute.

## Gate 1 acceptance tests

Gate 1 remains open until all of the following are shown and Austen can describe
the intended experience without relying on prose beside the artifact.

### Spatial proof now

- Machine comparison confirms this candidate's envelope, doors, shrine
  centres, radii, orbit sweeps, activation zones, occluder rectangles, route
  widths, and torch counts match the TypeScript plan and exported JSON.
- Forward and reverse route samples at 0.2 m remain inside the room, outside
  rock and trenches, connected Water-to-Earth, and wide enough for the stated
  2.4/3/4 m clear routes.
- Moving eye-height windows prove at most one full performer readable at any
  route sample. Report worst-case clearance at the lowest required visible
  point; fixed centre rays are insufficient.
- A numbered top-down board and longitudinal section keep Water entry, first
  focus, DJ/EK/FL order, orbit direction, state consequence, final view, and
  Earth exit understandable without narration.
- Austen correctly explains: where he enters, what calls attention first, the
  route order, what he does at each shrine, what changes because of it, where
  red ends and green begins, the final view, and how he exits. Record his actual
  paraphrase and explicit Gate 1 approval; enthusiasm alone is not approval.

### First-person framing required at Gate 2

- Water withholds the full field until the intended reveal.
- DJ, EK, and FL each receive one continuous full-body viewing window; no free
  walk angle exposes two performers.
- Torch density guides forward travel without hiding the orbit entrance or
  making backtracking look closed.
- Extinction leaves the route safely legible, and green is the only saturated
  exit cue after the neutral pause.
- Near/middle/far captures show one fire family with no triangular silhouette,
  white-core clipping, billboard rotation, or visible tier swap.

### Runtime and performance evidence required later

Gate 1 does not set production performance targets. Before Gate 4 approval,
record target hardware/GPU and viewport, cold and warm runs, p50 and p95 frame
time, draw calls, triangles, active hero/near/far fire counts, transparent
overdraw proxy, dynamic-light count, shadow-map count and refresh rate, GPU
memory, shader compilation stalls, and console output. The detailed hero count
must never exceed one; no measurement may be taken only on the isolated route
when the merged museum is the acceptance target.
