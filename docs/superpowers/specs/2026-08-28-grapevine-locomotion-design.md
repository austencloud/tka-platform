# Grapevine Locomotion Design

Status: task-branch prototype pending live multi-rig acceptance

## Outcome

Walk Lab gains a distinct grapevine pattern that travels laterally through a
four-footfall loop:

1. side step;
2. cross behind;
3. side step;
4. cross in front.

The avatar keeps its stage-facing intent while travelling left or right. The
normal sidestep remains a separate movement class.

## Ownership

This extends the existing `@austencloud/scene-3d` `LocomotionAnimator`. It does
not add another gait clock, movement solver, or foot planter.

- Walk Lab selects `lateralGait: "grapevine"` for the grapevine pattern.
- `LocomotionAnimator` selects the authored left/right four-step clips, drives
  their phase, and exposes their measured contacts through its existing gait
  clock.
- `FootPlanter` remains late correction. It may preserve contact but does not
  invent a crossing path.
- Gait diagnostics grade intentional crossover order, 3D foot/leg clearance,
  joint continuity, slip, and weight transfer.

## Motion source and offline authoring

The two already-shipped Mixamo `left strafe walking.fbx` and
`right strafe walking.fbx` files contain captured crossover weight transfer and
lateral root travel. `build-grapevine.py` repeats their two-step cycle, changes
the crossing ankle's fore/aft target during its airborne window, and uses
Blender visual constraint baking to alternate back and front crossings.

The bake preserves the source body motion and ankle orientation. It adds only
the depth change and the minimum vertical clearance required while the ankle
passes the support foot. Runtime IK is not used as an animation generator.

Asset and licensing details live beside the generated clips in
`static/animations/locomotion-pack/GRAPEVINE.md` and
`grapevine.motion.json`.

## Runtime interface

```ts
type LateralGait = "sidestep" | "grapevine";

interface LocomotionInput {
  lateralGait?: LateralGait;
}

interface AnimationUrls {
  grapevineLeft?: string;
  grapevineRight?: string;
}
```

The optional URLs keep existing consumers compatible. `sidestep` is the
default. Root-motion variants are not declared because no authored
`grapevine-*-rm.glb` assets exist.

## Hard gates

The offline build aborts unless both clips:

- contain front and back crossover depth of at least 12 cm;
- keep at least 12 cm between ankle centres, sampled at quarter-frame
  intervals;
- preserve both upper- and lower-leg lengths within 2 mm; and
- keep foot height within 8 cm of the source capture's maximum.

Runtime diagnostics must not treat negative left/right foot order as a
collision for this pattern. They instead require both crossed and uncrossed
order and grade 3D ankle and leg-segment clearance separately.

## Verification

- Rebuild both GLBs and confirm the asset gates pass.
- Inspect front/top contact sheets across the complete four-step loop.
- Run focused walk-pattern, gait-analysis, gait-verdict, and locomotion-clock
  tests.
- In Walk Lab, watch both directions and the reversal seam on every shipped
  rig from front, side, and quarter views, with planting on and off.
- Reject the prototype for any visible foot or shin penetration, knee pop,
  teleport, phase jump, skating contact, or implausible weight transfer even
  when automated metrics pass.

## Known boundary

This prototype supplies an authored cyclic grapevine vocabulary. It does not
yet compile arbitrary footprint poses or score-time footfall events. That
future input must enter through the adopted footprint/timing seams and still be
executed by `LocomotionAnimator`.
