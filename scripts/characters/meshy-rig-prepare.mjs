/**
 * Make a Meshy auto-rigged GLB look like the rigs the intake already accepts.
 *
 * Two things differ from the Mixamo/Unreal exports the pipeline was built on,
 * both observed on 2026-09-05 output from Meshy 7 + the rigging API:
 *
 *   1. The spine chain is named from the chest down: Hips -> Spine02 ->
 *      Spine01 -> Spine -> neck -> Head. The runtime expects Hips -> Spine ->
 *      Spine1 -> Spine2 -> Neck, so the three bones are renamed by their place
 *      in the hierarchy, never by their label.
 *   2. The rigged export keeps only the base colour, then wires that same
 *      image in as a full-strength emissive and overdrives specular through
 *      KHR_materials_specular. The unrigged refine that fed the rigger carries
 *      the normal and metallic-roughness maps on the same UV atlas (the rigger
 *      reorders vertices but keeps every UV), so those images are carried
 *      across and the emissive and specular overrides are dropped.
 *
 * Usage: node --import tsx scripts/characters/meshy-rig-prepare.mjs <rigged.glb> <unrigged.glb> [output.glb]
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { serializeGlb } from "./character-glb.mjs";

const require = createRequire(import.meta.url);
const { parseGlb } = require("../lib/glb-measure.cjs");

const SPINE_CANONICAL = ["Spine", "Spine1", "Spine2"];
const MESHY_MATERIAL_EXTENSIONS = [
  "KHR_materials_specular",
  "KHR_materials_ior",
];

/**
 * Rename the spine bones between Hips and the neck by hierarchy order.
 * Returns the list of changes; an already canonical rig returns none.
 */
export function canonicalizeMeshySpine(document) {
  const nodes = document.nodes ?? [];
  const hipsIndex = nodes.findIndex((node) => node.name === "Hips");
  if (hipsIndex < 0) return [];
  const changes = [];

  const chain = [];
  let cursor = (nodes[hipsIndex].children ?? []).find((child) =>
    /^spine/i.test(nodes[child]?.name ?? "")
  );
  while (cursor !== undefined && /^spine/i.test(nodes[cursor].name ?? "")) {
    chain.push(cursor);
    cursor = (nodes[cursor].children ?? []).find((child) =>
      /^(spine|neck)/i.test(nodes[child]?.name ?? "")
    );
  }
  if (chain.length !== SPINE_CANONICAL.length) {
    throw new Error(
      `Expected ${SPINE_CANONICAL.length} spine bones between Hips and the neck, found ${chain.length}`
    );
  }
  chain.forEach((index, position) => {
    const canonical = SPINE_CANONICAL[position];
    if (nodes[index].name === canonical) return;
    changes.push({ index, from: nodes[index].name, to: canonical });
    nodes[index].name = canonical;
  });

  if (cursor !== undefined && nodes[cursor].name !== "Neck") {
    changes.push({ index: cursor, from: nodes[cursor].name, to: "Neck" });
    nodes[cursor].name = "Neck";
  }
  return changes;
}

function imageBytes(glb, imageIndex) {
  const image = glb.document.images?.[imageIndex];
  const view = glb.document.bufferViews?.[image?.bufferView];
  if (!image || !view) return null;
  const offset = view.byteOffset ?? 0;
  return {
    mimeType: image.mimeType,
    bytes: glb.binary.subarray(offset, offset + view.byteLength),
  };
}

function textureImageIndex(document, textureInfo) {
  if (!textureInfo) return null;
  const texture = document.textures?.[textureInfo.index];
  return typeof texture?.source === "number" ? texture.source : null;
}

/** Append an image to the binary chunk and return the new texture index. */
function appendTexture(document, chunks, state, { mimeType, bytes }, name) {
  const padded = Buffer.concat([
    bytes,
    Buffer.alloc((4 - (bytes.length % 4)) % 4),
  ]);
  document.bufferViews ??= [];
  document.images ??= [];
  document.textures ??= [];
  document.bufferViews.push({
    buffer: 0,
    byteOffset: state.offset,
    byteLength: bytes.length,
  });
  chunks.push(padded);
  state.offset += padded.length;
  document.images.push({
    name,
    mimeType,
    bufferView: document.bufferViews.length - 1,
  });
  document.textures.push({
    sampler: document.samplers?.length ? 0 : undefined,
    source: document.images.length - 1,
  });
  return document.textures.length - 1;
}

/**
 * Carry the refine's normal and metallic-roughness maps onto every rigged
 * material and strip the emissive/specular overrides the rigger added.
 */
export function transplantRefineMaterials(rigged, unrigged) {
  const sourceMaterial = unrigged.document.materials?.[0];
  if (!sourceMaterial) throw new Error("Unrigged refine has no material");
  const normal = imageBytes(
    unrigged,
    textureImageIndex(unrigged.document, sourceMaterial.normalTexture)
  );
  const metallicRoughness = imageBytes(
    unrigged,
    textureImageIndex(
      unrigged.document,
      sourceMaterial.pbrMetallicRoughness?.metallicRoughnessTexture
    )
  );
  if (!normal || !metallicRoughness) {
    throw new Error(
      "Unrigged refine is missing its normal or metallic-roughness map"
    );
  }

  const document = rigged.document;
  const chunks = [rigged.binary];
  const state = { offset: rigged.binary.length };
  const padding = (4 - (state.offset % 4)) % 4;
  if (padding > 0) {
    chunks.push(Buffer.alloc(padding));
    state.offset += padding;
  }
  const normalIndex = appendTexture(document, chunks, state, normal, "normal");
  const roughnessIndex = appendTexture(
    document,
    chunks,
    state,
    metallicRoughness,
    "metallic_roughness"
  );

  const summary = { materials: 0, emissiveRemoved: 0, extensionsRemoved: 0 };
  for (const material of document.materials ?? []) {
    summary.materials += 1;
    material.pbrMetallicRoughness ??= {};
    material.normalTexture = { index: normalIndex };
    material.pbrMetallicRoughness.metallicRoughnessTexture = {
      index: roughnessIndex,
    };
    if (material.emissiveTexture || material.emissiveFactor) {
      delete material.emissiveTexture;
      delete material.emissiveFactor;
      summary.emissiveRemoved += 1;
    }
    for (const extension of MESHY_MATERIAL_EXTENSIONS) {
      if (material.extensions?.[extension]) {
        delete material.extensions[extension];
        summary.extensionsRemoved += 1;
      }
    }
    if (material.extensions && Object.keys(material.extensions).length === 0) {
      delete material.extensions;
    }
  }
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    if (!Array.isArray(document[key])) continue;
    document[key] = document[key].filter(
      (name) => !MESHY_MATERIAL_EXTENSIONS.includes(name)
    );
    if (document[key].length === 0) delete document[key];
  }

  const binary = Buffer.concat(chunks);
  if (document.buffers?.[0]) document.buffers[0].byteLength = binary.length;
  return { binary, summary };
}

export function prepareMeshyRig({ riggedPath, unriggedPath, outputPath }) {
  const rigged = parseGlb(resolve(riggedPath));
  const unrigged = parseGlb(resolve(unriggedPath));
  const jointChanges = canonicalizeMeshySpine(rigged.document);
  const { binary, summary } = transplantRefineMaterials(rigged, unrigged);
  writeFileSync(
    resolve(outputPath ?? riggedPath),
    serializeGlb(rigged.document, binary)
  );
  return { jointChanges, ...summary };
}

function main() {
  const [riggedPath, unriggedPath, outputPath] = process.argv
    .slice(2)
    .filter((argument) => argument !== "--");
  if (!riggedPath || !unriggedPath) {
    console.error(
      "Usage: meshy-rig-prepare.mjs <rigged.glb> <unrigged.glb> [output.glb]"
    );
    process.exitCode = 1;
    return;
  }
  const result = prepareMeshyRig({ riggedPath, unriggedPath, outputPath });
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
