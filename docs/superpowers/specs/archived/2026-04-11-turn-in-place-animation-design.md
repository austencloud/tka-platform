---
status: archived
value: 3
effort: M
remaining: "Code framework complete (ClipBasedTurnAnimator, IK solver, RootMotionExtractor). Blocked on clip assets: no FBX/GLB files exist. Need 3 Mixamo clips (90L, 90R, 180) + 4 mocap clips (45L, 45R, 135L, 135R)."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-08-01
---
# Turn-In-Place Animation System Design

> **Archived 2026-08-01 (GHOST_PATHS):** the deliverables this spec names no longer exist on disk (Avatar3D.svelte, IFootPlanter, IIKSolver, and FootPlanter were all deleted from the tree). The avatar 3D substrate it targeted was removed; if this capability returns it needs a fresh spec against the current scene architecture.

**Date:** 2026-04-11
**Status:** Design approved, ready for implementation plan
**Scope:** Sequence Viewer performer + museum standing NPCs (everything except the FPS player)

## Problem

The avatar in the sequence viewer slides its feet on the floor during two situations:

1. **Beat-to-beat rotation.** When `PerformerRig.rotation.y` changes to point the avatar at a new facing angle, the entire rig group pivots around its origin. The feet, which are held in place by an idle animation inside the rig, appear to swing through an arc in world space — they are rotating rigidly with the body instead of stepping.
2. **Idle hip sway.** The idle clip has a lateral hip translation track. Without any ground anchoring, the mesh (including feet) slides laterally with the hips. The viewer sees this as the feet drifting without any stepping choreography.

Both symptoms come from the same root cause: **the animation system has no mechanism for pinning the feet to the ground independently of where the hips or the rig origin happen to be.** Visual believability requires that the feet commit to a ground position and the body moves above them — which in turn requires foot IK, and for large heading changes, authored stepping motion with root motion driving the rig's yaw.

## Goal

Produce a layered animation pipeline where:

- Feet remain geometrically planted on the ground regardless of hip sway or small body motion
- Changes in facing angle are performed by authored stepping clips, not rigid rig-level rotation
- The interface between the sequence/scene layer and the animator is **sample-based** — given `(fromHeading, toHeading, phase 0→1)` it returns a pose, so the same system works for scrubbable timelines, paused review, and reactive museum NPCs
- The implementation can be swapped in a decade (motion matching, neural motion models, generative animation) without changing the interface or anything above it

## Scope

**In scope:** Any avatar that is rooted in place and may rotate — specifically the `Viewer3DScene` performer (sequence playback, gallery cards, mirror/dual-wheel modes) and standing NPCs in the museum (reactive turns toward the player).

**Out of scope:** The museum FPS player. Per prior decision, that avatar uses responsive code-driven movement and foot IK fights the responsiveness. It keeps its current pipeline unchanged.

**Also out of scope (separate project):** Full TKA sequence capture with constraint retargeting. That project depends on the IK and interface work here but is its own feedback item (`SNOJemsUM3ZPISODhtXX`).

## Non-goals

- Motion matching. The bounded discrete-state problem (7 turns × 2 directions) doesn't need it; classical clip sets remain state of the art for this regime.
- Procedural turn generation from scratch. We author/capture the 7 clips and play them; the system is sample-based so a generator could be substituted later, but that's not this project.
- Walking locomotion. This system covers stationary turns only. Museum FPS locomotion already has its own speed-matched clip system and is not touched.
- Finger-level pose during turns. Fingers are driven by the existing `FingerAnimator` system unchanged.

## Current state of the codebase

Before any new work, three pieces of existing infrastructure need to be understood, because the project leverages them:

**`IIKSolver` (`services/contracts/IIKSolver.ts`):** Generic IK with analytic 2-bone, CCD, and FABRIK algorithms. Has 3-axis min/max joint constraints, pole hints, humanoid constraint presets. The 2-bone solver was designed for arm chains (shoulder → elbow → wrist) where all three joints have wide rotational freedom. Passing leg chains into it produces knee splaying because the solver treats the knee as a free-rotation joint when it should be a 1-DOF hinge around the sagittal axis.

**`IFootPlanter` (`services/contracts/IFootPlanter.ts`, implementation disabled at `Avatar3D.svelte:752`):** Post-process foot IK that was scaffolded to run between `LocomotionAnimator.update()` and `AvatarAnimator.update()`. Has contact detection via foot velocity threshold, blend-in/blend-out ramps, pelvis height clamping, foot-to-ground offset. The class is fully written. It is disabled because it calls the generic `solveTwoBone()` which produces the knee splay. The comment in `Avatar3D.svelte:746-752` explicitly identifies the three missing pieces: **hinge-constrained knee solver**, **foot rotation alignment**, and **authored animation contact curves**. That comment is the canonical statement of what this project fixes.

**`RootMotionExtractor` (called at `Avatar3D.svelte:726-743`):** Live. Every frame, extracts lateral + forward delta from the Hips bone, converts Mixamo cm to scene units, rotates by facing angle, and emits `onRootMotion({x, z})`. It does **not** currently extract yaw delta — that's an addition this project needs.

**`LocomotionAnimator`, `AnimationStateMachine`, `AvatarAnimator`, `PerformerRig`:** Existing and unchanged. The turn animation system plugs into the existing animation pipeline as additional clip inputs and an additional IK post-process pass.

## Architecture

The system has two layers, added on top of existing infrastructure. I'll describe them top-down.

### Layer 1: `ITurnAnimator` — sample-based turn sampling

**The public interface that consumers (sequence viewer, museum NPC scheduler) talk to.** It deliberately does not expose "clips" or "playback state" — those are implementation details behind this interface.

```typescript
interface TurnRequest {
  /** Heading at phase 0, in radians (0 = north, positive = counterclockwise) */
  fromHeading: number;
  /** Heading at phase 1, in radians */
  toHeading: number;
  /** Phase 0→1 within the turn. 0 = start pose, 1 = end pose. */
  phase: number;
}

interface TurnSample {
  /** Accumulated yaw delta from phase=0 to this phase, in radians */
  yawDelta: number;
  /** Per-bone local rotations to apply to the skeleton this frame */
  boneRotations: Map<string, Quaternion>;
  /** Per-foot contact state: 0 = airborne, 1 = fully planted */
  leftFootContact: number;
  rightFootContact: number;
}

interface ITurnAnimator {
  /**
   * Sample the turn pose at a given phase. Pure function: same input always
   * returns same output. Consumers own the phase clock; this method has no
   * internal playback state.
   */
  sample(request: TurnRequest): TurnSample;

  /**
   * Compute the magnitude of a heading change in radians, normalized to the
   * set of clips the implementation supports. Returns the shortest-path
   * rotation in [-π, π]. Consumers use this to decide whether a turn is
   * large enough to schedule or can be ignored (e.g. below some epsilon).
   */
  computeShortestAngle(fromHeading: number, toHeading: number): number;
}
```

**Implementation: `ClipBasedTurnAnimator`.** Internally holds the 7 turn clips (45L, 90L, 135L, 180, 45R, 90R, 135R). On each `sample()` call:

1. Pick the clip whose magnitude matches the requested heading change (snapping to the nearest 45° increment; beat heading changes in TKA are always multiples of 45° so this is lossless).
2. Compute the sample time as `phase × clip.duration`.
3. Sample the clip at that time using `AnimationAction.time` on a paused mixer, OR (more directly) pre-bake each clip's bone rotations into a frame-indexed array at load time and interpolate. Direct sampling is cleaner because the mixer is stateful and we want stateless.
4. Extract yaw delta by reading the Hips bone's Y rotation at phase × duration and subtracting the Hips bone's Y rotation at 0.
5. Read contact curves (baked at clip load time) at the same sample time.
6. Return the `TurnSample`.

**Future implementations** (10-year swap point): `NeuralTurnAnimator` (motion diffusion model), `MotionMatchingTurnAnimator` (database search), `ConstraintRetargetedTurnAnimator` (from mocap + IK constraints). All of them implement the same sample-based interface and can be substituted without touching the rig or consumers.

### Layer 2: `ILegIKSolver` — hinge-constrained foot planting

**A specialized two-bone solver for leg chains.** Extends the IK stack rather than replacing it; the generic `IIKSolver` continues serving arms where wide-range motion is correct.

```typescript
interface LegIKInput {
  /** The leg chain: UpLeg → Leg → Foot */
  chain: BoneChain;
  /** World-space target position for the foot bone */
  footTarget: Vector3;
  /** Ground normal at the target (for foot rotation alignment) */
  groundNormal: Vector3;
  /** Forward direction the foot should face (for toe alignment) */
  footForward: Vector3;
  /** Sagittal axis the knee is allowed to rotate around (in UpLeg local space) */
  kneeHingeAxis: Vector3;
  /** Forward vector for the pole hint (prevents knee from flipping backward) */
  poleDirection: Vector3;
  /** Blend weight 0-1 (0 = animation only, 1 = fully IK) */
  weight: number;
}

interface ILegIKSolver {
  solve(input: LegIKInput): void;
}
```

**Algorithm (`HingeConstrainedLegIKSolver`):**

1. **Position solve.** Standard 2-bone analytic IK law-of-cosines, but the middle-joint rotation is constrained to the plane perpendicular to `kneeHingeAxis`. This enforces 1-DOF knee motion; knees cannot splay sideways because the solver never produces out-of-plane rotation.
2. **Foot rotation alignment.** After the position solve, compute the ankle's world rotation such that the foot's sole plane aligns with `groundNormal` and the toe forward vector aligns with `footForward`. Apply this as a quaternion on the Foot bone.
3. **Weight blending.** Slerp each computed bone rotation toward the original animation rotation by `1 - weight`. This is what lets contact curves drive smooth blend-in/blend-out.

The solver is stateless — all input comes from the `LegIKInput` struct. Same request, same result.

### Existing `FootPlanter` gets rewired

`FootPlanter` already has the scaffolding: per-foot contact detection, blend ramps, pelvis height clamping, contact velocity thresholds, and the frame-order wiring between `LocomotionAnimator` and `AvatarAnimator`. What it does **not** have is a solver that works on legs. This project adds `ILegIKSolver` as a dependency and switches `FootPlanter` to call it instead of the generic two-bone solver.

`FootPlanter` also switches from **velocity-threshold-based contact detection** to **contact-curve-based detection** when the current clip has baked curves. The velocity heuristic remains as a fallback for clips without curves (idle, legacy locomotion). On turn clips specifically, contact curves are authoritative because a pivot foot has zero velocity for its entire stance phase and the velocity heuristic would either lock it too aggressively (if threshold is loose) or miss the planting entirely (if tight).

### Contact curve format

Each turn clip ships with a sidecar JSON file containing per-frame contact state sampled at the clip's frame rate:

```typescript
interface ContactCurveData {
  /** Matches the clip name in the GLB */
  clipName: string;
  /** Frames per second the curves are sampled at */
  frameRate: number;
  /** Total frame count — matches clip duration × frameRate */
  frameCount: number;
  /** Per-frame contact state for left foot (0 = airborne, 1 = planted).
   *  Values between 0 and 1 are weight ramps for blend-in/blend-out. */
  leftFoot: number[];
  /** Per-frame contact state for right foot */
  rightFoot: number[];
}
```

Contact curves are loaded alongside the GLB at clip-load time and stored in a `ContactCurveCache` keyed by clip name. `FootPlanter` queries the cache each frame.

### Root motion yaw extraction — additive change

`RootMotionExtractor` currently extracts lateral (X) and forward (Z) translation deltas from the Hips bone. This project adds **yaw delta extraction**: the Y-rotation component of the Hips bone world rotation, differenced frame-to-frame, emitted as `onRootMotion({x, z, yawDelta})`.

`PerformerRig` receives `yawDelta` through the `onRootMotion` callback and, when a turn is active, accumulates it into `facingAngle`. When no turn is active, the callback is ignored (idle clips don't rotate the hips). This is what makes the rig physically rotate through a turn rather than snap to the new heading — the clip drives the rotation, the rig follows.

### Pipeline order per frame

```
1. Sequence/NPC scheduler computes current phase and calls
   turnAnimator.sample({ fromHeading, toHeading, phase })
   → yields boneRotations + contact + yawDelta

2. LocomotionAnimator.update(delta)
   → writes baseline pose from idle/locomotion clips to skeleton

3. Turn clip overlay: apply boneRotations from step 1 to skeleton bones
   (full overwrite on the bones the turn clip authored — hips, legs, spine).
   The idle clip's hip bob/sway is suspended on these bones for the duration
   of the turn; the turn clip's own authored hip motion takes over, which
   includes any natural sway the animator baked in. When phase reaches 1,
   the turn is retired and idle resumes driving hips.

4. RootMotionExtractor.extract()
   → reads x, z, yawDelta from hips (now includes turn clip's yaw)
   → emits onRootMotion({x, z, yawDelta})

5. PerformerRig consumes onRootMotion
   → integrates yawDelta into rotation.y when a turn is active

6. FootPlanter.update(delta, input)
   → queries contact curves for this clip at this phase
   → calls ILegIKSolver.solve() for each foot
   → writes corrected leg + ankle rotations to skeleton

7. AvatarAnimator.update()
   → arm IK for props (existing, unchanged)

8. Render
```

The new insertions are steps 1, 3, and 5. Steps 2, 4, 6, 7, 8 are existing with minor modifications (FootPlanter calls a different solver; extractor includes yawDelta; rig consumes yawDelta).

### Upper body during turns

**The turn clip is responsible for lower body and hips. The upper body (arms, hands, props) continues to be driven by the existing `AvatarAnimator` arm IK that pins hands to grid positions.** When a turn is in progress, the hand grid positions interpolate from beat N's targets to beat N+1's targets over phase 0→1, and the arm IK tracks them normally.

This matters because the sequence is notation-authoritative: the hands must land exactly where the sequence data says at every beat. The turn clip cannot be allowed to override that. The design cleanly separates: `ITurnAnimator` produces a pose for legs/hips/spine; `AvatarAnimator` produces a pose for arms/hands; they compose without conflict because they own disjoint bone sets.

### Timing: beat duration wins

Each turn's phase is computed as `phase = (currentBeatTime - turnStartTime) / beatDuration`, clamped to `[0, 1]`. The clip's authored duration is not used to advance time — it's only used by `ClipBasedTurnAnimator` to map phase back to a sample time inside the clip. At fast tempos the clip effectively plays fast; at slow tempos it plays slow. The avatar always finishes the turn exactly at the next beat boundary.

Root motion yaw extraction is phase-based, not time-based: at phase P, the accumulated yaw is read from the clip's hips-Y track at time `P × clip.duration`. This means the rig's rotation is smooth across arbitrary play rates and the consumer doesn't need to know about clip duration.

## Data flow

### Sequence Viewer path

1. Beat playback advances `currentBeatTime` each frame based on tempo
2. `SequencePerformerScheduler` (new, thin) computes phase from beat time and calls `turnAnimator.sample()`
3. Pipeline runs as above
4. On beat boundary, `fromHeading` rolls to what was `toHeading`, new `toHeading` read from next beat, phase resets to 0

### Museum NPC path

1. Museum NPC AI decides to turn toward the player at wall-clock time T with duration D
2. `MuseumNPCScheduler` (new, thin) computes `phase = (now - T) / D`
3. Same pipeline as above
4. When phase reaches 1, the NPC is at the new heading and the scheduler becomes idle

Both consumers compute phase from their own clocks and feed `ITurnAnimator`. The animator itself has no concept of "time" — it only knows phase.

### Scrubbing path

1. User drags timeline to time T
2. Sequence viewer computes which beat T falls within and the phase within that beat
3. `turnAnimator.sample()` is called with the computed phase — which may go backward, forward, or jump
4. Pipeline runs, avatar shows the correct pose
5. No playback state is involved; scrubbing is the common case, not a special case

## Error handling

**Clip not loaded.** `ClipBasedTurnAnimator.sample()` falls back to returning a pose that linearly interpolates the hips-Y rotation between `fromHeading` and `toHeading` with no leg motion. Feet will slide (which is the current state of the world) but nothing crashes. A warning is logged once per missing clip.

**Heading change not a multiple of 45°.** The animator snaps to the nearest supported clip magnitude and logs a warning. This should never happen in production because TKA heading changes are always 45° multiples, but the system is defensive.

**IK target unreachable.** If the foot target is further from the hip than the leg can extend, the leg stretches to max length toward the target (standard 2-bone IK degenerate case) and the pelvis adjustment clamp prevents extreme corrections. The visual result is slight hyper-extension rather than popping.

**Contact curves missing for a clip.** `FootPlanter` falls back to velocity-threshold contact detection for that clip. Turn clips with proper curves get accurate planting; legacy clips keep working as before.

## Testing

Tests follow the project's earned-test philosophy: silent-bug algorithms get unit tests, visual wiring gets manual verification.

**Unit tested (silent bugs):**

- `HingeConstrainedLegIKSolver`: give it known targets and verify the knee rotation stays in the sagittal plane within ε; verify target error is within tolerance; verify the unreachable case degrades gracefully.
- `ClipBasedTurnAnimator.sample()`: given a fake clip with known bone rotation curves, verify phase sampling is linear and deterministic, verify `computeShortestAngle()` returns [-π, π] for various heading pairs.
- `RootMotionExtractor.extract()` with yawDelta: verify yaw delta is computed correctly across frame boundaries including wraparound at ±π.
- Contact curve sampling: verify frame-to-phase mapping, verify out-of-range phases clamp rather than crash.

**Manual/visual verification:**

- Sequence viewer: perform a 7-letter sequence with mixed facing changes, confirm feet never slide and turns look like steps
- Scrubbing: drag playhead through a sequence at varying speeds, confirm avatar is always in a valid pose with no popping
- Museum NPC: place a standing NPC, move past it, confirm it turns toward the player with stepping
- Idle hip sway: park the avatar and watch for 30 seconds, confirm feet stay planted while hips sway

## Phase breakdown

The project ships in two phases. Phase 1 is foundation work that is necessary regardless of clip sourcing and is durable (the IK stack and root motion yaw are permanent infrastructure). Phase 2 builds the clip library and the public interface on top.

### Phase 1: Foundation (IK stack + root motion yaw)

**Ships value as:** the existing disabled `FootPlanter` becomes usable with locomotion clips. Walking in the museum immediately looks better (feet planted through heel strikes). No new clip assets needed.

Tasks:

1. Add `HingeConstrainedLegIKSolver` implementation + `ILegIKSolver` interface, unit tested
2. Extend `IIKSolver` OR keep `ILegIKSolver` separate (decision at plan time — separate is cleaner; tree ends up with generic solver for arms, leg solver for legs)
3. Add foot rotation alignment pass to `HingeConstrainedLegIKSolver`
4. Add `ContactCurveData` type, `ContactCurveCache`, and velocity-fallback behavior to `FootPlanter`
5. Rewire `FootPlanter` to call `ILegIKSolver` instead of generic two-bone
6. Re-enable `FootPlanter` in `Avatar3D.svelte` for sequence viewer context (behind a prop flag; museum FPS player leaves it off)
7. Extend `RootMotionExtractor` to extract and emit yaw delta
8. Wire `onRootMotion({yawDelta})` consumption into `PerformerRig` (behind a flag — only active when a turn is scheduled)
9. Update stale memory file `project_root_motion_migration.md` — root motion is live, not disabled

### Phase 2: Turn clips and public interface

**Ships value as:** the feature the user actually asked for. Beat-to-beat rotations become stepping animations. Museum NPCs can reactively turn.

Tasks:

1. Source Mixamo clips: 90° Left, 90° Right, 180° — download FBX, import to Blender, bake root motion, export as GLB with contact curves as a sidecar
2. Mocap Move.ai clips: 45° L, 45° R, 135° L, 135° R. Two-phone setup at ~90° offset. Subject (Austen) performs each turn from a neutral standing pose with arms at sides. Export Mixamo-compatible skeleton, auto-rig via Mixamo, export as GLB
3. Build a contact-curve auto-bake Blender script that derives contact state from foot height + velocity and exports the sidecar JSON (saves manual curve authoring for the mocap clips)
4. Implement `ITurnAnimator` contract
5. Implement `ClipBasedTurnAnimator` with phase-based sampling
6. Build `SequencePerformerScheduler` that computes phase from beat time and calls the animator
7. Build `MuseumNPCScheduler` for reactive standing NPC turns
8. Wire into `Avatar3D.svelte` / `PerformerRig.svelte`: during sample, overlay turn clip bones, emit yaw through root motion, let `FootPlanter` handle feet
9. Add `turnAnimator` to the appropriate DI container (`performer-container` or equivalent)
10. Manual verification across sequence viewer, scrubbing, museum NPCs

### Future phases (not in this spec)

- Phase 3: Cross-fade between consecutive turns that don't complete before the next request (short beat followed by long beat followed by short beat). Partial designs exist as "interruption blending" and are worth their own brainstorm.
- Phase 4: Upgrade `ClipBasedTurnAnimator` → `NeuralTurnAnimator` or similar when the technology matures. The interface is designed so this is an implementation swap, not a rewrite.
- Related future project: TKA Sequence Capture (feedback `SNOJemsUM3ZPISODhtXX`) — constraint-retargeted mocap replay. Depends on this IK stack.

## Risks and edge cases

**Knee pop at the analytic solver's reach boundary.** When the target is exactly at the maximum leg extension, the 2-bone analytic solver returns a flat-knee configuration which can pop if the target oscillates around that boundary. Mitigation: clamp target distance to `0.98 × maxLegLength` before solving (small gap prevents boundary oscillation).

**Contact curve timing mismatch with beat tempo.** Contact curves are authored at the clip's native frame rate. At high play rates (fast tempo), the curve sampling may miss brief contact events. Mitigation: curves are linearly interpolated during sampling, and contact states below 0.2 are clamped to 0 (avoiding spurious IK blend-in during rapid transitions).

**Mocap vs Mixamo stylistic mismatch.** The 3 Mixamo clips and 4 mocap clips will have different "performer character" — Mixamo's generic humanoid vs. Austen's specific movement. The 45° and 135° clips may feel different from the 90° and 180° clips when played back-to-back. Mitigation: during Phase 2, evaluate mismatch empirically before shipping. If too jarring, options are (a) retarget the Mixamo clips through the same processing as the mocap clips to smooth out the difference, or (b) mocap all 7 clips and drop the Mixamo hybrid.

**Root motion yaw extraction floating-point drift.** Over many frames, accumulated yawDelta may drift from the true turn angle due to float precision. Mitigation: at phase 1.0, the rig's facingAngle is **snapped** to the target heading (the scheduler knows the authoritative target) rather than relying on the accumulated delta. Drift during the turn is imperceptible.

**Knee hinge axis calibration.** The hinge axis is defined in UpLeg local space, but Mixamo skeletons can have slightly different UpLeg orientations between models. Mitigation: derive hinge axis at skeleton-build time by computing the cross product of the rest-pose femur and tibia directions — this is always the correct sagittal axis regardless of bind pose quirks.

**Sequence viewer rig pivot vs. foot midpoint.** Even with foot IK working perfectly, if the rig origin is at the hips and yaw is driven by root motion from the clip, the visual pivot point of the turn should land between the feet — the clip itself is responsible for positioning the hips such that this happens naturally. If clips are authored correctly this is automatic. If not, an additional rig-origin offset may be needed. Flag for manual review during Phase 2 verification.

## Open questions

These are questions whose answers don't block the design but need decisions during implementation planning:

1. Where does `ILegIKSolver` live? New file next to `IIKSolver`, or as an additional method on `IIKSolver`? (Recommend: separate file. Legs are structurally different from arms.)
2. Where does `ITurnAnimator` live in the DI container hierarchy? `performer-container` vs. a new `animation-container`? (Recommend: whichever container owns `FootPlanter` already.)
3. Should the `SequencePerformerScheduler` and `MuseumNPCScheduler` share a base class? They both compute `phase` from a clock, just different clocks. (Recommend: two 20-line classes are fine, don't pre-abstract.)
4. Bake contact curves as JSON sidecars or as extras in the GLB itself? (Recommend: sidecars — easier to iterate without re-exporting the GLB.)

## References

- `src/lib/shared/3d/services/contracts/IIKSolver.ts` — existing generic IK
- `src/lib/shared/3d/services/contracts/IFootPlanter.ts` — existing scaffolded foot planter
- `src/lib/shared/3d/services/implementations/FootPlanter.ts` — implementation
- `src/lib/shared/3d/components/Avatar3D.svelte:746-752` — the canonical comment describing the three missing IK pieces
- `src/lib/shared/3d/components/Avatar3D.svelte:726-743` — live root motion extraction
- `docs/superpowers/specs/2026-04-05-performer-rig-hierarchy-design.md` — rig hierarchy this plugs into
- Related future project: feedback `SNOJemsUM3ZPISODhtXX` (TKA Sequence Capture)
