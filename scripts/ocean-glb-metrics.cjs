//
// One owner for "what are this GLB's bounds". Extracted from
// measure-ocean-models.cjs so measure-ocean-assets.cjs can consume the same
// parser instead of writing a second one.
//
// Reads only the GLB's JSON chunk. Position accessors carry min/max per the
// glTF spec, so bounds need no geometry decode and no WebGL context.
//
// Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md

const fs = require("fs");

// KHR_mesh_quantization stores positions as normalized SHORT/BYTE; the GPU
// divides by the type max to recover [-1, 1].
const INT16_MAX = 32767;
const INT8_MAX = 127;

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  const chunkLength = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) {
    throw new Error(`Expected JSON chunk, got 0x${chunkType.toString(16)}`);
  }
  return JSON.parse(buf.toString("utf-8", 20, 20 + chunkLength));
}

function accessorScale(acc) {
  if (!acc.normalized) return 1;
  if (acc.componentType === 5122) return 1 / INT16_MAX; // SHORT
  if (acc.componentType === 5120) return 1 / INT8_MAX; // BYTE
  return 1;
}

/**
 * Walks the default scene and returns, per mesh-bearing node, its world scale
 * and translation. Rotation is ignored deliberately: an axis-aligned bound
 * through an arbitrary rotation is not meaningfully tighter than the untilted
 * one, and every ocean asset in the index is exported axis-aligned.
 */
function meshNodeTransforms(gltf) {
  const nodes = gltf.nodes || [];
  const out = [];

  function walk(index, parentScale, parentTranslation) {
    const node = nodes[index];
    if (!node) return;
    const s = node.scale || [1, 1, 1];
    const t = node.translation || [0, 0, 0];
    const scale = [
      parentScale[0] * s[0],
      parentScale[1] * s[1],
      parentScale[2] * s[2],
    ];
    const translation = [
      parentTranslation[0] + t[0] * parentScale[0],
      parentTranslation[1] + t[1] * parentScale[1],
      parentTranslation[2] + t[2] * parentScale[2],
    ];
    if (node.mesh !== undefined) out.push({ mesh: node.mesh, scale, translation });
    for (const child of node.children || []) walk(child, scale, translation);
  }

  const scenes = gltf.scenes || [];
  const scene = scenes[gltf.scene || 0] || {};
  for (const root of scene.nodes || []) walk(root, [1, 1, 1], [0, 0, 0]);
  return out;
}

/**
 * World-space bounds, vertex count and a geometry signature.
 *
 * Unlike the older inline version this applies each mesh node's own transform
 * rather than assuming the first one speaks for the file — several polyhaven
 * assets carry a scene-level scale on a child node.
 */
function measureGlb(filePath) {
  const gltf = parseGlbJson(filePath);
  const accessors = gltf.accessors || [];
  const meshes = gltf.meshes || [];
  const transforms = meshNodeTransforms(gltf);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0;

  // A GLB with no scene graph (rare, but Meshy has produced them) still has
  // meshes worth measuring; treat them as identity-transformed.
  const placements = transforms.length
    ? transforms
    : meshes.map((_, i) => ({ mesh: i, scale: [1, 1, 1], translation: [0, 0, 0] }));

  for (const placement of placements) {
    const mesh = meshes[placement.mesh];
    if (!mesh) continue;
    for (const prim of mesh.primitives || []) {
      const index = prim.attributes?.POSITION;
      if (index === undefined) continue;
      const acc = accessors[index];
      if (!acc || !acc.min || !acc.max) continue;
      vertices += acc.count || 0;
      const q = accessorScale(acc);
      for (let axis = 0; axis < 3; axis++) {
        const a = acc.min[axis] * q * placement.scale[axis] + placement.translation[axis];
        const b = acc.max[axis] * q * placement.scale[axis] + placement.translation[axis];
        min[axis] = Math.min(min[axis], a, b);
        max[axis] = Math.max(max[axis], a, b);
      }
    }
  }

  if (!Number.isFinite(min[0])) {
    throw new Error(`No position accessors with bounds in ${filePath}`);
  }

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxExtent = Math.max(...size);

  return {
    min,
    max,
    size,
    maxExtent,
    vertices,
    quantized: (gltf.extensionsUsed || []).includes("KHR_mesh_quantization"),
    // Ratios against the longest axis, so the signature survives the
    // normalize-to-unit-extent step the runtime applies at import. Three
    // decimals is loose enough to absorb float drift and tight enough that two
    // different assets do not collide.
    ratio: size.map((s) => Number((s / maxExtent).toFixed(3))),
  };
}

module.exports = { parseGlbJson, meshNodeTransforms, measureGlb };
