# Locomotion Research Canon

Last verified: 2026-08-28

This document turns locomotion research into TKA engineering decisions. It is
the required starting point for work on walking, footfall planning, gait timing,
starts, stops, turns, lateral movement, foot planting, retargeting, terrain, and
motion matching.

It is not a claim that every cited method is implemented. Each entry separates
evidence from the decision TKA has made and the code owner that would carry it.
Read `.claude/rules/locomotion.md` before changing locomotion behavior.

No finite document can contain every locomotion paper. This canon tracks the
sources that change a TKA decision, establish an evaluation method, or supply a
candidate dataset. A source that does none of those belongs in working notes,
not this file.

## Status and evidence vocabulary

Decision status:

- **Shipped**: verified in `main` at the date above.
- **Prototype**: verified in a task branch or lab, but not a production contract.
- **Adopted**: the architecture direction is accepted, but implementation is
  incomplete.
- **Evaluate**: promising research, with no adoption decision yet.
- **Reference only**: useful evidence that does not define TKA behavior.
- **Rejected**: an approach TKA must not use as its behavior owner.

Evidence type:

- **Peer-reviewed**: a published paper or systematic review.
- **Research preprint**: a primary manuscript that has not been verified here as
  peer-reviewed.
- **Production documentation**: current documentation or a production talk from
  a shipping animation stack.
- **Practitioner guidance**: an experienced animation engineer's documented
  technique. Useful, but not equivalent to a controlled study.
- **Dataset**: motion or biomechanical data. Availability does not imply product
  or training rights.

## Current TKA contract

The current ownership path is:

```text
authored destination / score intent
  -> destination and timing planners
  -> host execution (Walk Lab or Stage adapter)
  -> @austencloud/scene-3d LocomotionAnimator
  -> @austencloud/scene-3d FootPlanter
  -> gait diagnostics and live visual review
```

The owners have deliberately different jobs:

1. `src/lib/shared/3d/locomotion/destination-walk-plan.ts` owns exact
   straight-line root progress from `from`, `to`, and integer footfall count. It
   does not choose contacts, clips, swing arcs, or a final stance.
2. `LocomotionAnimator` in `@austencloud/scene-3d` owns the monotonic gait clock,
   animation time, directional clip blend, contact curves, and stride scaling.
   The package is modified in this repository through
   `patches/@austencloud__scene-3d@0.1.6.patch`.
3. A terminal transition owner must select and execute the braking and landing
   window. `TerminalStepPlan` is the adopted seam. Its implementation must be
   verified on the current branch before use.
4. `FootPlanter` is a late contact and IK correction layer. It may realize a
   declared anchor without replacing the source motion or deciding what counts
   as a step.
5. `GaitTimingPlan` is the adopted seam for externally authored plant times.
   Musical score time stays canonical when Stage supplies a schedule. A gait
   enum, speed curve, or eased root track is not an authored footfall schedule.
6. `src/lib/features/stage/locomotion/motion-matching/` contains feature
   extraction, trajectory construction, nearest-neighbour search, and a
   controller named `MmLocomotionController`. At the last verification the
   controller did not build or query the database. Treat it as unfinished
   infrastructure, not a shipping motion-matching solver and not a reason to
   create a parallel system.
7. `measureStandingStance` / `planStandingStance` / `applyStandingStance` in
   `@austencloud/scene-3d` `src/lib/services/leg-geometry.ts` own the **static
   standing base** a performer holds when nothing is driving its legs. This is
   not locomotion: it owns no gait clock, no contact schedule, and no footfall
   plan. `Avatar3D.svelte` calls it once at load, and only when
   `enableLocomotion` is false. The moment a clip or a planner drives the legs,
   that owner writes the same bones every frame and the standing pose is gone,
   which is the intended relationship. Do not add a second stance solver, and do
   not extend this one into swing, contact, or step planning.

The governing TKA designs are:

- `docs/superpowers/specs/2026-08-27-exact-step-locomotion-design.md`
- `docs/superpowers/specs/2026-08-28-stage-footfall-planning-handoff.md`
- `docs/superpowers/specs/2026-08-28-gait-timing-plan-experiment.md`, when that
  file is present on the working branch

Implementation state changes faster than this document. Before editing, prove
the relevant symbols and tests still exist with repository search. Do not turn
the status labels above into an excuse to trust stale paths.

## Non-negotiable behavior contracts

### Exact destination and step count

For a straight path of distance `D`, `N` authored footfalls, and duration `T`:

```text
mean step length = D / N
cadence          = N / T
mean speed       = D / T
```

When `D`, `N`, and `T` are locked, cadence, mean step length, and mean speed are
derived. The UI may expose all of them, but it must identify which constraints
are authored and which are derived.

The endpoint must be reached on footfall `N`, without an endpoint snap and
without a hidden footfall `N + 1` inside the idle transition. Curved paths need
arc-length progress. Crossed and dance steps need per-foot poses; `D / N` is
only a summary for those patterns.

[Task-based Locomotion](https://www.cs.ubc.ca/~van/papers/2016-TOG-taskBasedLocomotion/index.html)
demonstrates why generic root travel is insufficient for task-specific movement:
footstep plans can include side steps, toe and heel pivots, duration, effort,
and character-proportion retargeting. Epic's
[Distance Matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/distance-matching-in-unreal-engine)
and [Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine)
show the production separation between selecting animation progress from
distance and applying a bounded target-transform correction.

TKA decision: **Shipped** for straight mark-to-mark root progress. **Adopted**
for per-foot footprint plans and exact goal stance. The latter is not a truthful
runtime input until the animator and contact layers accept it.

### Gait timing and musical time

Walking to a beat is an auditory-motor synchronization problem, not a playback
speed preset. A systematic review of gait synchronization identifies footfall
phase relative to the nearest beat, tempo-matching error, and timing variability
as distinct measures. It also reports that synchronization depends on task and
instruction; spontaneous beat alignment cannot be assumed.

Source: [Entrainment and Synchronization to Auditory Stimuli During Walking](https://pmc.ncbi.nlm.nih.gov/articles/PMC6028729/)
(peer-reviewed systematic review).

TKA decision: **Adopted**. Stage authors plant events in score time through one
external `GaitTimingPlan`. The animator realizes the schedule while preserving a
monotonic gait clock. Diagnostics must report plant-time error and its spread,
not only cadence. Do not infer exact plants from beat-local root minima or from
an animation clip's nominal BPM.

### Starts, stops, and terminal steps

Human stopping is a transition with phase-dependent decisions, reduced push-off,
braking, and a selected final placement. It is not steady locomotion with speed
set to zero.

- [Analysis of Rapid Stopping During Human Walking](https://pubmed.ncbi.nlm.nih.gov/9658047/)
  found swing-leg braking, inhibited stance-leg push-off, and phase-dependent
  decisions about an additional step.
- [Motor programmes for the termination of gait in humans](https://pmc.ncbi.nlm.nih.gov/articles/PMC2279001/)
  measured different braking programs in stance and swing limbs and adaptation
  with approach speed.

TKA decision: **Adopted**. A `TerminalStepPlan` must be known at least one step
ahead and carry remaining distance, terminal foot, contact schedule, target
facing, and a root-distance curve or authored stop motion. The animator owns the
window. FootPlanter may preserve the declared support anchor. Freezing an
arbitrary walk-loop phase and blending to idle is **Rejected**.

### Step turns, spin turns, pivots, and facing

Turning is foot placement plus weight transfer and braking. Root yaw alone is
not a turn.

- [Turning Strategies During Human Walking](https://pubmed.ncbi.nlm.nih.gov/10368408/)
  describes phase-dependent step and spin turns, with the forward braking leg
  influencing the selected strategy.
- [A three-dimensional biomechanical comparison between turning strategies](https://pubmed.ncbi.nlm.nih.gov/16129503/)
  found a wider support base and lower demands for the studied step turns than
  spin-turn variants.
- [Bases for the selection of alternate foot placement during straight- and
  turning-gait](https://pubmed.ncbi.nlm.nih.gov/40876264/) found different,
  stereotyped alternate placements for step and spin turns across turn angles.

TKA decision: **Prototype** for authored turn clips and seam-matched facing.
**Adopted** for a planner that selects turn family, pivot/support foot, amount,
and phase window. `TerminalStepPlan.targetFacing` is not complete until runtime
evidence proves the plan actually drives facing. Arbitrary angle support may
compose authored clips and bounded warping, but must not rotate the root under
two stationary feet.

### Lateral stepping, crossover, and grapevine

Sidesteps and crossovers are different movement classes. A crossover places the
moving limb beyond the body's midline and requires a different support strategy.
Front and back crossovers are both legitimate patterns.

- [Bilateral ground reaction forces and joint moments for lateral sidestepping
  and crossover stepping tasks](https://pmc.ncbi.nlm.nih.gov/articles/PMC3737798/)
  records distinct bilateral mechanics for the two tasks.
- [Perturbation-evoked lateral steps in older adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC6501204/)
  distinguishes lateral sidestep, front crossover, back crossover, and medial
  sidestep strategies.
- [Contact-Aware Retargeting of Skinned Motion](https://openaccess.thecvf.com/content/ICCV2021/html/Villegas_Contact-Aware_Retargeting_of_Skinned_Motion_ICCV_2021_paper.html)
  shows that self-contact preservation and interpenetration reduction are
  separate constraints during retargeting.

TKA decision: **Adopted architecture, not yet a general runtime capability**.
A grapevine must compile to explicit alternating foot poses and contact windows,
including side step, anterior cross, side step, and posterior cross. It needs
foot yaw, which leg passes in front or behind, toe clearance, support ownership,
pelvis travel, and target-facing intent.

A negative left/right leg-order margin is not automatically a collision. It is
expected during an intentional crossover. Pattern-aware diagnostics must
distinguish:

- permitted leg-order reversal with positive mesh and capsule clearance;
- foot or shin interpenetration;
- an invalid crossing direction for the authored template; and
- a discontinuous pose jump that skipped the swing path.

FootPlanter cannot synthesize a grapevine from a sidestep clip. The required
source motion must come from authored motion, a sufficiently covered motion
database, or a separately approved generative controller. IK remains the last
correction layer.

### Contact, foot locking, IK, and retargeting

Contact is explicit data. A low foot height is a useful signal, but it is not a
complete contact model.

- [Reducing Footskate in Human Motion Reconstruction with Ground Contact
  Constraints](https://openaccess.thecvf.com/content_WACV_2020/html/Zou_Reducing_Footskate_in_Human_Motion_Reconstruction_with_Ground_Contact_Constraints_WACV_2020_paper.html)
  combines contact detection with trajectory optimization.
- [UnderPressure](https://diglib.eg.org/items/def192e5-ad91-4409-b078-7d564fbaefb5)
  uses pressure-insole labels to estimate ground reaction forces and derives
  contact-aware IK cleanup.
- [Contact-Aware Retargeting of Skinned Motion](https://openaccess.thecvf.com/content/ICCV2021/html/Villegas_Contact-Aware_Retargeting_of_Skinned_Motion_ICCV_2021_paper.html)
  treats ground contact, self-contact, and interpenetration as retargeting
  constraints.
- [Inverse Kinematics and Foot Locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking)
  is practitioner guidance for toe locking, inertialized acquire and release,
  automatic contact annotation, and offline cleanup. Its central boundary is
  useful here: IK modifies source animation rather than replacing it.
- Epic's [Speed Planting](https://dev.epicgames.com/documentation/en-us/unreal-engine/fix-foot-sliding-with-ik-retargeter-in-unreal-engine)
  uses source foot-speed curves and IK goals to correct retargeting slip.

TKA decision: **Shipped** for late contact locks and leg IK. **Adopted** for
source contact labels, toe-aware anchors, confidence, per-rig reach limits, and
contact-aware retargeting. Foot locks must release safely when the correction
would break the source pose. Pulling the pelvis down until every foot reaches is
not acceptable motion quality.

### Motion matching, warping, and learned controllers

Motion matching selects recorded poses that jointly fit the current pose and a
desired future trajectory. It does not invent missing stops, pivots, lateral
steps, or dance vocabulary.

- Ubisoft's [Motion Matching and The Road to Next-Gen Animation](https://www.gdcvault.com/play/1023280/Motion-Matching-and-The-Road)
  is the production origin for continuous pose-and-plan search over long motion
  capture sequences.
- Epic's current [Motion Matching documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-matching-in-unreal-engine)
  queries future trajectory and pose features including both feet. It also
  documents an experimental Crashing Legs channel. More data expands available
  behavior; weights do not repair absent coverage.
- [Learned Motion Matching](https://static-wordpress.ubisoft.com/montreal.ubisoft.com/wp-content/uploads/2020/07/09154101/Learned_Motion_Matching.pdf)
  compresses and generalizes motion-matching behavior with a learned model.
- [Control Operators for Interactive Character Animation](https://theorangeduck.com/media/uploads/other_stuff/ControlOperators.pdf)
  demonstrates designer-composable control over both learned motion matching
  and an autoregressive flow-matching controller.
- [Environment-aware Motion Matching](https://arxiv.org/abs/2510.22632)
  adds environmental and nearby-agent features so pose and trajectory selection
  can respond to obstacles.

TKA decision: **Evaluate** completion of the existing motion-matching owner.
Do not add a second database, search stack, or controller beside
`src/lib/features/stage/locomotion/motion-matching/`. Before adoption, prove
runtime database construction and querying, contact-labelled coverage, stable
transitions, cross-rig retargeting, web performance, deterministic score-time
control, and rejection costs that permit intentional crossover without allowing
interpenetration.

Warping and inertialization are bounded correction tools. Epic documents
[Orientation, Stride, and Slope Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine)
as pose adjustments that align animation with movement. They do not replace
missing motion data.

### Terrain

[Phase-Functioned Neural Networks for Character Control](https://theorangeduck.com/page/phase-functioned-neural-networks-character-control)
demonstrates a learned phase-conditioned controller trained across rough terrain,
obstacles, jumps, and crouches. Epic's Slope Warping is a production correction
for terrain alignment.

TKA decision: **Reference only** until Stage has a terrain-traversal requirement.
Current floor locomotion should keep one explicit ground plane and per-rig sole
offset. A future terrain controller must sample environment geometry as planning
input; a downward raycast plus ankle IK is not sufficient for ledges, stairs,
or obstacle negotiation.

### Music-conditioned dance generation

Generative dance research is useful for coverage, in-betweening, and constraint
interfaces. It is not evidence that a generated clip is stage-ready.

- [AIST++ / AI Choreographer](https://research.google/pubs/ai-choreographer-music-conditioned-3d-dance-generation-with-aist/)
  provides a large music-and-3D-motion benchmark across ten genres.
- [EDGE](https://openaccess.thecvf.com/content/CVPR2023/html/Tseng_EDGE_Editable_Dance_Generation_From_Music_CVPR_2023_paper.html)
  supports temporal and joint constraints, adds contact-consistency training,
  and reports that common automated metrics do not track human judgments well.
- [FineDance](https://openaccess.thecvf.com/content/ICCV2023/html/Li_FineDance_A_Fine-grained_Choreography_Dataset_for_3D_Full_Body_Dance_ICCV_2023_paper.html)
  broadens genre and hand-motion coverage.

TKA decision: **Evaluate** as an offline candidate generator after deterministic
footfall constraints exist. Generated motion must pass the same endpoint,
contact, self-intersection, joint-continuity, rig-retarget, and live visual gates
as authored motion. A beat-alignment score alone is not acceptance.

## Source and decision ledger

`Runtime owner` names where adoption belongs. It does not claim the capability
already exists there.

| Problem class                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                  | Type                                               | TKA decision and status                                                                                                                 | Runtime owner                                                             | License or asset status                                                                                    | Last verified |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| Exact task-specific footprints                  | [Agrawal and van de Panne, 2016](https://www.cs.ubc.ca/~van/papers/2016-TOG-taskBasedLocomotion/index.html)                                                                                                                                                                                                                                                                                               | Peer-reviewed                                      | Adopt footstep-plan semantics; exact arbitrary footprints remain **Adopted**                                                            | destination planner, future footprint-plan compiler, `LocomotionAnimator` | Citation only; paper is not an asset grant                                                                 | 2026-08-28    |
| Exact root progress and bounded correction      | [Epic Distance Matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/distance-matching-in-unreal-engine), [Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine)                                                                                                                                                                   | Production documentation                           | Straight exact-step planner is **Shipped**; bounded target warping is **Evaluate**                                                      | `destination-walk-plan.ts`, `LocomotionAnimator`                          | Reference only; no Epic code or assets imported                                                            | 2026-08-28    |
| Beat-authored gait timing                       | [Auditory gait synchronization review](https://pmc.ncbi.nlm.nih.gov/articles/PMC6028729/)                                                                                                                                                                                                                                                                                                                 | Peer-reviewed systematic review                    | External plant schedule and phase-error metrics are **Adopted**                                                                         | `GaitTimingPlan`, score-time host, diagnostics                            | Open-access article; citation does not grant motion assets                                                 | 2026-08-28    |
| Gait termination                                | [Hase and Stein, 1998](https://pubmed.ncbi.nlm.nih.gov/9658047/), [Crenna et al., 2001](https://pmc.ncbi.nlm.nih.gov/articles/PMC2279001/)                                                                                                                                                                                                                                                                | Peer-reviewed                                      | Remaining-distance, phase-aware terminal step is **Adopted**                                                                            | `TerminalStepPlan`, `LocomotionAnimator`                                  | Citation only                                                                                              | 2026-08-28    |
| Step and spin turns                             | [Hase and Stein, 1999](https://pubmed.ncbi.nlm.nih.gov/10368408/), [Taylor et al., 2005](https://pubmed.ncbi.nlm.nih.gov/16129503/), [Kreter and Fino, 2025](https://pubmed.ncbi.nlm.nih.gov/40876264/)                                                                                                                                                                                                   | Peer-reviewed                                      | Turn-family, support-foot, and phase selection are **Adopted**; current clips are a **Prototype**                                       | turn planner, `LocomotionAnimator`                                        | Citation only                                                                                              | 2026-08-28    |
| Lateral sidestep and crossover                  | [Bilateral lateral gait study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3737798/), [perturbation-evoked lateral steps](https://pmc.ncbi.nlm.nih.gov/articles/PMC6501204/)                                                                                                                                                                                                                                 | Peer-reviewed                                      | Treat as distinct gait classes; grapevine footprint template is **Adopted**, not shipped                                                | footprint-plan compiler, asset pipeline, diagnostics                      | Citation only                                                                                              | 2026-08-28    |
| Ground contact and footskate                    | [Zou et al., WACV 2020](https://openaccess.thecvf.com/content_WACV_2020/html/Zou_Reducing_Footskate_in_Human_Motion_Reconstruction_with_Ground_Contact_Constraints_WACV_2020_paper.html), [UnderPressure](https://diglib.eg.org/items/def192e5-ad91-4409-b078-7d564fbaefb5)                                                                                                                               | Peer-reviewed                                      | Explicit contact labels and contact-constrained cleanup are **Adopted**                                                                 | asset pipeline, `FootPlanter`, diagnostics                                | Papers are reference material; UnderPressure code/data require separate license review                     | 2026-08-28    |
| Runtime foot locking                            | [Holden, 2026](https://theorangeduck.com/page/inverse-kinematics-foot-locking), [Epic Speed Planting](https://dev.epicgames.com/documentation/en-us/unreal-engine/fix-foot-sliding-with-ik-retargeter-in-unreal-engine)                                                                                                                                                                                   | Practitioner guidance and production documentation | Toe-aware late correction is **Shipped/Adopted**; IK as motion generator is **Rejected**                                                | `FootPlanter`                                                             | Techniques may be studied; verify linked code licenses before copying code                                 | 2026-08-28    |
| Contact-aware retargeting and self-intersection | [Villegas et al., ICCV 2021](https://openaccess.thecvf.com/content/ICCV2021/html/Villegas_Contact-Aware_Retargeting_of_Skinned_Motion_ICCV_2021_paper.html)                                                                                                                                                                                                                                               | Peer-reviewed                                      | Per-rig self-contact preservation and interpenetration checks are **Adopted**                                                           | retarget/import pipeline, diagnostics                                     | Citation only; no model or dataset license inferred                                                        | 2026-08-28    |
| Paired upper-body IK routing                    | [Unity Two Bone IK Constraint](https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html), [Epic Full-Body IK](https://dev.epicgames.com/documentation/unreal-engine/control-rig-full-body-ik-in-unreal-engine)                                                                                                                                       | Production documentation                           | Measured body axes, torso participation, deterministic over/under elbow corridors, and production head-threat avoidance are **Shipped** | `AvatarAnimator`, `SpineTwister`, `ElbowPoleComputer`                     | Reference only; no Unity or Epic code or assets imported                                                   | 2026-08-30    |
| Motion matching                                 | [Ubisoft GDC 2016](https://www.gdcvault.com/play/1023280/Motion-Matching-and-The-Road), [Epic Motion Matching](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-matching-in-unreal-engine)                                                                                                                                                                                              | Production talk and documentation                  | Complete existing search owner before adoption; current runtime is **Unfinished/Evaluate**                                              | `features/stage/locomotion/motion-matching`                               | Reference only; animation databases require their own licenses                                             | 2026-08-28    |
| Learned motion control                          | [Learned Motion Matching](https://static-wordpress.ubisoft.com/montreal.ubisoft.com/wp-content/uploads/2020/07/09154101/Learned_Motion_Matching.pdf), [Control Operators](https://theorangeduck.com/media/uploads/other_stuff/ControlOperators.pdf)                                                                                                                                                       | Peer-reviewed                                      | Offline experiment only after deterministic constraints and licensed data; **Evaluate**                                                 | existing motion-matching owner or a separately approved production owner  | Papers are citation material; reference implementations and training data need separate review             | 2026-08-28    |
| Terrain adaptation                              | [PFNN](https://theorangeduck.com/page/phase-functioned-neural-networks-character-control), [Epic Pose Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine)                                                                                                                                                                                                 | Peer-reviewed and production documentation         | Flat-stage corrections only; full terrain control is **Reference only**                                                                 | future environment-aware planner, `LocomotionAnimator`, `FootPlanter`     | Reference only                                                                                             | 2026-08-28    |
| Environment and crowd-aware pose selection      | [Environment-aware Motion Matching](https://arxiv.org/abs/2510.22632)                                                                                                                                                                                                                                                                                                                                     | Research preprint                                  | Keep pose and trajectory collision constraints coupled if Stage adds crowds; **Evaluate**                                               | existing motion-matching owner and Stage path planner                     | Paper reference; official example code reports MIT, data licenses remain separate                          | 2026-08-28    |
| Music-conditioned dance                         | [AIST++](https://research.google/pubs/ai-choreographer-music-conditioned-3d-dance-generation-with-aist/), [EDGE](https://openaccess.thecvf.com/content/CVPR2023/html/Tseng_EDGE_Editable_Dance_Generation_From_Music_CVPR_2023_paper.html), [FineDance](https://openaccess.thecvf.com/content/ICCV2023/html/Li_FineDance_A_Fine-grained_Choreography_Dataset_for_3D_Full_Body_Dance_ICCV_2023_paper.html) | Peer-reviewed and dataset                          | Candidate generation only; deterministic runtime adoption is **Evaluate**                                                               | offline motion pipeline, footprint-plan validator                         | Dataset, video, music, model, and SMPL terms must each be cleared                                          | 2026-08-28    |
| General mocap coverage                          | [CMU Graphics Lab Mocap Database](https://mocap.cs.cmu.edu/)                                                                                                                                                                                                                                                                                                                                              | Dataset                                            | Suitable candidate for stop, turn, and crossover asset audit; **Evaluate**                                                              | asset pipeline                                                            | Site allows commercial use inside products, forbids resale of raw/converted data, and requests attribution | 2026-08-28    |
| General animation benchmark                     | [LaFAN1](https://github.com/ubisoft/ubisoft-laforge-animation-dataset)                                                                                                                                                                                                                                                                                                                                    | Dataset                                            | Research and benchmark only; **Rejected** for commercial product training or redistribution without new permission                      | offline evaluation                                                        | CC BY-NC-ND 4.0                                                                                            | 2026-08-28    |
| Large unified human motion corpus               | [AMASS](https://amass.is.tue.mpg.de/register.php)                                                                                                                                                                                                                                                                                                                                                         | Dataset                                            | Research comparison only; **Rejected** for product use under current terms                                                              | offline evaluation                                                        | Noncommercial research only, with subset-specific terms                                                    | 2026-08-28    |
| Dance motion and music                          | [AIST++ download terms](https://google.github.io/aistplusplus_dataset/download.html)                                                                                                                                                                                                                                                                                                                      | Dataset                                            | Do not ingest until each media and annotation right is documented; **Evaluate**                                                         | offline motion pipeline                                                   | API code is Apache-2.0; videos and music inherit AIST Dance DB terms; SMPL has separate terms              | 2026-08-28    |
| Pressure-labelled foot contacts                 | [UnderPressure repository](https://github.com/InterDigitalInc/UnderPressure)                                                                                                                                                                                                                                                                                                                              | Dataset and code                                   | Useful for contact-label evaluation; **Evaluate** after legal and technical review                                                      | asset pipeline, diagnostics                                               | Custom InterDigital license and citation requirement; do not assume permissive commercial rights           | 2026-08-28    |

## Dataset and asset gate

No agent may download, commit, convert, train on, or ship motion data merely
because it is public. Record all of these before ingestion:

- canonical source URL and exact version or download date;
- motion, code, audio, video, body-model, and derived-data licenses separately;
- commercial use, modification, redistribution, attribution, and trained-model
  restrictions;
- performers' permitted use and any identity or biometric constraints;
- skeleton, sample rate, coordinate system, units, contacts, root motion, and
  known capture defects;
- which required movement classes are actually present; and
- the repository owner and storage location for source and derived assets.

CMU is the most promising currently identified commercial-use source, but its
site warns that toe and hand channels can be noisy and forbids reselling the
data directly, even after conversion. That still requires an import manifest
and attribution plan.

## Evaluation contract

Automated metrics catch silent failures. They do not replace watching the full
motion at speed, from useful camera angles, on every supported rig.

### Geometric and timing correctness

- requested and observed footfall count;
- root endpoint error and per-foot goal-stance error;
- plant-time error relative to score, including mean, worst case, and spread;
- monotonic gait and distance clocks under different frame partitions;
- step length, width, foot yaw, and required crossover order;
- no endpoint correction, backward correction, or hidden settlement step.

### Contact and continuity

- stance-foot translation and yaw slip during declared contact;
- contact precision and recall when source labels exist;
- heel and toe clearance during swing;
- joint velocity, acceleration, and jerk, with named worst joint;
- pose and root discontinuities at clip selections, wraps, and rig swaps;
- foot, shin, knee, and mesh interpenetration;
- contact preservation after retargeting.

### Gait and balance

- cadence, duty factor, double support, support alternation, and pelvis sway;
- body-over-support and center-of-mass plausibility where the rig permits it;
- terminal braking and stable settlement as a separate measurement window;
- turn-family, support-foot, and facing accuracy;
- pattern-specific checks for sidestep, front crossover, back crossover, and
  grapevine.

### Visual acceptance

Use Walk Lab in the approved in-app browser or Chrome DevTools setup. Inspect
the full maneuver, including departure, every plant, turn or crossover, arrival,
and settle. Test all shipped rigs and at least side, front, and quarter views.
Scrub or replay suspected seams. A metric dashboard with no visible review is
not proof of animation quality.

EDGE reports that common dance-generation metrics can disagree with human
judgments. That supports TKA's combined gate: deterministic metrics plus live
visual evaluation. It does not justify accepting visible defects because one
metric improved.

## Rejected assumptions

### A single hard-coded rotation can serve as a stance for every rig
Rejected 2026-09-03, with runtime bone measurements on four rigs.

`Avatar3D.svelte` widened the default stance with a fixed 8-degree rotation
about each upper leg's **own local Z**. A bone's local axes are a property of
the export, not of the body, so one constant behaved differently on every rig:
it abducted the Mixamo-derived catalog rigs (ch18 321 mm -> 549 mm ankle
separation, ch01 318 -> 564, ch07 326 -> 567) and adducted the intake rig
(239 mm -> 18 mm), which is the feet-stuck-together silhouette Austen reported
on `/test/staff-grip`. The rotation also raised the ankles off the bind pose
that `getFeetOffset()` had already measured, so every affected performer stood
a centimetre or two above the floor without anything reporting it.

A stance must be measured from the body it belongs to: hip sockets, ankles, and
the frontal plane they define. The replacement targets ankle separation equal to
the rig's own hip-socket separation, applies the rotation in world space about a
measured abduction axis, restores each foot's authored world orientation, and
returns the ankle height change so the host can re-ground the performer.

Two different upstream shapes feed that measurement, so do not read one rig's
numbers as the catalog's. The Mixamo-derived catalog rigs arrive at runtime in
their authored bind pose, ankles about 1.7x hip width apart. The intake rig
arrives with ankles at exactly 1.0x hip width, which is the signature of a
Blender intake that baked the GLB's embedded `mixamo.com` action - that clip's
first frame stands the rig at attention, and `pose.armature_apply()` writes it
in as the new bind pose (see `clear_imported_pose` in
`scripts/characters/blender-proportion-rescale.py`, landed 2026-09-03 in
`40180e87a8`). The runtime stance normalizes both shapes, so fixing the intake
bake does not invalidate it and it does not excuse leaving the bake in place.


| Assumption                                               | Why it is rejected                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root motion eliminates footskate                         | Source root and foot motion can still mismatch the world controller, retargeted rig, warping, blending, or contact anchors.                            |
| Motion matching naturally plants feet                    | Selection only chooses from available data. Contacts, coverage, retargeting, blending, and correction remain explicit concerns.                        |
| Inertialization or a crossfade can create a missing stop | Blending removes a small pose discontinuity. It does not create braking, final foot placement, or weight transfer.                                     |
| Setting velocity to zero is a terminal transition        | Human gait termination is phase- and speed-dependent and can require another placement.                                                                |
| Rotating the root under the avatar is a turn             | A believable turn selects support, places a foot, transfers weight, and rotates through an authored or data-covered window.                            |
| Negative leg order is always collision                   | Intentional front and back crossovers reverse left/right foot order. Collision requires geometry and continuity evidence.                              |
| IK can turn a sidestep into a grapevine                  | IK can correct a target near a valid source pose. It cannot supply the missing swing path, support sequence, pelvis action, or self-contact semantics. |
| Beat alignment equals authored footfalls                 | Cadence or root extrema do not prove which foot planted, at what score time, or for how long.                                                          |
| Exact root endpoint plus step count equals exact arrival | Root mark, terminal plant, and stable two-foot goal stance are different events.                                                                       |
| A public dataset is product-cleared                      | Code, annotations, video, music, performer data, body models, and derived assets can carry different terms.                                            |
| A cited technique is implemented                         | Research, adopted architecture, prototypes, and shipped behavior are separate status classes.                                                          |
| Green unit tests prove top-tier motion                   | Tests cannot see twitching, implausible weight transfer, mesh penetration, or a bad silhouette. Live visual evidence is mandatory.                     |

## Open gaps, in priority order

1. **Grapevine ground truth and semantics.** Acquire or author left/right front
   and back crossover motion with contact labels. Define explicit footprints,
   foot yaw, support, clearance, and pattern-aware collision grading.
2. **Contact-aware retargeting across shipped rigs.** Measure how one source
   motion changes on short and tall rigs. Preserve intentional self-contact
   while preventing interpenetration.
3. **Terminal transition coverage.** Complete stop assets or distance-matched
   profiles for terminal foot, approach speed, remaining distance, and desired
   facing. Prove that `targetFacing` executes.
4. **External score-time gait schedule.** Land and prove `GaitTimingPlan` across
   different render-frame partitions without changing the requested plant times.
5. **Footprint-target runtime seam.** After timing works, add explicit left and
   right target pose/contact windows without turning FootPlanter into a planner.
6. **Motion-matching completion decision.** Either finish database build/search
   through the existing owner or record why the project will use authored
   transition sets instead. Do not leave the current name implying capability
   that runtime does not have.
7. **Asset provenance inventory.** Record every current locomotion clip's source,
   license, skeleton, root-motion curve, contacts, mirrored status, and supported
   rigs.
8. **Human evaluation protocol.** Add repeatable blinded comparisons for
   grounding, weight, continuity, intent, and preference alongside diagnostics.
9. **Terrain scope.** Make an explicit product decision before adding slope or
   obstacle logic to flat-stage locomotion.
10. **Learned controller threshold.** Define the data volume, web runtime budget,
    determinism, editability, and licensing evidence required before training or
    shipping one.

## Maintenance protocol

Before non-trivial locomotion work:

1. Read `.claude/rules/locomotion.md` and this document.
2. Trace the current request through planner, animator, contact correction, and
   diagnostics. Verify the owner in source, not only in a handoff.
3. Search current-year official production documentation and primary research
   for the specific problem class.
4. State whether the change reuses, extends, composes, or creates an owner.
5. Record the adoption status and the proof required to change it.
6. If data or code will be imported, complete the dataset and asset gate first.
7. Run focused automated checks and live browser evaluation. Record both.

Update this canon when a source changes an architectural decision, a capability
moves from adopted to prototype or shipped, an owner changes, or a license is
cleared or revoked. Update `Last verified` only for the rows actually checked.
Do not paste a new bibliography into `.claude/rules/locomotion.md`; rules route
here so there is one research owner.
