/**
 * Gait rig sampler
 *
 * Finds the leg chains on a live avatar and reads a GaitFrame off them.
 *
 * It reads the scene graph rather than asking the animation services what they
 * did, because the whole point of the instrument is to see what ended up on
 * screen. LocomotionAnimator writes clip rotations, FootPlanter overwrites some
 * of them with IK, AvatarAnimator touches the arms, and the number that matters
 * is where the ankle actually is once all three have had their turn.
 */

import { Object3D, Vector3 } from "three";

import type { FootFrame, GaitFrame, Vec3 } from "./gait-frame";

/**
 * Canonical leg bones and the names real exports use for them.
 *
 * Mirrors `BONE_NAME_ALIASES` in scene-3d's AvatarSkeletonBuilder, which is
 * the codebase's owner of "what is this bone called on this rig" — the table
 * is not exported from the package, so it is restated here rather than
 * re-derived: same names, same order, same exact-then-contains match. Toe
 * aliases are added because the builder does not track toes and the heel
 * question cannot be answered without them.
 *
 * Order matters for the contains fallback: LeftUpLeg must be tried before
 * LeftLeg, or "leftupleg" would be claimed by the shorter name.
 */
const LEG_BONE_ALIASES = [
  ["Hips", ["Hips", "pelvis"]],
  [
    "LeftUpLeg",
    ["LeftUpLeg", "l_thigh", "thigh.L", "upperleg_l", "LeftUpperLeg"],
  ],
  ["LeftLeg", ["LeftLeg", "l_shin", "shin.L", "lowerleg_l", "LeftLowerLeg"]],
  ["LeftFoot", ["LeftFoot", "l_foot", "foot.L", "foot_l"]],
  [
    "LeftToeBase",
    ["LeftToeBase", "l_toe", "toe.L", "ball_l", "LeftToes", "LeftToe"],
  ],
  [
    "RightUpLeg",
    ["RightUpLeg", "r_thigh", "thigh.R", "upperleg_r", "RightUpperLeg"],
  ],
  ["RightLeg", ["RightLeg", "r_shin", "shin.R", "lowerleg_r", "RightLowerLeg"]],
  ["RightFoot", ["RightFoot", "r_foot", "foot.R", "foot_r"]],
  [
    "RightToeBase",
    ["RightToeBase", "r_toe", "toe.R", "ball_r", "RightToes", "RightToe"],
  ],
] as const satisfies ReadonlyArray<readonly [string, readonly string[]]>;

type CanonicalBone = (typeof LEG_BONE_ALIASES)[number][0];

/**
 * `Hips` deliberately omits the builder's looser "hip" and "root" aliases.
 * The builder only ever feeds itself Bone objects from a skeleton; this walks
 * a whole scene graph, where "root" is the name of half the empty groups in
 * it.
 */
function resolveLegBones(subtree: Object3D): Map<CanonicalBone, Object3D> {
  const resolved = new Map<CanonicalBone, Object3D>();
  const candidates: Object3D[] = [];
  subtree.traverse((node) => {
    if ((node as { isBone?: boolean }).isBone) candidates.push(node);
  });

  for (const bone of candidates) {
    const name = bone.name.toLowerCase();
    for (const [canonical, aliases] of LEG_BONE_ALIASES) {
      if (resolved.has(canonical)) continue;
      if (aliases.some((alias) => name === alias.toLowerCase())) {
        resolved.set(canonical, bone);
        break;
      }
    }
  }

  for (const bone of candidates) {
    const name = bone.name.toLowerCase();
    for (const [canonical, aliases] of LEG_BONE_ALIASES) {
      if (resolved.has(canonical)) continue;
      if (aliases.some((alias) => name.includes(alias.toLowerCase()))) {
        resolved.set(canonical, bone);
        break;
      }
    }
  }

  return resolved;
}

interface LegBones {
  hip: Object3D;
  knee: Object3D;
  ankle: Object3D;
  toe: Object3D | null;
}

export interface RiggedAvatar {
  /** Stable identity, so a buffer survives the performer list re-rendering. */
  id: string;
  /**
   * The object the character is positioned by, NOT the pelvis. Weight transfer
   * is measured as the pelvis's departure from this, so the two must be
   * different objects or every rig reads as having no weight shift at all.
   */
  root: Object3D;
  hips: Object3D;
  left: LegBones;
  right: LegBones;
}

/**
 * The object that carries the character across the floor.
 *
 * The first non-Bone ancestor of Hips: the armature node every skinned GLB
 * has. It inherits every transform applied to the character from above, so it
 * tracks travel, while excluding the Hips bone's own animation, which is where
 * the pelvis's sway lives. Those have to be different objects or weight
 * transfer measures as zero by construction.
 *
 * The tagged `performerIndex` group is not usable for this: in the stage host
 * it is a stationary wrapper four levels above the node that actually moves.
 */
function resolveTravelNode(hips: Object3D): Object3D {
  for (let node: Object3D | null = hips.parent; node; node = node.parent) {
    if (!(node as { isBone?: boolean }).isBone) return node;
  }
  return hips;
}

/** Prefer a name the host chose, then its index, then something unique. */
function resolveId(hips: Object3D): string {
  for (let node: Object3D | null = hips; node; node = node.parent) {
    const named = /^PERFORMER_(.+)$/.exec(node.name ?? "");
    if (named) return named[1]!;
    if (typeof node.userData?.performerIndex === "number") {
      return `performer-${node.userData.performerIndex as number}`;
    }
  }
  return `rig-${hips.id}`;
}

/**
 * Collect every avatar in a scene that carries a full pair of leg chains.
 *
 * Keyed off Hips, because in every humanoid rig the legs hang from it, so one
 * Hips is exactly one character and the search cannot pick up two halves of
 * two different skeletons.
 */
export function collectRiggedAvatars(scene: Object3D): RiggedAvatar[] {
  const found: RiggedAvatar[] = [];
  const seen = new Set<Object3D>();

  scene.traverse((object) => {
    if (!(object as { isBone?: boolean }).isBone) return;
    if (seen.has(object)) return;

    const bones = resolveLegBones(object);
    const hips = bones.get("Hips");
    // Resolution starts at this node, so it is only the Hips of this rig when
    // it names itself one. Anything deeper finds its own descendants instead.
    if (hips !== object) return;

    const leftHip = bones.get("LeftUpLeg");
    const leftKnee = bones.get("LeftLeg");
    const leftAnkle = bones.get("LeftFoot");
    const rightHip = bones.get("RightUpLeg");
    const rightKnee = bones.get("RightLeg");
    const rightAnkle = bones.get("RightFoot");
    if (!leftHip || !leftKnee || !leftAnkle) return;
    if (!rightHip || !rightKnee || !rightAnkle) return;

    seen.add(hips);
    found.push({
      id: resolveId(hips),
      root: resolveTravelNode(hips),
      hips,
      // A rig without a ToeBase can still be measured for slip and twitch; it
      // just cannot answer the heel question, and the report says so rather
      // than inventing a ball of the foot.
      left: {
        hip: leftHip,
        knee: leftKnee,
        ankle: leftAnkle,
        toe: bones.get("LeftToeBase") ?? null,
      },
      right: {
        hip: rightHip,
        knee: rightKnee,
        ankle: rightAnkle,
        toe: bones.get("RightToeBase") ?? null,
      },
    });
  });

  found.sort((a, b) => a.id.localeCompare(b.id));
  return found;
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();

function worldOf(object: Object3D, out: Vec3): Vec3 {
  object.getWorldPosition(tmpA);
  out.x = tmpA.x;
  out.y = tmpA.y;
  out.z = tmpA.z;
  return out;
}

function vec(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

/** Interior angle at the knee in degrees. 180 is a straight leg. */
function kneeAngle(leg: LegBones): number {
  leg.hip.getWorldPosition(tmpA);
  leg.knee.getWorldPosition(tmpB);
  leg.ankle.getWorldPosition(tmpC);
  const thighX = tmpA.x - tmpB.x;
  const thighY = tmpA.y - tmpB.y;
  const thighZ = tmpA.z - tmpB.z;
  const shinX = tmpC.x - tmpB.x;
  const shinY = tmpC.y - tmpB.y;
  const shinZ = tmpC.z - tmpB.z;
  const thighLen = Math.hypot(thighX, thighY, thighZ);
  const shinLen = Math.hypot(shinX, shinY, shinZ);
  if (thighLen < 1e-6 || shinLen < 1e-6) return 180;
  const cos =
    (thighX * shinX + thighY * shinY + thighZ * shinZ) / (thighLen * shinLen);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function sampleLeg(leg: LegBones, claimedContact: number): FootFrame {
  return {
    ankle: worldOf(leg.ankle, vec()),
    toe: leg.toe ? worldOf(leg.toe, vec()) : null,
    knee: worldOf(leg.knee, vec()),
    hip: worldOf(leg.hip, vec()),
    kneeAngle: kneeAngle(leg),
    claimedContact,
  };
}

export interface SampleContext {
  t: number;
  dt: number;
  /** What the animator says it is bearing, when the host can supply it. */
  claimedContactLeft?: number;
  claimedContactRight?: number;
}

/**
 * Read one frame off a rig.
 *
 * Facing comes out of the world matrix rather than off the movement state, so
 * a character whose group says one thing and whose mesh does another is
 * measured as it looks. Everything downstream that resolves "forward" and
 * "sideways" depends on this being the visible facing.
 */
export function sampleRig(
  avatar: RiggedAvatar,
  context: SampleContext
): GaitFrame {
  avatar.root.updateWorldMatrix(true, true);

  // Facing comes off the hip axis rather than any node's rotation. Which
  // object carries the character's turn differs per host, and a bone's rest
  // orientation is a property of whoever exported the rig; the line between
  // the two hip joints is the character's own left-right axis on every
  // humanoid, and it is visible in the pose the eye is judging.
  avatar.left.hip.getWorldPosition(tmpA);
  avatar.right.hip.getWorldPosition(tmpB);
  let rx = tmpB.x - tmpA.x;
  let rz = tmpB.z - tmpA.z;
  const span = Math.hypot(rx, rz);
  if (span < 1e-6) {
    rx = -1;
    rz = 0;
  } else {
    rx /= span;
    rz /= span;
  }
  // forward = up x right, so a right of -X gives a forward of +Z.
  const facing = Math.atan2(rz, -rx);

  return {
    t: context.t,
    dt: context.dt,
    root: worldOf(avatar.root, vec()),
    facing,
    hips: worldOf(avatar.hips, vec()),
    left: sampleLeg(avatar.left, context.claimedContactLeft ?? -1),
    right: sampleLeg(avatar.right, context.claimedContactRight ?? -1),
  };
}

/**
 * A fixed-size window of frames per avatar.
 *
 * Bounded on purpose: a probe left running for an hour must not be the reason
 * the tab runs out of memory, and every metric in the report is a property of
 * the last few seconds rather than of the whole session.
 */
export class GaitRecorder {
  private buffers = new Map<string, GaitFrame[]>();

  constructor(private readonly capacity = 900) {}

  push(id: string, frame: GaitFrame): void {
    let buffer = this.buffers.get(id);
    if (!buffer) {
      buffer = [];
      this.buffers.set(id, buffer);
    }
    buffer.push(frame);
    if (buffer.length > this.capacity) {
      buffer.splice(0, buffer.length - this.capacity);
    }
  }

  frames(id: string): readonly GaitFrame[] {
    return this.buffers.get(id) ?? [];
  }

  ids(): string[] {
    return [...this.buffers.keys()].sort();
  }

  clear(): void {
    this.buffers.clear();
  }

  /** Drop buffers for avatars that are no longer in the scene. */
  retain(ids: readonly string[]): void {
    const keep = new Set(ids);
    for (const id of [...this.buffers.keys()]) {
      if (!keep.has(id)) this.buffers.delete(id);
    }
  }
}
