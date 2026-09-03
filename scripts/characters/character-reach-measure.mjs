/**
 * Measure a character GLB the way the runtime measures it.
 *
 * `LiveSequencePerformer3D` builds a `PerformerReachSample` out of
 * `AvatarPoseDiagnostics`, which `Avatar3D` fills from the mapped arm chains:
 * `upperLength` is the arm-chain root to middle, `lowerLength` is middle to
 * effector, and `shoulderWidth` is the world distance between the two chain
 * roots (the upper-arm joints, not the clavicles). Those three quantities are
 * rotation-invariant bone geometry, so reading them off the authored rest pose
 * of the GLB reproduces exactly what the browser reports on the first frame.
 *
 * The bone mapping comes from the runtime `AvatarSkeletonBuilder` so this file
 * never maintains a second alias table, and the arithmetic comes from the
 * shared `performer-reach-measurements` owner so a sweep can never disagree
 * with the solve it is meant to probe.
 */
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { Bone, Matrix4, Skeleton, Vector3 } from "three";

import { AvatarSkeletonBuilder } from "../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarSkeletonBuilder.ts";
import {
  fitStaffLengthForHug,
  measurePerformerReach,
  planHugReachGeometry,
} from "../../src/lib/shared/3d/domain/performer-reach-measurements.ts";

const require = createRequire(import.meta.url);
const { parseGlb, nodeMatrix } = require("../lib/glb-measure.cjs");

/** The arm chain the runtime measures, per side. */
const ARM_CHAIN = {
  left: { root: "LeftArm", middle: "LeftForeArm", effector: "LeftHand" },
  right: { root: "RightArm", middle: "RightForeArm", effector: "RightHand" },
};

/**
 * Canonical bone name -> node index, resolved through the runtime mapper.
 *
 * `mapBoneToMap` is the same call `AvatarSkeletonBuilder` makes while building
 * a live skeleton, so a rig it accepts in the browser resolves identically here.
 */
function mapJointNodes(document) {
  const nodes = document.nodes ?? [];
  const skins = document.skins ?? [];
  const jointIndices = [...new Set(skins.flatMap((skin) => skin.joints ?? []))];
  const builder = new AvatarSkeletonBuilder();
  const mapped = new Map();
  const boneNodeIndex = new Map();

  const bones = jointIndices.map((index) => {
    const bone = new Bone();
    bone.name = nodes[index]?.name ?? "";
    const before = new Set(mapped.keys());
    builder.mapBoneToMap(bone, mapped);
    for (const canonical of mapped.keys()) {
      if (!before.has(canonical)) boneNodeIndex.set(canonical, index);
    }
    return bone;
  });
  builder.skeleton = new Skeleton(bones);

  return {
    boneNodeIndex,
    fingerChains: builder.buildFingerChains({}) !== null,
    fingerBoneCount: [...mapped.keys()].filter((name) =>
      /Hand(Thumb|Index|Middle|Ring|Pinky)[123]$/.test(name)
    ).length,
  };
}

/** World matrix per node index for the GLB's authored rest pose. */
function restPoseWorldMatrices(document) {
  const nodes = document.nodes ?? [];
  const worldMatrices = new Map();
  const visit = (index, parentMatrix) => {
    const node = nodes[index];
    if (!node || worldMatrices.has(index)) return;
    const world = parentMatrix.clone().multiply(nodeMatrix(node));
    worldMatrices.set(index, world);
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = document.scenes?.[document.scene ?? 0];
  for (const root of scene?.nodes ?? []) visit(root, new Matrix4());
  return worldMatrices;
}

function worldPosition(worldMatrices, boneNodeIndex, boneName) {
  const nodeIndex = boneNodeIndex.get(boneName);
  if (nodeIndex === undefined) return null;
  const matrix = worldMatrices.get(nodeIndex);
  if (!matrix) return null;
  return new Vector3().setFromMatrixPosition(matrix);
}

function segmentLengths(worldMatrices, boneNodeIndex, chain) {
  const root = worldPosition(worldMatrices, boneNodeIndex, chain.root);
  const middle = worldPosition(worldMatrices, boneNodeIndex, chain.middle);
  const effector = worldPosition(worldMatrices, boneNodeIndex, chain.effector);
  if (!root || !middle || !effector) return null;
  return {
    root,
    upperM: root.distanceTo(middle),
    lowerM: middle.distanceTo(effector),
  };
}

/**
 * Skeleton-derived stature: the ground-to-crown span of the mapped body bones.
 *
 * The head bone sits inside the skull rather than at its crown, so the span is
 * extended by the head-to-neck length, which is the standard proxy when no
 * mesh bounds are wanted. Stature is context for the sweep, not a solve input.
 */
function estimateStatureM(worldMatrices, boneNodeIndex) {
  const head = worldPosition(worldMatrices, boneNodeIndex, "Head");
  const neck = worldPosition(worldMatrices, boneNodeIndex, "Neck");
  const foot =
    worldPosition(worldMatrices, boneNodeIndex, "LeftToeBase") ??
    worldPosition(worldMatrices, boneNodeIndex, "LeftFoot");
  if (!head || !neck || !foot) return null;
  return head.y - foot.y + (head.y - neck.y);
}

/**
 * Lateral separation of the two foot joints in the authored rest pose.
 *
 * This is not a solve input. It is a tripwire: a Blender round trip that bakes
 * the imported pose into the rest pose collapses an authored feet-apart stance
 * onto a feet-together one, and nothing else in this table would notice. A
 * fixture that quietly changed its stance is a different body than the one it
 * claims to be.
 */
function footSeparationM(worldMatrices, boneNodeIndex) {
  const left = worldPosition(worldMatrices, boneNodeIndex, "LeftFoot");
  const right = worldPosition(worldMatrices, boneNodeIndex, "RightFoot");
  return left && right ? left.distanceTo(right) : null;
}

/**
 * Every number the staff-grip solve consumes, for one character GLB.
 *
 * Returns `measurements: null` when the rig's arm chains do not resolve, which
 * is the same condition that makes the runtime fall back to the un-measured
 * stance rather than posing against garbage.
 */
export function measureCharacterReach(filePath) {
  const absolutePath = resolve(filePath);
  const { document } = parseGlb(absolutePath);
  const { boneNodeIndex, fingerChains, fingerBoneCount } =
    mapJointNodes(document);
  const worldMatrices = restPoseWorldMatrices(document);

  const left = segmentLengths(worldMatrices, boneNodeIndex, ARM_CHAIN.left);
  const right = segmentLengths(worldMatrices, boneNodeIndex, ARM_CHAIN.right);
  const base = {
    file: basename(absolutePath),
    fingerChains,
    fingerBoneCount,
    statureM: estimateStatureM(worldMatrices, boneNodeIndex),
    footSeparationM: footSeparationM(worldMatrices, boneNodeIndex),
  };
  if (!left || !right) {
    return { ...base, measurements: null, hug: null, staffFit: null };
  }

  const measurements = measurePerformerReach({
    leftUpperArmM: left.upperM,
    leftForearmM: left.lowerM,
    rightUpperArmM: right.upperM,
    rightForearmM: right.lowerM,
    shoulderWidthM: left.root.distanceTo(right.root),
  });
  if (!measurements) {
    return { ...base, measurements: null, hug: null, staffFit: null };
  }

  return {
    ...base,
    measurements,
    hug: planHugReachGeometry(measurements),
    staffFit: fitStaffLengthForHug(measurements),
  };
}

/** One row of the sweep's measured-proportion table. */
export function reachTableRow(id, measured) {
  const { measurements: m, hug, staffFit } = measured;
  return {
    id,
    statureCm: measured.statureM === null ? null : measured.statureM * 100,
    upperArmCm: m ? m.upperArmM * 100 : null,
    forearmCm: m ? m.forearmM * 100 : null,
    reachCm: m ? m.reachM * 100 : null,
    shoulderWidthCm: m ? m.shoulderWidthM * 100 : null,
    footSeparationCm:
      measured.footSeparationM === null ? null : measured.footSeparationM * 100,
    hugLaneCm: hug ? hug.laneM * 100 : null,
    hugForwardCm: hug ? hug.forwardM * 100 : null,
    staffFits: staffFit ? staffFit.fits : null,
    staffCm: staffFit
      ? staffFit.fits
        ? staffFit.recommendedStaffLengthCm
        : staffFit.maxStaffLengthCm
      : null,
    fingerChains: measured.fingerChains,
  };
}

/** Fixed-width console table so a sweep prints its own proof. */
export function formatReachTable(rows) {
  const columns = [
    ["id", 22, (r) => r.id],
    ["stature", 8, (r) => fixed(r.statureCm, 1)],
    ["upArm", 7, (r) => fixed(r.upperArmCm, 2)],
    ["forearm", 8, (r) => fixed(r.forearmCm, 2)],
    ["reach", 7, (r) => fixed(r.reachCm, 2)],
    ["shoulder", 9, (r) => fixed(r.shoulderWidthCm, 2)],
    ["stance", 7, (r) => fixed(r.footSeparationCm, 2)],
    ["lane", 6, (r) => fixed(r.hugLaneCm, 2)],
    ["forward", 8, (r) => fixed(r.hugForwardCm, 2)],
    ["staff", 7, (r) => fixed(r.staffCm, 1)],
    ["fit", 5, (r) => (r.staffFits === null ? "-" : r.staffFits ? "yes" : "NO")],
    ["fingers", 7, (r) => (r.fingerChains ? "ok" : "MISSING")],
  ];
  const header = columns.map(([name, width]) => name.padEnd(width)).join(" ");
  const rule = "-".repeat(header.length);
  const body = rows.map((row) =>
    columns.map(([, width, read]) => String(read(row)).padEnd(width)).join(" ")
  );
  return [header, rule, ...body].join("\n");
}

function fixed(value, digits) {
  return value === null || value === undefined ? "-" : value.toFixed(digits);
}
