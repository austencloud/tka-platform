import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Bone, Skeleton } from "three";

import { AvatarSkeletonBuilder } from "../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarSkeletonBuilder.ts";

const require = createRequire(import.meta.url);
const { parseGlb } = require("../lib/glb-measure.cjs");

export const REQUIRED_BODY_BONES = [
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
];

const IMPORT_JOINT_ALIASES = new Map([
  ["spine_01", "Spine"],
  ["spine_02", "Spine1"],
  ["spine_03", "Spine2"],
  ["thigh_l", "LeftUpLeg"],
  ["calf_l", "LeftLeg"],
  ["thigh_r", "RightUpLeg"],
  ["calf_r", "RightLeg"],
]);

function canonicalImportedJointName(name) {
  const withoutNamespace = name.replace(/^mixamorig\d*:/i, "");
  const bodyBone = IMPORT_JOINT_ALIASES.get(withoutNamespace.toLowerCase());
  if (bodyBone) return bodyBone;

  const finger = withoutNamespace.match(
    /^(thumb|index|middle|ring|pinky)_0?([123])_([lr])$/i
  );
  if (!finger) return withoutNamespace;

  const [, fingerName, segment, side] = finger;
  const canonicalFinger =
    fingerName[0].toUpperCase() + fingerName.slice(1).toLowerCase();
  return `${side.toLowerCase() === "l" ? "Left" : "Right"}Hand${canonicalFinger}${segment}`;
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function serializeGlb(document, binary) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const paddedJson = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = (4 - (binary.length % 4)) % 4;
  const paddedBinary = Buffer.concat([binary, Buffer.alloc(binaryPadding)]);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBinary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(paddedBinary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([
    header,
    jsonHeader,
    paddedJson,
    binaryHeader,
    paddedBinary,
  ]);
}

/** Canonicalize supported vendor joint names without changing node indices. */
export function normalizeRuntimeJointNames(filePath) {
  const absolutePath = resolve(filePath);
  const { document, binary } = parseGlb(absolutePath);
  const nodes = document.nodes ?? [];
  const jointIndices = new Set(
    (document.skins ?? []).flatMap((skin) => skin.joints ?? [])
  );
  const changes = [];
  const normalizedNames = new Map();

  for (const index of jointIndices) {
    const node = nodes[index];
    if (typeof node?.name !== "string") continue;
    const normalized = canonicalImportedJointName(node.name);
    const existingIndex = normalizedNames.get(normalized);
    if (existingIndex !== undefined && existingIndex !== index) {
      throw new Error(
        `Joint namespace normalization would duplicate ${normalized} at nodes ${existingIndex} and ${index}`
      );
    }
    normalizedNames.set(normalized, index);
    if (normalized === node.name || normalized === "") continue;
    changes.push({ index, from: node.name, to: normalized });
    node.name = normalized;
  }

  if (changes.length > 0) {
    writeFileSync(absolutePath, serializeGlb(document, binary));
  }
  return changes;
}

function runtimeBoneMapping(jointNames) {
  const builder = new AvatarSkeletonBuilder();
  const mapped = new Map();
  const bones = jointNames.map((name) => {
    const bone = new Bone();
    bone.name = name;
    builder.mapBoneToMap(bone, mapped);
    return bone;
  });
  builder.skeleton = new Skeleton(bones);
  return {
    mappedBones: REQUIRED_BODY_BONES.filter((name) => mapped.has(name)),
    fingerChains: builder.buildFingerChains({}) !== null,
  };
}

function triangleCountForPrimitive(document, primitive) {
  if ((primitive.mode ?? 4) !== 4) return 0;
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
  const accessor = document.accessors?.[accessorIndex];
  return accessor ? Math.floor(accessor.count / 3) : 0;
}

function sceneTraversalOrder(document) {
  const nodes = document.nodes ?? [];
  const ordered = [];
  const visited = new Set();
  function visit(index) {
    if (visited.has(index) || !nodes[index]) return;
    visited.add(index);
    ordered.push(index);
    for (const child of nodes[index].children ?? []) visit(child);
  }
  const scene = document.scenes?.[document.scene ?? 0];
  for (const root of scene?.nodes ?? []) visit(root);
  return ordered;
}

export function inspectCharacterGlb(filePath) {
  const absolutePath = resolve(filePath);
  const errors = [];
  const warnings = [];
  let document;
  try {
    ({ document } = parseGlb(absolutePath));
  } catch (error) {
    return {
      file: basename(absolutePath),
      bytes: existsSync(absolutePath) ? statSync(absolutePath).size : 0,
      validGlb: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
    };
  }

  const nodes = document.nodes ?? [];
  const skins = document.skins ?? [];
  const meshes = document.meshes ?? [];
  const jointIndices = new Set(skins.flatMap((skin) => skin.joints ?? []));
  const jointNames = [...jointIndices]
    .map((index) => nodes[index]?.name)
    .filter((name) => typeof name === "string" && name.length > 0);
  const { mappedBones } = runtimeBoneMapping(jointNames);
  const missingBodyBones = REQUIRED_BODY_BONES.filter(
    (name) => !mappedBones.includes(name)
  );
  const skinnedNodes = sceneTraversalOrder(document)
    .map((index) => nodes[index])
    .filter((node) => node.skin !== undefined && node.mesh !== undefined);
  const runtimeSkin = skins[skinnedNodes.at(-1)?.skin];
  const runtimeJointNames = (runtimeSkin?.joints ?? [])
    .map((index) => nodes[index]?.name)
    .filter((name) => typeof name === "string" && name.length > 0);
  const { fingerChains } = runtimeBoneMapping(runtimeJointNames);
  const skinnedPrimitives = skinnedNodes.flatMap(
    (node) => meshes[node.mesh]?.primitives ?? []
  );
  const unweightedPrimitiveCount = skinnedPrimitives.filter(
    (primitive) =>
      primitive.attributes?.JOINTS_0 === undefined ||
      primitive.attributes?.WEIGHTS_0 === undefined
  ).length;
  const triangleCount = meshes.reduce(
    (total, mesh) =>
      total +
      (mesh.primitives ?? []).reduce(
        (meshTotal, primitive) =>
          meshTotal + triangleCountForPrimitive(document, primitive),
        0
      ),
    0
  );

  if (skins.length === 0) errors.push("No glTF skin is present");
  if (skinnedNodes.length === 0) errors.push("No mesh node is bound to a skin");
  if (unweightedPrimitiveCount > 0) {
    errors.push(
      `${unweightedPrimitiveCount} skinned primitive(s) lack JOINTS_0 or WEIGHTS_0`
    );
  }
  if (missingBodyBones.length > 0) {
    errors.push(
      `Runtime body bones are missing: ${missingBodyBones.join(", ")}`
    );
  }
  if (!fingerChains)
    warnings.push("The complete 30-bone finger rig is unavailable");
  if ((document.textures?.length ?? 0) === 0) {
    warnings.push("The model has no texture records");
  }
  if ((document.materials?.length ?? 0) === 0) {
    warnings.push("The model has no material records");
  }
  if ((document.animations?.length ?? 0) > 0) {
    warnings.push(
      "Embedded animations are present; TKA drives the skeleton itself"
    );
  }
  if (triangleCount > 150_000) {
    warnings.push(
      `Triangle count is high for a web character (${triangleCount})`
    );
  }

  return {
    file: basename(absolutePath),
    bytes: statSync(absolutePath).size,
    sha256: sha256File(absolutePath),
    validGlb: true,
    gltfVersion: document.asset?.version ?? null,
    sceneCount: document.scenes?.length ?? 0,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    primitiveCount: meshes.reduce(
      (total, mesh) => total + (mesh.primitives?.length ?? 0),
      0
    ),
    triangleCount,
    skinCount: skins.length,
    skinnedMeshNodeCount: skinnedNodes.length,
    jointCount: jointIndices.size,
    runtimeSkeletonJointCount: runtimeSkin?.joints?.length ?? 0,
    mappedBodyBones: mappedBones,
    mappedBodyBoneCount: mappedBones.length,
    missingBodyBones,
    fingerChains,
    materialCount: document.materials?.length ?? 0,
    textureCount: document.textures?.length ?? 0,
    imageCount: document.images?.length ?? 0,
    animationCount: document.animations?.length ?? 0,
    errors,
    warnings,
  };
}
