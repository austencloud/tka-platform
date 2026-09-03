# Locomotion Gait Tiers: A Real Run, Not A Fast Walk

**Date:** 2026-09-03
**Status:** implemented on `claude/locomotion-tiers`
**Scope:** walk hardening, a run tier bound to Shift, ground momentum, and a
run-aware gait probe.

## The request

> "If we could harden the walking animations and make it so the character can
> run if they hold shift using whatever triple A approach is appropriate in
> 2026 ... I like that they're walking around mostly naturally with actual leg
> movement that attaches to the ground but I think it's not quite on the level
> of realism that I'm looking for."

Three separable defects sat behind "not quite on the level of realism":

1. **There was no run.** Shift multiplied the commanded speed by 2.3 and the
   walk clip absorbed all of it, which is the cartoon speed-walk.
2. **There was no momentum.** Velocity snapped from 0 to full and back in one
   frame, so every start and stop was instantaneous.
3. **The gait probe could not grade a run** even once one existed. Its bands
   are walking-gait bands, so a correct run failed 9 of 18 rows.

## Ownership statement

Per `.claude/rules/never-hand-roll.md`, the required relationship for each
piece of shared behaviour:

| Capability | Relationship | Owner |
|---|---|---|
| Gait clock, clip blend, contacts, stride scaling | **extend** | `@austencloud/scene-3d` `LocomotionAnimator` |
| Ground velocity over time (accel/decel/air control) | **create** | `packages/camera-3d/src/lib/ground-velocity.ts` |
| Movement input to world velocity | **extend** | `packages/camera-3d` `UnifiedCameraController` |
| Gait grading | **extend** | `src/lib/shared/3d/diagnostics/gait/gait-verdicts.ts` |

No parallel gait clock, planner, controller, or grader was created. The canon
(`docs/architecture/locomotion-research-canon.md`) forbids all four.

## Why a run is a second set of clips, not a multiplier

`updateGaitSplit()` implements Grieve's square-root law: for a speed ratio
`r = commanded / clipNative`, authored stride is `clamp(sqrt(r), 0.5, 1.15)`
and playback rate carries the remainder. The 1.15 cap is on `sqrt(r)`, so the
walk clip saturates its stride at `r ~= 1.32` and every further metre per
second lands on rate alone.

That is not a run at any rate, because a run is not a faster walk:

- a walk always has double support; a run replaces it with **flight**;
- duty factor drops from ~0.6 to ~0.3;
- arm carriage, trunk lean, and knee lift all change.

Measured from the shipped pack (headless three.js, replicating
`analyzeClipGait`):

| clip | duration (s) | native speed (m/s) | double support |
|---|---|---|---|
| `walk-forward.glb` | 1.0667 | **1.5174** | 25.0% |
| `walk-backward.glb` | 1.2667 | 1.0043 | 43.8% |
| `strafe-left.glb` | 1.0667 | 1.4952 | 42.2% |
| `strafe-right.glb` | 1.0667 | 1.5323 | 42.2% |
| `run.glb` | 0.7667 | **3.0987** | 4.7% |
| `strafe-run-left.glb` | 0.7000 | **3.7418** | 6.3% |
| `strafe-run-right.glb` | 0.6667 | **3.4634** | 6.3% |
| `grapevine-left.glb` | 2.1000 | 1.4571 | 23.4% |
| `idle.glb` | 8.3333 | 0.0043 | 100% |

The run clips were already in `static/animations/locomotion-pack/`. Nothing
loaded them.

## Design: a speed axis on the existing direction blend

Everything in `LocomotionAnimator` is generic over `DIRECTION_KEYS` --
`prepareClip`, `createActions`, `analyzeClipGait`, `blendedNativeSpeed`,
`advanceGaitPhase`, `applyStateWeights`, `applyLegacyWeights`,
`blendedDistanceStep`, `getFootPlantConfidence`. A run tier is therefore three
more direction keys, not a new subsystem:

```
forward     -> runForward
strafeLeft  -> runStrafeLeft
strafeRight -> runStrafeRight
```

`assignTieredWeight()` splits each direction's weight between its walk clip and
its run clip; `runTierFraction()` produces the split with a `smoothStep01`
across a band derived from the two clips' **own measured speeds**:

```
lower = walkNative * WALK_TIER_CEILING   // 1.15, where the walk stops being honest
upper = runNative  * RUN_TIER_FLOOR      // 0.80, where the run starts being honest
```

Deriving the band from the clips rather than writing constants means a rig
whose retarget lands a slower walk crosses over sooner, instead of being held
to a number authored for a different skeleton. The fraction is zero whenever
the run clip is absent, unmeasured, or not actually faster than the walk, so a
pack without run coverage behaves exactly as it did before.

### Tier transitions are phase-matched by construction

Both tiers read the same monotonic `gaitSteps`, and `phaseAtGaitStep` offsets
each clip by its own measured left-strike phase. A crossover therefore happens
with the two clips already agreeing on which foot is down; the tier change
lands between footfalls instead of teleporting one. This is why no separate
transition state machine was needed -- **the shared clock is the transition.**

### No backward run, on purpose

The pack has no backward run and no jog. `RUN_TIER_KEYS` omits `backward` and
both grapevines, and `FlowFestGrayboxWalkScene` clamps
`effectiveSprintMultiplier` to 1 whenever `moveDirection.z < 0`. Asking
`walk-backward` (1.004 m/s native) for ~3.9 m/s saturates stride and rate and
turns retreating into a moonwalk. Sideways-and-back keeps the sprint, because
the lateral run carries that component.

## Momentum

`advanceGroundVelocity()` in `packages/camera-3d` moves the horizontal
velocity **vector** toward its target at an acceleration or deceleration rate,
capped by `maximumSpeed`. Three decisions worth keeping:

- **The bound is on the vector, not the axes.** A hard turn carries through its
  arc instead of snapping to the new heading.
- **Rate selection compares magnitudes.** Releasing Shift while still holding W
  is a *decrease* in target speed, so it brakes rather than coasting.
- **`Infinity` acceleration reproduces the previous instant response exactly**,
  so every existing consumer is unchanged until it opts in. The graybox review
  harnesses deliberately do not opt in, keeping exact distance-over-time
  measurement intact.

Flow Fest's values (`flow-fest-simulation-contract.ts`):

| constant | value | consequence |
|---|---|---|
| walk speed | 1.7 m/s | |
| sprint multiplier | 2.3 | run target 3.91 m/s |
| ground acceleration | 8 m/s^2 | 1.7 m/s in 0.21 s; 3.91 m/s in 0.49 s |
| ground deceleration | 12 m/s^2 | run stops in 0.33 s over ~0.65 m |

Deceleration is deliberately faster than acceleration: 0.65 m is about the
distance the terminal-stop clips absorb, so the brake and the stop animation
agree.

Those two speeds sit cleanly on either side of the tier band -- 1.7 is below
`1.5174 x 1.15 = 1.745`, and 3.91 is above `3.0987 x 0.80 = 2.479` -- so a
Flow Fest walk is pure walk clip and a Flow Fest sprint is pure run clip, with
the blend used only during the ramp.

## Grading a run

`gait-verdicts.ts` gained a `"run"` maneuver profile. Its bands are
**empirically calibrated**, not invented, in the same style as the existing
`joltAccel: 300` ("Calibrated in the walk lab rather than guessed"). The same
rig, page and pattern (x-bot, circle, foreground tab) measured at both tiers:

| metric | walk | run | ratio |
|---|---|---|---|
| pace | 1.26 m/s | 3.95 m/s | **x3.13** |
| knee jerk RMS | 2111 | 6251 | x2.96 |
| worst joint acceleration | 106 | 297 | x2.80 |

Two independent kinematic metrics track the pace ratio almost exactly, which
establishes that those bands scale **linearly with pace**, not with pace
squared. The run profile therefore scales the knee-jerk and jolt ceilings by
`pace / 1.26 m/s` and substitutes literature bands for the four shape rows
(cadence 155-185, step length 110-160 cm, duty factor 0.25-0.40, double
support 0).

Three deliberate refusals:

1. **Foot slip is not scaled.** A four-centimetre slide is visible at any
   stride, and the same walk measures 7.1 cm on this pattern -- so slip is not
   a run defect at all, and the hypothesis that the run's 3.5-4.1 cm came from
   turn sweep was falsified by that baseline.
2. **The profile is caller-declared, never self-classified.** Duty factor
   below 0.5 defines running, so `verdictRows` could pick the profile from the
   report itself. It deliberately does not: a *broken walk* measuring 0.30
   duty factor must still fail red rather than be silently regraded as a good
   run. `tests/unit/3d/gait-verdicts-run.test.ts` locks this in.
3. **Knee twitches read "none" at a run rather than being rebanded.** The
   fixed 4000 deg/s^2 pop detector sits *below* the run's own 6251 RMS, so it
   counts the stride itself. The primary signal survives, because knee jerk
   RMS is still graded against a scaled band.

Result on a correct run: **3 of 18 rows outside, down from 9.**

## HUD honesty

The sim's mobility chip read "ON FOOT / Walking" while the body sprinted. The
mounted half of that state has always reported a mode (Cruise / Performance)
and the on-foot half reported nothing. `FlowFestOnFootMotion` now carries
`{ speedMetersPerSecond, sprinting }`, and the label says "Running" only when
the player asked to run **and** the body is genuinely travelling faster than
its walk. Shift alone is a request the body may not be able to honour --
blocked by a car, backpedalling, standing still -- and speed alone climbs on a
downhill walk.

## Package artefacts

`@austencloud/scene-3d` exports `{ types: dist/index.d.ts, svelte: src/index.ts,
import: dist/index.js }`. **Vite resolves the `svelte` condition, so `src/` is
what renders.** The repository patch already deletes every `dist` `.d.ts`
(218 entries including `dist/index.d.ts`), so TypeScript falls through to
`src/` too -- no `.d.ts` edits are needed or wanted.

`dist/lib/services/implementations/LocomotionAnimator.js` was regenerated with
esbuild so a consumer resolving the `import` condition gets the tier.
`dist/lib/components/Avatar3D.svelte` was deliberately left stale: nothing
resolves a `.svelte` file out of `dist`, and rewriting a compiled component by
hand invites a divergence nobody would notice.

## What this does not do

- **No run terminal stop.** `TerminalKey`, the armed/braking/landed/settled
  state machine, and the contact curves all exist and work, but only
  `walk-stop-left/right` assets exist, so stopping from a run plays a walk
  stop. The fix is an FBX through `scripts/build-terminal-stops.py`, not code.
- **No jog mid-tier.** No jog clip exists, and faking one with playback rate is
  precisely the fault the run tier removes.
- **No Quaternius import yet.** `remapClipToSkeleton` only recognises
  `mixamorig1` / `mixamorig:` / `mixamorig` / `""` bone prefixes, so a CC0
  Quaternius clip needs a retarget mapping before it can fill the coverage
  gaps above. The canon's dataset gate (source, licence, performer, commercial
  use, redistribution, attribution) must be completed and recorded before any
  such clip is downloaded, converted, or committed.
- **The walk lab has no straight steady-state pattern.** Every sustained sample
  rides `CIRCLE_R = 2.6`, which at 3.9 m/s is a 1.5 rad/s turn no runner holds.
  This confounds `overSupportFraction` ("body over the foot" reads 49% at a
  walk and 0% at a run), the one genuinely open run-specific finding.

## Verification

- 49 unit tests across six files, including 10 for `advanceGroundVelocity`,
  6 static contract tests for the run tier, 7 for the run gait profile, and a
  drift guard pinning the measured clip speeds.
- `svelte-check`: 0 errors, 0 warnings.
- Walk lab, circle, 3.90 m/s, planting on, buffer settled: x-bot, ch01 and
  ch10 all reach `data-gait-tier` = 1 and score **3 of 18**, failing the same
  three rows (foot slip 4.0-5.6 cm, body over the foot 0%, weight alternates
  no). Cadence 156-164, step length 145-152 cm, duty factor 0.27-0.28, double
  support 0%. ch07 scores 4 of 18 -- see the audit below.
- Flow Fest on foot, real surface: all three run clips fetched; measured speed
  plateau 1.73 m/s walking and 3.85 m/s running against a 3.91 target, with
  the ramp and the brake both visible in the trace.

## Related

- `docs/architecture/locomotion-research-canon.md`
- `.claude/rules/locomotion.md`, `.claude/rules/canonical-capabilities.md`
- `patches/@austencloud__scene-3d@0.1.6.patch`

## Audit, 2026-09-03

Austen asked for an adversarial pass over this work before going further. It
found two defects and corrected two claims, including one of my own.

### Measured: the crossover is clean

The claim that "tier transitions are phase-matched by construction" was read
off the code, never measured. It is now measured. Ramping 1.2 -> 4.2 m/s in a
straight line over 8 s, with the tier fraction and every joint sampled per
frame:

| observation | value |
|---|---|
| tier regressions while speed climbs | **0** |
| tier leaves 0 at | 1.69 m/s (derived lower bound 1.745) |
| tier reaches 1 at | 2.54 m/s (derived upper bound 2.479) |
| joint jolts inside the crossing window | **0 of 13** |

All 13 jolts occur later, at sustained run speed. The seam itself is quiet, so
the shared clock does hold the two clips in phase across the exchange. This is
now locked by `tests/unit/3d/locomotion-motion-quality.test.ts`.

### Defect 1: ch07 resolves only one foot at a run

Held to one pattern, one speed and one planting setting, and varying only the
rig, ch07 is an outlier:

| rig @ 3.90 m/s | score | cadence | step length | cadence x step | vs 3.90 |
|---|---|---|---|---|---|
| x-bot | 3 of 18 | 160 | 148.8 cm | 3.97 m/s | ok |
| ch01 | 3 of 18 | 161 | 145.4 cm | 3.90 m/s | ok |
| ch10 | 3 of 18 | 157 | 150.3 cm | 3.93 m/s | ok |
| **ch07** | 4 of 18 | **102** | 144.8 cm | **2.46 m/s** | **63%** |

Cadence times step length must reconcile with ground speed. On three rigs it
does, within 1%. On ch07 it recovers under two thirds of the distance actually
travelled, which means footfalls are going unresolved rather than the body
moving differently.

The gait probe's contact strip shows which ones: ch07 registers about 13 left
contacts and **2 right** over the same window where x-bot registers about 14 on
each side. One foot is nearly invisible to contact detection. ch07 is a heeled
character, which changes the ankle's height above ground and the toe geometry
the contact band is measured against, so the footwear is the first place to
look. That is a hypothesis, not a diagnosis.

Bounds worth keeping, because they narrow the search:

- **Not general to the rig.** ch07 walking at 1.40 m/s reconciles (4 of 18,
  cadence 120, step 72.3 cm).
- **Not general to the run tier.** ch07 at 2.60 m/s, already at tier 0.92,
  reconciles: 133/min x 118.1 cm = 2.62 m/s against 2.60 commanded.
- **Not rig scale.** The obvious explanation -- a short rig saturating its
  stride -- is falsified. Hip heights are ch10 1.0516, ch07 0.9955, ch01 0.9916,
  ch12 0.9765, ch18 0.9377. ch07 is the second tallest; the shortest rig is
  fine.

So the failure appears on one rig, only above roughly 2.6 m/s.

### Defect 2: the run profile lets a broken measurement move its own goalposts

The run bands scale by pace, and pace is derived from the *measured* gait. When
contact detection under-resolves, measured pace falls, and the ceilings tighten
around the very rig that is already failing:

| rig | measured pace | knee-jerk ceiling | knee jerk |
|---|---|---|---|
| ch10 | 4.01 m/s | 4773 | 6301 |
| x-bot | 3.97 m/s | 4727 | 6271 |
| ch07 | 2.46 m/s | **2931** | 7185 |

ch07's knee-jerk ceiling is 62% of x-bot's purely because its cadence
under-resolves. The row grades worse for a reason that has nothing to do with
its knees. The ceiling should scale by **commanded** speed, which the caller
already knows, so that a measurement failure cannot make an unrelated row look
like a second defect.

### Correction 1: the "3 of 18" claim was right

I told Austen mid-session that my own screenshots contradicted this spec. They
did not. On a settled buffer x-bot measures exactly 3 of 18, and ch01 and ch10
match it on the same three rows. The frames that disagreed were ramp frames --
a mixed walk-and-run buffer graded against run bands.

The same mistake produced a false alarm: an early reading of ch07 as "7 of 18,
cadence 89, step length 0.0 cm" was taken before the rolling buffer had filled.
Settled and sampled three times twelve seconds apart, ch07 is a stable 4 of 18.
**The gait readout needs a settling window of about 20 s after any navigation
before it can be read at all.** Every number in this audit was taken after one.

### Correction 2: knee jerk does not come into band

The spec says the run profile scales the knee-jerk ceiling by pace. It does,
and that is still not enough: 6271 against a 4727 ceiling on x-bot. It grades
`warn` rather than `bad`, so it stays out of the 3-of-18 count, but calling it
handled would be wrong. Knee jerk is out of band at a walk too (4189 against
1500), so it is a standing property of these clips and rigs, not something the
run tier introduced.

### Process failure that allowed this

`.claude/rules/locomotion.md` requires live visual proof on **each supported
rig**. The verification above cited x-bot alone. Defect 1 is visible in the
first frame of any other rig, and was found the moment a second one was opened.
