#!/usr/bin/env node
/** Verify the production Autumn GLB's delivery and geometry contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTUMN_DEPTH_MATERIAL_GRADES } from "./autumn-depth-material-grades.mjs";
import { AUTUMN_HERO_MATERIAL_GRADES } from "./autumn-hero-material-grades.mjs";

const glbPath = resolve("static/models/autumn/autumn-environment.glb");
const groundDetailPath = resolve(
  "static/textures/autumn-floor/ground-detail-modulation.ktx2"
);
const maximumBytes = 20 * 1024 * 1024;
const maximumFernTriangles = 8_000;
const maximumRenderedTriangles = 2_200_000;
const expectedFernInstances = 54;
const expectedGroundTextureSize = 2_048;
const expectedGroundDetailSize = 1_024;
const treeGroundingStrategy = "bounded-central-root-plate-v2";
const maximumTreeGroundingDepth = 0.76;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  invariant(buffer.length >= 20, "GLB is too short to contain a valid header");
  invariant(buffer.readUInt32LE(0) === 0x46546c67, "GLB magic is invalid");
  invariant(buffer.readUInt32LE(4) === 2, "GLB must use glTF 2.0");
  invariant(
    buffer.readUInt32LE(8) === buffer.length,
    "GLB header length is invalid"
  );
  const jsonLength = buffer.readUInt32LE(12);
  const binaryHeaderOffset = 20 + jsonLength;
  invariant(
    buffer.readUInt32LE(binaryHeaderOffset + 4) === 0x004e4942,
    "GLB binary chunk is missing"
  );
  return {
    bytes: buffer.length,
    buffer,
    binaryOffset: binaryHeaderOffset + 8,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

function primitiveTriangles(gltf, primitive) {
  invariant(
    primitive.mode == null || primitive.mode === 4,
    `Unsupported primitive mode: ${primitive.mode}`
  );
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
  invariant(Number.isInteger(accessorIndex), "Primitive lost its vertex data");
  return Number(gltf.accessors[accessorIndex].count) / 3;
}

function meshTriangles(gltf, meshIndex) {
  const mesh = gltf.meshes[meshIndex];
  return mesh.primitives.reduce(
    (total, primitive) => total + primitiveTriangles(gltf, primitive),
    0
  );
}

function instanceCount(gltf, node) {
  const attributes =
    node.extensions?.EXT_mesh_gpu_instancing?.attributes ?? null;
  if (!attributes) return 1;
  const accessorIndex = Object.values(attributes)[0];
  invariant(
    Number.isInteger(accessorIndex),
    "Instancing node lost its transform accessor"
  );
  return Number(gltf.accessors[accessorIndex].count);
}

function meshUsesMaterial(gltf, meshIndex, prefix) {
  return gltf.meshes[meshIndex].primitives.some((primitive) =>
    String(gltf.materials[primitive.material]?.name ?? "").startsWith(prefix)
  );
}

function textureImage(gltf, texture) {
  const imageIndex =
    texture.extensions?.KHR_texture_basisu?.source ?? texture.source;
  invariant(Number.isInteger(imageIndex), "Texture lost its image source");
  return gltf.images[imageIndex];
}

function ktx2Dimensions(buffer, binaryOffset, gltf, image) {
  invariant(image.mimeType === "image/ktx2", `${image.name} is not KTX2`);
  const view = gltf.bufferViews[image.bufferView];
  invariant(view, `${image.name} lost its buffer view`);
  const start = binaryOffset + (view.byteOffset ?? 0);
  const identifier = buffer.subarray(start, start + 12).toString("hex");
  invariant(
    identifier === "ab4b5458203230bb0d0a1a0a",
    `${image.name} has an invalid KTX2 identifier`
  );
  return {
    width: buffer.readUInt32LE(start + 20),
    height: buffer.readUInt32LE(start + 24),
  };
}

function standaloneKtx2Dimensions(path) {
  const buffer = readFileSync(path);
  invariant(
    buffer.subarray(0, 12).toString("hex") === "ab4b5458203230bb0d0a1a0a",
    "Autumn ground detail has an invalid KTX2 identifier"
  );
  return {
    width: buffer.readUInt32LE(20),
    height: buffer.readUInt32LE(24),
    bytes: buffer.length,
  };
}

const { bytes, buffer, binaryOffset, json: gltf } = readGlbJson(glbPath);
const extensions = new Set(gltf.extensionsUsed ?? []);
const meshNodes = (gltf.nodes ?? []).filter((node) =>
  Number.isInteger(node.mesh)
);
const fernNodes = meshNodes.filter((node) =>
  meshUsesMaterial(gltf, node.mesh, "Autumn Fern PBR")
);
const terrainNode = meshNodes.find((node) => node.name === "Autumn_Terrain");
const terrainApronNode = meshNodes.find(
  (node) => node.name === "Autumn_Terrain_Apron"
);
const benchNode = meshNodes.find(
  (node) => node.name === "Autumn_Rough_Bench_Seat"
);
const stumpNodes = meshNodes.filter((node) =>
  /^Autumn_Stump_Seat_\d+$/.test(node.name ?? "")
);
const owlTreeNode = meshNodes.find((node) => node.name === "HeroTreeA_03_0");
const groundMaterial = (gltf.materials ?? []).find(
  (material) => material.name === "Autumn Living Forest Floor"
);
const importedTreeMaterialPrefixes = [
  ...Object.values(AUTUMN_HERO_MATERIAL_GRADES),
  ...Object.values(AUTUMN_DEPTH_MATERIAL_GRADES),
].map((profile) => profile.prefix);
const importedTreeMaterialMatches = Object.fromEntries(
  importedTreeMaterialPrefixes.map((prefix) => [
    prefix,
    (gltf.materials ?? [])
      .map((material) => material.name ?? "")
      .filter((name) => name.startsWith(prefix)),
  ])
);

invariant(terrainNode, "Autumn terrain node is missing");
invariant(terrainApronNode, "Autumn terrain horizon apron is missing");
invariant(owlTreeNode, "Owl tree node HeroTreeA_03_0 is missing");
invariant(groundMaterial, "Autumn living forest floor material is missing");
for (const prefix of importedTreeMaterialPrefixes) {
  invariant(
    importedTreeMaterialMatches[prefix].length > 0,
    `Optimized Autumn GLB lost material family ${prefix}`
  );
}
const groundTextureIndex =
  groundMaterial.pbrMetallicRoughness?.baseColorTexture?.index;
invariant(
  Number.isInteger(groundTextureIndex),
  "Ground base-color texture is missing"
);
const groundImage = textureImage(gltf, gltf.textures[groundTextureIndex]);
const groundTextureDimensions = ktx2Dimensions(
  buffer,
  binaryOffset,
  gltf,
  groundImage
);
const groundDetailDimensions = standaloneKtx2Dimensions(groundDetailPath);

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
for (const extension of [
  "EXT_mesh_gpu_instancing",
  "EXT_meshopt_compression",
  "KHR_mesh_quantization",
  "KHR_texture_basisu",
]) {
  invariant(extensions.has(extension), `Autumn GLB lost ${extension}`);
}
invariant(
  fernNodes.length === 1,
  `Expected one instanced fern batch, found ${fernNodes.length}`
);
invariant(
  terrainNode.extras?.tka_ground_treatment === "baked-living-floor",
  "Terrain lost its baked living-floor contract"
);
invariant(
  terrainNode.extras?.tka_camera_collision === true,
  "Terrain lost its camera-collision contract"
);
invariant(
  terrainApronNode.extras?.tka_ground_treatment ===
    "fog-dissolved-rolling-horizon",
  "Terrain apron regressed to a flat or unauthored horizon"
);
invariant(
  terrainApronNode.extras?.tka_camera_collision === true,
  "Terrain horizon lost its camera-collision contract"
);
invariant(
  meshTriangles(gltf, terrainApronNode.mesh) >= 3_500,
  "Terrain horizon lost the authored rolling-ring topology"
);
invariant(
  groundMaterial.pbrMetallicRoughness.baseColorTexture.texCoord === 1,
  "Ground macro color must use TEXCOORD_1"
);
invariant(
  groundMaterial.normalTexture?.texCoord == null ||
    groundMaterial.normalTexture.texCoord === 0,
  "Ground normal detail must use TEXCOORD_0"
);
invariant(
  groundTextureDimensions.width === expectedGroundTextureSize &&
    groundTextureDimensions.height === expectedGroundTextureSize,
  `Ground atlas must remain ${expectedGroundTextureSize}px, found ${groundTextureDimensions.width}x${groundTextureDimensions.height}`
);
invariant(
  groundDetailDimensions.width === expectedGroundDetailSize &&
    groundDetailDimensions.height === expectedGroundDetailSize,
  `Ground detail must remain ${expectedGroundDetailSize}px, found ${groundDetailDimensions.width}x${groundDetailDimensions.height}`
);
invariant(
  owlTreeNode.extras?.tka_grounding_strategy === treeGroundingStrategy,
  "Owl tree lost its bounded central root-plate grounding proof"
);
invariant(
  Number(owlTreeNode.extras?.tka_root_contact_samples) >= 4,
  "Owl tree grounding proof has too few root-contact samples"
);
invariant(
  Number(owlTreeNode.extras?.tka_root_contact_fraction) >= 0.5,
  "Owl tree central root plate has insufficient terrain contact"
);
invariant(
  Number(owlTreeNode.extras?.tka_root_central_clearance_after) <= 0.002,
  "Owl tree central root plate still clears terrain"
);
invariant(
  Number(owlTreeNode.extras?.tka_grounding_depth) <= maximumTreeGroundingDepth,
  "Owl tree exceeded the root-visibility burial cap"
);

invariant(
  benchNode?.extras?.tka_prop_language === "irregular-split-log",
  "Bench regressed to a box primitive"
);
invariant(
  stumpNodes.length === 2 &&
    stumpNodes.every(
      (node) => node.extras?.tka_prop_language === "root-flared-hewn-stump"
    ),
  "Stump seats regressed to cone primitives"
);

const fernNode = fernNodes[0];
const fernTriangles = meshTriangles(gltf, fernNode.mesh);
const fernInstances = instanceCount(gltf, fernNode);
const renderedTriangles = meshNodes.reduce(
  (total, node) =>
    total + meshTriangles(gltf, node.mesh) * instanceCount(gltf, node),
  0
);
const uncompressedTextures = (gltf.textures ?? [])
  .map((texture, index) => ({ index, image: textureImage(gltf, texture) }))
  .filter(({ image }) => image.mimeType !== "image/ktx2");
const farBotanicalExpectations = new Map([
  ["Autumn Hero A PBR", 16],
  ["Autumn Willow PBR", 15],
  ["Autumn Larch PBR", 15],
  ["Autumn Snag PBR", 7],
]);
const farBotanicalNodes = meshNodes.filter((node) => {
  const triangles = meshTriangles(gltf, node.mesh);
  if (triangles > 2_800 || !node.extensions?.EXT_mesh_gpu_instancing) {
    return false;
  }
  return gltf.meshes[node.mesh].primitives.some((primitive) =>
    farBotanicalExpectations.has(gltf.materials[primitive.material]?.name ?? "")
  );
});
const farBotanicalProof = Object.fromEntries(
  farBotanicalNodes.map((node) => {
    const materialName =
      gltf.materials[gltf.meshes[node.mesh].primitives[0].material]?.name;
    return [
      materialName,
      {
        instances: instanceCount(gltf, node),
        triangles: meshTriangles(gltf, node.mesh),
      },
    ];
  })
);
for (const [materialName, expectedInstances] of farBotanicalExpectations) {
  invariant(
    farBotanicalProof[materialName]?.instances === expectedInstances,
    `Far botanical ${materialName} expected ${expectedInstances} instances`
  );
}
invariant(
  !(gltf.materials ?? []).some((material) =>
    String(material.name ?? "").startsWith("Far Autumn")
  ),
  "Autumn retained the flat-shaded procedural far-tree material family"
);

invariant(
  fernTriangles <= maximumFernTriangles,
  `Fern source has ${fernTriangles.toLocaleString()} triangles; maximum is ${maximumFernTriangles.toLocaleString()}`
);
invariant(
  fernInstances === expectedFernInstances,
  `Expected ${expectedFernInstances} fern instances, found ${fernInstances}`
);
invariant(
  renderedTriangles <= maximumRenderedTriangles,
  `Autumn renders ${renderedTriangles.toLocaleString()} source triangles; maximum is ${maximumRenderedTriangles.toLocaleString()}`
);
invariant(
  uncompressedTextures.length === 0,
  `Autumn GLB contains non-KTX2 textures: ${uncompressedTextures
    .map(({ index, image }) => `${index}:${image.name ?? image.mimeType}`)
    .join(", ")}`
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      extensions: [...extensions],
      meshes: gltf.meshes?.length ?? 0,
      nodes: gltf.nodes?.length ?? 0,
      textures: gltf.textures?.length ?? 0,
      importedTreeMaterialMatches,
      ground: {
        treatment: terrainNode.extras.tka_ground_treatment,
        texture: groundImage.name,
        dimensions: groundTextureDimensions,
        colorTexCoord:
          groundMaterial.pbrMetallicRoughness.baseColorTexture.texCoord,
        detailTexCoord: groundMaterial.normalTexture?.texCoord ?? 0,
        tiledColorDetail: {
          path: groundDetailPath,
          ...groundDetailDimensions,
        },
      },
      owlTreeGrounding: {
        strategy: owlTreeNode.extras.tka_grounding_strategy,
        depth: owlTreeNode.extras.tka_grounding_depth,
        samples: owlTreeNode.extras.tka_root_contact_samples,
        contactFraction: owlTreeNode.extras.tka_root_contact_fraction,
        centralClearanceAfter:
          owlTreeNode.extras.tka_root_central_clearance_after,
        maximumAutomaticSink: owlTreeNode.extras.tka_root_max_automatic_sink,
      },
      cameraCollision: {
        terrain: terrainNode.extras.tka_camera_collision,
        horizon: terrainApronNode.extras.tka_camera_collision,
      },
      settlementProps: {
        bench: benchNode.extras.tka_prop_language,
        stumps: stumpNodes.map((node) => node.extras.tka_prop_language),
      },
      farBotanicalProof,
      fern: {
        instances: fernInstances,
        triangles: fernTriangles,
        renderedTriangles: fernTriangles * fernInstances,
      },
      renderedTriangles,
      uncompressedTextures: uncompressedTextures.length,
    },
    null,
    2
  )
);
