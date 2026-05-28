// measure-ocean-models.cjs
// Loads each ocean GLB, measures raw geometry bounds, and reports
// what the normalization pipeline will produce.
// Run: node scripts/measure-ocean-models.cjs

const fs = require("fs");
const path = require("path");

// We can't use three.js GLTFLoader in Node without a full WebGL context.
// Instead, parse the GLB binary to extract accessor min/max from the JSON chunk.
// GLB format: 12-byte header, then chunks. First chunk = JSON.

const MODEL_PATHS = {
  "meshy-staghorn-coral": "static/models/ocean/meshy/staghorn_coral.glb",
  "meshy-brain-coral": "static/models/ocean/meshy/brain_coral.glb",
  "meshy-fan-coral": "static/models/ocean/meshy/fan_coral.glb",
  "meshy-table-coral": "static/models/ocean/meshy/table_coral.glb",
  "meshy-kelp": "static/models/ocean/meshy/kelp.glb",
  "meshy-tall-kelp": "static/models/ocean/meshy/tall_kelp.glb",
  "meshy-sea-grass": "static/models/ocean/meshy/sea_grass.glb",
  "kelp-plant": "static/models/ocean/kelp_plant.glb",
  "starfish": "static/models/ocean/starfish.glb",
  "sea-urchin": "static/models/ocean/sea_urchin.glb",
  "shell": "static/models/ocean/shell.glb",
  "anemone": "static/models/ocean/anemone.glb",
  "rock-0": "static/models/ocean/rock_0.glb",
  "rock-1": "static/models/ocean/rock_1.glb",
  "rock-2": "static/models/ocean/rock_2.glb",
  "rock-3": "static/models/ocean/rock_3.glb",
  "rock-4": "static/models/ocean/rock_4.glb",
  "rock-5": "static/models/ocean/rock_5.glb",
  "meshy-basalt-pinnacle": "static/models/ocean/meshy/basalt_pinnacle.glb",
  "meshy-coral-encrusted-rock": "static/models/ocean/meshy/coral_encrusted_rock.glb",
  "meshy-coral-mountain": "static/models/ocean/meshy/coral_mountain.glb",
  "meshy-neon-coral-summit": "static/models/ocean/meshy/neon_coral_summit.glb",
  "meshy-submerged-coral-citadel": "static/models/ocean/meshy/submerged_coral_citadel.glb",
  "meshy-sunlit-coral-arch": "static/models/ocean/meshy/sunlit_coral_arch.glb",
  "meshy-underwater-coral-arch": "static/models/ocean/meshy/underwater_coral_arch.glb",
  "meshy-underwater-rock-table": "static/models/ocean/meshy/underwater_rock_table.glb",
  "meshy-photorealistic-coral-0": "static/models/ocean/meshy/photorealistic_coral_0.glb",
  "meshy-photorealistic-coral-1": "static/models/ocean/meshy/photorealistic_coral_1.glb",
  "meshy-photorealistic-coral-2": "static/models/ocean/meshy/photorealistic_coral_2.glb",
  "meshy-photorealistic-coral-3": "static/models/ocean/meshy/photorealistic_coral_3.glb",
  "struct-coral-arch": "static/models/ocean/structures/coral-arch.glb",
  "struct-coral-bommie": "static/models/ocean/structures/coral-bommie.glb",
  "struct-coral-tower": "static/models/ocean/structures/coral-tower.glb",
  "struct-reef-wall": "static/models/ocean/structures/reef-wall.glb",
  "ph-boulder-01": "static/models/ocean/polyhaven/boulder_01.glb",
  "ph-rock-07": "static/models/ocean/polyhaven/rock_07.glb",
  "ph-stone-01": "static/models/ocean/polyhaven/stone_01.glb",
  "ph-sand-rocks": "static/models/ocean/polyhaven/sand_rocks_small_01.glb",
  "ph-coast-rocks-05": "static/models/ocean/polyhaven/coast_rocks_05.glb",
};

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  // GLB header: magic(4) + version(4) + length(4) = 12 bytes
  // Chunk 0: chunkLength(4) + chunkType(4) + chunkData(chunkLength)
  const chunkLength = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4E4F534A) { // "JSON"
    throw new Error(`Expected JSON chunk, got 0x${chunkType.toString(16)}`);
  }
  const jsonStr = buf.toString("utf-8", 20, 20 + chunkLength);
  return JSON.parse(jsonStr);
}

// INT16 normalization factor for KHR_mesh_quantization
const INT16_MAX = 32767;

function getModelBounds(gltf) {
  const accessors = gltf.accessors || [];
  const meshes = gltf.meshes || [];
  const nodes = gltf.nodes || [];

  let globalMin = [Infinity, Infinity, Infinity];
  let globalMax = [-Infinity, -Infinity, -Infinity];
  let hasQuantization = false;

  const extensionsUsed = gltf.extensionsUsed || [];
  if (extensionsUsed.includes("KHR_mesh_quantization")) {
    hasQuantization = true;
  }

  for (const mesh of meshes) {
    for (const prim of mesh.primitives || []) {
      const posIdx = prim.attributes?.POSITION;
      if (posIdx === undefined) continue;
      const acc = accessors[posIdx];
      if (!acc || !acc.min || !acc.max) continue;

      // If quantized (componentType 5122 = SHORT, normalized: true),
      // the GPU divides by 32767 to get [-1, 1].
      // Three.js getX/getY/getZ do this automatically.
      let scale = 1.0;
      if (acc.normalized && (acc.componentType === 5122 || acc.componentType === 5120)) {
        scale = 1.0 / INT16_MAX;
      }

      for (let i = 0; i < 3; i++) {
        const lo = acc.min[i] * scale;
        const hi = acc.max[i] * scale;
        if (lo < globalMin[i]) globalMin[i] = lo;
        if (hi > globalMax[i]) globalMax[i] = hi;
      }
    }
  }

  // Accumulate node transforms (scale + translation) for mesh nodes
  // In practice, most Meshy models have identity node transforms,
  // but some PolyHaven/Sketchfab models have scene-level scale.
  // Walk the node tree to find world transforms for mesh-bearing nodes.
  const worldTransforms = [];

  function walkNode(nodeIdx, parentScale, parentTranslation) {
    const node = nodes[nodeIdx];
    if (!node) return;

    const s = node.scale || [1, 1, 1];
    const t = node.translation || [0, 0, 0];
    const worldScale = [parentScale[0] * s[0], parentScale[1] * s[1], parentScale[2] * s[2]];
    const worldTrans = [
      parentTranslation[0] + t[0] * parentScale[0],
      parentTranslation[1] + t[1] * parentScale[1],
      parentTranslation[2] + t[2] * parentScale[2],
    ];

    if (node.mesh !== undefined) {
      worldTransforms.push({ scale: worldScale, translation: worldTrans });
    }

    for (const child of node.children || []) {
      walkNode(child, worldScale, worldTrans);
    }
  }

  const scenes = gltf.scenes || [];
  const defaultScene = scenes[gltf.scene || 0] || {};
  for (const rootIdx of defaultScene.nodes || []) {
    walkNode(rootIdx, [1, 1, 1], [0, 0, 0]);
  }

  // Use the first mesh node's world scale (most models have one mesh)
  const ws = worldTransforms.length > 0 ? worldTransforms[0].scale : [1, 1, 1];

  const sizeX = (globalMax[0] - globalMin[0]) * Math.abs(ws[0]);
  const sizeY = (globalMax[1] - globalMin[1]) * Math.abs(ws[1]);
  const sizeZ = (globalMax[2] - globalMin[2]) * Math.abs(ws[2]);

  return {
    rawMin: globalMin,
    rawMax: globalMax,
    nodeScale: ws,
    sizeX,
    sizeY,
    sizeZ,
    maxExtent: Math.max(sizeX, sizeY, sizeZ),
    hasQuantization,
    accessorNormalized: hasQuantization,
  };
}

console.log("Model measurement report");
console.log("========================\n");
console.log("objectKey".padEnd(35), "rawX".padStart(10), "rawY".padStart(10), "rawZ".padStart(10), "maxExt".padStart(10), "1/maxExt".padStart(10), "quant?".padStart(8));
console.log("-".repeat(103));

const results = {};

for (const [key, relPath] of Object.entries(MODEL_PATHS)) {
  const fullPath = path.join(__dirname, "..", relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(key.padEnd(35), "FILE MISSING");
    continue;
  }

  try {
    const gltf = parseGlbJson(fullPath);
    const bounds = getModelBounds(gltf);
    results[key] = bounds;

    console.log(
      key.padEnd(35),
      bounds.sizeX.toFixed(3).padStart(10),
      bounds.sizeY.toFixed(3).padStart(10),
      bounds.sizeZ.toFixed(3).padStart(10),
      bounds.maxExtent.toFixed(3).padStart(10),
      (1 / bounds.maxExtent).toFixed(4).padStart(10),
      (bounds.hasQuantization ? "YES" : "no").padStart(8),
    );
  } catch (e) {
    console.log(key.padEnd(35), `ERROR: ${e.message}`);
  }
}

// Now show what placement scale * normalization produces for representative entries
console.log("\n\nPlacement scale analysis (sample entries)");
console.log("==========================================\n");
console.log(
  "objectKey".padEnd(35),
  "placScale".padStart(10),
  "maxExt".padStart(10),
  "normFactor".padStart(10),
  "finalSize(m)".padStart(12),
);
console.log("-".repeat(87));

// Read a few placement entries to spot-check
const samplePlacements = [
  { key: "meshy-submerged-coral-citadel", scale: 3.51 },
  { key: "meshy-basalt-pinnacle", scale: 2.53 },
  { key: "meshy-coral-mountain", scale: 3.22 },
  { key: "struct-coral-tower", scale: 5.0 },
  { key: "struct-reef-wall", scale: 6.0 },
  { key: "rock-0", scale: 2.5 },
  { key: "rock-3", scale: 0.15 },
  { key: "meshy-kelp", scale: 4.5 },
  { key: "meshy-staghorn-coral", scale: 0.75 },
  { key: "starfish", scale: 0.3 },
  { key: "shell", scale: 0.2 },
];

for (const sp of samplePlacements) {
  const bounds = results[sp.key];
  if (!bounds) continue;
  const normFactor = 1 / bounds.maxExtent;
  const finalSize = sp.scale; // after normalization, placement scale = world meters
  console.log(
    sp.key.padEnd(35),
    sp.scale.toFixed(2).padStart(10),
    bounds.maxExtent.toFixed(3).padStart(10),
    normFactor.toFixed(4).padStart(10),
    finalSize.toFixed(2).padStart(12),
  );
}

console.log("\n\nKey insight: after 1/maxExtent normalization, the model fits in a 1×1×1 cube.");
console.log("Placement scale then directly = world-space meters (largest dimension).");
console.log("A citadel at scale 3.51 = 3.51m across its widest axis.");
console.log("Performer height ~1.5m. So citadel = ~2.3x performer height.");
console.log("Blender reference shows structures 10-20x performer height = 15-30m.");
console.log("Gap: placement scales are too small for the Blender reference.");
