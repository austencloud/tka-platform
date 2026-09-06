#!/usr/bin/env node
/**
 * Optimize the authored Blossom amphitheatre for WebGL delivery.
 *
 * The source uses sculpted cherry trees, custom petals and shared grove mesh
 * data. `instance` converts repeated
 * nodes to EXT_mesh_gpu_instancing while preserving named stage and hero-prop
 * nodes. PBR atlases are resized and WebP-compressed before the final meshopt
 * pass so close-range material detail survives without shipping raw sources.
 *
 * Input:  static/models/blossom/blossom_environment_raw.glb
 * Output: static/models/blossom/blossom_environment.glb
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync, statSync } from "fs";
import { resolve } from "path";

const INPUT = resolve("static/models/blossom/blossom_environment_raw.glb");
const OUTPUT = resolve("static/models/blossom/blossom_environment.glb");
const TMP = resolve("static/models/blossom/_tmp_optimized.glb");
const TMP_INSTANCED = resolve("static/models/blossom/_tmp_instanced.glb");
const TMP_PRUNED = resolve("static/models/blossom/_tmp_pruned.glb");
const TEMPORARIES = [TMP, TMP_INSTANCED, TMP_PRUNED];
const STAGE_DECK_TOP = 0.55;
const STAGE_HEIGHT_TOLERANCE = 0.001;

function size(path) {
  return `${(statSync(path).size / 1024).toFixed(1)} KB`;
}

function run(label, command) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit" });
}

function cleanTemporaryFiles() {
  for (const temporary of TEMPORARIES) {
    if (existsSync(temporary)) rmSync(temporary);
  }
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`Not a binary glTF file: ${path}`);
  }
  const jsonLength = buffer.readUInt32LE(12);
  const json = buffer
    .subarray(20, 20 + jsonLength)
    .toString("utf8")
    .replace(/\u0000+$/, "")
    .trimEnd();
  return JSON.parse(json);
}

function worldY(node, point) {
  if (node.matrix) {
    return (
      node.matrix[1] * point[0] +
      node.matrix[5] * point[1] +
      node.matrix[9] * point[2] +
      node.matrix[13]
    );
  }

  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const translationY = node.translation?.[1] ?? 0;
  return (
    2 * (x * y + z * w) * sx * point[0] +
    (1 - 2 * (x * x + z * z)) * sy * point[1] +
    2 * (y * z - x * w) * sz * point[2] +
    translationY
  );
}

function normalizedAccessorValue(accessor, value) {
  if (!accessor.normalized) return value;
  switch (accessor.componentType) {
    case 5120:
      return Math.max(value / 127, -1);
    case 5121:
      return value / 255;
    case 5122:
      return Math.max(value / 32767, -1);
    case 5123:
      return value / 65535;
    default:
      throw new Error(
        `Unsupported normalized component type: ${accessor.componentType}`
      );
  }
}

function verifyStageBounds(path) {
  const gltf = readGlbJson(path);
  const childNodeIndices = new Set(
    gltf.nodes.flatMap((node) => node.children ?? [])
  );
  const stageBounds = new Map();

  gltf.nodes.forEach((node, nodeIndex) => {
    if (!node.name?.startsWith("Stage_") || node.mesh === undefined) return;
    if (childNodeIndices.has(nodeIndex)) {
      throw new Error(
        `Stage bound verification requires a root node: ${node.name}`
      );
    }

    let maximumY = Number.NEGATIVE_INFINITY;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      const minimum = accessor.min.map((value) =>
        normalizedAccessorValue(accessor, value)
      );
      const maximum = accessor.max.map((value) =>
        normalizedAccessorValue(accessor, value)
      );
      for (const localX of [minimum[0], maximum[0]]) {
        for (const localY of [minimum[1], maximum[1]]) {
          for (const localZ of [minimum[2], maximum[2]]) {
            maximumY = Math.max(
              maximumY,
              worldY(node, [localX, localY, localZ])
            );
          }
        }
      }
    }
    stageBounds.set(node.name, maximumY);
  });

  const deckNode = gltf.nodes.find((node) => node.name === "Stage_Planks");
  const deckMaximum = stageBounds.get("Stage_Planks");
  if (deckNode?.extras?.tka_stage_deck_top !== STAGE_DECK_TOP) {
    throw new Error("Stage_Planks is missing its 0.55 deck-height metadata");
  }
  if (Math.abs(deckMaximum - STAGE_DECK_TOP) > STAGE_HEIGHT_TOLERANCE) {
    throw new Error(
      `Stage_Planks max Y must be ${STAGE_DECK_TOP}; got ${deckMaximum}`
    );
  }

  const tooHigh = [...stageBounds].filter(
    ([, maximum]) => maximum > STAGE_DECK_TOP + STAGE_HEIGHT_TOLERANCE
  );
  if (tooHigh.length > 0) {
    throw new Error(
      `Stage geometry exceeds deck height: ${JSON.stringify(tooHigh)}`
    );
  }

  console.log("\n── Verify exported stage bounds (Y-up) ──");
  for (const [name, maximum] of [...stageBounds].sort()) {
    console.log(`  ${name}: max Y=${maximum.toFixed(6)}`);
  }
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  console.error("Run build-blossom-amphitheatre.py first.");
  process.exit(1);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);

cleanTemporaryFiles();
try {
  run(
    "Deduplicate, instance, preserve silhouettes, and compress PBR atlases",
    [
      "npx gltf-transform optimize",
      `"${INPUT}" "${TMP}"`,
      "--compress false",
      "--texture-compress webp",
      "--texture-size 1536",
      // meshoptimizer's error budget is relative to each mesh's own extent, so
      // 0.001 on a thirty-metre path ribbon allowed three and a half centimetres
      // of deviation — more than the whole cross-section. Every walk in the
      // garden came out of this pass as a flat strip of a few dozen triangles
      // with its crown, its edge columns and its per-vertex shading collapsed
      // away, which is a large part of why the paths read as smears rather than
      // surfaces. Blender already authors the real level-of-detail work here
      // (decimate_wood, reduce_foliage_cards, and a baked LOD per grove tier),
      // so this was a second, blind decimation on top of a deliberate one.
      // Turning it off costs about 420k rendered triangles against a 4.2M cap
      // and returns the authored geometry intact.
      "--simplify false",
      "--instance true",
      "--flatten false",
      "--join false",
      // The palette pass folds flat-colour materials into one atlas material.
      // It rewrote the river into a material with an emissive factor of pure
      // white, so the water shipped as a glowing white sheet on every tier that
      // renders the baked ribbon. Authored PBR factors are the contract between
      // the Blender build and the scene; a draw-call saving is not worth losing
      // them.
      "--palette false",
    ].join(" ")
  );

  run(
    "GPU-instance repeated authored asset families",
    `npx gltf-transform instance "${TMP}" "${TMP_INSTANCED}" --min 2`
  );
  run(
    "Prune accessors orphaned by instancing",
    `npx gltf-transform prune "${TMP_INSTANCED}" "${TMP_PRUNED}"`
  );
  run(
    "Meshopt geometry compression",
    `npx gltf-transform meshopt "${TMP_PRUNED}" "${OUTPUT}"`
  );
} finally {
  cleanTemporaryFiles();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
verifyStageBounds(OUTPUT);
run(
  "Inspect optimized Blossom asset",
  `npx gltf-transform inspect "${OUTPUT}"`
);
