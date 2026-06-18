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
  import type { RigBinding, LegChain } from "$lib/features/stage/locomotion/motion-matching/rig-binding";
  import { solveLegIK } from "$lib/shared/3d/services/hinge-constrained-leg-ik-solver";
  import { computeKneeHingeAxis } from "$lib/shared/3d/services/knee-hinge-axis-calibrator";
  import { calculatePropState } from "$lib/shared/3d/services/prop-state-interpolator";
  import { buildSweptVolume } from "$lib/features/stage/locomotion/dodge/swept-volume-builder";
  import { solveDodge } from "$lib/features/stage/locomotion/dodge/dodge-orchestrator";
  import {
    StanceSimulator,
    restPoseFromHeight,
  } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
  import type { SimPropTarget, RestPoseGeometry } from "$lib/features/lab/tabs/collision-lab/services/types";
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

  // Arm IK chains (shoulder->elbow->hand) + per-elbow hinge axes. Built once.
  let leftArm: LegChain | null = null;
  let rightArm: LegChain | null = null;
  let leftElbowHinge: Vector3 | null = null;
  let rightElbowHinge: Vector3 | null = null;

  const _q = new Quaternion();
  const _pitchQ = new Quaternion();
  const _pitchAxis = new Vector3(1, 0, 0);
  const _up = new Vector3(0, 1, 0);
  const _grip = new Vector3();
  const _staffAxis = new Vector3();
  const _pole = new Vector3();
  const _qHandBefore = new Quaternion();
  const _qHandParent = new Quaternion();

  /** Build a two-bone arm chain (Arm->ForeArm->Hand) from bind-pose offsets,
   *  matching the LegChain shape solveLegIK consumes (the elbow is a hinge like
   *  the knee). Bone local positions are bind-pose constants, so this is valid
   *  whether or not the rig is currently posed. */
  function buildArmChain(side: "Left" | "Right", r: RigBinding): LegChain | null {
    const arm = r.getBone(`${side}Arm`);
    const fore = r.getBone(`${side}ForeArm`);
    const hand = r.getBone(`${side}Hand`);
    if (!arm || !fore || !hand) return null;
    // Lengths MUST be world distances (meters). The X Bot skeleton is authored
    // at ~100x scale with the root scaled down, so bone.position (local) is in
    // the wrong units; world distances between joints are the real bone lengths.
    r.root.updateMatrixWorld(true);
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    arm.getWorldPosition(a);
    fore.getWorldPosition(b);
    hand.getWorldPosition(c);
    const upperLength = a.distanceTo(b);
    const lowerLength = b.distanceTo(c);
    return {
      root: arm,
      middle: fore,
      effector: hand,
      totalLength: upperLength + lowerLength,
      upperLength,
      lowerLength,
      rootRestDir: fore.position.clone().normalize(),
      middleRestDir: hand.position.clone().normalize(),
    };
  }

  /** Pin one hand to a world target (the prop grip) via the hinge two-bone IK,
   *  reaching from the CURRENT (dodged) shoulder. footForward aligns the hand to
   *  the staff; the pole biases the elbow outward + down. */
  function solveArm(chain: LegChain, hinge: Vector3, staff: Mesh, isLeft: boolean): void {
    _grip.copy(staff.position);
    _staffAxis.set(0, 1, 0).applyQuaternion(staff.quaternion).normalize();
    _pole.set(isLeft ? -1 : 1, -1, 0).normalize();
    const hand = chain.effector;
    // Capture the natural (clip-posed) wrist orientation before the solve.
    hand.getWorldQuaternion(_qHandBefore);
    solveLegIK({
      chain,
      footTarget: _grip,
      groundNormal: _up,
      footForward: _staffAxis,
      kneeHingeAxis: hinge,
      poleDirection: _pole,
      weight: 1,
    });
    // Pin POSITION only. solveLegIK's final block forces the hand to a
    // ground-basis world orientation whose axis convention does not match this
    // Mixamo hand bone, twisting the wrist into an alien pose. Restore the
    // natural orientation so the arm reaches without the robotic wrist (a clean
    // grip alignment is a later refinement, not today's goal).
    if (hand.parent) {
      hand.parent.getWorldQuaternion(_qHandParent);
      hand.quaternion.copy(_qHandParent.invert()).multiply(_qHandBefore);
    } else {
      hand.quaternion.copy(_qHandBefore);
    }
    hand.updateMatrixWorld(true);
  }

  function readShoulderY(r: RigBinding): number {
    // Use the arm-attachment joints (LeftArm/RightArm), not the clavicles, so the
    // prop-grip anchor matches the body model's shoulder line exactly.
    const ls = r.getBone("LeftArm");
    const rs = r.getBone("RightArm");
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

  /** Measure a StanceSimulator body model from the REAL rig so the solve uses
   *  the avatar's true handedness (left shoulder at +X here), arm reach, and
   *  torso heights — not idealized anthropometrics. Frame: Y=0 at the shoulder
   *  line, X=0 centerline, matching the prop-target frame. */
  function measureRigBody(r: RigBinding): RestPoseGeometry | null {
    const get = (n: string) => r.getBone(n);
    const hips = get("Hips"), s1 = get("Spine1"), s2 = get("Spine2"),
      neck = get("Neck"), head = get("Head"),
      la = get("LeftArm"), ra = get("RightArm"),
      lf = get("LeftForeArm"), lh = get("LeftHand"),
      rf = get("RightForeArm"), rh = get("RightHand");
    if (!hips || !s1 || !s2 || !neck || !head || !la || !ra || !lf || !lh || !rf || !rh) return null;
    r.root.updateMatrixWorld(true);
    const w = (b: typeof hips) => b.getWorldPosition(new Vector3());
    const wHips = w(hips), wS1 = w(s1), wS2 = w(s2), wNeck = w(neck), wHead = w(head);
    const wLa = w(la), wRa = w(ra), wLf = w(lf), wLh = w(lh), wRf = w(rf), wRh = w(rh);
    const shoulderYW = (wLa.y + wRa.y) / 2;
    const upper = (wLa.distanceTo(wLf) + wRa.distanceTo(wRf)) / 2;
    const lower = (wLf.distanceTo(wLh) + wRf.distanceTo(wRh)) / 2;
    return {
      hipsY: wHips.y - shoulderYW,
      spine1: new Vector3(0, wS1.y - shoulderYW, 0),
      spine2: new Vector3(0, wS2.y - shoulderYW, 0),
      neck: new Vector3(0, wNeck.y - shoulderYW, 0),
      head: new Vector3(0, wHead.y - shoulderYW, 0),
      leftShoulder: new Vector3(wLa.x, 0, 0),
      rightShoulder: new Vector3(wRa.x, 0, 0),
      upperArmLength: upper,
      forearmLength: lower,
      footHalfWidth: 0.1,
      headRadius: 0.09,
      torsoRadius: 0.12,
      armRadius: 0.04,
    };
  }

  /** Run the solve + frame setup exactly once, the first frame the rig is ready. */
  function ensureSolved(): void {
    if (didSolve || !rig || !controller) return;
    didSolve = true;
    shoulderY = readShoulderY(rig);
    restFacing = controller.state.facing;
    spineBone = rig.getBone("Spine");
    leftArm = buildArmChain("Left", rig);
    rightArm = buildArmChain("Right", rig);
    leftElbowHinge = leftArm ? computeKneeHingeAxis(leftArm.rootRestDir, leftArm.middleRestDir) : null;
    rightElbowHinge = rightArm ? computeKneeHingeAxis(rightArm.rootRestDir, rightArm.middleRestDir) : null;
    blueSweep = buildSweptVolume(blueConfig, 24).samples;
    redSweep = buildSweptVolume(redConfig, 24).samples;
    // Body model measured from the REAL rig (real handedness + reach), shared by
    // the solve and the live clearance readout so both match the actual avatar.
    const body = measureRigBody(rig) ?? restPoseFromHeight(1.8);
    sim = new StanceSimulator(body);
    solution = solveDodge(blueConfig, redConfig, 1.8, 24, body);
    footSphere.position.set(solution.stance.footOffsetX, 0.02, solution.stance.footOffsetZ);
    footSphere.visible = true;
    if (typeof window !== "undefined") {
      (window as unknown as { __dodgeSolution?: DodgeSolution }).__dodgeSolution = solution;
      (window as unknown as { __dodgeClearance?: () => number }).__dodgeClearance = liveClearance;
      // Distance (m) of each hand bone from its prop grip — 0 = fully attached.
      (window as unknown as { __dodgeHandGap?: () => { left: number; right: number } }).__dodgeHandGap =
        () => ({
          left: leftArm ? leftArm.effector.getWorldPosition(new Vector3()).distanceTo(blueStaff.position) : -1,
          right: rightArm ? rightArm.effector.getWorldPosition(new Vector3()).distanceTo(redStaff.position) : -1,
        });
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

    // Advance the prop clock and place the staves imperatively (the props are
    // the fixed world-space choreography; they do NOT follow the body).
    progress = (progress + dt / LOOP_SEC) % 1;
    placeStaff(blueStaff, blueConfig, progress);
    placeStaff(redStaff, redConfig, progress);

    // Pin each hand to its prop grip via arm IK, reaching from the dodged body.
    // This is the "hands stay attached while the body dodges" requirement.
    if (leftArm && leftElbowHinge) solveArm(leftArm, leftElbowHinge, blueStaff, true);
    if (rightArm && rightElbowHinge) solveArm(rightArm, rightElbowHinge, redStaff, false);

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
