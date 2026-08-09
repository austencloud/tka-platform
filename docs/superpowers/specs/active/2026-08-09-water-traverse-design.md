# The Water Traverse — Design

**Date:** 2026-08-09
**Status:** Approved (Austen, 2026-08-09: "finish this job without any more gates")
**Supersedes:** `2026-08-09-drowned-gallery-channels-design.md` (three channels, air-bells,
buoyant shaft, mirror-pool ensemble)
**Tracker:** amends `DRct0NTn`, `kZfilqc0`, `RGJjXOrk`

## What this is

One walk through water in three states. Ice, then liquid, then steam, staged
across three open landscapes joined by a single watercourse. The visitor walks
one direction and never backtracks.

It is deliberately **outside the museum fiction**. Austen (2026-08-09): *"I'm
kind of considering this experience to be something that'll come long before I
try to make the museum story actually fit."* No Order, no Vulcan Cave, no
diegetic explanation for why a glacier gives way to a seafloor. The piece is
surreal and is allowed to be.

It is also a callback to the app. Winter and Ocean are backgrounds users spin
sequences against every day; walking through them is a homecoming for anyone
who has used the app and a trailer for anyone who has not.

## The spine

**One water surface. Three relationships to it.**

| | Landscape | The visitor is | Letter | Effect |
|---|---|---|---|---|
| 1 | Frozen river across a snowfield | **on top of** the surface | **A** | `sparkles` |
| 2 | Sea trench, walked on the floor | **beneath** it | **C** | `goo` |
| 3 | Geothermal plain | **half in** it | **B** | `smoke` |

On it, under it, in it. The arc resolves by putting the visitor inside the thing
they started out standing on.

### Why those letters

MCP-verified 2026-08-09. A, B and C are the Split-Same group of Type 1
(Dual-Shift).

- **A** is pro / pro. Both hands the same direction, no internal conflict —
  unified and locked. Ice.
- **B** is anti / anti. Also unified, but inverted. A and B are the same motion
  at opposite rotations, which is the exact relationship ice has to steam.
- **C** is the hybrid, anti blue / pro red, and the only one of the three
  carrying both. It also has 16 variations where A and B have 8 — the most
  variable letter in the group. Liquid.

Walk order is A → C → B. Alphabetical order is not walk order; the mapping is
not bent to look tidy.

## Wayfinding: the water is the path

The single constraint Austen set on scale: *"as long as the path is clear and
we don't force the user to have to explore in order to figure out where to go."*

The watercourse is both the theme constant and the route. The visitor is never
given a direction; they are given a river.

1. **Snowfield.** A frozen river cuts a distinct ribbon through snow, readable
   to the horizon. The field may be arbitrarily large because the visitor is not
   navigating the field — they are following the ice.
2. **Sea.** The trench the river became. Seafloor channel, current moving with
   the visitor, god rays overhead.
3. **Geothermal plain.** The hot stream, marked out across the plain by its own
   steam.

Glacier to sea to hot spring: one watershed. Iceland is the real landscape that
is all three at once, and is the art-direction reference.

### Hard constraints

- **One path, always visible, never a choice.** If a visitor stops and turns in
  a circle wondering where to go, the design has failed.
- **Forward-only.** No reason to walk back. The river runs one direction.

## All three states are present in all three landscapes

Each landscape is *dominated* by one state, not limited to it — a hot spring in
a cold place is ice at the edges, liquid in the basin, steam at the interface.
Open sightlines deliver this for free:

- From the frozen river, the steam plume of the geothermal plain is visible far
  across the valley. The end of the walk is visible from the beginning.
- From the seafloor, the Snell window shows ice above; hot vents ahead trail
  steam.
- From the geothermal plain the visitor can turn and see the whole way back.

Nothing is staged to say this. Distance says it.

## Transitions

- **Ice → Sea.** A threshold the visitor sees through first: the frozen river
  widens, the ice thins, green light comes up through a crack, and they walk
  down into it.
- **Sea → Steam.** The one expensive moment. The visitor **rises up through the
  surface** into steam. Both environments must be alive for the length of the
  crossing.

Considered and rejected: transitioning *through* every surface (beautiful,
three times the cost), and morphing the world in place around a stationary
visitor (purest, far beyond budget).

## Performers

One per landscape. One body having a different argument with the same substance:
the ice performer is locked in it, the liquid performer moves with it, the steam
performer is dissolving into it.

**No ensemble finale and no fourth space.** Nothing to complete, nothing to
collect, no gate.

## Grammar: traverse, not complete

This walk is linear, and Water's approved grammar was choose-one
(`RGJjXOrk`). The amendment, to be written into the tracker so it is not
relitigated:

> Fire's verb is **complete the set** — three shrines that must be finished
> because extinction causally requires all three. It is a checklist with a gate.
> Water's verb is **traverse a transformation** — one direction through a
> substance that changes state. Nothing unlocks, nothing completes, there is no
> gate. Linear movement is not the same as a procession of tasks.

Earth's half of that ruling (Earth's verb is *compare*) is untouched.

## What survives, what does not

**Survives:** the water optics work of 2026-08-09 —
`primitives/water-surface-shader.ts` and its `PlanarReflector` seams. Fresnel,
depth absorption, ripple normals and foam are exactly what a geothermal pool at
landscape scale needs.

**Does not survive:** the Drowned Gallery basin geometry. Today's grotto pools
are 19×4 m and 19×7.5 m — room-sized. This is not a room.

**Naming:** `primitives/WaterSurface.svelte` collides with
`scenes/ocean/runtime/water/WaterSurface.svelte`. They are different capabilities
— a reflective pool seen from above versus a Gerstner/Snell underside seen from
below — but the two names cannot sit this close together once the ocean scene is
part of this walk. The primitive is renamed `ReflectivePool.svelte`.

## Risks

- **Three heavy environments in one walk.** Winter and Ocean were authored as
  standalone backgrounds with their own budgets. Running them as landscapes in a
  continuous walk needs a load/unload strategy and a real memory measurement
  before any polish.
- **The rise-through-the-surface moment** needs two environments resident at
  once. Prototype it before anything gets pretty; if it does not land, the
  structure needs rethinking.
- **The scenes were not authored as walkable ground.** They are skyboxed
  backgrounds sized to a camera orbit. Making them walkable terrain is not free.

## Build order

1. The walkable route shell and the watercourse path, graybox, all three
   landscapes at true scale. Proves wayfinding and the sightlines.
2. The sea → steam rise. The one transition that can invalidate the structure.
3. Landscape dressing, drawing on the existing Winter and Ocean subsystems.
4. Performers and their effects.
