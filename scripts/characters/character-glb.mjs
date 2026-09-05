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

/**
 * Read the pixel size from an embedded image header without decoding it.
 *
 * Character textures arrive as PNG or JPEG from an exporter and leave the
 * optimizer as WebP, so those three headers are the whole vocabulary. A
 * format this does not recognise reports null rather than a guess.
 */
export function readImageDimensions(bytes) {
  if (!bytes || bytes.length < 16) return null;

  if (
    bytes.length >= 24 &&
    bytes.readUInt32BE(0) === 0x89504e47 &&
    bytes.readUInt32BE(4) === 0x0d0a1a0a
  ) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      // Padding, TEM, SOI and restart markers carry no length field.
      if (
        marker === 0xff ||
        marker === 0x01 ||
        marker === 0xd8 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        offset += marker === 0xff ? 1 : 2;
        continue;
      }
      const isStartOfFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isStartOfFrame) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
    return null;
  }

  if (
    bytes.length >= 30 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const packed = bytes.readUInt32LE(21);
      return {
        width: 1 + (packed & 0x3fff),
        height: 1 + ((packed >>> 14) & 0x3fff),
      };
    }
  }

  return null;
}

const SPECULAR_GLOSSINESS_EXTENSION = "KHR_materials_pbrSpecularGlossiness";
const UNLIT_EXTENSION = "KHR_materials_unlit";

/**
 * A metallic factor at or above this with no metallic-roughness texture makes
 * a MeshStandardMaterial nearly black under direct light alone: metal has no
 * diffuse term, and without an environment map there is nothing to reflect.
 */
const DARK_METAL_FACTOR = 0.5;

function imageIndexForTexture(document, textureInfo) {
  if (!textureInfo || typeof textureInfo.index !== "number") return null;
  const texture = document.textures?.[textureInfo.index];
  return typeof texture?.source === "number" ? texture.source : null;
}

function describeImages(document, binary) {
  const bufferViews = document.bufferViews ?? [];
  return (document.images ?? []).map((image, index) => {
    const entry = {
      index,
      name: image.name ?? null,
      mimeType: image.mimeType ?? null,
      embedded: typeof image.bufferView === "number",
      width: null,
      height: null,
    };
    if (!entry.embedded) return entry;
    const view = bufferViews[image.bufferView];
    if (!view) return entry;
    const start = view.byteOffset ?? 0;
    const size = readImageDimensions(
      binary.subarray(start, start + view.byteLength)
    );
    if (size) {
      entry.width = size.width;
      entry.height = size.height;
    }
    return entry;
  });
}

function largestImageSide(images, indices) {
  let largest = null;
  for (const index of indices) {
    const image = images[index];
    if (!image || image.width === null || image.height === null) continue;
    const side = Math.max(image.width, image.height);
    if (largest === null || side > largest) largest = side;
  }
  return largest;
}

function joinNames(entries) {
  return entries.map((entry) => entry.name).join(", ");
}

/**
 * Report what each material can actually render with.
 *
 * The rig gates say whether a character can move. This says whether it can
 * look like anything once it does: which PBR channels survived export, how
 * large the source textures are, and which declarations three.js will not
 * honour. Warnings are raised only for materials a skinned primitive draws;
 * an unused material is pruned by the optimizer anyway.
 */
export function auditCharacterMaterials(document, binary, skinnedPrimitives) {
  const images = describeImages(document, binary);
  const skinnedMaterialIndices = new Set(
    skinnedPrimitives
      .map((primitive) => primitive.material)
      .filter((index) => typeof index === "number")
  );

  const entries = (document.materials ?? []).map((material, index) => {
    const pbr = material.pbrMetallicRoughness ?? {};
    const extensions = Object.keys(material.extensions ?? {});
    const channels = {
      baseColor: imageIndexForTexture(document, pbr.baseColorTexture),
      metallicRoughness: imageIndexForTexture(
        document,
        pbr.metallicRoughnessTexture
      ),
      normal: imageIndexForTexture(document, material.normalTexture),
      occlusion: imageIndexForTexture(document, material.occlusionTexture),
      emissive: imageIndexForTexture(document, material.emissiveTexture),
    };
    const baseColorFactor = pbr.baseColorFactor ?? [1, 1, 1, 1];
    return {
      index,
      name: material.name ?? `material ${index}`,
      skinned: skinnedMaterialIndices.has(index),
      alphaMode: material.alphaMode ?? "OPAQUE",
      alphaCutoff: material.alphaCutoff ?? 0.5,
      doubleSided: material.doubleSided === true,
      baseColorAlpha: baseColorFactor[3] ?? 1,
      metallicFactor: pbr.metallicFactor ?? 1,
      roughnessFactor: pbr.roughnessFactor ?? 1,
      channels,
      extensions,
      maxTextureSide: largestImageSide(
        images,
        Object.values(channels).filter((value) => value !== null)
      ),
    };
  });

  const skinned = entries.filter((entry) => entry.skinned);
  const withChannel = (channel) =>
    skinned.filter((entry) => entry.channels[channel] !== null).length;
  const alphaModes = { OPAQUE: 0, MASK: 0, BLEND: 0 };
  for (const entry of skinned) {
    alphaModes[entry.alphaMode] = (alphaModes[entry.alphaMode] ?? 0) + 1;
  }
  const summary = {
    skinnedMaterialCount: skinned.length,
    withBaseColorTexture: withChannel("baseColor"),
    withNormalTexture: withChannel("normal"),
    withMetallicRoughnessTexture: withChannel("metallicRoughness"),
    withOcclusionTexture: withChannel("occlusion"),
    withEmissiveTexture: withChannel("emissive"),
    alphaModes,
    maxTextureSide: largestImageSide(
      images,
      images.map((image) => image.index)
    ),
    specularGlossinessCount: skinned.filter((entry) =>
      entry.extensions.includes(SPECULAR_GLOSSINESS_EXTENSION)
    ).length,
    unlitCount: skinned.filter((entry) =>
      entry.extensions.includes(UNLIT_EXTENSION)
    ).length,
  };

  const warnings = [];
  const withoutNormal = skinned.filter(
    (entry) => entry.channels.normal === null
  );
  if (skinned.length > 0 && withoutNormal.length > 0) {
    warnings.push(
      `${withoutNormal.length} of ${skinned.length} skinned material(s) carry no normal map: ${joinNames(withoutNormal)}`
    );
  }
  const withoutRoughness = skinned.filter(
    (entry) =>
      entry.channels.metallicRoughness === null &&
      !entry.extensions.includes(SPECULAR_GLOSSINESS_EXTENSION) &&
      !entry.extensions.includes(UNLIT_EXTENSION)
  );
  if (skinned.length > 0 && withoutRoughness.length > 0) {
    warnings.push(
      `${withoutRoughness.length} of ${skinned.length} skinned material(s) carry no metallic-roughness texture, so one roughness factor covers each whole surface: ${withoutRoughness
        .map((entry) => `${entry.name} (${entry.roughnessFactor})`)
        .join(", ")}`
    );
  }
  const darkMetal = withoutRoughness.filter(
    (entry) => entry.metallicFactor >= DARK_METAL_FACTOR
  );
  if (darkMetal.length > 0) {
    warnings.push(
      `Metallic factor without a metallic-roughness texture renders dark under the viewer's direct lights: ${darkMetal
        .map((entry) => `${entry.name} (${entry.metallicFactor})`)
        .join(", ")}`
    );
  }
  const opaqueBlends = skinned.filter(
    (entry) => entry.alphaMode === "BLEND" && entry.baseColorAlpha === 1
  );
  if (opaqueBlends.length > 0) {
    warnings.push(
      `BLEND declared on material(s) with an opaque base colour; a solid body in the transparent pass tears against itself (ch01/ch12, 2026-09-04): ${joinNames(opaqueBlends)}`
    );
  }
  const specularGlossiness = skinned.filter((entry) =>
    entry.extensions.includes(SPECULAR_GLOSSINESS_EXTENSION)
  );
  if (specularGlossiness.length > 0) {
    warnings.push(
      `${SPECULAR_GLOSSINESS_EXTENSION} is not read by the runtime GLTFLoader; convert to metallic-roughness before intake: ${joinNames(specularGlossiness)}`
    );
  }
  if (summary.maxTextureSide !== null && summary.maxTextureSide < 1024) {
    warnings.push(
      `Largest texture is ${summary.maxTextureSide} px; the catalog optimizer targets 1024 px, so this source starts below catalog resolution`
    );
  }

  return { entries, summary, images, warnings };
}

export function inspectCharacterGlb(filePath) {
  const absolutePath = resolve(filePath);
  const errors = [];
  const warnings = [];
  let document;
  let binary;
  try {
    ({ document, binary } = parseGlb(absolutePath));
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
  const materialAudit = auditCharacterMaterials(
    document,
    binary,
    skinnedPrimitives
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
  warnings.push(...materialAudit.warnings);

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
    materials: materialAudit.entries,
    materialSummary: materialAudit.summary,
    images: materialAudit.images,
    animationCount: document.animations?.length ?? 0,
    errors,
    warnings,
  };
}
