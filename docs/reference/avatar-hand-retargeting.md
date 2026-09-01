# Character hand retargeting

## Runtime contract

Finding the expected finger names is a mapping result, not proof that a grip
will deform correctly. Every imported joint also carries a reference transform
that defines how its local axes sit inside the parent joint.

For each finger joint, the runtime captures the imported local reference
rotation `Qbind` before applying any pose. A grip preset is treated as a local
joint delta `ΔQgrip`, so the target is:

```text
Qtarget = normalize(Qbind × ΔQgrip)
```

The right-hand delta is mirrored before composition. Replacing `Qbind` with the
grip quaternion is forbidden: it makes a name-compatible rig appear valid while
rotating its fingers in a different reference frame.

## Evidence behind the contract

- The [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations)
  defines node rotation as a quaternion in the node's local coordinate system;
  skins additionally preserve the authored reference through inverse bind
  matrices.
- [Unreal Engine's IK retargeting documentation](https://dev.epicgames.com/documentation/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine)
  requires matching reference poses and distinguishes direction alignment from
  local/global rotation-axis alignment. It explicitly warns that an axis method
  can produce nonsensical results when rotation directions differ.
- [Unity's humanoid configuration documentation](https://docs.unity3d.com/Manual/ConfiguringtheAvatar.html)
  says a successful required-bone match is not sufficient for good results;
  the bind pose and humanoid reference pose must also be valid.
- [Three.js SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html)
  preserves target matrices and bone positions by default and provides
  per-bone local offsets for retargeting cases that need an explicit adapter.

## Acceptance gates

1. Body and finger names map to the canonical chains.
2. Grip deltas compose onto non-identity reference rotations in automated tests.
3. Identity-reference characters keep their established grip result.
4. Both hands are inspected in neutral, overhead, cross-body, depth, and low
   bake-off poses before catalog promotion.
5. A rig with a genuinely different finger-flex convention remains in visual
   review until it has a measured local-offset adapter. Bone-name success alone
   must never promote it.

## Wrist power-grip frame

A staff grip needs a full hand-local coordinate frame, not one line between two
named joints:

- **Longitudinal axis:** wrist to Middle1 MCP. Its reversed direction tracks the
  staff's directed pinky end.
- **Transverse axis:** Index1 to Pinky1 MCP, projected perpendicular to the
  longitudinal axis. This spans the palm; it is not the staff axis.
- **Palm normal:** the cross product of the transverse and longitudinal axes.
  Thumb1 selects the palmar side of the otherwise sign-ambiguous plane.

The longitudinal axis controls staff alignment. The palm normal resolves the
remaining roll about the staff. Reusing the transverse knuckle line as the
staff axis is forbidden: on a neutral humanoid hand it requests roughly a
right-angle wrist deviation before anatomical clamping and can collapse the
skinned wrist.

This frame follows the [ISB upper-extremity joint-coordinate recommendation](https://pubmed.ncbi.nlm.nih.gov/15844264/),
which defines motion from segment-local coordinate systems. It also matches
observed power-grip mechanics: during a cylindrical squeeze grip, the
[tool axis can become collinear with the forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3260558/).
The wrist swing guard is 35 degrees, consistent with evidence that maximal
[grip strength occurs near 35 degrees of wrist extension](https://pubmed.ncbi.nlm.nih.gov/1538102/)
and decreases as the wrist moves farther from its effective grip posture.

## Wrist acceptance gates

1. The calibrated staff axis is longitudinal on a measured imported rig and is
   not the transverse Index1-to-Pinky1 line.
2. A vertical staff already aligned with the forearm keeps both wrists within
   15 degrees of their imported reference rotations after smoothing settles.
3. Palm roll remains deterministic on both hands and preserves the directed
   thumb/pinky staff ends.
4. Neutral, overhead, cross-body, depth, and low bake-off poses are inspected
   from front, side, and hand-close-up views before catalog promotion.
