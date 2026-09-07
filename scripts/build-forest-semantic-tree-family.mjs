#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-family.json"), "utf8"));
const requireFromCli = createRequire(realpathSync(resolve("node_modules/@gltf-transform/cli/package.json")));
const [{ NodeIO, getBounds }, { ALL_EXTENSIONS }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const evidenceDirectory = resolve(manifest.evidenceDirectory);
await mkdir(evidenceDirectory, { recursive: true });

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function isGreen(right, green, left) {
  const spread = Math.max(right, green, left) - Math.min(right, green, left);
  return green > 38 && green > right * 1.045 && green > left * 1.025 && spread > 9;
}

function wrap(value) {
  return ((value % 1) + 1) % 1;
}

function samplePixel(pixels, width, height, uv) {
  const x = Math.min(width - 1, Math.floor(wrap(uv[0]) * width));
  const y = Math.min(height - 1, Math.floor(wrap(uv[1]) * height));
  const offset = (y * width + x) * 4;
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
}

function barycentricUv(first, second, third, weights) {
  return [
    first[0] * weights[0] + second[0] * weights[1] + third[0] * weights[2],
    first[1] * weights[0] + second[1] * weights[1] + third[1] * weights[2],
  ];
}

function classifyTriangle(uvs, pixels, width, height) {
  const first = uvs[0];
  const second = uvs[1];
  const third = uvs[2];
  const samples = [
    barycentricUv(first, second, third, [0.6, 0.2, 0.2]),
    barycentricUv(first, second, third, [0.2, 0.6, 0.2]),
    barycentricUv(first, second, third, [0.2, 0.2, 0.6]),
    barycentricUv(first, second, third, [1 / 3, 1 / 3, 1 / 3]),
  ];
  return samples.filter((uv) => isGreen(...samplePixel(pixels, width, height, uv))).length >= 2;
}

async function makeSemanticTextures(candidate, originalImage) {
  const decoded = await sharp(originalImage).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const barkPixels = Buffer.from(decoded.data);
  const foliagePixels = Buffer.from(decoded.data);
  let greenPixels = 0;
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    const right = decoded.data[offset];
    const green = decoded.data[offset + 1];
    const left = decoded.data[offset + 2];
    if (!isGreen(right, green, left)) continue;
    greenPixels += 1;
    foliagePixels[offset] = clamp(right * candidate.foliageRgbScale[0] + 3);
    foliagePixels[offset + 1] = clamp(green * candidate.foliageRgbScale[1] + 2);
    foliagePixels[offset + 2] = clamp(left * candidate.foliageRgbScale[2] + 5);
  }
  const raw = { width: decoded.info.width, height: decoded.info.height, channels: 4 };
  const bark = await sharp(barkPixels, { raw }).png().toBuffer();
  const foliage = await sharp(foliagePixels, { raw }).png().toBuffer();
  await writeFile(resolve(evidenceDirectory, `${candidate.species}-bark-base-color.png`), bark);
  await writeFile(resolve(evidenceDirectory, `${candidate.species}-foliage-base-color.png`), foliage);
  return {
    sourcePixels: decoded.data,
    width: decoded.info.width,
    height: decoded.info.height,
    greenPixels,
    bark,
    foliage,
  };
}

function makePrimitive(document, original, indices, material, name) {
  const position = original.getAttribute("POSITION");
  const IndexArray = position.getCount() <= 65535 ? Uint16Array : Uint32Array;
  const primitive = document
    .createPrimitive()
    .setMode(original.getMode())
    .setIndices(document.createAccessor(`${name}_Indices`).setType("SCALAR").setArray(new IndexArray(indices)))
    .setMaterial(material);
  for (const semantic of original.listSemantics()) {
    primitive.setAttribute(semantic, original.getAttribute(semantic));
  }
  return primitive;
}

async function buildCandidate(candidate) {
  const input = resolve(manifest.outputDirectory, `${candidate.id}_refined_raw.glb`);
  const output = resolve(manifest.outputDirectory, `${candidate.id}_semantic_review.glb`);
  const document = await io.read(input);
  const root = document.getRoot();
  invariant(root.listMeshes().length === 1, `${candidate.id} expected one mesh`);
  const mesh = root.listMeshes()[0];
  invariant(mesh.listPrimitives().length === 1, `${candidate.id} expected one source primitive`);
  const primitive = mesh.listPrimitives()[0];
  const sourceMaterial = primitive.getMaterial();
  invariant(sourceMaterial, `${candidate.id} source primitive has no material`);
  const baseColorTexture = sourceMaterial.getBaseColorTexture();
  invariant(baseColorTexture?.getImage(), `${candidate.id} has no embedded base color texture`);
  const normalTexture = sourceMaterial.getNormalTexture();
  invariant(normalTexture?.getImage(), `${candidate.id} has no embedded normal texture`);
  const positions = primitive.getAttribute("POSITION");
  const texcoords = primitive.getAttribute("TEXCOORD_0");
  const sourceIndices = primitive.getIndices();
  invariant(positions && texcoords && sourceIndices, `${candidate.id} lacks indexed positions or UVs`);
  invariant(sourceIndices.getCount() % 3 === 0, `${candidate.id} index count is not triangles`);

  const semanticTextures = await makeSemanticTextures(candidate, baseColorTexture.getImage());
  const barkIndices = [];
  const foliageIndices = [];
  const uvArray = texcoords.getArray();
  const indexArray = sourceIndices.getArray();
  for (let offset = 0; offset < indexArray.length; offset += 3) {
    const triangle = [indexArray[offset], indexArray[offset + 1], indexArray[offset + 2]];
    const uvs = triangle.map((index) => [uvArray[index * 2], uvArray[index * 2 + 1]]);
    const foliage = classifyTriangle(
      uvs,
      semanticTextures.sourcePixels,
      semanticTextures.width,
      semanticTextures.height
    );
    (foliage ? foliageIndices : barkIndices).push(...triangle);
  }
  invariant(barkIndices.length > 0, `${candidate.id} semantic split found no bark faces`);
  invariant(foliageIndices.length > 0, `${candidate.id} semantic split found no foliage faces`);

  const barkTexture = document
    .createTexture(`${candidate.label}_Bark_BaseColor`)
    .setImage(semanticTextures.bark)
    .setMimeType("image/png");
  const foliageTexture = document
    .createTexture(`${candidate.label}_Foliage_BaseColor`)
    .setImage(semanticTextures.foliage)
    .setMimeType("image/png");
  const barkMaterial = document
    .createMaterial(`${candidate.label}_Bark`)
    .setBaseColorTexture(barkTexture)
    .setNormalTexture(normalTexture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.92)
    .setEmissiveFactor([0, 0, 0])
    .setDoubleSided(true);
  const foliageMaterial = document
    .createMaterial(`${candidate.label}_Foliage`)
    .setBaseColorTexture(foliageTexture)
    .setNormalTexture(normalTexture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.88)
    .setEmissiveFactor([0, 0, 0])
    .setDoubleSided(true);
  mesh.removePrimitive(primitive);
  mesh.addPrimitive(makePrimitive(document, primitive, barkIndices, barkMaterial, `${candidate.species}_Bark`));
  mesh.addPrimitive(makePrimitive(document, primitive, foliageIndices, foliageMaterial, `${candidate.species}_Foliage`));

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  invariant(scene, `${candidate.id} has no scene`);
  const sourceBounds = getBounds(scene);
  const sourceDimensions = sourceBounds.max.map((value, axis) => value - sourceBounds.min[axis]);
  const width = Math.max(sourceDimensions[0], sourceDimensions[2]);
  const scale = Math.min(candidate.targetHeightMetres / sourceDimensions[1], candidate.targetCrownWidthMetres / width);
  const centerX = (sourceBounds.min[0] + sourceBounds.max[0]) * 0.5;
  const centerZ = (sourceBounds.min[2] + sourceBounds.max[2]) * 0.5;
  const normalizationRoot = document
    .createNode(`${candidate.label}_Normalization`)
    .setScale([scale, scale, scale])
    .setTranslation([-centerX * scale, -sourceBounds.min[1] * scale, -centerZ * scale]);
  for (const child of [...scene.listChildren()]) normalizationRoot.addChild(child);
  scene.addChild(normalizationRoot);
  sourceMaterial.dispose();
  await mkdir(dirname(output), { recursive: true });
  await io.write(output, document);
  const finalBounds = getBounds(scene);
  return {
    id: candidate.id,
    species: candidate.species,
    input: input.replaceAll("\\", "/"),
    output: output.replaceAll("\\", "/"),
    sourceTriangles: indexArray.length / 3,
    barkTriangles: barkIndices.length / 3,
    foliageTriangles: foliageIndices.length / 3,
    nonGreenTriangles: barkIndices.length / 3,
    barkTriangleShare: barkIndices.length / indexArray.length,
    foliageTriangleShare: foliageIndices.length / indexArray.length,
    greenAtlasPixelShare: semanticTextures.greenPixels / (semanticTextures.width * semanticTextures.height),
    sourceDimensions,
    uniformScale: scale,
    normalizedMinimum: [...finalBounds.min],
    normalizedMaximum: [...finalBounds.max],
    normalizedDimensionsMetres: finalBounds.max.map((value, axis) => value - finalBounds.min[axis]),
    semanticMaterials: [barkMaterial.getName(), foliageMaterial.getName()],
  };
}

const metrics = [];
for (const candidate of manifest.candidates) metrics.push(await buildCandidate(candidate));
await writeFile(resolve(evidenceDirectory, "semantic-split-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
