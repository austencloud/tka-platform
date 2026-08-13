#!/usr/bin/env node
/**
 * Optimize the Blender-authored Moonlit Winter Hollow for WebGL delivery.
 *
 * Geometry is simplified and instanced first. Textures are then normalized to
 * PNG for KTX-Software, encoded as GPU-compressed KTX2, and meshopt is applied
 * last. WebP reduced the download but expanded all 42 Winter textures back to
 * raw pixels in VRAM; the runtime already wires KTX2Loader, so the asset should
 * use the format its loader advertises.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/winter/winter-environment_raw.glb");
const OUTPUT = resolve("static/models/winter/winter-environment.glb");
const TMP_SLIM = resolve("static/models/winter/_winter-slim.glb");
const TMP_SELECTIVE = resolve("static/models/winter/_winter-selective.glb");
const TMP_INSTANCED = resolve("static/models/winter/_winter-instanced.glb");
const TMP_PNG = resolve("static/models/winter/_winter-png.glb");
const TMP_UASTC = resolve("static/models/winter/_winter-uastc.glb");
const TMP_ETC = resolve("static/models/winter/_winter-etc.glb");
const TEMPORARIES = [
  TMP_SLIM,
  TMP_SELECTIVE,
  TMP_INSTANCED,
  TMP_PNG,
  TMP_UASTC,
  TMP_ETC,
];
const KEEP_INTERMEDIATES =
  process.env.TKA_KEEP_WINTER_OPTIMIZATION_INTERMEDIATES === "1";
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
const KTX_BIN = resolve(".tools/ktx");
const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";
const ENVIRONMENT = {
  ...process.env,
  PATH: `${KTX_BIN}${PATH_SEPARATOR}${process.env.PATH}`,
};

const CLI_PACKAGE_JSON = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const requireFromCli = createRequire(CLI_PACKAGE_JSON);
const { NodeIO } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))
);
const { compressTexture, instance, simplifyPrimitive } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))
);
const { MeshoptSimplifier } = await import(
  pathToFileURL(requireFromCli.resolve("meshoptimizer"))
);

const EDITABLE_COMPOSER_ROLES = new Set([
  "conifer",
  "rock",
  "deadwood",
  "stump",
  "settlement-seat",
  "settlement-hearth-stone",
  "settlement-hearth-fuel",
  "settlement-hearth-ember",
  "lodge-woodpile-log",
]);

const HERO_GEOMETRY_ROLES = new Set(["settlement-lodge", "settlement-seat"]);

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
    env: ENVIRONMENT,
  });
}

function clean() {
  for (const path of TEMPORARIES) {
    if (existsSync(path)) rmSync(path);
  }
}

function normalizedName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function composerDescriptor(node) {
  const extras = node.getExtras();
  const role =
    typeof extras.tka_role === "string" ? extras.tka_role : undefined;
  const authoredId =
    typeof extras.tka_composer_id === "string"
      ? extras.tka_composer_id
      : undefined;
  if (!authoredId && !role) return null;

  const name = node.getName();
  const id =
    authoredId ||
    `winter:${normalizedName(role)}:${normalizedName(name || "unnamed")}`;
  return {
    id,
    objectKey:
      typeof extras.tka_composer_object_key === "string"
        ? extras.tka_composer_object_key
        : normalizedName(role),
    label: name || role || "Winter scene object",
    locked:
      typeof extras.tka_composer_locked === "boolean"
        ? extras.tka_composer_locked
        : !EDITABLE_COMPOSER_ROLES.has(role),
  };
}

async function createComposerInstanceBatches(input, output) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const descriptorsByMesh = new Map();

  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh || node.getExtension("EXT_mesh_gpu_instancing")) return;
      const descriptors = descriptorsByMesh.get(mesh) ?? [];
      descriptors.push(composerDescriptor(node));
      descriptorsByMesh.set(mesh, descriptors);
    });
  }

  await document.transform(instance({ min: 2 }));

  for (const node of document.getRoot().listNodes()) {
    if (!node.getExtension("EXT_mesh_gpu_instancing")) continue;
    const mesh = node.getMesh();
    const descriptors = mesh ? descriptorsByMesh.get(mesh) : undefined;
    if (
      !descriptors ||
      descriptors.every((descriptor) => descriptor === null)
    ) {
      continue;
    }
    node.setExtras({
      ...node.getExtras(),
      composerInstanceIds: descriptors.map((descriptor) =>
        descriptor ? descriptor.id : null
      ),
      composerInstanceObjectKeys: descriptors.map((descriptor) =>
        descriptor ? descriptor.objectKey : null
      ),
      composerInstanceLabels: descriptors.map((descriptor) =>
        descriptor ? descriptor.label : null
      ),
      composerInstanceLocked: descriptors.map((descriptor) =>
        descriptor ? descriptor.locked : true
      ),
    });
  }

  await io.write(output, document);
}

function meshesForRoles(document, roles) {
  const meshes = new Set();
  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      if (!roles.has(node.getExtras()?.tka_role)) return;
      const mesh = node.getMesh();
      if (mesh) meshes.add(mesh);
    });
  }
  return meshes;
}

async function simplifyBackgroundGeometry(input, output) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const protectedMeshes = meshesForRoles(document, HERO_GEOMETRY_ROLES);
  await MeshoptSimplifier.ready;

  for (const mesh of document.getRoot().listMeshes()) {
    if (protectedMeshes.has(mesh)) continue;
    for (const primitive of mesh.listPrimitives()) {
      simplifyPrimitive(primitive, {
        simplifier: MeshoptSimplifier,
        ratio: 0.1,
        error: 0.05,
      });
    }
  }

  await io.write(output, document);
  console.log(
    `Preserved ${protectedMeshes.size} lodge/chair hero meshes from global simplification.`
  );
}

async function normalizeTextureDelivery(input, output) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const protectedMeshes = meshesForRoles(document, HERO_GEOMETRY_ROLES);
  const protectedMaterials = new Set();
  for (const mesh of protectedMeshes) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (material) protectedMaterials.add(material);
    }
  }

  const detailTextures = new Set();
  const protectedTextures = new Set();
  for (const material of document.getRoot().listMaterials()) {
    const details = [
      material.getNormalTexture(),
      material.getMetallicRoughnessTexture(),
      material.getOcclusionTexture(),
    ].filter(Boolean);
    const colors = [
      material.getBaseColorTexture(),
      material.getEmissiveTexture(),
    ].filter(Boolean);
    for (const texture of details) detailTextures.add(texture);
    if (protectedMaterials.has(material)) {
      for (const texture of [...details, ...colors])
        protectedTextures.add(texture);
    }
  }

  for (const texture of document.getRoot().listTextures()) {
    const isDetail = detailTextures.has(texture);
    const isProtected = protectedTextures.has(texture);
    await compressTexture(texture, {
      encoder: sharp,
      targetFormat: "png",
      resize: isProtected
        ? isDetail
          ? [1024, 1024]
          : [2048, 2048]
        : isDetail
          ? [512, 512]
          : [1024, 1024],
    });
  }

  await io.write(output, document);
  console.log(
    `Preserved ${protectedTextures.size} lodge/chair textures at hero resolution.`
  );
}

if (!existsSync(INPUT)) {
  throw new Error(`Winter source GLB does not exist: ${INPUT}`);
}
if (
  !existsSync(resolve(KTX_BIN, "toktx.exe")) &&
  !existsSync(resolve(KTX_BIN, "toktx"))
) {
  throw new Error(`KTX-Software is missing from ${KTX_BIN}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  run("Deduplicate and preserve linked scenery", [
    "optimize",
    INPUT,
    TMP_SLIM,
    "--compress",
    "false",
    "--texture-compress",
    "false",
    "--simplify",
    "false",
    "--instance",
    "false",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  console.log(
    "\nSimplify background geometry while preserving lodge and chairs"
  );
  await simplifyBackgroundGeometry(TMP_SLIM, TMP_SELECTIVE);
  console.log("\nConvert repeated meshes to ID-preserving GPU instances");
  await createComposerInstanceBatches(TMP_SELECTIVE, TMP_INSTANCED);

  console.log("\nNormalize textures; retain hero lodge/chair resolution");
  await normalizeTextureDelivery(TMP_INSTANCED, TMP_PNG);
  console.log(`PNG intermediate: ${size(TMP_PNG)}`);

  run("Encode normal, metallic-roughness, and occlusion maps as KTX2 UASTC", [
    "uastc",
    TMP_PNG,
    TMP_UASTC,
    "--slots",
    "{normalTexture,metallicRoughnessTexture,occlusionTexture}",
    "--level",
    "4",
    "--zstd",
    "18",
  ]);
  run("Encode color and emissive maps as KTX2 ETC1S", [
    "etc1s",
    TMP_UASTC,
    TMP_ETC,
    "--slots",
    "{baseColorTexture,emissiveTexture}",
    "--quality",
    "200",
  ]);
  run("Apply meshopt geometry compression", ["meshopt", TMP_ETC, OUTPUT]);
} finally {
  if (!KEEP_INTERMEDIATES) clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Winter asset", ["inspect", OUTPUT]);
