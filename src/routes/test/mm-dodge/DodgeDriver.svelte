<script lang="ts">
  /**
   * DodgeDriver — Threlte child that drives the prop-dodge slice each frame.
   *
   * IMPERATIVE by design: the staff/foot meshes are plain Object3Ds mutated
   * directly in the useTask loop (exactly how MmLocomotionController mutates
   * bones), and the solve runs ONCE behind a plain boolean guard. There is NO
   * $effect, NO $derived, and NO per-frame $state in this component. Binding
   * reactive $state to <T> props and rewriting it every frame feeds Threlte's
   * invalidate -> render -> task -> invalidate cycle synchronously, which Svelte
   * reports as effect_update_depth_exceeded (an infinite loop that hangs the
   * page). Keeping the per-frame path reactivity-free makes that impossible.
   *
   * Deferred (correctness-first bar): per-frame arm-IK so the hands grip the
   * moving staves, and a full swept-volume wireframe gizmo.
   */
  import { T, useTask } from "@threlte/core";
  import {
    Euler,
    Mesh,
    CylinderGeometry,
    MeshStandardMaterial,
    SphereGeometry,
    Quaternion,
    Vector3,
    type Bone,
  } from "three";
  import type { MmLocomotionController } from "$lib/features/stage/locomotion/motion-matching/mm-locomotion-controller";
  import type { RigBinding } from "$lib/features/stage/locomotion/motion-matching/rig-binding";
  import { calculatePropState } from "$lib/shared/3d/services/prop-state-interpolator";
  import { buildSweptVolume } from "$lib/features/stage/locomotion/dodge/swept-volume-builder";
  import { solveDodge } from "$lib/features/stage/locomotion/dodge/dodge-orchestrator";
  import {
    StanceSimulator,
    restPoseFromHeight,
  } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
  import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
  import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
  import type { DodgeSolution } from "$lib/features/stage/locomotion/dodge/dodge-types";
  import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

  let {
    controller,
    rig,
    blueConfig,
    redConfig,
    dodgeOn,
    onClearance,
  }: {
    controller: MmLocomotionController | null;
    rig: RigBinding | null;
    blueConfig: MotionConfig3D;
    redConfig: MotionConfig3D;
    dodgeOn: boolean;
    onClearance: (clearanceM: number, solution: DodgeSolution | null) => void;
  } = $props();

  const LOOP_SEC = 2.5;
  const STAFF_HORIZONTAL_QUAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));

  // Imperative meshes — mutated each frame, NEVER bound to reactive $state.
  const blueStaff = new Mesh(
    new CylinderGeometry(0.02, 0.02, 0.86, 12),
    new MeshStandardMaterial({ color: "#3b82f6" })
  );
  const redStaff = new Mesh(
    new CylinderGeometry(0.02, 0.02, 0.86, 12),
    new MeshStandardMaterial({ color: "#ef4444" })
  );
  const footSphere = new Mesh(
    new SphereGeometry(0.05, 12, 12),
    new MeshStandardMaterial({ color: "#22c55e", transparent: true, opacity: 0.7 })
  );
  footSphere.visible = false;

  // Plain (non-reactive) state. None of this triggers Svelte reactivity.
  let shoulderY = 0;
  let restFacing = 0;
  let blueSweep: SimPropTarget[] = [];
  let redSweep: SimPropTarget[] = [];
  let sim: StanceSimulator | null = null;
  let spineBone: Bone | null = null;
  let solution: DodgeSolution | null = null;
  let lastDodgeOn = false;
  let progress = 0;
  let didSolve = false;
  let clearanceFrames = 0;

  const _q = new Quaternion();
  const _pitchQ = new Quaternion();
  const _pitchAxis = new Vector3(1, 0, 0);

  function readShoulderY(r: RigBinding): number {
    const ls = r.getBone("LeftShoulder");
    const rs = r.getBone("RightShoulder");
    const v = new Vector3();
    let sum = 0;
    let n = 0;
    if (ls) { ls.getWorldPosition(v); sum += v.y; n++; }
    if (rs) { rs.getWorldPosition(v); sum += v.y; n++; }
    if (n === 0) {
      const neck = r.getBone("Neck");
      if (neck) { neck.getWorldPosition(v); return v.y; }
      return 1.4;
    }
    return sum / n;
  }

  /** Run the solve + frame setup exactly once, the first frame the rig is ready. */
  function ensureSolved(): void {
    if (didSolve || !rig || !controller) return;
    didSolve = true;
    shoulderY = readShoulderY(rig);
    restFacing = controller.state.facing;
    spineBone = rig.getBone("Spine");
    blueSweep = buildSweptVolume(blueConfig, 24).samples;
    redSweep = buildSweptVolume(redConfig, 24).samples;
    sim = new StanceSimulator(restPoseFromHeight(1.8));
    solution = solveDodge(blueConfig, redConfig, 1.8, 24);
    footSphere.position.set(solution.stance.footOffsetX, 0.02, solution.stance.footOffsetZ);
    footSphere.visible = true;
    if (typeof window !== "undefined") {
      (window as unknown as { __dodgeSolution?: DodgeSolution }).__dodgeSolution = solution;
      (window as unknown as { __dodgeClearance?: () => number }).__dodgeClearance = liveClearance;
    }
  }

  /** Place a staff mesh from the prop state on its plane (imperative, no state). */
  function placeStaff(staff: Mesh, config: MotionConfig3D, p: number): void {
    const s = calculatePropState(config, p);
    staff.position.set(
      s.worldPosition.x,
      shoulderY + s.worldPosition.y,
      s.worldPosition.z + 0.3
    );
    _q.copy(s.worldRotation).multiply(STAFF_HORIZONTAL_QUAT);
    staff.quaternion.copy(_q);
  }

  /** Current avatar stance in the solver frame (origin at the rest pose). */
  function liveStance(): StancePose {
    const root = rig?.root;
    const facing = controller?.state.facing ?? restFacing;
    return {
      footOffsetX: root ? root.position.x : 0,
      footOffsetZ: root ? root.position.z : 0,
      rootYawRad: facing - restFacing,
      spinePitchRad: dodgeOn && solution ? solution.stance.spinePitchRad : 0,
    };
  }

  /** Worst body penetration at the live stance, as a signed clearance (m).
   *  Negative = the prop intrudes into torso/head; >= 0 = cleared. */
  function liveClearance(): number {
    if (!sim || blueSweep.length === 0) return 0;
    const r = sim.evaluateSweep(liveStance(), blueSweep, redSweep);
    const torso = r.collisions.find((c) => c.zone === "prop-through-torso");
    const head = r.collisions.find((c) => c.zone === "prop-through-head");
    const depth = Math.max(torso?.depth ?? 0, head?.depth ?? 0);
    return -depth;
  }

  useTask((delta) => {
    if (!controller || !rig) return;
    ensureSolved();
    const dt = Math.min(delta, 1 / 15);

    // Drive the dodge intent on toggle change.
    if (dodgeOn !== lastDodgeOn) {
      lastDodgeOn = dodgeOn;
      if (dodgeOn && solution) {
        controller.setTargetFacing(solution.stance.rootYawRad);
        controller.setTargetPosition(solution.stance.footOffsetX, solution.stance.footOffsetZ);
      } else {
        controller.setTargetFacing(0);
        controller.setTargetPosition(0, 0);
      }
    }

    controller.update(dt);

    // Apply the solved spine pitch on top of the posed clip (local X hinge).
    if (spineBone && dodgeOn && solution) {
      _pitchQ.setFromAxisAngle(_pitchAxis, solution.stance.spinePitchRad);
      spineBone.quaternion.multiply(_pitchQ);
      spineBone.updateMatrixWorld(true);
    }

    // Advance the prop clock and place the staves imperatively.
    progress = (progress + dt / LOOP_SEC) % 1;
    placeStaff(blueStaff, blueConfig, progress);
    placeStaff(redStaff, redConfig, progress);

    // Report clearance to the page at ~6/sec, not every frame, to keep the
    // panel's reactive updates well clear of the render loop.
    if (++clearanceFrames >= 10) {
      clearanceFrames = 0;
      onClearance(liveClearance(), solution);
    }
  });
</script>

<T is={blueStaff} />
<T is={redStaff} />
<T is={footSphere} />
