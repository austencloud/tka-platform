# Flow Fest Arrival Arc — Roadmap

**Date:** 2026-09-02
**Status:** Decomposition agreed. Sub-project 1 (Drive in) selected for the first design.
**Settled so far:** chase camera behind the car; approach extended along the real
ODOT bearing to the survey west edge (~885 m, ~130 s at a careful 15 mph), fully
player-steered.
**Scope:** This is a roadmap, not an implementation spec. Each sub-project below
gets its own `YYYY-MM-DD-<topic>-design.md` and its own implementation plan.

## The arc, as Austen described it

Recorded verbatim in intent and order, 2026-09-02:

> When you first open up this game you should drive in — that's the whole thing.
> You arrive at the festival on the road after having driven in for a couple
> minutes through the cornfields. Then drive your car carefully and slowly into
> the front gate. You park it off to the side temporarily. You get out of your
> car. You go to the pop-up canopy which is set up, which has a picnic table and
> several people behind it. You get your wristband. You show your ID. You say hi
> to a couple friends. Then you get told where the parking situation is, and you
> go drive your car to wherever you set up camp. Then you take a while to
> actually unload your stuff and maybe set up, and make sure that you move the
> car back to its spot within two or three hours after pulling in — but nobody is
> really going to harp on you for that. Then after that your car's parked, your
> stuff is set up, you probably need like a meal or something, and you probably
> have a lot of friends you want to say hi to. Maybe check out the vendors at
> Vendor Village along the way. Maybe even just do a walk around the campground
> just to see what there is to explore. And while you're walking around the
> campground you're going to run into people you know from past years, and people
> who are spinning, and people who are already forming jam circles, people who are
> excited to be seeing each other again.

The load-bearing sentence is the first one. Arrival is the emotional core of a
festival, and it is currently the only part of the sim with no simulation in it.

## What the sim already has

| Capability | Owner |
| --- | --- |
| Registered road centerline (18 ODOT points, NAD83/UTM 16N) | `FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD` in `src/routes/test/flow-fest-sim/flow-fest-camp-plan.ts` |
| Surveyed camp entrance `{328.26, -98.16}` (Aug 2024 Street View panorama, snapped 0.63 m to ODOT feature 3019609) | `FLOW_FEST_CAMP_ROAD_ENTRANCE`, same file |
| Gatehouse site, lower check-in point, campground loop, entrance basis with `driveInwardUnit` | `FLOW_FEST_LOWER_GATEHOUSE_SITE`, `FLOW_FEST_LOWER_CHECK_IN`, `FLOW_FEST_LOWER_CAMPGROUND_LOOP`, `FLOW_FEST_LOWER_ENTRANCE_BASIS` |
| "South cornfield" landmark and region | `flow-fest-camp-plan.ts` |
| 1 m DTM terrain, 1025×1025 samples, world bounds ±512 m | `static/data/flow-fest-sim/terrain.manifest.json` + `terrain-height.f32` |
| A complete ground-vehicle simulation — for the electric unicycle | `src/lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle.ts` and `state/flow-fest-mobility-state.svelte.ts` |
| NPC population with a `gate-greeter` role and a `gate-greet` activity, plus display names, sociability, schedules, routable anchors | `src/lib/features/flow-fest-sim/domain/flow-fest-population.ts` |
| 11-phase progress state machine with objectives and snapshot validation | `src/lib/features/flow-fest-sim/state/flow-fest-progress.ts` |
| 44 parked cars, correctly grounded on their tyres | `src/routes/test/flow-fest-sim/flow-fest-parked-cars.ts` |
| Sim clock at 0.5 minutes per second | `FLOW_FEST_SIM_MINUTES_PER_SECOND` |
| Corridor graph, audio walla, fire jam, forest ecology | various, `src/routes/test/flow-fest-sim/` |

The EUC is the important one. It is the pattern a drivable car follows: input
merge, dynamics step, terrain attitude derivation, collision reconciliation,
mount and dismount, battery, odometer, parked collider, snapshot and restore.

## What the sim does not have

- **Driving of any kind.** The two phases that would carry it are staged
  buttons. `camp-arrival` reads *"Vehicle travel is staged without inventing a
  drive time"*; `vehicle-settle` reads *"The registered road centerline ends in
  west upper parking. Travel is untimed"*. The action labels are literally
  "Stage arrival" and "Stage west parking".
- **Getting in or out of a vehicle.**
- **Any interaction or conversation system.** The nearest thing is
  `observeFlowFestFireJam`, a proximity observer hardcoded to the fire's
  coordinates with a fixed join radius.
- The canopy, the picnic table, the crew behind it, the wristband, the ID.
- Cargo, unloading, the soft two-to-three-hour move-the-car window.
- Meals.
- **Vendor Village. It does not exist anywhere in the code or the camp plan.**
- Free-form campground wandering. Today the equivalent phase is a directed walk
  to Middle Earth.
- Anyone you know from past years.
- Daytime jam circles that form on their own.

## Standing constraint: how long the approach drive can be

Measured against the registered geometry, not estimated:

- The ODOT centerline as authored runs x −170 → 370 and affords about **540 m**.
- Extended along its real bearing to the west edge of the surveyed terrain
  square, the distance from that edge to the gate is about **885 m**.
- That is roughly **80 s at 25 mph**, **100 s at 20 mph**, **130 s at 15 mph**.

So "a couple of minutes through the cornfields" is reachable, but only at a
genuinely careful rural speed. The 1024 m terrain square cannot afford a fast
two-minute approach without extending coverage outside the survey. Any design
that wants a longer approach has to choose deliberately between a slower
authored speed, a curved or looping alignment that uses more of the square, or
new terrain west of the current bounds. Do not quietly assume one of these.

## Decomposition

Six independent subsystems, in dependency order. Each gets its own spec, plan,
and implementation cycle.

### 0. Loadout and economy — ADDED 2026-09-02

Austen, when asked whether the player picks their car:

> If the very first thing in your game is picking your car, well why aren't you
> going to pick the one prop that you come in with, and the tent that you pick it
> in with? Why not have a finite set of money that allows you to pick your
> favourite things? For example if you get a bigger and better tent then you're
> going to sleep more, because we're eventually going to have an energy bar which
> is going to keep track of how much you've been moving around and how much you
> need to go rest. Also you could pick whether you want to eat from the vendors
> which costs more money, or if you want to prepare food ahead of time which
> actually saves you money — but I don't know how that game mechanic would make
> sense, because obviously everyone would just prepare ahead of time.

A finite budget spent before the drive, on the things you arrive with: car,
prop, tent, food strategy. The tent feeds a future energy and rest system. The
car caps cargo.

**The prepare-versus-buy balance.** Prepared food is cheaper in money and more
expensive in everything else, so neither play dominates:

- **Time and distance.** Eating from your cooler means walking back to camp,
  cooking, and cleaning up — time away from the festival, and the walk spends
  the same energy the tent exists to protect. Vendor food is where you already
  are.
- **Cargo.** A cooler takes room in the car and time to unload; room not spent
  on a bigger tent. The car you picked caps both.
- **Decay.** Ice melts. Day 3 cooler food restores less than day 1. Vendor food
  does not degrade.
- **Where the people are.** Vendor Village is where you run into people you
  know. Eating alone at camp is the cheapest meal and the one where nothing
  happens to you.

A pickup with a big cooler and a cheap tent is a coherent build; so is a
hatchback with a great tent and a vendor budget. Every one of those costs is
something the sim needs for other reasons, so none of it is a balance tax
invented to prop up the mechanic.

**The discipline that keeps this honest:** a choice may only appear on the
loadout screen once at least one of its consequences is implemented. Otherwise
it is a menu that lies. The budget and the car qualify immediately; the tent
qualifies when it becomes cargo you carry and pitch; food qualifies when Vendor
Village and the energy bar exist. The data model is designed once, in full, and
the screen reveals choices as their consequences land.

Depends on nothing. Its consequences land across sub-projects 1, 3, 4, and 5.

### 1. Drive in — SELECTED, designing next

Car vehicle simulation on the EUC pattern; the road extended west through the
cornfields; careful, slow entry at the front gate; temporary parking off to the
side; getting out of the car.

Prerequisite for sub-project 3. Self-contained and independently verifiable.
Austen: *"that's the whole thing."*

### 2. The canopy

A general proximity-interaction owner, generalizing `observeFlowFestFireJam`
rather than adding a second parallel proximity system. The canopy, picnic table,
and crew as a real site. Wristband and ID as an exchange with people instead of
a button. Being told where the parking situation is, through a person.

Foundation for sub-projects 4 and 5 as well.

### 3. Camp arrival

Drive to the site you chose. Unload cargo over real time. The soft
two-to-three-hour window to move the car back, measured against the sim clock,
enforced socially rather than punitively — nobody harps on it.

Depends on 1 (a drivable car) and 2 (being told where to go).

### 4. The campground as a place

Vendor Village as new site content. Meals. Free roam replacing today's directed
walk to Middle Earth.

Depends on 2 for anything interactive.

### 5. People you know

Returning acquaintances with memory of past years. Greetings. Jam circles that
form on their own during the day, not only at the scheduled fire jam.

Depends on 2, and reads best after 4 exists to wander through.

## Rules that bind this work

- `.claude/rules/never-hand-roll.md` — the EUC is the existing ground-vehicle
  owner and `observeFlowFestFireJam` is the existing proximity observer. Extend
  or generalize; do not stand up parallel implementations.
- `.claude/rules/no-fabrication.md` — the site geometry is surveyed. Do not
  invent distances, alignments, or site features that the registered data does
  not support. Say when something is authored rather than measured.
- `.claude/rules/visual-verification-mandatory.md` — every visual change here is
  a size, position, or structure change.
- `.claude/rules/worktree-workflow.md` — one worktree per sub-project.

## Related

- `docs/superpowers/specs/active/2026-08-24-flow-fest-sim-design.md` — the
  foundation spec. Its first vertical slice already listed "drive directly to
  the selected site" and the return drive through the lower gate; both shipped
  as staged buttons instead.
- Memory: `project_flow_fest_arrival_arc`, `project_flow_fest_car_replacement`,
  `reference_flow_fest_meshy_cars`.
