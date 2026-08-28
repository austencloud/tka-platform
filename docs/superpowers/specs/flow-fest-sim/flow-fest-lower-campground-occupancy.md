# Flow Fest lower campground occupancy

## Governing correction

The 2023 registered NAIP loop is the lower campground's vehicle circulation
road. It replaces the old visual implication of a second road cutting across
the middle of the clearing.

Austen's 2026-08-28 operational correction governs how festival dressing uses
that loop:

- cars concentrate in the open interior;
- only a few tents mix directly with those cars;
- a larger tent band sits near the inside edge of the loop; and
- the main lower tent population sits across the road beside the tree line.

This is authoritative topology, not a survey of a particular year's individual
vehicles or tent pitches. Exact dressing positions remain deterministic
festival placement derived from the registered loop.

## Runtime ownership

`flow-fest-camp-plan.ts` owns both the registered loop and the occupancy policy.
The minimap, ground mask, route clearance, and production dressing must consume
that shared plan. No second hand-authored center road or direct destination line
may imply a drive through the car-camping field.

## Acceptance

- The lower loop is the only vehicle road drawn around the lower clearing.
- The entrance approach joins the loop without a second center-cut segment.
- Every lower car is inside the loop and concentrated near its center.
- Interior car-camping tents are a minority.
- Inner roadside tents remain inside the loop.
- Tree-line tents remain outside the loop.
- All tents and cars stay clear of registered roads and foot connectors.
- The scene remains deterministic and uses instancing for both populations.
