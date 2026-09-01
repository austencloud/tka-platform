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

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-wave-r2.json"), "utf8"));
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

function isExtraFoliagePixel(candidate, right, green, left) {
  const mode = candidate.foliageClassifier?.extraAtlasMode;
  const spread = Math.max(right, green, left) - Math.min(right, green, left);
  if (mode === "warm-summer-leaves") {
    return right > 58 && right > green * 0.95 && right > left * 1.15 && spread > 18;
  }
  if (mode === "pale-canopy-leaves") {
    const mean = (right + green + left) / 3;
    return mean > 72 && spread < 72 && left < right * 1.18;
  }
  return false;
}

function isCandidateFoliagePixel(candidate, right, green, left, heightFraction = 1) {
  if (isGreen(right, green, left)) return true;
  const minimum = candidate.foliageClassifier?.extraMinimumHeightFraction ?? 0;
  return heightFraction >= minimum && isExtraFoliagePixel(candidate, right, green, left);
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

function classifyTriangle(candidate, uvs, pixels, width, height, heightFraction) {
  const [first, second, third] = uvs;
  const samples = [
    barycentricUv(first, second, third, [0.6, 0.2, 0.2]),
    barycentricUv(first, second, third, [0.2, 0.6, 0.2]),
    barycentricUv(first, second, third, [0.2, 0.2, 0.6]),
    barycentricUv(first, second, third, [1 / 3, 1 / 3, 1 / 3]),
  ];
  return samples.filter((uv) => isCandidateFoliagePixel(candidate, ...samplePixel(pixels, width, height, uv), heightFraction)).length >= 2;
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
    if (candidate.foliageClassifier?.barkGreenNeutralize && isGreen(right, green, left)) {
      const luminance = (right * 0.2126 + green * 0.7152 + left * 0.0722) / 255;
      const target = candidate.foliageClassifier.barkReplacementRgb;
      const lift = 0.7 + luminance * 0.5;
      barkPixels[offset] = clamp(target[0] * lift);
      barkPixels[offset + 1] = clamp(target[1] * lift);
      barkPixels[offset + 2] = clamp(target[2] * lift);
    }
    if (!isCandidateFoliagePixel(candidate, right, green, left)) continue;
    greenPixels += 1;
    if (isGreen(right, green, left)) {
      foliagePixels[offset] = clamp(right * candidate.foliageRgbScale[0] + 3);
      foliagePixels[offset + 1] = clamp(green * candidate.foliageRgbScale[1] + 2);
      foliagePixels[offset + 2] = clamp(left * candidate.foliageRgbScale[2] + 5);
    } else {
      const luminance = (right * 0.2126 + green * 0.7152 + left * 0.0722) / 255;
      const target = candidate.foliageClassifier.replacementRgb;
      const lift = 0.72 + luminance * 0.55;
      foliagePixels[offset] = clamp(target[0] * lift);
      foliagePixels[offset + 1] = clamp(target[1] * lift);
      foliagePixels[offset + 2] = clamp(target[2] * lift);
    }
  }
  const raw = { width: decoded.info.width, height: decoded.info.height, channels: 4 };
  const bark = await sharp(barkPixels, { raw }).png().toBuffer();
  const foliage = await sharp(foliagePixels, { raw }).png().toBuffer();
  await writeFile(resolve(evidenceDirectory, `${candidate.species}-bark-base-color.png`), bark);
  await writeFile(resolve(evidenceDirectory, `${candidate.species}-foliage-base-color.png`), foliage);
  return { sourcePixels: decoded.data, width: decoded.info.width, height: decoded.info.height, greenPixels, bark, foliage };
}

function makePrimitive(document, original, indices, material, name) {
  const position = original.getAttribute("POSITION");
  const IndexArray = position.getCount() <= 65535 ? Uint16Array : Uint32Array;
  const primitive = document
    .createPrimitive()
    .setMode(original.getMode())
    .setIndices(document.createAccessor(`${name}_Indices`).setType("SCALAR").setArray(new IndexArray(indices)))
    .setMaterial(material);
  for (const semantic of original.listSemantics()) primitive.setAttribute(semantic, original.getAttribute(semantic));
  return primitive;
}

function componentAspectRatios(indexArray, positionArray, vertexCount) {
  const parent = new Uint32Array(vertexCount);
  const rank = new Uint8Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) parent[index] = index;
  function find(value) {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  }
  function union(first, second) {
    let a = find(first);
    let b = find(second);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  }
  for (let offset = 0; offset < indexArray.length; offset += 3) {
    union(indexArray[offset], indexArray[offset + 1]);
    union(indexArray[offset], indexArray[offset + 2]);
  }
  const boundsByRoot = new Map();
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const root = find(vertex);
    const x = positionArray[vertex * 3];
    const y = positionArray[vertex * 3 + 1];
    const z = positionArray[vertex * 3 + 2];
    const bounds = boundsByRoot.get(root) ?? { min: [x, y, z], max: [x, y, z] };
    bounds.min[0] = Math.min(bounds.min[0], x);
    bounds.min[1] = Math.min(bounds.min[1], y);
    bounds.min[2] = Math.min(bounds.min[2], z);
    bounds.max[0] = Math.max(bounds.max[0], x);
    bounds.max[1] = Math.max(bounds.max[1], y);
    bounds.max[2] = Math.max(bounds.max[2], z);
    boundsByRoot.set(root, bounds);
  }
  const aspectByRoot = new Map();
  for (const [root, bounds] of boundsByRoot) {
    const dimensions = bounds.max.map((value, axis) => value - bounds.min[axis]).sort((a, b) => b - a);
    aspectByRoot.set(root, dimensions[0] / Math.max(dimensions[1], 0.0001));
  }
  return { find, aspectByRoot };
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
  const positionArray = positions.getArray();
  const indexArray = sourceIndices.getArray();
  const components = componentAspectRatios(indexArray, positionArray, positions.getCount());
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positionArray.length; index += 3) {
    minimumX = Math.min(minimumX, positionArray[index]);
    maximumX = Math.max(maximumX, positionArray[index]);
    minimumY = Math.min(minimumY, positionArray[index + 1]);
    maximumY = Math.max(maximumY, positionArray[index + 1]);
    minimumZ = Math.min(minimumZ, positionArray[index + 2]);
    maximumZ = Math.max(maximumZ, positionArray[index + 2]);
  }
  const treeCenterX = (minimumX + maximumX) * 0.5;
  const treeCenterZ = (minimumZ + maximumZ) * 0.5;
  const horizontalWidth = Math.max(maximumX - minimumX, maximumZ - minimumZ);
  for (let offset = 0; offset < indexArray.length; offset += 3) {
    const triangle = [indexArray[offset], indexArray[offset + 1], indexArray[offset + 2]];
    const uvs = triangle.map((index) => [uvArray[index * 2], uvArray[index * 2 + 1]]);
    const centroidY = triangle.reduce((sum, index) => sum + positionArray[index * 3 + 1], 0) / 3;
    const centroidX = triangle.reduce((sum, index) => sum + positionArray[index * 3], 0) / 3;
    const centroidZ = triangle.reduce((sum, index) => sum + positionArray[index * 3 + 2], 0) / 3;
    const heightFraction = (centroidY - minimumY) / Math.max(0.0001, maximumY - minimumY);
    const aspectRatio = components.aspectByRoot.get(components.find(triangle[0])) ?? 1;
    const radialFraction = Math.hypot(centroidX - treeCenterX, centroidZ - treeCenterZ) / Math.max(horizontalWidth, 0.0001);
    const centralRule = candidate.foliageClassifier?.structuralBarkCentralRadiusFraction;
    const centralBark = centralRule !== undefined
      && radialFraction <= centralRule
      && heightFraction <= candidate.foliageClassifier.structuralBarkCentralMaximumHeightFraction
      && aspectRatio >= candidate.foliageClassifier.structuralBarkCentralMinimumAspectRatio;
    const structuralBark = centralBark || aspectRatio >= (candidate.foliageClassifier?.structuralBarkAspectRatio ?? Number.POSITIVE_INFINITY);
    const foliage = !structuralBark && classifyTriangle(candidate, uvs, semanticTextures.sourcePixels, semanticTextures.width, semanticTextures.height, heightFraction);
    (foliage ? foliageIndices : barkIndices).push(...triangle);
  }
  invariant(barkIndices.length > 0, `${candidate.id} semantic split found no bark faces`);
  invariant(foliageIndices.length > 0, `${candidate.id} semantic split found no foliage faces`);

  const barkTexture = document.createTexture(`${candidate.label}_Bark_BaseColor`).setImage(semanticTextures.bark).setMimeType("image/png");
  const foliageTexture = document.createTexture(`${candidate.label}_Foliage_BaseColor`).setImage(semanticTextures.foliage).setMimeType("image/png");
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
