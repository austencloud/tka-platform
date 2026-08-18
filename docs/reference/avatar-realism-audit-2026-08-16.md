# Avatar Prop-Performance Realism Audit — 2026-08-16

Requested by Austen: state-of-the-art survey + full grade of the 3D avatar
prop-spinning realism, focused on (1) hand-prop attachment and (2) the avatar
refusing to turn its upper body. Code evidence gathered from the installed,
patched `@austencloud/scene-3d@0.1.6` dist and app-side `src/lib/shared/3d/`.

## Verdict in one paragraph

The machinery is far better than the symptoms suggest — a hand-rolled analytic
two-bone IK with pole vectors, a biomechanically-cited clavicle raiser, a spine
twister, hinge-constrained foot planting, and a Yale-GRASP-taxonomy grip pose
library. Nobody building web avatars ships this much. But three narrow seams
throw away most of the realism the rest of the stack earns: the wrist is
**positioned but never oriented** (the staff spins through a frozen fist), the
torso heuristics are **depth-blind** (a target behind the body produces zero
response), and an unreachable target **fails silently** (the arm points, the
hand stops short, the prop sails on). Every visible complaint traces to one of
those three.

## Symptom → cause map

### "The hand is not attached to the prop in any meaningful way"

1. **Wrist orientation is never solved.** `HandPose` carries `wristRotation`
   and `staffAngle` (`AvatarAnimator.js:95-96,157,165`; typed in
   `IAvatarAnimator.d.ts:17-19`) — cloned, lerped, and **consumed by nothing**.
   `IKSolver.solveTwoBone` returns only shoulder+elbow quaternions
   (`IKSolver.js:146-151`); the hand bone's rotation rides along with the
   forearm. The palm has no relationship to the staff axis.
2. **The target is the wrist joint, not the palm.** The `offset` param in
   `setPropsAndBlend` is only a world→local shift (`AvatarAnimator.js:145-170`).
   The prop's centerline is aimed at the Hand-bone origin (wrist), ~6-9 cm from
   the palm center the fingers actually wrap.
3. **Grip is binary and static.** Runtime sets `GripType.SQUARE` when a prop
   exists, `IDLE` otherwise (`Avatar3D.svelte:967-973`). PENCIL / CRADLE /
   OPEN_PALM / RELEASE exist in data but are never selected.
   `CylinderGraspSolver` (dynamic curl from prop radius) is unwired.
4. **Unreachable targets fail silently.** Solver clamps to 99.9% reach and
   returns `success:false` (`IKSolver.js:59-66`), but `solveAndApply` applies
   anyway ("we still point toward it") and nothing escalates the deficit to
   clavicle/spine/hips/feet. Hand short of prop = visible detach.
5. **Collision detection is decorative.** `CollisionDetector` finds
   prop-through-torso/arm events but only emits events; wired only into the
   Collision Lab, never corrective, never in production paths.

### "He doesn't want to turn his upper body / doesn't know shoulders go back and forward"

6. **SpineTwister reads only `.x` and `.y` of hand targets — never `.z`.**
   (`SpineTwister.js:89-124,142-145`.) WHEEL-plane targets sit up to
   `GRID_RADIUS_3D = 0.52 m` behind/ahead of the chest
   (`plane-transforms.ts:131`), and the torso does not respond to depth at all.
7. **ClavicleRaiser is elevation-only** — up to 15° raise when the hand is
   high (`ClavicleRaiser.js`). No protraction/retraction (shoulders
   forward/back) exists anywhere.
8. **The yaw signal saturates at 0.2 m** (`SHOULDER_HALF_WIDTH`,
   `SpineTwister.js:43,106`) against a 0.52 m grid radius, and it's an
   open-loop heuristic — the spine turns because of a lateral-offset formula,
   not because the arm needs help reaching. No feasibility feedback in either
   direction.
9. **Anatomical joint limits exist and are dead code.**
   `getHumanoidConstraints()` (`IKSolver.js:402-453` in source) is never
   invoked by the analytic path, so nothing prevents anatomically impossible
   shoulder/elbow solutions on extreme targets.

### Architecture note

Prop and hand are two independent systems converging on the same computed
point: grid math (`prop-state-interpolator.ts` → `plane-transforms.ts`) places
the PropAnchor; the avatar IK independently chases that anchor's world position
(`Avatar3D.svelte:857-885`). There is no rigid link, so *any* IK error appears
directly as hand-prop separation — the most visually expensive place an error
can live.

## Report card

| Subsystem | Grade | Notes |
|---|---|---|
| Prop trajectory math (grid→3D, 9 planes) | **A−** | Matches 2D canon, clean plane algebra. Hardcoded 0.52 m radius (TODO in code) ignores avatar proportions. |
| Lower body (foot planting, hinge knees, turn clips, root motion) | **B+** | Genuinely good; hinge-constrained knee IK + contact curves is above web par. |
| Arm IK core | **B−** | Correct analytic two-bone + per-plane pole vectors. Loses marks: no wrist DOF, constraints unwired, silent unreachable clamp. |
| Shoulder girdle | **C+** | Inman-cited elevation is nice; missing the entire protraction/retraction axis. |
| Torso/spine engagement | **C** | Good instincts (weights, hip counter-rotation) but depth-blind, saturating, open-loop. |
| Fingers/grip infrastructure | **B−** | Taxonomy-grounded pose library + 30-bone animator is real; runtime uses ~15% of it. |
| Hand↔prop coupling (the thing the eye judges) | **D+** | Position-only, wrist-orientation fields dead, no palm socket, no contact guarantee, no corrective loop. |
| **Overall perceived realism** | **C+** | The C+ is *seam-located*, not effort-located. The fixes are narrow. |

## State of the art (2026), and where TKA sits

- **No prior art for notation-driven prop-spinning avatars.** Searches for
  flow-arts virtual performers return nothing. Nearest relatives: game weapon
  IK, VR avatar IK, VTuber retargeting. TKA is genuinely first here.
- **Games (the relevant production bar):** hands don't chase props — the arm
  IK solves to a *grip target* (position **and rotation**), then the prop is
  FK-snapped to a hand socket so contact is exact by construction; residual
  error goes into the arm path, where the eye forgives it. UE5 FBIK / Unity
  FinalIK recruit clavicle and spine automatically when a target exceeds
  reach. Effector rotation goals are table stakes; TKA has none.
- **VR (VRChat IK 2.0):** shipped anatomical shoulder modeling and
  spine-recruiting reach specifically because users' hands detaching from
  intent reads as broken — same lesson.
- **Web libraries:** three.js CCDIKSolver, abandoned THREE.IK,
  [ossos](https://github.com/sketchpunklabs/ossos) (engine-independent IK
  rigs, FABRIK/CCD, Ubisoft IK-Rigs lineage). Verdict: TKA's hand-rolled stack
  is already at or above what's adoptable off-the-shelf — **extend, don't
  replace**.
- **Research tier:** ManipNet (SIGGRAPH 2021) synthesizes finger poses given
  wrist + object trajectories — *exactly* TKA's setting (both trajectories are
  known from notation). Not web-deployable off the shelf; its cheap 90%
  approximation (a small authored grip-pose set blended by context) is
  standard game practice and is what the roadmap below uses. Physics-based HOI
  (TokenHSI etc.) is not real-time-web-ready. "Teaching hands to grip staffs"
  is NOT years away — the pragmatic version is weeks of work on top of the
  existing FingerAnimator.

## Roadmap, ordered by visual ROI per effort

1. **Wrist orientation goal + palm socket** (small). Consume
   `staffAngle`/`wristRotation`: after the two-bone solve, set the hand bone's
   world rotation so the palm's grip axis aligns with the prop axis (slerp for
   continuity); offset the IK target by the palm-center vector so the staff
   sits in the palm, not the wrist joint. Kills the "frozen fist" and the
   6-9 cm offset in one change.
2. **Last-mile contact lock** (small). After IK, measure hand-socket vs prop
   transform; move the *rendered* prop by the residual (clamped, eased) so
   contact is pixel-exact. The prop deviates from the ideal notation path by
   millimeters nobody can see; the contact gap everyone can see disappears.
   This is the industry-inverted attachment adapted to notation-driven props.
3. **Depth-aware torso + per-plane stance** (medium). Feed `.z` into
   SpineTwister yaw/pitch. Add a stance layer: WHEEL plane → rotate
   hips/facing toward the plane (real spinners blade sideways); fusion planes
   → partial. Product question: does the body turning change how the notation
   should read to the audience? (Flagged below.)
4. **Reach-deficit escalation** (medium). When `success:false`, loop: clavicle
   protraction (new DOF, ~10-15°) → spine lean toward target (incl. depth) →
   hip shift/step, re-solving after each recruitment. 2-3 iterations, cheap.
   This is FinalIK's behavior in ~100 lines.
5. **Wire the dead constraints** (small). Apply `getHumanoidConstraints()`
   post-solve to forbid impossible shoulder/elbow poses.
6. **Runtime grip selection + dynamic radius** (small-medium). Drive
   `GripType` from motion type/staff angle (RELEASE during floats, etc.); wire
   `CylinderGraspSolver` for per-prop diameters.
7. **Head gaze** (small). Head look-at toward the dominant/crossing prop with
   biomech clamps — cheapest liveliness win in the whole list; currently the
   head only inherits a twist share.
8. **Regrasp micro-dynamics** (larger, ManipNet-lite). Blend authored
   micro-poses by relative staff-to-palm angle so fast spins read as the staff
   rotating *in* the hand rather than welded to it.
9. **Promote CollisionDetector to corrective** (medium) — at minimum let
   detected torso/arm penetration bias the pole vector and spine twist.

## Open questions for Austen

1. **Wheel-plane canon:** should the performer turn the whole body toward the
   wheel plane (realistic blading — audience sees the pattern edge-on) or stay
   front-facing so the notation reads visually? This decides item 3's design.
2. **Camera-distance priority:** at typical viewing distance, is contact +
   wrist alignment (items 1-2) enough, or is finger-level realism (6, 8)
   actually visible in your scenes?
3. **Believability bar:** is the target "obviously a stylized avatar doing the
   right thing" or "could pass for mocap"? Items 1-5 get the former; 8 starts
   the latter.

## Addendum (same day): the long-horizon direction — execution planning

Austen's follow-up reframed the ceiling of this work. TKA technique is strictly
no-finger-spinning: grip references survive only via negative space (MCP canon:
"passing the prop through space around the body **without** turning the torso")
and body turns ("turning the torso to execute patterns"). Both are filed in the
glossary as *execution* category — i.e., **the notation specifies the pattern;
execution chooses the body configuration.** Plane identity is body-relative
(front wall vs back wall; left wheel vs right wheel; floor above vs below the
arm), so a body turn re-frames which plane a prop occupies without changing the
absolute pattern.

The white whale: an avatar that *chooses* body turns the way a trained spinner
does — e.g., a wall-plane pattern that would cross the arms should instead be
executed by turning sideways so the pattern becomes wheel-plane in the body
frame, moving the conflicting prop from the (previous) back-wall position onto
the new left/right plane.

Why this is tractable despite feeling unsolvable: the notation gives **complete
future knowledge** of both prop trajectories, so this is offline planning with
a perfect feasibility oracle, not reactive control. The repo has already built
most of the oracle (wall-plane feasibility project, 2026-07-13: swept-tube
collision scan + StanceSimulator + three-state verdicts baked into sequence
metadata, "engine stays dumb"). What's missing is the **search layer over body
frames**: per beat, choose facing/stance from the equivalence class of legal
executions, with body turns inserted at legal transition windows. Discrete
headings × beats → dynamic programming; edge feasibility from the existing
swept-tube scan; cost = collision + reach deficit + turn effort + readability.
Constraint from `feedback_two_props_always_reachable`: a feasible execution
always exists — "infeasible" verdicts indict the solver's DoF, not the pose.

The genuinely hard part is not the search — it's encoding execution legality
(where negative-space windows are, which turns are technique-legal, grip
reference continuity). That knowledge exists only in Austen; the multiplier on
his guinea-pig role is **labeled executions**: fixture sequences with his
chosen body-turn solutions (the `tests/fixtures/wall-feasibility/` pattern,
extended from verdicts to full facing tracks).

Vision ladder: (1) contact/wrist polish (items 1-2, 5-7 above) → (2) finish the
feasibility oracle (wall-plane Phase 3) → (3) Body Conductor v1: offline DP
over facing headings, output a facing/stance track in sequence metadata, viewer
applies it → (4) v2: continuous turn timing aligned to negative-space windows +
grip-reference (thumb/pinky) continuity tracking → (5) learned style polish.
The reactive spine/stance work in items 3-4 is the degenerate single-frame case
of this planner and should be built as such.

## Known bug flagged separately

`Avatar3D.svelte` IK-target fallback (no anchor refs) skips the rig's facing
rotation/world position — wrong hand targets in several lab scenes
(CandidateThumbnailViewport, FanRelationScene, ScenePreview,
ThreeDControlsLab, WorldSceneContent). Spawned as its own task.
