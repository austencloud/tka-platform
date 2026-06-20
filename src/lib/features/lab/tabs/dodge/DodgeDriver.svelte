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
  import { TransformControls, interactivity } from "@threlte/extras";

  // Activate pointer raycasting for the canvas so the floor's onclick (place the
  // step where the user clicks) fires. One call per canvas; coexists with the
  // puppet TransformControls gizmo.
  interactivity();
  import {
    Euler,
    Mesh,
    CylinderGeometry,
    Matrix4,
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
  import { sampleTrajectory } from "$lib/features/lab/tabs/collision-lab/services/stance-trajectory";
  import {
    StanceSimulator,
    restPoseFromHeight,
  } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
  import type { SimPropTarget, RestPoseGeometry, SimResult } from "$lib/features/lab/tabs/collision-lab/services/types";
  import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
  import type { DodgeSolution } from "$lib/features/stage/locomotion/dodge/dodge-types";
  import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

  let {
    controller,
    rig,
    blueConfig,
    redConfig,
    dodgeOn,
    manualMode,
    manualX,
    manualZ,
    manualYawDeg,
    puppetMode,
    puppetProgress,
    puppetPart,
    puppetGizmoMode,
    onGizmoDrag,
    onClearance,
  }: {
    controller: MmLocomotionController | null;
    rig: RigBinding | null;
    blueConfig: MotionConfig3D;
    redConfig: MotionConfig3D;
    dodgeOn: boolean;
    manualMode: boolean;
    manualX: number;
    manualZ: number;
    manualYawDeg: number;
    puppetMode: boolean;
    puppetProgress: number;
    puppetPart: "body" | "chest" | "head" | "lfoot" | "rfoot";
    puppetGizmoMode: "translate" | "rotate";
    onGizmoDrag: (dragging: boolean) => void;
    onClearance: (clearanceM: number, solution: DodgeSolution | null) => void;
  } = $props();

  // Which Object3D the puppet gizmo drives, and in which mode — selection-time
  // reactivity only (NOT per-frame), so it stays clear of the render-loop ban on
  // reactive <T> props. `rig` becomes non-null once, then bone lookups are stable.
  const gizmoTarget = $derived.by(() => {
    if (!puppetMode || !rig) return null;
    switch (puppetPart) {
      case "chest": return rig.getBone("Spine2") ?? null;
      case "head": return rig.getBone("Head") ?? null;
      case "lfoot": return leftFootHandle;
      case "rfoot": return rightFootHandle;
      default: return rig.root;
    }
  });
  // Bones rotate; foot handles translate; the body root honors the Move/Turn toggle.
  const gizmoModeResolved = $derived(
    puppetPart === "chest" || puppetPart === "head"
      ? "rotate"
      : puppetPart === "lfoot" || puppetPart === "rfoot"
        ? "translate"
        : puppetGizmoMode
  );

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

  // Puppet foot-target handles. In puppet mode the feet are IK-pinned to these
  // world targets (drag one to plant/shift that foot); the leg bends to follow.
  function makeFootHandle(color: string): Mesh {
    const m = new Mesh(
      new SphereGeometry(0.045, 12, 12),
      new MeshStandardMaterial({ color, transparent: true, opacity: 0.55 })
    );
    m.visible = false;
    return m;
  }
  const leftFootHandle = makeFootHandle("#f59e0b");
  const rightFootHandle = makeFootHandle("#f59e0b");

  // Plain (non-reactive) state. None of this triggers Svelte reactivity.
  let shoulderY = 0;
  let restFacing = 0;
  let blueSweep: SimPropTarget[] = [];
  let redSweep: SimPropTarget[] = [];
  let sim: StanceSimulator | null = null;
  let spineBone: Bone | null = null;
  let solution: DodgeSolution | null = null;
  let lastTx = NaN;
  let lastTz = NaN;
  let lastTyaw = NaN;
  let progress = 0;
  let didSolve = false;
  let clearanceFrames = 0;
  let puppetSeeded = false;

  // Arm IK chains (shoulder->elbow->hand) + per-elbow hinge axes. Built once.
  let leftArm: LegChain | null = null;
  let rightArm: LegChain | null = null;
  let leftElbowHinge: Vector3 | null = null;
  let rightElbowHinge: Vector3 | null = null;

  // Leg IK chains (hip->knee->foot) + knee hinge axes, for puppet foot-pinning.
  let leftLeg: LegChain | null = null;
  let rightLeg: LegChain | null = null;
  let leftKneeHinge: Vector3 | null = null;
  let rightKneeHinge: Vector3 | null = null;

  const _q = new Quaternion();
  const _pitchQ = new Quaternion();
  const _pitchAxis = new Vector3(1, 0, 0);
  const _twistQ = new Quaternion();
  const _twistAxis = new Vector3(0, 1, 0);
  const _up = new Vector3(0, 1, 0);
  const _grip = new Vector3();
  const _staffAxis = new Vector3();
  const _pole = new Vector3();
  const _qHandBefore = new Quaternion();
  const _qHandParent = new Quaternion();
  const _shL = new Vector3();
  const _shR = new Vector3();
  const _fwd = new Vector3();

  // Reach = a STEP toward the under-reach prop (feet follow the prop, body stays
  // balanced) plus a modest residual lean. The step does most of the reaching so
  // the spine never folds over stationary feet.
  const STEP_FRACTION = 0.8; // fraction of the reach shortfall closed by stepping
  const STEP_CAP = 0.6; // max auto-step (m) toward a prop
  const LEAN_GAIN = 2.0;
  const MAX_LEAN = 0.5; // ~29 deg residual lean for what the step leaves

  interface ReachAssist {
    stepX: number;
    stepZ: number;
    pitch: number;
  }

  /** Compute the reach assist at the BASE stance (bx,bz) — not the stepped
   *  position, so it is a stable function of base + props. Steps the feet toward
   *  whichever prop is hardest to reach, then leans for the residual. */
  function computeReach(bx: number, bz: number): ReachAssist {
    const none: ReachAssist = { stepX: 0, stepZ: 0, pitch: 0 };
    if (!leftArm || !rightArm || !rig) return none;
    const reach = (leftArm.upperLength + leftArm.lowerLength) * 0.99;
    const root = rig.root.position;
    leftArm.root.getWorldPosition(_shL);
    rightArm.root.getWorldPosition(_shR);
    // Shift shoulders from the current root back to the BASE root in XZ.
    _shL.x += bx - root.x;
    _shL.z += bz - root.z;
    _shR.x += bx - root.x;
    _shR.z += bz - root.z;
    const dL = _shL.distanceTo(blueStaff.position);
    const dR = _shR.distanceTo(redStaff.position);
    const deficit = Math.max(dL, dR) - reach;
    if (deficit <= 0.001) return none;
    // Step toward the harder-to-reach prop (in XZ), from that shoulder.
    const worstSh = dL >= dR ? _shL : _shR;
    const worstGrip = dL >= dR ? blueStaff.position : redStaff.position;
    let dx = worstGrip.x - worstSh.x;
    let dz = worstGrip.z - worstSh.z;
    const len = Math.hypot(dx, dz) || 1;
    const stepDist = Math.min(deficit * STEP_FRACTION, STEP_CAP);
    const stepX = (dx / len) * stepDist;
    const stepZ = (dz / len) * stepDist;
    const residual = Math.max(0, deficit - stepDist);
    const pitch = Math.min(residual * LEAN_GAIN, MAX_LEAN);
    return { stepX, stepZ, pitch };
  }

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

  /** Build a hip->knee->foot leg chain from bind-pose offsets (same shape as
   *  the arm chain; the knee is a hinge like the elbow). Used to IK-pin the feet
   *  to their drag handles in puppet mode. */
  function buildLegChain(side: "Left" | "Right", r: RigBinding): LegChain | null {
    const up = r.getBone(`${side}UpLeg`);
    const leg = r.getBone(`${side}Leg`);
    const foot = r.getBone(`${side}Foot`);
    if (!up || !leg || !foot) return null;
    r.root.updateMatrixWorld(true);
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    up.getWorldPosition(a);
    leg.getWorldPosition(b);
    foot.getWorldPosition(c);
    const upperLength = a.distanceTo(b);
    const lowerLength = b.distanceTo(c);
    return {
      root: up,
      middle: leg,
      effector: foot,
      totalLength: upperLength + lowerLength,
      upperLength,
      lowerLength,
      rootRestDir: leg.position.clone().normalize(),
      middleRestDir: foot.position.clone().normalize(),
    };
  }

  /** Pin one foot to its world handle via the hinge two-bone leg IK; the knee
   *  bends forward to follow. Unlike the hand solve we keep solveLegIK's
   *  ground-basis foot orientation (a foot SHOULD sit flat), so no wrist-style
   *  orientation restore. */
  function solveFoot(chain: LegChain, hinge: Vector3, handle: Mesh): void {
    _grip.copy(handle.position);
    _staffAxis.set(0, 0, 1); // foot points forward
    _pole.set(0, 0, 1).normalize(); // knee bends forward
    solveLegIK({
      chain,
      footTarget: _grip,
      groundNormal: _up,
      footForward: _staffAxis,
      kneeHingeAxis: hinge,
      poleDirection: _pole,
      weight: 1,
    });
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

  /** Measure a StanceSimulator body model from the REAL rig: real shoulder width,
   *  arm reach, and torso heights — not idealized anthropometrics.
   *
   *  CRITICAL: measure in ROOT-LOCAL space, never world. The rig is already
   *  translated + turned by the locomotion controller by the time the one-shot
   *  solve fires, so a WORLD-space read contaminates every coordinate with the
   *  root transform — e.g. both shoulders collapse onto the same side, yielding a
   *  broken asymmetric body and a different (garbage) stance every reload.
   *  Root-local strips the root transform, so the measurement is pose/position-
   *  invariant and deterministic.
   *
   *  Frame: canonical StanceSimulator convention (Y=0 at the shoulder line, X=0
   *  centerline, character RIGHT = +X, forward = +Z) — the same frame the swept
   *  prop targets and the idealized fallback live in. We force symmetric shoulders
   *  (±halfWidth) rather than copying the rig's raw handedness so the solve's
   *  side assignment matches the target frame the whole pipeline is validated in. */
  function measureRigBody(r: RigBinding): RestPoseGeometry | null {
    const get = (n: string) => r.getBone(n);
    const hips = get("Hips"), s1 = get("Spine1"), s2 = get("Spine2"),
      neck = get("Neck"), head = get("Head"),
      la = get("LeftArm"), ra = get("RightArm"),
      lf = get("LeftForeArm"), lh = get("LeftHand"),
      rf = get("RightForeArm"), rh = get("RightHand");
    if (!hips || !s1 || !s2 || !neck || !head || !la || !ra || !lf || !lh || !rf || !rh) return null;
    r.root.updateMatrixWorld(true);
    const toLocal = new Matrix4().copy(r.root.matrixWorld).invert();
    // Root-local position of a bone (world → root frame).
    const L = (b: typeof hips) => b.getWorldPosition(new Vector3()).applyMatrix4(toLocal);
    const lHips = L(hips), lS1 = L(s1), lS2 = L(s2), lNeck = L(neck), lHead = L(head);
    const lLa = L(la), lRa = L(ra), lLf = L(lf), lLh = L(lh), lRf = L(rf), lRh = L(rh);
    const shoulderY = (lLa.y + lRa.y) / 2;
    const halfWidth = Math.abs(lLa.x - lRa.x) / 2;
    const upper = (lLa.distanceTo(lLf) + lRa.distanceTo(lRf)) / 2;
    const lower = (lLf.distanceTo(lLh) + lRf.distanceTo(lRh)) / 2;
    return {
      hipsY: lHips.y - shoulderY,
      spine1: new Vector3(0, lS1.y - shoulderY, 0),
      spine2: new Vector3(0, lS2.y - shoulderY, 0),
      neck: new Vector3(0, lNeck.y - shoulderY, 0),
      head: new Vector3(0, lHead.y - shoulderY, 0),
      leftShoulder: new Vector3(-halfWidth, 0, 0),
      rightShoulder: new Vector3(halfWidth, 0, 0),
      upperArmLength: upper,
      forearmLength: lower,
      footHalfWidth: 0.1,
      headRadius: 0.09,
      torsoRadius: 0.12,
      // Oriented-slab torso half-axes — REQUIRED for the twist DOF to mean
      // anything. Without these the simulator falls back to the isotropic
      // torsoRadius and an edge-on turn clears nothing. Wide across the
      // shoulders, thin front-to-back; the thin axis is what twist presents.
      torsoHalfWidth: 0.14,
      torsoHalfDepth: 0.095,
      torsoHalfHeight: 0.12,
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
    leftLeg = buildLegChain("Left", rig);
    rightLeg = buildLegChain("Right", rig);
    leftKneeHinge = leftLeg ? computeKneeHingeAxis(leftLeg.rootRestDir, leftLeg.middleRestDir) : null;
    rightKneeHinge = rightLeg ? computeKneeHingeAxis(rightLeg.rootRestDir, rightLeg.middleRestDir) : null;
    // Seed the puppet foot handles at the rig's current foot positions so the
    // first leg-IK frame is a no-op (no snap).
    if (leftLeg) leftFootHandle.position.copy(leftLeg.effector.getWorldPosition(new Vector3()));
    if (rightLeg) rightFootHandle.position.copy(rightLeg.effector.getWorldPosition(new Vector3()));
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
      (window as unknown as { __dodgeBody?: RestPoseGeometry }).__dodgeBody = body;
      (window as unknown as { __dodgeClearance?: () => number }).__dodgeClearance = liveClearance;
      // Distance (m) of each hand bone from its prop grip — 0 = fully attached.
      (window as unknown as { __dodgeHandGap?: () => { left: number; right: number } }).__dodgeHandGap =
        () => ({
          left: leftArm ? leftArm.effector.getWorldPosition(new Vector3()).distanceTo(blueStaff.position) : -1,
          right: rightArm ? rightArm.effector.getWorldPosition(new Vector3()).distanceTo(redStaff.position) : -1,
        });
      (window as unknown as { __dodgeSweeps?: { blue: SimPropTarget[]; red: SimPropTarget[] } }).__dodgeSweeps =
        { blue: blueSweep, red: redSweep };
      // Live pose snapshot: where the rig actually is vs the solved stance, plus
      // each arm's actual extension (hand-shoulder dist / arm length).
      (window as unknown as { __dodgeLive?: () => unknown }).__dodgeLive = () => {
        if (!rig || !leftArm || !rightArm) return null;
        const v = (o: { getWorldPosition: (t: Vector3) => Vector3 }) => o.getWorldPosition(new Vector3());
        const shL = v(leftArm.root), shR = v(rightArm.root);
        const haL = v(leftArm.effector), haR = v(rightArm.effector);
        const lenL = leftArm.upperLength + leftArm.lowerLength;
        const lenR = rightArm.upperLength + rightArm.lowerLength;
        return {
          rootPos: { x: rig.root.position.x, y: rig.root.position.y, z: rig.root.position.z },
          facing: controller?.state.facing, restFacing,
          liveStance: liveStance(),
          armLenL: +lenL.toFixed(3), armLenR: +lenR.toFixed(3),
          extL: +(shL.distanceTo(haL) / lenL).toFixed(3),
          extR: +(shR.distanceTo(haR) / lenR).toFixed(3),
          shToStaffL: +shL.distanceTo(blueStaff.position).toFixed(3),
          shToStaffR: +shR.distanceTo(redStaff.position).toFixed(3),
          handToStaffL: +haL.distanceTo(blueStaff.position).toFixed(3),
          handToStaffR: +haR.distanceTo(redStaff.position).toFixed(3),
        };
      };
      // Evaluate an arbitrary stance against the swept volume (grid-search probe).
      (window as unknown as { __dodgeEval?: (x: number, z: number, yawDeg: number, pitchRad?: number, twistDeg?: number) => unknown }).__dodgeEval =
        (x: number, z: number, yawDeg: number, pitchRad = 0, twistDeg = 0) => {
          if (!sim) return null;
          const s: StancePose = { footOffsetX: x, footOffsetZ: z, rootYawRad: (yawDeg * Math.PI) / 180, spinePitchRad: pitchRad, torsoTwistRad: (twistDeg * Math.PI) / 180 };
          const r = sim.evaluateSweep(s, blueSweep, redSweep);
          let body = 0;
          for (const c of r.collisions) {
            if (c.zone === "prop-through-torso" || c.zone === "prop-through-head") body = Math.max(body, c.depth);
          }
          return { feasible: r.feasible, reachBlue: r.reachShortfall.blue, reachRed: r.reachShortfall.red, body, bal: r.balanceMargin, stretchBlue: r.reachStretch.blue, stretchRed: r.reachStretch.red };
        };
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

  /** Facing yaw (sim convention: forward at θ is (sin θ, cos θ)) read straight
   *  off the rig root — used in puppet mode where the gizmo turns the root and
   *  the locomotion controller is not advanced, so controller.state.facing is
   *  stale. */
  function rootFacing(): number {
    if (!rig) return restFacing;
    _fwd.set(0, 0, 1).applyQuaternion(rig.root.quaternion);
    return Math.atan2(_fwd.x, _fwd.z);
  }

  /** Current avatar stance in the solver frame (origin at the rest pose). */
  function liveStance(): StancePose {
    const root = rig?.root;
    const facing = puppetMode ? rootFacing() : (controller?.state.facing ?? restFacing);
    // In auto mode the spine pitch + torso twist actually applied this frame come
    // from the trajectory sampled at `progress`, so the clearance HUD reflects the
    // real edge-on body, not an untwisted one.
    const sampled =
      !puppetMode && dodgeOn && solution?.trajectory
        ? sampleTrajectory(solution.trajectory, progress)
        : null;
    return {
      footOffsetX: root ? root.position.x : 0,
      footOffsetZ: root ? root.position.z : 0,
      rootYawRad: facing - restFacing,
      spinePitchRad: puppetMode
        ? 0
        : sampled
          ? sampled.spinePitchRad
          : dodgeOn && solution
            ? solution.stance.spinePitchRad
            : 0,
      torsoTwistRad: sampled ? (sampled.torsoTwistRad ?? 0) : 0,
    };
  }

  /** Worst body penetration at the live stance, as a signed clearance (m).
   *  Negative = the prop intrudes into torso/head; >= 0 = cleared. In puppet mode
   *  the prop is frozen at the scrubbed instant, so we check that single instant
   *  (not the whole swept volume). */
  function liveClearance(): number {
    if (!sim || blueSweep.length === 0) return 0;
    let r: SimResult;
    if (puppetMode) {
      const i = Math.min(
        blueSweep.length - 1,
        Math.max(0, Math.round(puppetProgress * (blueSweep.length - 1)))
      );
      r = sim.evaluate(liveStance(), blueSweep[i]!, redSweep[i]!);
    } else {
      r = sim.evaluateSweep(liveStance(), blueSweep, redSweep);
    }
    const torso = r.collisions.find((c) => c.zone === "prop-through-torso");
    const head = r.collisions.find((c) => c.zone === "prop-through-head");
    const depth = Math.max(torso?.depth ?? 0, head?.depth ?? 0);
    return -depth;
  }

  useTask((delta) => {
    if (!controller || !rig) return;
    ensureSolved();
    const dt = Math.min(delta, 1 / 15);

    // Place the staves first (fixed world choreography; they do NOT follow the
    // body), so the reach computation sees this frame's grips. Puppet mode
    // freezes the prop at the scrubbed timeline position; otherwise it loops.
    progress = puppetMode ? puppetProgress : (progress + dt / LOOP_SEC) % 1;
    placeStaff(blueStaff, blueConfig, progress);
    placeStaff(redStaff, redConfig, progress);

    // PUPPET: the TransformControls gizmo owns the rig root (the user drags the
    // body). We don't run locomotion — just keep the feet on the floor, refresh
    // world matrices, and re-pin both hands to the staves so they stay glued no
    // matter where the body is dragged. Demonstration authoring; no auto-solve.
    if (puppetMode) {
      if (rig.root.position.y !== 0) rig.root.position.y = 0;
      rig.root.updateMatrixWorld(true);
      // On entry, seed the foot handles at the feet's CURRENT spots so the legs
      // don't snap to a stale target left over from a prior pose/mode.
      if (!puppetSeeded) {
        if (leftLeg) leftFootHandle.position.copy(leftLeg.effector.getWorldPosition(new Vector3()));
        if (rightLeg) rightFootHandle.position.copy(rightLeg.effector.getWorldPosition(new Vector3()));
        puppetSeeded = true;
      }
      // Feet first (pinned to the drag handles, legs bend to follow), then hands
      // (pinned to the staves). Chest/head/root are posed by the gizmo and just
      // persist — we never overwrite them here.
      leftFootHandle.visible = true;
      rightFootHandle.visible = true;
      if (leftLeg && leftKneeHinge) solveFoot(leftLeg, leftKneeHinge, leftFootHandle);
      if (rightLeg && rightKneeHinge) solveFoot(rightLeg, rightKneeHinge, rightFootHandle);
      if (leftArm && leftElbowHinge) solveArm(leftArm, leftElbowHinge, blueStaff, true);
      if (rightArm && rightElbowHinge) solveArm(rightArm, rightElbowHinge, redStaff, false);
      if (++clearanceFrames >= 10) {
        clearanceFrames = 0;
        onClearance(liveClearance(), solution);
      }
      return;
    }
    // Leaving puppet mode: hide the foot handles and arm re-seeding for next entry.
    if (leftFootHandle.visible) {
      leftFootHandle.visible = false;
      rightFootHandle.visible = false;
      puppetSeeded = false;
    }

    // Base stance: MANUAL (user-scrubbed) overrides AUTO (solver); neutral when
    // the dodge is off and not in manual mode. In AUTO the body follows the
    // solved TRAJECTORY sampled at the current sweep progress, so it moves
    // through the dodge (and turns edge-on via torsoTwist) instead of holding
    // one fixed, max-extended pose.
    let bx = 0, bz = 0, byaw = 0, btwist = 0;
    if (manualMode) {
      bx = manualX;
      bz = manualZ;
      byaw = (manualYawDeg * Math.PI) / 180;
    } else if (dodgeOn && solution?.trajectory) {
      const st = sampleTrajectory(solution.trajectory, progress);
      bx = st.footOffsetX;
      bz = st.footOffsetZ;
      byaw = st.rootYawRad;
      btwist = st.torsoTwistRad ?? 0;
    }

    // Reach = a modest lean PLUS a coupled forward foot-step, so the WHOLE body
    // (feet included) moves to reach the props and stays balanced — instead of
    // folding the spine over stationary feet.
    const reach = computeReach(bx, bz);
    const reachPitch = reach.pitch;
    const tx = bx + reach.stepX;
    const tz = bz + reach.stepZ;
    const tyaw = byaw;

    // Position target may move every frame — a moving goal is fine for the
    // locomotion controller. Facing is re-issued only when it shifts beyond a
    // small epsilon: setTargetFacing resets the turn-cross detector, so calling
    // it every frame would break the turn. The trajectory carries most of the
    // "turn edge-on" in torsoTwist (below), not rootYaw, so facing barely moves.
    if (tx !== lastTx || tz !== lastTz) {
      controller.setTargetPosition(tx, tz);
      lastTx = tx;
      lastTz = tz;
    }
    if (Number.isNaN(lastTyaw) || Math.abs(tyaw - lastTyaw) > 0.02) {
      controller.setTargetFacing(tyaw);
      lastTyaw = tyaw;
    }

    controller.update(dt);

    // Torso twist (turn the chest edge-on) then residual forward lean — both
    // layered on the locomotion clip pose the controller just wrote to the spine
    // this frame, so they don't accumulate. Then pin each hand to its grip.
    if (spineBone && (Math.abs(btwist) > 0.001 || reachPitch > 0.001)) {
      if (Math.abs(btwist) > 0.001) {
        _twistQ.setFromAxisAngle(_twistAxis, btwist);
        spineBone.quaternion.multiply(_twistQ);
      }
      if (reachPitch > 0.001) {
        _pitchQ.setFromAxisAngle(_pitchAxis, reachPitch);
        spineBone.quaternion.multiply(_pitchQ);
      }
      spineBone.updateMatrixWorld(true);
    }
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
<T is={leftFootHandle} />
<T is={rightFootHandle} />

{#if puppetMode && gizmoTarget}
  <TransformControls
    object={gizmoTarget}
    mode={gizmoModeResolved}
    onmouseDown={() => onGizmoDrag(true)}
    onmouseUp={() => onGizmoDrag(false)}
  />
{/if}
