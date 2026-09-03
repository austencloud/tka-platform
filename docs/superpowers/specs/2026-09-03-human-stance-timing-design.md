# Human Stance Timing — Design

Date: 2026-09-03
Status: implemented on `codex/stance-timing`
Owners: `src/lib/shared/3d/collision/stance-yaw-track.ts` (time),
`src/lib/shared/3d/collision/upper-body-stance-planner.ts` (geometry)

## The defect

`planUpperBodyStance` computes the torso turn as a memoryless function of where
the props are on the current frame:

```
yawRad = sign(meanX) * MAX_STANCE_YAW_RAD * smoothstep01(coherence) * lateralWeight
lateralWeight = smoothstep01((|meanX| - 0.10) / (0.28 - 0.10))
```

Three consequences follow from the shape of that expression, not from tuning:

1. It cannot start early. The turn is a strict function of the props' present
   position, so the body reacts where a person anticipates.
2. Every turn has the same velocity profile — whatever profile the props happen
   to sweep the 10-to-28 cm assist band with.
3. There is no history and no lookahead, so a turn that continues through a step
   boundary has nothing to flow out of or into.

A fourth defect is downstream: the animator fans one scalar to Spine1 and Spine2
in a fixed 0.45/0.55 split, so every part of the torso arrives on the same frame.
Real bodies break successively.

The fix is not a filter. `AvatarAnimator` used to low-pass this value and the
filter was deliberately removed (`this.stanceYawSmoothedRad = this.stanceYawTargetRad;`)
because a lag term makes the shoulders face the previous side midway through a
lateral transition and puts the arm through the head. A filter only knows the
past. The timing belongs where the future is known: at score time.

## Ownership

`planUpperBodyStance` keeps its job — *what yaw does this grip geometry want* —
and stays pure and memoryless. A second owner, `stance-yaw-track.ts`, answers
*how does that yaw evolve over score time*. Time is not put inside the geometric
function; the geometric function is sampled across score time to build a curve.

`buildStanceYawTrack` samples the memoryless planner at `SAMPLES_PER_STEP = 24`
per motion step, reduces the samples to keys (`reduceToKeys`; plateaus within
`PLATEAU_EPSILON_RAD = 0.25°` collapse), shifts key times earlier by the
anticipation lead, and fits a curve through them. `sampleStanceYawTrack` reads
that one curve at several offset times to produce the per-segment angles.

## The curve: monotone piecewise cubic Hermite (PCHIP)

Fritsch & Carlson, *Monotone Piecewise Cubic Interpolation*, SIAM J. Numer.
Anal. 17(2), 1980 — the same algorithm as d3's `curveMonotoneX`. Implemented in
`monotoneTangents` / `hermite`.

Why this one:

- **It cannot overshoot.** The shoulder limit is 87°, three degrees clear of the
  90° degeneracy where the shoulder line runs parallel to root forward — a
  documented limit cycle that produced an 8.2° flicker on ch18. Catmull-Rom and
  natural cubic fits ring past their keys, and here a ring goes straight into
  that degeneracy. The PCHIP tangent limiter makes overshoot impossible by
  construction, which `stance-yaw-track.test.ts` asserts.
- **It is C1.** The tangent at an interior key is a weighted mean of the
  neighbouring secants, so a turn that continues in the same direction through a
  step boundary keeps its speed instead of stopping and restarting. Where the
  secants change sign the tangent is zero, which is what a reversal wants.
- **It needs no per-turn authoring.** Keys come from the geometry itself, so a
  sequence nobody has tuned still gets a curve.

Rejected: **inertialization** (Bollo, GDC 2018), a decaying polynomial blend over
a transition. It is a reactive smoother — it can only respond to a target that
has already changed, which is the property that made the removed low-pass wrong.
Rejected: **a second low-pass on the delivered yaw**, same reason plus the
recorded arm-through-head failure. Rejected: **a time-varying Spine1/Spine2
fraction split**, because it moves the shoulder line the grip solve converges
against (below).

## Anticipation: 0.07 steps on the shoulders, the rest from the lower spine

Anticipatory postural adjustments in the trunk precede a focal limb movement by
roughly 50–120 ms. At an ordinary 0.66 s step that is about 0.08–0.18 steps, so
that window was the starting point: `ANTICIPATION_LEAD_STEPS` began at 0.22.

Measurement killed that. A 400-frame collision sweep of ch18:

| shoulder lead | frames with a hit | worst penetration |
| --- | --- | --- |
| 0.22 | 22 | 57.8 mm (reaching `penetrate`) |
| 0.10 | 12 | 40.3 mm |
| 0.07 | 7 | 21.9 mm |

The mechanism was isolated rather than guessed at. Zeroing the stagger and head
drag left the sweep at 21 frames, so the stagger was innocent; zeroing the lead
alone dropped it to 14 frames / 27.7 mm. Sampling matched phases confirmed it:
at the same delivered chest yaw (~55°) main measured 8.45 mm of shaft-to-torso
clearance and this branch 20.81 mm of overlap, because the yaw arrives while the
props are still less lateral. **Leading the shoulder line is expensive precisely
because the arms are solved against it.**

The lower spine is not. It carries no grip constraint, so the anticipation moved
there: `TORSO_STAGGER_STEPS` rose from 0.16 to 0.24, which moved nothing in the
ch18 sweep while taking Spine1's own lead over the props from about 0.09 to 0.13
steps. On the synthetic fixture the split is eightfold — Spine1 leads the
geometry by 0.148 steps in mean quantile terms against the chest's 0.018 — and
that ratio is what the unit test pins.

The lead is anticipation, not a permanent offset: the ease-out settles the chest
onto the geometry's own arrival (within 0.07 steps on the fixture) rather than
arriving early and holding.

## Successive breaking: one curve, four read heads

`sampleStanceYawTrack` never plans four curves. It reads the single curve at
staggered times:

| segment | sampled at | note |
| --- | --- | --- |
| Spine1 | `t + SPINE2_SHARE * TORSO_STAGGER_STEPS` | leads |
| Spine2 | `t - SPINE1_SHARE * TORSO_STAGGER_STEPS` | trails |
| chest | `SPINE1_SHARE * lead + SPINE2_SHARE * trail` | the shoulder line |
| head | `t - SPINE1_SHARE * TORSO_STAGGER_STEPS - HEAD_DRAG_STEPS` | settles last |

The shoulder line is load-bearing, so the stagger is expressed as an excess about
the resting split and then put back symmetrically:

```
stagger = softLimit(leadingSpine - SPINE1_SHARE * chest, MAX_SPINE_STAGGER_RAD)
spine1  = SPINE1_SHARE * chest + stagger
spine2  = SPINE2_SHARE * chest - stagger
```

`spine1 + spine2 === chest` identically, however large the stagger and whether or
not the bound engaged. The grip solve therefore sees exactly the yaw the planner
delivered; none of the anticipation leaks into it.

`softLimit(v, L) = L * tanh(v / L)` bounds the stagger (22°) and the head lag
(30°) without a flat top and without the velocity kink a clamp introduces at the
bound. The animator keeps hard clamps at 25° and 34° as defensive bounds, set
deliberately above the app-side soft limits so a guard that fires is a bug rather
than the design.

`arrivals.hips` is reported as `null`, not zero: the animator rotates no hip
bone, and the lab labels that lane "pinned — the feet never slide".

## The corridor, and why it takes two numbers

`planUpperBodyStanceDepth` opens the ±0.118 m positional depth lane only above
80% of the turn (`SIDE_ON_YAW_KNEE_RAD`), because a linear ramp dragged the rear
grip through the torso while the chest was still half square. Anticipation moves
the chest earlier relative to the props — precisely into that mid-transition
regime — so the knee now takes both numbers:

```
alignedDesire = sign(propDesire) === sign(yaw) ? |propDesire| : 0
sideOn        = max(|yaw|, alignedDesire)
```

Only an aligned desire counts. Through a reversal the delivered yaw passes
through zero while the props still ask for the side being left, and opening a
corridor in the sign of a near-zero yaw would steer the grips the wrong way at
the frame they are least committed. On the untracked path the two numbers are
equal, so that path is bit-for-bit unchanged.

A/B at final settings on ch18: corridor off 16 frames / 28.36 mm, corridor on
7 frames / 21.89 mm.

## Consumers

`resolveTrackedUpperBodyStance` is the single seam. `Viewer3DScene.svelte` and
`LiveSequencePerformer3D.svelte` both route through it, and both pass
`stanceSegments` down to the rig. With no track the function returns the historic
instant-arrival split, so an unbuilt track degrades to today's behaviour rather
than to a broken pose. The lab receives the track for telemetry only; it never
poses anything.

The animator side is a `pnpm patch` of `@austencloud/scene-3d@0.1.6` (src and
dist): `setStanceYawSegments`, `applyBladeYaw(bone, angleRad)` taking an angle
instead of a fraction, and `applyStanceHeadLag`.

## Results

Four rigs, 400-frame sweeps, main versus this branch:

| rig | main frames / worst | this branch |
| --- | --- | --- |
| ch18 | 11 / 36.49 mm | 7 / 21.89 mm |
| ch07 | 85 / 53.40 mm (reaching `penetrate`) | 67 / 34.67 mm |
| ch01 | 10 / 58.35 mm | 0 / 0.00 mm |
| intake-current | 29 / 52.51 mm | 31 / 52.43 mm |

The intake-current delta is not a regression: over the narrow 2.2–3.4 window both
branches read identically (14 frames, the same hit list, 52.51 vs 52.43 mm). That
band is pre-existing; the +2 is its mirror at 6.x.

Held facings on all four rigs keep 0.00 mm grip-separation spread, 0 collisions
and 0.000° axis error. Angular velocity is continuous across mid-turn boundaries:
at t = 2.00 the samples 1.98 → 2.02 give successive deltas of 0.245, 0.220, 0.195
and 0.170 rad/step — monotone, no jump.

## The lab

`/test/staff-grip` plays as well as scrubs. The band under the four cameras draws
the yaw track against score time with the prop lateral signal on the same axis, so
the lead reads as a phase offset and the ease reads as curvature; the lower lane
draws Spine1, chest, Spine2 and head as a share of each one's own full turn, so
the successive break reads as stagger.
