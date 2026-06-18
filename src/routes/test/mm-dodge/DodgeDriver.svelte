<script lang="ts">
  /**
   * DodgeDriver — Threlte child that drives the prop-dodge slice each frame.
   *
   * Mirrors MmDriver: a useTask loop (delta in SECONDS) advances the
   * MmLocomotionController. Adds: two live staves swinging on their planes, the
   * solved anticipatory dodge (toggle), the applied spine pitch, and an
   * authoritative clearance readout computed by running the SAME StanceSimulator
   * at the avatar's live stance against the prop swept volume.
   *
   * Deferred to a follow-up (correctness-first bar): per-frame arm-IK so the
   * hands grip the moving staves, and a full swept-volume wireframe gizmo. The
   * load-bearing claim (torso cleared) is verified by the clearance readout
   * without them.
   */
  import { T, useTask } from "@threlte/core";
  import { Euler, Quaternion, Vector3, type Bone } from "three";
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

  const STAFF_LENGTH = 0.86;
  const STAFF_RENDER_RADIUS = 0.02;
  const LOOP_SEC = 2.5;
  const STAFF_HORIZONTAL_QUAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));

  // Live render transforms for each staff (world).
  let bluePos = $state<[number, number, number]>([0, 1, 0]);
  let blueQuat = $state<[number, number, number, number]>([0, 0, 0, 1]);
  let redPos = $state<[number, number, number]>([0, 1, 0]);
  let redQuat = $state<[number, number, number, number]>([0, 0, 0, 1]);

  // Solved dodge + the marker for the solved foot target.
  let solution = $state<DodgeSolution | null>(null);
  let footMarker = $state<[number, number, number]>([0, 0.02, 0]);

  // Solve + frame setup, recomputed when configs change.
  let shoulderY = 0;
  let restFacing = 0;
  let blueSweep: SimPropTarget[] = [];
  let redSweep: SimPropTarget[] = [];
  let sim: StanceSimulator | null = null;
  let spineBone: Bone | null = null;
  let lastDodgeOn = false;
  let progress = 0;

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

  // Initialize solve + frame once the rig + controller are ready.
  $effect(() => {
    if (!rig || !controller) return;
    shoulderY = readShoulderY(rig);
    restFacing = controller.state.facing;
    spineBone = rig.getBone("Spine");
    blueSweep = buildSweptVolume(blueConfig, 24).samples;
    redSweep = buildSweptVolume(redConfig, 24).samples;
    sim = new StanceSimulator(restPoseFromHeight(1.8));
    // Use a LOCAL for the solve result. Reading the `solution` $state back inside
    // this same effect (e.g. for footMarker) would make the effect depend on a
    // value it writes — an infinite re-run (effect_update_depth_exceeded).
    const sol = solveDodge(blueConfig, redConfig, 1.8, 24);
    solution = sol;
    footMarker = [sol.stance.footOffsetX, 0.02, sol.stance.footOffsetZ];

    if (typeof window !== "undefined") {
      (window as unknown as { __dodgeSolution?: DodgeSolution }).__dodgeSolution = sol;
      (window as unknown as { __dodgeClearance?: () => number }).__dodgeClearance = liveClearance;
    }
  });

  /** Map calculatePropState output into a world render transform on this plane. */
  function propRender(config: MotionConfig3D, p: number): {
    pos: [number, number, number];
    quat: [number, number, number, number];
  } {
    const s = calculatePropState(config, p);
    // grip world = (x, shoulderY + y, z + AVATAR_GRID_OFFSET-equivalent already
    // baked by the renderer frame). buildSweptVolume adds the grid offset to z;
    // mirror that here so the rendered staff sits where the solver placed it.
    const pos: [number, number, number] = [
      s.worldPosition.x,
      shoulderY + s.worldPosition.y,
      s.worldPosition.z + 0.3,
    ];
    _q.copy(s.worldRotation).multiply(STAFF_HORIZONTAL_QUAT);
    return { pos, quat: [_q.x, _q.y, _q.z, _q.w] };
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
   *  Negative = the prop is intruding into torso/head; >= 0 = cleared. */
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

    // Advance the prop clock and update render transforms.
    progress = (progress + dt / LOOP_SEC) % 1;
    const b = propRender(blueConfig, progress);
    bluePos = b.pos;
    blueQuat = b.quat;
    const r = propRender(redConfig, progress);
    redPos = r.pos;
    redQuat = r.quat;

    onClearance(liveClearance(), solution);
  });
</script>

<!-- Blue (LH) staff: wheel plane. -->
<T.Mesh position={bluePos} quaternion={blueQuat}>
  <T.CylinderGeometry args={[STAFF_RENDER_RADIUS, STAFF_RENDER_RADIUS, STAFF_LENGTH, 12]} />
  <T.MeshStandardMaterial color="#3b82f6" />
</T.Mesh>

<!-- Red (RH) staff: wall plane. -->
<T.Mesh position={redPos} quaternion={redQuat}>
  <T.CylinderGeometry args={[STAFF_RENDER_RADIUS, STAFF_RENDER_RADIUS, STAFF_LENGTH, 12]} />
  <T.MeshStandardMaterial color="#ef4444" />
</T.Mesh>

<!-- Solved foot-target marker. -->
{#if solution}
  <T.Mesh position={footMarker}>
    <T.SphereGeometry args={[0.05, 12, 12]} />
    <T.MeshStandardMaterial color="#22c55e" transparent opacity={0.7} />
  </T.Mesh>
{/if}
