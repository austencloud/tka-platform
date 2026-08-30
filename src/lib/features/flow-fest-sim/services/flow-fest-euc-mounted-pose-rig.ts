/**
 * The mounted-pose composition layer for the Flow Fest electric unicycle.
 *
 * `@austencloud/scene-3d` exports the two-bone leg solver and its hinge-axis
 * calibrator, but `Avatar3D` has no seam for external foot targets and the
 * package does not export its chain builder or any sole geometry. Everything
 * between those two facts lives here: skeleton discovery, chain measurement,
 * sole calibration from the skin data, pelvis placement, and the per-frame
 * solve against live pedal anchors.
 *
 * Nothing in this file patches or reaches into the package. It composes the
 * exported solver against bones it finds in the scene, which is why it can
 * ship without touching `node_modules`. The contract scene-3d should grow to
 * absorb it is written up at the bottom of this file.
 */

import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
  type Bone,
  type Object3D,
  type SkinnedMesh,
} from "three";
import {
  HingeConstrainedLegIKSolver,
  KneeHingeAxisCalibrator,
} from "@austencloud/scene-3d";
import {
  FLOW_FEST_EUC_CONTACT_THRESHOLDS,
  FLOW_FEST_EUC_MAXIMUM_PELVIS_LATERAL_METERS,
  FLOW_FEST_EUC_PEDAL_SEPARATION_METERS,
  FlowFestEucIdleStabilityTracker,
  advanceFlowFestEucStanceSignals,
  emptyFlowFestEucContactPoints,
  emptyFlowFestEucSoleContact,
  flowFestEucKneeFlexRadians,
  flowFestEucLegReachMeters,
  flowFestEucStanceBlend,
  flowFestEucStanceOffsets,
  flowFestEucStanceSignals,
  gradeFlowFestEucSoleContact,
  type FlowFestEucContactPoints,
  type FlowFestEucMountedPoseDiagnostic,
  type FlowFestEucMountedPoseStatus,
  type FlowFestEucPedalSide,
  type FlowFestEucSoleContact,
  type FlowFestEucStanceBlend,
  type FlowFestEucStanceDrive,
  type FlowFestEucStanceSignals,
} from "../domain/flow-fest-euc-mounted-pose";

// ── Skeleton discovery ──────────────────────────────────────────────────────

/**
 * The bones this pose writes, with the same alias spellings
 * `AvatarSkeletonBuilder` accepts.
 *
 * Mirrored rather than imported because the package exports neither the alias
 * table nor a way to reach a mounted `Avatar3D`'s skeleton service. Keep this
 * list a strict subset of the package's own, so a rig the avatar can load is
 * always a rig this pose can find.
 */
const BONE_ALIASES = {
  Hips: ["Hips", "pelvis", "hip", "root"],
  Spine: ["Spine", "spine", "spine1"],
  Spine1: ["Spine1", "spine2", "chest"],
  LeftUpLeg: ["LeftUpLeg", "l_thigh", "thigh.L", "upperleg_l", "LeftUpperLeg"],
  LeftLeg: ["LeftLeg", "l_shin", "shin.L", "lowerleg_l", "LeftLowerLeg"],
  LeftFoot: ["LeftFoot", "l_foot", "foot.L", "foot_l"],
  LeftToeBase: [
    "LeftToeBase",
    "LeftToe",
    "LeftToes",
    "l_toe",
    "toe.L",
    "ball_l",
  ],
  RightUpLeg: [
    "RightUpLeg",
    "r_thigh",
    "thigh.R",
    "upperleg_r",
    "RightUpperLeg",
  ],
  RightLeg: ["RightLeg", "r_shin", "shin.R", "lowerleg_r", "RightLowerLeg"],
  RightFoot: ["RightFoot", "r_foot", "foot.R", "foot_r"],
  RightToeBase: [
    "RightToeBase",
    "RightToe",
    "RightToes",
    "r_toe",
    "toe.R",
    "ball_r",
  ],
} as const;

type MountedBoneName = keyof typeof BONE_ALIASES;

/**
 * Resolve the bones by name, exactly the way the package's own builder does:
 * canonical spelling first so a rig that already uses TKA names keeps each
 * spine level where it authored it, then exact aliases, then substrings.
 */
export function findMountedPoseBones(
  root: Object3D
): Map<MountedBoneName, Bone> {
  const bones: Bone[] = [];
  root.traverse((node) => {
    if ((node as Bone).isBone) bones.push(node as Bone);
  });

  const found = new Map<MountedBoneName, Bone>();
  const names = Object.keys(BONE_ALIASES) as MountedBoneName[];

  for (const bone of bones) {
    const name = bone.name.toLowerCase();
    const canonical = names.find((entry) => entry.toLowerCase() === name);
    if (canonical && !found.has(canonical)) found.set(canonical, bone);
  }
  for (const bone of bones) {
    const name = bone.name.toLowerCase();
    for (const entry of names) {
      if (found.has(entry)) continue;
      if (BONE_ALIASES[entry].some((alias) => alias.toLowerCase() === name)) {
        found.set(entry, bone);
        break;
      }
    }
  }
  for (const bone of bones) {
    const name = bone.name.toLowerCase();
    for (const entry of names) {
      if (found.has(entry)) continue;
      if (
        BONE_ALIASES[entry].some((alias) => name.includes(alias.toLowerCase()))
      ) {
        found.set(entry, bone);
        break;
      }
    }
  }
  return found;
}

// ── Chain measurement ───────────────────────────────────────────────────────

/**
 * A two-bone chain in the shape the exported solver consumes.
 *
 * `buildTwoBoneChain` in the package measures exactly this but is not exported
 * from its barrel, so it is re-derived here. Both are bind-pose properties:
 * bone offsets are rigid, so the lengths are the same on any frame, and the
 * rest direction is the child's own local position normalized - which is what
 * the package computes the long way round, through world space and back.
 */
export interface MountedBoneChain {
  root: Bone;
  middle: Bone;
  effector: Bone;
  totalLength: number;
  upperLength: number;
  lowerLength: number;
  rootRestDir: Vector3;
  middleRestDir: Vector3;
}

/**
 * Measure the chain in world units, so its lengths match the world-space
 * targets the solver is given even when the model carries a uniform scale.
 */
export function measureTwoBoneChain(
  root: Bone,
  middle: Bone,
  effector: Bone
): MountedBoneChain {
  const rootWorld = root.getWorldPosition(new Vector3());
  const middleWorld = middle.getWorldPosition(new Vector3());
  const effectorWorld = effector.getWorldPosition(new Vector3());
  const upperLength = rootWorld.distanceTo(middleWorld);
  const lowerLength = middleWorld.distanceTo(effectorWorld);
  return {
    root,
    middle,
    effector,
    totalLength: upperLength + lowerLength,
    upperLength,
    lowerLength,
    rootRestDir: middle.position.clone().normalize(),
    middleRestDir: effector.position.clone().normalize(),
  };
}

// ── Sole calibration ────────────────────────────────────────────────────────

/**
 * Where the bottom of the shoe is, expressed in the foot bone's own space.
 *
 * The acceptance criteria are about the sole, not the ankle, and the ankle is
 * several centimetres above and behind it. Guessing that offset is how a foot
 * ends up hovering or buried, so it is measured off the skin: the vertices the
 * foot and toe bones own, at bind pose, lowest band only.
 */
export interface SoleFrame {
  /** Centre of the contact patch, in foot-bone local units. */
  origin: Vector3;
  /** Heel-to-toe axis, unit, in foot-bone local space. */
  forward: Vector3;
  /** Outward sole normal, unit, in foot-bone local space. */
  up: Vector3;
  /**
   * Signed distance from `origin` to the lowest point of the whole shoe along
   * `up`, in foot-bone local units. Never positive.
   */
  lowestAlongUp: number;
  /** How many skin vertices the patch was measured from. */
  sampleCount: number;
}

const CONTACT_BAND_METERS = 0.01;

/**
 * Calibrate one foot's sole frame from the skinned geometry.
 *
 * Three's default `AttachedBindMode` recomputes `bindMatrixInverse` as the
 * inverse of the mesh's own world matrix every frame, so the skinning product
 * collapses to `bone.matrixWorld * boneInverses[i] * bindMatrix * v`. At bind
 * pose that leaves `bindMatrix * v` as the world position and
 * `boneInverses[i] * bindMatrix * v` as the offset that, multiplied by the
 * bone's live world matrix, tracks the vertex for the rest of the run.
 *
 * Returns null when the rig has no vertices bound to this foot, which is a rig
 * this pose cannot place and must say so rather than invent an offset for.
 */
export function calibrateSoleFrame(
  meshes: SkinnedMesh[],
  foot: Bone,
  toe: Bone | null
): SoleFrame | null {
  const owned = new Set<Bone>([foot]);
  if (toe) {
    owned.add(toe);
    toe.traverse((node) => {
      if ((node as Bone).isBone) owned.add(node as Bone);
    });
  }

  const bindWorld: Vector3[] = [];
  const footLocal: Vector3[] = [];
  const toFootLocal = new Matrix4();
  const scratch = new Vector3();
  let footBindInverse: Matrix4 | null = null;
  let toeBindInverse: Matrix4 | null = null;

  for (const mesh of meshes) {
    const skeleton = mesh.skeleton;
    if (!skeleton) continue;
    const footIndex = skeleton.bones.indexOf(foot);
    if (footIndex < 0) continue;
    const inverse = skeleton.boneInverses[footIndex];
    if (!inverse) continue;
    toFootLocal.copy(inverse).multiply(mesh.bindMatrix);
    footBindInverse ??= inverse.clone();
    if (!toeBindInverse && toe) {
      const toeIndex = skeleton.bones.indexOf(toe);
      const toeInverse = toeIndex >= 0 ? skeleton.boneInverses[toeIndex] : null;
      if (toeInverse) toeBindInverse = toeInverse.clone();
    }

    const position = mesh.geometry.getAttribute("position");
    const skinIndex = mesh.geometry.getAttribute("skinIndex");
    const skinWeight = mesh.geometry.getAttribute("skinWeight");
    if (!position || !skinIndex || !skinWeight) continue;

    for (let vertex = 0; vertex < position.count; vertex += 1) {
      let dominantBone: Bone | undefined;
      let dominantWeight = 0;
      for (let influence = 0; influence < 4; influence += 1) {
        const weight = skinWeight.getComponent(vertex, influence);
        if (weight <= dominantWeight) continue;
        dominantWeight = weight;
        dominantBone = skeleton.bones[skinIndex.getComponent(vertex, influence)];
      }
      if (!dominantBone || dominantWeight < 0.5) continue;
      if (!owned.has(dominantBone)) continue;

      scratch.fromBufferAttribute(position, vertex);
      footLocal.push(scratch.clone().applyMatrix4(toFootLocal));
      bindWorld.push(scratch.clone().applyMatrix4(mesh.bindMatrix));
    }
  }

  if (bindWorld.length < 12) return null;

  // The bind pose stands the character upright with both soles flat, so world
  // -Y is straight down through the shoe and world up is the sole normal.
  let lowest = Infinity;
  for (const point of bindWorld) lowest = Math.min(lowest, point.y);

  const band: number[] = [];
  for (let index = 0; index < bindWorld.length; index += 1) {
    if (bindWorld[index]!.y - lowest <= CONTACT_BAND_METERS) band.push(index);
  }
  if (band.length < 6) return null;

  const centerBind = new Vector3();
  for (const index of band) centerBind.add(bindWorld[index]!);
  centerBind.multiplyScalar(1 / band.length);

  // Heel-to-toe axis: the major axis of the contact patch's horizontal spread.
  //
  // Taking the single farthest point instead would aim at a corner rather than
  // at the toe - on a patch 0.26 m long and 0.09 m wide that is 19 degrees off,
  // which alone would blow the 8-degree foot-forward tolerance. The principal
  // axis uses every sample in the band, so it lands on the long axis of a
  // rectangular, rounded, or elliptical patch alike.
  let covarianceXX = 0;
  let covarianceXZ = 0;
  let covarianceZZ = 0;
  for (const index of band) {
    const offsetX = bindWorld[index]!.x - centerBind.x;
    const offsetZ = bindWorld[index]!.z - centerBind.z;
    covarianceXX += offsetX * offsetX;
    covarianceXZ += offsetX * offsetZ;
    covarianceZZ += offsetZ * offsetZ;
  }
  if (covarianceXX + covarianceZZ < 1e-8) return null;

  // Major eigenvector of the symmetric 2x2 covariance, in closed form.
  const half = (covarianceXX + covarianceZZ) / 2;
  const difference = (covarianceXX - covarianceZZ) / 2;
  const major = half + Math.hypot(difference, covarianceXZ);
  const bestForward =
    Math.abs(covarianceXZ) > 1e-12
      ? new Vector3(covarianceXZ, 0, major - covarianceXX)
      : covarianceZZ >= covarianceXX
        ? new Vector3(0, 0, 1)
        : new Vector3(1, 0, 0);
  if (bestForward.lengthSq() < 1e-12) return null;
  bestForward.normalize();

  // Which end of that axis is the toe. Read from the BIND pose - the inverse
  // of each bone's bind matrix is its bind world transform - so the sign is
  // decided in the same frame the patch was measured in rather than in
  // whatever pose the animator happens to have the foot in right now.
  if (!footBindInverse) return null;
  const footBind = new Vector3().setFromMatrixPosition(
    footBindInverse.clone().invert()
  );
  const toeBind = toeBindInverse
    ? new Vector3().setFromMatrixPosition(toeBindInverse.clone().invert())
    : centerBind.clone();
  const heading = toeBind.clone().sub(footBind);
  heading.y = 0;
  if (heading.lengthSq() > 1e-8 && heading.dot(bestForward) < 0) {
    bestForward.negate();
  }

  // Carry the frame into foot-local space through the same bind transform the
  // points came in on, so origin and axes stay consistent with each other.
  const originLocal = new Vector3();
  for (const index of band) originLocal.add(footLocal[index]!);
  originLocal.multiplyScalar(1 / band.length);

  const bindToFootLocal = footBindInverse;

  const forwardLocal = bestForward
    .clone()
    .transformDirection(bindToFootLocal)
    .normalize();
  const upLocal = new Vector3(0, 1, 0)
    .transformDirection(bindToFootLocal)
    .normalize();

  // Re-orthogonalize: the measured heel-to-toe axis is only horizontal to
  // within the patch's own noise.
  const rightLocal = new Vector3()
    .crossVectors(upLocal, forwardLocal)
    .normalize();
  forwardLocal.crossVectors(rightLocal, upLocal).normalize();

  let lowestAlongUp = 0;
  for (const point of footLocal) {
    lowestAlongUp = Math.min(
      lowestAlongUp,
      point.clone().sub(originLocal).dot(upLocal)
    );
  }

  return {
    origin: originLocal,
    forward: forwardLocal,
    up: upLocal,
    lowestAlongUp,
    sampleCount: band.length,
  };
}

// ── The rig ─────────────────────────────────────────────────────────────────

export interface MountedPoseAnchors {
  /** The `FFS_ElectricUnicycle` group: heading plus terrain attitude. */
  vehicleRoot: Object3D;
  /** The `FFS_EUC_RiderLean` group: suspension, visual pitch, visual lean. */
  riderFrame: Object3D;
  left: Object3D;
  right: Object3D;
}

export interface MountedPoseUpdate {
  deltaSeconds: number;
  drive: FlowFestEucStanceDrive;
  /** True while the host has locomotion suppressed for the mounted pose. */
  locomotionSuspended: boolean;
  /** Elapsed simulation seconds, for the idle-stability window. */
  elapsedSeconds: number;
  /** Whether the vehicle is standing still, which is the idle capture. */
  idle: boolean;
}

interface LegRig {
  side: FlowFestEucPedalSide;
  chain: MountedBoneChain;
  foot: Bone;
  toe: Bone | null;
  hingeAxis: Vector3;
  sole: SoleFrame;
  bendSign: -1 | 1 | undefined;
}

interface CapturedTransform {
  bone: Bone;
  position: Vector3;
  quaternion: Quaternion;
}

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Poses the mounted rider against live pedal anchors, once per frame, after
 * the avatar's own animation has run and before the frame is rendered.
 */
export class FlowFestEucMountedPoseRig {
  private readonly solver = new HingeConstrainedLegIKSolver();
  private readonly calibrator = new KneeHingeAxisCalibrator();
  private readonly idleStability = new FlowFestEucIdleStabilityTracker();

  private status: FlowFestEucMountedPoseStatus = "detached";
  private unsupportedReason: string | null = null;
  /** Cleared at the top of every frame; a transient geometry complaint. */
  private frameWarning: string | null = null;

  private anchors: MountedPoseAnchors | null = null;
  private avatarRoot: Object3D | null = null;
  private hips: Bone | null = null;
  private spine: Bone | null = null;
  private spine1: Bone | null = null;
  private legs: LegRig[] = [];
  private captured: CapturedTransform[] = [];

  private signals: FlowFestEucStanceSignals = {
    accelerate: 0,
    brake: 0,
    carveLeft: 0,
    carveRight: 0,
  };
  private blend: FlowFestEucStanceBlend = {
    neutral: 1,
    accelerate: 0,
    brake: 0,
    carveLeft: 0,
    carveRight: 0,
  };
  private frameRateHz = 0;
  private contacts: Record<FlowFestEucPedalSide, FlowFestEucSoleContact> = {
    left: emptyFlowFestEucSoleContact(),
    right: emptyFlowFestEucSoleContact(),
  };
  private contactPoints: Record<
    FlowFestEucPedalSide,
    FlowFestEucContactPoints
  > = {
    left: emptyFlowFestEucContactPoints(),
    right: emptyFlowFestEucContactPoints(),
  };
  private pelvisLateralOffsetMeters = Number.NaN;
  private pelvisForwardOffsetMeters = Number.NaN;
  private locomotionSuspended = false;

  private readonly scratch = {
    matrix: new Matrix4(),
    matrixB: new Matrix4(),
    quaternion: new Quaternion(),
    quaternionB: new Quaternion(),
    vector: new Vector3(),
    vectorB: new Vector3(),
    vectorC: new Vector3(),
  };

  setAnchors(anchors: MountedPoseAnchors | null): void {
    this.anchors = anchors;
    if (!anchors) this.detach();
  }

  /**
   * Bind to an avatar subtree. Returns false when the rig is missing something
   * the pose needs, in which case the diagnostic says which.
   */
  attach(avatarRoot: Object3D): boolean {
    this.detach();
    this.avatarRoot = avatarRoot;
    this.status = "waiting-for-rig";

    avatarRoot.updateWorldMatrix(true, true);

    const bones = findMountedPoseBones(avatarRoot);
    const hips = bones.get("Hips");
    if (!hips) return this.reject("rig has no Hips bone");

    const meshes: SkinnedMesh[] = [];
    avatarRoot.traverse((node) => {
      if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    if (meshes.length === 0) return this.reject("rig has no skinned mesh");

    const legs: LegRig[] = [];
    for (const side of ["left", "right"] as FlowFestEucPedalSide[]) {
      const prefix = side === "left" ? "Left" : "Right";
      const upLeg = bones.get(`${prefix}UpLeg` as MountedBoneName);
      const leg = bones.get(`${prefix}Leg` as MountedBoneName);
      const foot = bones.get(`${prefix}Foot` as MountedBoneName);
      const toe = bones.get(`${prefix}ToeBase` as MountedBoneName) ?? null;
      if (!upLeg || !leg || !foot) {
        return this.reject(`rig is missing the ${side} leg chain`);
      }
      const sole = calibrateSoleFrame(meshes, foot, toe);
      if (!sole) return this.reject(`rig has no skin bound to the ${side} foot`);

      const chain = measureTwoBoneChain(upLeg, leg, foot);
      if (chain.upperLength < 1e-4 || chain.lowerLength < 1e-4) {
        return this.reject(`rig reports a zero-length ${side} leg`);
      }
      legs.push({
        side,
        chain,
        foot,
        toe,
        hingeAxis: this.calibrator.compute(chain.rootRestDir, chain.middleRestDir),
        sole,
        bendSign: undefined,
      });
    }

    this.hips = hips;
    this.spine = bones.get("Spine") ?? null;
    this.spine1 = bones.get("Spine1") ?? null;
    this.legs = legs;

    const toCapture: Bone[] = [hips];
    if (this.spine) toCapture.push(this.spine);
    if (this.spine1) toCapture.push(this.spine1);
    for (const leg of legs) {
      toCapture.push(leg.chain.root, leg.chain.middle, leg.foot);
    }
    this.captured = toCapture.map((bone) => ({
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
    }));

    this.idleStability.reset();
    this.status = "ready";
    this.unsupportedReason = null;
    return true;
  }

  /**
   * Release the rig and put every bone this pose wrote back the way it was
   * found, so the ordinary on-foot pipeline resumes from an untouched pose
   * even when the shared GLTF cache hands the same prepared root back.
   */
  detach(): void {
    for (const entry of this.captured) {
      entry.bone.position.copy(entry.position);
      entry.bone.quaternion.copy(entry.quaternion);
    }
    if (this.captured.length > 0) this.hips?.updateMatrixWorld(true);
    this.captured = [];
    this.avatarRoot = null;
    this.hips = null;
    this.spine = null;
    this.spine1 = null;
    this.legs = [];
    this.status = "detached";
    this.unsupportedReason = null;
    this.frameWarning = null;
    this.contacts = {
      left: emptyFlowFestEucSoleContact(),
      right: emptyFlowFestEucSoleContact(),
    };
    this.contactPoints = {
      left: emptyFlowFestEucContactPoints(),
      right: emptyFlowFestEucContactPoints(),
    };
    this.pelvisLateralOffsetMeters = Number.NaN;
    this.pelvisForwardOffsetMeters = Number.NaN;
    // The rider is back on its own animation pipeline, so every field that
    // describes the mounted pose has to fall with it. Leaving these set makes a
    // detached diagnostic claim the walk cycle is still held off in a stance it
    // is no longer holding - the one reading a dismount check depends on.
    this.locomotionSuspended = false;
    this.signals = { accelerate: 0, brake: 0, carveLeft: 0, carveRight: 0 };
    this.blend = {
      neutral: 1,
      accelerate: 0,
      brake: 0,
      carveLeft: 0,
      carveRight: 0,
    };
    this.idleStability.reset();
  }

  isAttachedTo(root: Object3D | null): boolean {
    return this.avatarRoot !== null && this.avatarRoot === root;
  }

  get attached(): boolean {
    return this.status === "ready";
  }

  private reject(reason: string): false {
    this.status = "unsupported-rig";
    this.unsupportedReason = reason;
    return false;
  }

  /** Advance the stance blend only. Safe to call with no rig attached. */
  advanceBlend(deltaSeconds: number, drive: FlowFestEucStanceDrive): void {
    this.signals = advanceFlowFestEucStanceSignals(
      this.signals,
      flowFestEucStanceSignals(drive),
      deltaSeconds
    );
    this.blend = flowFestEucStanceBlend(this.signals);
  }

  update(update: MountedPoseUpdate): void {
    this.frameWarning = null;
    this.locomotionSuspended = update.locomotionSuspended;
    this.frameRateHz =
      update.deltaSeconds > 0 ? 1 / update.deltaSeconds : this.frameRateHz;
    this.advanceBlend(update.deltaSeconds, update.drive);

    const anchors = this.anchors;
    const hips = this.hips;
    if (!anchors || !hips || this.status !== "ready" || this.legs.length !== 2) {
      return;
    }

    // One update over the vehicle subtree brings the pedal anchors and the
    // avatar - which hangs off the same rider-lean group - current together,
    // so the pose reads the attitude the frame is about to render rather than
    // the previous one.
    anchors.vehicleRoot.updateWorldMatrix(true, true);

    const stance = flowFestEucStanceOffsets(this.blend);

    const pedal = {
      left: readAnchorFrame(anchors.left),
      right: readAnchorFrame(anchors.right),
    };
    const frameUp = pedal.left.up.clone().add(pedal.right.up).normalize();
    const frameForward = pedal.left.forward
      .clone()
      .add(pedal.right.forward)
      .normalize();
    const frameLeft = new Vector3()
      .crossVectors(frameUp, frameForward)
      .normalize();
    const frameRight = frameLeft.clone().negate();

    // Where each sole has to sit, and how the shoe has to be turned to sit
    // there. Both follow from the pedal anchor alone, so they are settled
    // before any bone moves.
    const footRotation: Record<FlowFestEucPedalSide, Quaternion> = {
      left: new Quaternion(),
      right: new Quaternion(),
    };
    const ankleTarget: Record<FlowFestEucPedalSide, Vector3> = {
      left: new Vector3(),
      right: new Vector3(),
    };
    const soleTarget: Record<FlowFestEucPedalSide, Vector3> = {
      left: new Vector3(),
      right: new Vector3(),
    };

    for (const leg of this.legs) {
      const anchor = pedal[leg.side];
      const scale = footWorldScale(leg.foot);

      const soleBasis = new Matrix4().makeBasis(
        new Vector3().crossVectors(leg.sole.up, leg.sole.forward).normalize(),
        leg.sole.up,
        leg.sole.forward
      );
      const pedalBasis = new Matrix4().makeBasis(
        anchor.left,
        anchor.up,
        anchor.forward
      );
      footRotation[leg.side] = new Quaternion()
        .setFromRotationMatrix(pedalBasis)
        .multiply(
          new Quaternion().setFromRotationMatrix(soleBasis).invert()
        );

      // Lift the contact patch by however far the shoe hangs below it, so the
      // deepest point of the sole rests on the pedal instead of through it.
      soleTarget[leg.side] = anchor.position
        .clone()
        .addScaledVector(anchor.up, -leg.sole.lowestAlongUp * scale);

      ankleTarget[leg.side] = soleTarget[leg.side]
        .clone()
        .sub(
          leg.sole.origin
            .clone()
            .multiplyScalar(scale)
            .applyQuaternion(footRotation[leg.side])
        );
    }

    // Pelvis attitude: the pedal frame carries heading, terrain, suspension
    // and lean already, so the stance only adds its own pitch and roll on top.
    // Applying the vehicle attitude again here is the double-application the
    // acceptance criteria forbid.
    const pelvisRotation = new Quaternion()
      .setFromRotationMatrix(
        new Matrix4().makeBasis(frameLeft, frameUp, frameForward)
      )
      .multiply(
        new Quaternion().setFromEuler(
          eulerFromPitchRoll(stance.pelvisPitchRadians, stance.pelvisRollRadians)
        )
      );
    this.setBoneWorldQuaternion(hips, pelvisRotation);
    hips.updateMatrixWorld(true);

    // Measure the hip joints' rigid offset from the pelvis at this attitude.
    // Bone offsets do not translate, so one reading is exact for any pelvis
    // position this frame.
    const hipsWorld = hips.getWorldPosition(new Vector3());
    const hipOffset: Record<FlowFestEucPedalSide, Vector3> = {
      left: new Vector3(),
      right: new Vector3(),
    };
    for (const leg of this.legs) {
      hipOffset[leg.side] = leg.chain.root
        .getWorldPosition(new Vector3())
        .sub(hipsWorld);
    }

    const support = soleTarget.left.clone().add(soleTarget.right).multiplyScalar(0.5);
    const lateral = clamp(
      stance.pelvisLateralMeters,
      -FLOW_FEST_EUC_MAXIMUM_PELVIS_LATERAL_METERS,
      FLOW_FEST_EUC_MAXIMUM_PELVIS_LATERAL_METERS
    );
    const forward = stance.pelvisForwardMeters;

    let standHeight = Infinity;
    for (const leg of this.legs) {
      const desiredReach = flowFestEucLegReachMeters(
        leg.chain.upperLength,
        leg.chain.lowerLength,
        stance.kneeFlexRadians
      );
      const maximumReach = leg.chain.totalLength * 0.999;

      // Offset from the support midpoint to the point the hip joint has to
      // reach from, decomposed in the pedal frame.
      const offset = ankleTarget[leg.side]
        .clone()
        .sub(hipOffset[leg.side])
        .sub(support);
      const offsetRight = offset.dot(frameRight);
      const offsetUp = offset.dot(frameUp);
      const offsetForward = offset.dot(frameForward);

      const perpendicular = Math.hypot(
        lateral - offsetRight,
        forward - offsetForward
      );
      if (perpendicular >= maximumReach) {
        // The stance is wider or deeper than the leg is long. Stand as tall as
        // the geometry allows and let the contact error report the miss; the
        // alternative is a NaN pelvis and a rider that disappears.
        this.frameWarning = `${leg.side} leg cannot span the stance (${perpendicular.toFixed(3)} m across a ${maximumReach.toFixed(3)} m leg)`;
        standHeight = Math.min(standHeight, offsetUp);
        continue;
      }
      const reach = clamp(desiredReach, perpendicular * 1.02, maximumReach);
      // Lower of the two heights, so the straighter leg holds exactly the
      // requested flex and the other one holds more. Taking the higher would
      // straighten one leg past it and hyperextend.
      standHeight = Math.min(
        standHeight,
        offsetUp + Math.sqrt(reach * reach - perpendicular * perpendicular)
      );
    }

    const pelvisTarget = support
      .clone()
      .addScaledVector(frameRight, lateral)
      .addScaledVector(frameForward, forward)
      .addScaledVector(frameUp, standHeight);
    this.setBoneWorldPosition(hips, pelvisTarget);
    hips.updateMatrixWorld(true);

    this.applyTorsoOffset(stance.torsoPitchRadians, stance.torsoRollRadians);
    hips.updateMatrixWorld(true);

    for (const leg of this.legs) {
      const result = this.solver.solve({
        chain: leg.chain,
        footTarget: ankleTarget[leg.side],
        kneeHingeAxis: leg.hingeAxis,
        poleDirection: frameForward,
        bendSign: leg.bendSign,
        weight: 1,
      });
      if (leg.bendSign === undefined && result.reliable) {
        leg.bendSign = result.bendSign;
      }
      // The solver restores the ankle's incoming world rotation, so the pedal
      // basis can be written straight onto it without fighting the solve. The
      // ankle joint does not move when the foot turns, so the position solve
      // stays satisfied.
      this.setBoneWorldQuaternion(leg.foot, footRotation[leg.side]);
      leg.foot.updateMatrixWorld(true);
    }

    this.measureContacts(pedal, anchors, update);
  }

  private applyTorsoOffset(pitchRadians: number, rollRadians: number): void {
    const bones = [this.spine, this.spine1].filter(
      (bone): bone is Bone => bone !== null
    );
    if (bones.length === 0) return;
    const share = 1 / bones.length;
    for (const bone of bones) {
      this.scratch.quaternion.setFromEuler(
        eulerFromPitchRoll(pitchRadians * share, rollRadians * share)
      );
      bone.quaternion.multiply(this.scratch.quaternion);
    }
  }

  private measureContacts(
    pedal: Record<FlowFestEucPedalSide, AnchorFrame>,
    anchors: MountedPoseAnchors,
    update: MountedPoseUpdate
  ): void {
    for (const leg of this.legs) {
      const anchor = pedal[leg.side];
      const scale = footWorldScale(leg.foot);
      const soleWorld = leg.sole.origin
        .clone()
        .applyMatrix4(leg.foot.matrixWorld);
      const soleForwardWorld = leg.sole.forward
        .clone()
        .transformDirection(leg.foot.matrixWorld)
        .normalize();
      const offset = soleWorld.clone().sub(anchor.position);
      const deepest = offset.dot(anchor.up) + leg.sole.lowestAlongUp * scale;

      const hipWorld = leg.chain.root.getWorldPosition(new Vector3());
      const kneeWorld = leg.chain.middle.getWorldPosition(new Vector3());
      const footWorld = leg.foot.getWorldPosition(new Vector3());
      const upper = kneeWorld.clone().sub(hipWorld);
      const lower = footWorld.clone().sub(kneeWorld);
      const flex =
        upper.lengthSq() > 1e-12 && lower.lengthSq() > 1e-12
          ? Math.acos(
              clamp(
                upper.clone().normalize().dot(lower.clone().normalize()),
                -1,
                1
              )
            )
          : 0;

      // Where the knee sits off the hip-to-ankle line decides the pole test.
      const line = footWorld.clone().sub(hipWorld);
      const kneeOffset = kneeWorld.clone().sub(hipWorld);
      if (line.lengthSq() > 1e-12) {
        kneeOffset.addScaledVector(
          line,
          -kneeOffset.dot(line) / line.lengthSq()
        );
      }

      this.contacts[leg.side] = {
        errorMeters: offset.length(),
        penetrationMeters: -deepest,
        forwardErrorDegrees:
          Math.acos(clamp(soleForwardWorld.dot(anchor.forward), -1, 1)) *
          RADIANS_TO_DEGREES,
        lateralErrorMeters: offset.dot(anchor.right),
        forwardErrorMeters: offset.dot(anchor.forward),
        kneeFlexDegrees: flex * RADIANS_TO_DEGREES,
        kneeForward: kneeOffset.dot(anchor.forward) > 0,
      };
      this.contactPoints[leg.side] = {
        soleWorld: { x: soleWorld.x, y: soleWorld.y, z: soleWorld.z },
        anchorWorld: {
          x: anchor.position.x,
          y: anchor.position.y,
          z: anchor.position.z,
        },
      };
    }

    // The pelvis is judged against the wheel centre plane, which is the
    // rider-lean frame's own YZ plane: zero means the hips sit over the wheel.
    const hips = this.hips;
    if (hips) {
      this.scratch.matrix.copy(anchors.riderFrame.matrixWorld).invert();
      const local = hips.getWorldPosition(new Vector3()).applyMatrix4(
        this.scratch.matrix
      );
      this.pelvisLateralOffsetMeters = local.x;
      this.pelvisForwardOffsetMeters = local.z;
    }

    if (update.idle) {
      this.idleStability.record({
        timeSeconds: update.elapsedSeconds,
        leftErrorMeters: this.contacts.left.errorMeters,
        rightErrorMeters: this.contacts.right.errorMeters,
      });
    } else {
      this.idleStability.reset();
    }
  }

  private setBoneWorldQuaternion(bone: Bone, rotation: Quaternion): void {
    if (bone.parent) {
      bone.parent.getWorldQuaternion(this.scratch.quaternionB);
      bone.quaternion
        .copy(this.scratch.quaternionB)
        .invert()
        .multiply(rotation);
    } else {
      bone.quaternion.copy(rotation);
    }
  }

  private setBoneWorldPosition(bone: Bone, position: Vector3): void {
    if (bone.parent) {
      this.scratch.matrixB.copy(bone.parent.matrixWorld).invert();
      bone.position.copy(position).applyMatrix4(this.scratch.matrixB);
    } else {
      bone.position.copy(position);
    }
  }

  diagnostic(): FlowFestEucMountedPoseDiagnostic {
    const left = this.contacts.left;
    const right = this.contacts.right;
    const leftVerdict = gradeFlowFestEucSoleContact(left);
    const rightVerdict = gradeFlowFestEucSoleContact(right);
    const pelvisWithinTolerance =
      Math.abs(this.pelvisLateralOffsetMeters) <=
      FLOW_FEST_EUC_CONTACT_THRESHOLDS.maximumPelvisLateralOffsetMeters;
    return {
      status: this.status,
      unsupportedReason: this.unsupportedReason ?? this.frameWarning,
      left,
      right,
      leftPoints: {
        soleWorld: { ...this.contactPoints.left.soleWorld },
        anchorWorld: { ...this.contactPoints.left.anchorWorld },
      },
      rightPoints: {
        soleWorld: { ...this.contactPoints.right.soleWorld },
        anchorWorld: { ...this.contactPoints.right.anchorWorld },
      },
      leftVerdict,
      rightVerdict,
      pelvisLateralOffsetMeters: this.pelvisLateralOffsetMeters,
      pelvisForwardOffsetMeters: this.pelvisForwardOffsetMeters,
      pelvisWithinTolerance,
      blend: { ...this.blend },
      stanceWidthMeters: FLOW_FEST_EUC_PEDAL_SEPARATION_METERS,
      idleStability: this.idleStability.report(),
      locomotionSuspended: this.locomotionSuspended,
      frameRateHz: this.frameRateHz,
      pass:
        this.status === "ready" &&
        this.frameWarning === null &&
        leftVerdict.pass &&
        rightVerdict.pass &&
        pelvisWithinTolerance,
    };
  }

  /** The knee flex each leg is actually holding, for tests and tuning. */
  measuredKneeFlexRadians(side: FlowFestEucPedalSide): number {
    const leg = this.legs.find((entry) => entry.side === side);
    if (!leg) return Number.NaN;
    const hip = leg.chain.root.getWorldPosition(new Vector3());
    const foot = leg.foot.getWorldPosition(new Vector3());
    return flowFestEucKneeFlexRadians(
      leg.chain.upperLength,
      leg.chain.lowerLength,
      hip.distanceTo(foot)
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export interface AnchorFrame {
  position: Vector3;
  /** The anchor's +X, which is the RIDER's left. Keeps the basis proper. */
  left: Vector3;
  /** The rider's right, for signed lateral measurement only. */
  right: Vector3;
  up: Vector3;
  forward: Vector3;
}

/**
 * Decompose an anchor's world matrix into a position and an orthonormal basis.
 *
 * `extractBasis` returns the columns with any scale still in them, so each
 * axis is normalized; the anchors are unscaled today but a scaled parent would
 * otherwise silently shear the foot basis.
 *
 * `left` is the first column rather than `right` on purpose. In a right-handed
 * Y-up frame whose +Z is forward, +X is the body's left, and a basis built
 * from (right, up, forward) has determinant -1 - a mirror, not a rotation,
 * which turns every foot inside out the moment it is used as a quaternion.
 */
export function readAnchorFrame(anchor: Object3D): AnchorFrame {
  const left = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  anchor.matrixWorld.extractBasis(left, up, forward);
  left.normalize();
  up.normalize();
  forward.normalize();
  return {
    position: new Vector3().setFromMatrixPosition(anchor.matrixWorld),
    left,
    right: left.clone().negate(),
    up,
    forward,
  };
}

function footWorldScale(foot: Bone): number {
  const basis = new Vector3();
  foot.matrixWorld.extractBasis(basis, new Vector3(), new Vector3());
  return basis.length();
}

/**
 * Local pitch about X and roll about Z, in the same XYZ order the vehicle
 * hierarchy composes its own attitude with.
 */
function eulerFromPitchRoll(pitchRadians: number, rollRadians: number): Euler {
  return new Euler(pitchRadians, 0, rollRadians, "XYZ");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

/**
 * Contract recommended for `@austencloud/scene-3d`.
 *
 * Everything above composes the package's exported solver from outside it,
 * because three things it owns are unreachable:
 *
 * 1. `buildTwoBoneChain` and `BoneChain` are internal to
 *    `services/leg-geometry.ts`. Exporting the builder from the barrel would
 *    delete `measureTwoBoneChain` here.
 * 2. `Avatar3D` exposes no ref, callback, or context carrying its skeleton
 *    service, so the bones have to be found by traversing for
 *    `PERFORMER_<id>` and re-deriving the alias table. An
 *    `onSkeletonReady(skeleton)` callback would delete `findMountedPoseBones`.
 * 3. There is no seam for external foot targets. `FootPlanter` owns ground
 *    contact only. A `mountedPose` prop taking left/right contact anchors plus
 *    a pelvis policy - or simply an `externalFootTargets` input evaluated after
 *    the animator and before the render - is the capability this file stands
 *    in for.
 *
 * Sole geometry (`SoleFrame` and `calibrateSoleFrame`) is worth owning there
 * too: it is a bind-pose property of the rig, identical for every consumer,
 * and `FootPlanter` currently approximates it with `footLowestPoint`.
 */
