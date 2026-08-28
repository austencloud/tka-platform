# Flow Fest Sim fidelity backlog

This backlog records visible production gaps that must not be hidden by a
passing systems gate. An item closes only with the evidence named in its
acceptance criteria.

## FFS-FID-001 · Electric-unicycle rider contact pose

- **Priority:** P0 visual credibility
- **Status:** accepted gap; implementation not started
- **Baseline evidence:**
  `docs/superpowers/specs/flow-fest-sim/evidence/forest-ecology-r2/flow-fest-euc-37-degree-climb-4k.png`
- **Visible failure:** the avatar is attached to the wheel by one root Y/Z
  offset. The idle stance does not place the left and right soles on their
  separate pedal centers, and the locomotion idle/whole-hierarchy lean can
  leave the hips and torso visibly displaced to one side. One shoe can overhang
  or miss its pedal even while the other appears plausible.

### Evidence from the current implementation

`FlowFestElectricUnicycle.svelte` passes `Avatar3D` a single
`riderPedalHeightMeters` and `riderOffsetZMeters` position. It does not provide
left/right pedal transforms. `Avatar3D` exposes ground foot planting, but not
independent external foot targets. Its installed scene-3d package already owns
`HingeConstrainedLegIKSolver`, which accepts an arbitrary world-space target for
each foot and can align the ankle to a basis. The missing capability is the
mounted-pose input and pipeline, not another leg solver.

### Options considered

1. **Retune the avatar root offset.** This can align average sole height, but
   cannot independently correct stance width, foot yaw, knee bend, or pelvis
   centering. It also fails as the wheel pitches and carves. Rejected as a
   completion path.
2. **Create a separate EUC-only avatar model or rig.** It could bake the pose,
   but duplicates the existing `ch01` skeleton, materials, loading, and avatar
   ownership. It would make future avatar selection expensive. Rejected unless
   the shared rig proves unable to reach the measured pedal stance.
3. **Recommended: reuse the existing rig with a dedicated mounted animation
   set and pedal-contact IK.** Author neutral, acceleration, braking, and carve
   poses on the existing skeleton. Blend them from the EUC dynamics, then use
   the existing hinge-constrained two-bone solver as a final pass against live
   left/right pedal anchors. Let the pose controller rebalance the pelvis over
   the support line while the existing EUC hierarchy continues to own wheel
   heading, terrain attitude, suspension, and gross lean.

This matches current production rig practice: Unreal Engine 5.8 documents
separate foot effectors plus pelvis/hips participation for procedural
alignment, and its IK Rig example evaluates the body move before the two limb
solves. References:
<https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig-full-body-ik-in-unreal-engine>
and
<https://dev.epicgames.com/documentation/unreal-engine/ik-rig-solvers-in-unreal-engine>.

### Scope and dependencies

- Add stable left/right pedal anchor transforms to the EUC visual hierarchy.
- Extend the source of `@austencloud/scene-3d` with an explicit mounted-pose or
  external-foot-target contract. Do not patch the installed `node_modules`
  package.
- Compose `HingeConstrainedLegIKSolver` for both legs after the mounted clip is
  sampled, including pole direction, sole offset, foot-forward basis, pelvis
  vertical correction, and bounded lateral rebalance.
- Author and retarget a compact EUC clip set for the same humanoid skeleton:
  neutral, accelerate, brake, carve left, and carve right.
- Feed normalized acceleration and steering/lean from
  `FlowFestElectricUnicycleDynamics` into the pose blend. Do not drive a walk
  cycle while mounted.
- Preserve the existing dismounted locomotion, prop IK, camera, collision, and
  avatar-selection owners.

### Acceptance criteria

- At rest and while riding straight, each sole center remains within 2 cm of
  its matching pedal center and no shoe penetrates the pedal by more than 1 cm.
- Foot forward differs from the pedal forward basis by at most 8 degrees.
- At neutral input the pelvis stays within 4 cm of the wheel center plane; the
  torso reads balanced rather than side-slipped.
- Knees bend forward with no hyperextension or pole flip at rest, under
  acceleration/braking, and during left/right carving.
- The contacts remain stable to within 1 cm over a ten-second idle capture and
  do not jitter when simulation frame rate changes between 30 and 60 FPS.
- The same proof passes on level terrain and registered 20-degree and 35-degree
  slopes without double-applying the terrain attitude.
- Mounting enters the dedicated EUC pose without a walk-cycle flash;
  dismounting restores the ordinary on-foot animation pipeline.
- Close-up rear, side, and three-quarter screenshots at 1920×1080 and
  3840×2160 show both pedals, both soles, knees, hips, and wheel together.
- A runtime diagnostic reports left/right sole-to-pedal error, pelvis lateral
  offset, and active mounted-pose blend weights so contact regressions fail
  mechanically rather than by taste alone.
