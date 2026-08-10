#!/usr/bin/env node
/** Verify the production Autumn GLB's delivery and geometry contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve("static/models/autumn/autumn-environment.glb");
const maximumBytes = 20 * 1024 * 1024;
const maximumFernTriangles = 8_000;
const maximumRenderedTriangles = 2_200_000;
const expectedFernInstances = 54;

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
  return {
    bytes: buffer.length,
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

const { bytes, json: gltf } = readGlbJson(glbPath);
const extensions = new Set(gltf.extensionsUsed ?? []);
const meshNodes = (gltf.nodes ?? []).filter((node) =>
  Number.isInteger(node.mesh)
);
const fernNodes = meshNodes.filter((node) =>
  meshUsesMaterial(gltf, node.mesh, "Autumn Fern PBR")
);

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
