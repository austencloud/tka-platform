#!/usr/bin/env node
/** Measure the approved Forest tree correction against its source atlases. */

import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const profilePath = resolve(
  "src/lib/shared/3d/environments/scenes/forest/forest-atmosphere-profile.ts"
);
const gradePath = resolve(
  "src/lib/shared/3d/environments/scenes/forest/forest-foliage-grade.ts"
);
const layoutPath = resolve("scripts/forest-tree-layout.json");
const environmentPath = resolve("static/models/forest/forest-environment.glb");
const nearFramePath = resolve("static/models/forest/forest-near-frame.glb");
const outputPath = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/evidence/tree-material-depth-r1/forest-tree-pass-metrics.json"
);
const sourceColorPath = resolve(
  "assets/3d-source/forest/polyhaven/jacaranda_tree/textures/jacaranda_tree_leaves_diff_1k.jpg"
);
const sourceAlphaPath = resolve(
  "assets/3d-source/forest/polyhaven/jacaranda_tree/textures/jacaranda_tree_leaves_alpha_1k.png"
);

function requireMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not read ${label} from its source owner`);
  return match[1];
}

function srgbToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hexToLinearRgb(hex) {
  return [1, 3, 5].map((offset) =>
    srgbToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16))
  );
}

function luminance([right, green, left]) {
  return 0.2126 * right + 0.7152 * green + 0.0722 * left;
}

function smoothstep(edge0, edge1, value) {
  const amount = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function percentile(sorted, fraction) {
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const p10 = percentile(sorted, 0.1);
  const p90 = percentile(sorted, 0.9);
  return {
    mean,
    standardDeviation: Math.sqrt(variance),
    p10,
    p90,
    p90ToP10Ratio: p90 / Math.max(p10, 0.0001),
  };
}

async function readGlbJson(path) {
  const buffer = await readFile(path);
  if (buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error(`${path} is not a binary glTF`);
  }
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.readUInt32LE(16);
  if (jsonChunkType !== 0x4e4f534a) {
    throw new Error(`${path} does not begin with a JSON chunk`);
  }
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonChunkLength));
}

function analyzeTreeRuntime(gltf) {
  const treeNodes = (gltf.nodes ?? []).filter((node) => {
    if (node.mesh === undefined) return false;
    const meshName = gltf.meshes?.[node.mesh]?.name ?? "";
    return meshName.startsWith("ForestTreeMesh_");
  });
  const meshTriangles = new Map();

  function trianglesForMesh(meshIndex) {
    if (meshTriangles.has(meshIndex)) return meshTriangles.get(meshIndex);
    const count = (gltf.meshes?.[meshIndex]?.primitives ?? []).reduce(
      (sum, primitive) => {
        const accessorIndex =
          primitive.indices ?? primitive.attributes?.POSITION;
        const elementCount = gltf.accessors?.[accessorIndex]?.count ?? 0;
        return sum + elementCount / 3;
      },
      0
    );
    meshTriangles.set(meshIndex, count);
    return count;
  }

  let treeInstanceCount = 0;
  let estimatedTriangleSubmissionsPerRender = 0;
  for (const node of treeNodes) {
    const translationAccessor =
      node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
    const instanceCount =
      translationAccessor === undefined
        ? 1
        : (gltf.accessors?.[translationAccessor]?.count ?? 0);
    treeInstanceCount += instanceCount;
    estimatedTriangleSubmissionsPerRender +=
      trianglesForMesh(node.mesh) * instanceCount;
  }

  return {
    treeNodeCount: treeNodes.length,
    treeInstanceCount,
    uniqueTreeMeshCount: meshTriangles.size,
    uniqueTreePrototypeTriangles: [...meshTriangles.values()].reduce(
      (sum, count) => sum + count,
      0
    ),
    estimatedTriangleSubmissionsPerRender,
  };
}

const [profileSource, gradeSource, layoutSource] = await Promise.all([
  readFile(profilePath, "utf8"),
  readFile(gradePath, "utf8"),
  readFile(layoutPath, "utf8"),
]);
const layout = JSON.parse(layoutSource);
const daySection = profileSource.slice(
  profileSource.indexOf("day: {"),
  profileSource.indexOf("golden-hour: {")
);
const tintHex = requireMatch(
  daySection,
  /foliageHighlightTint:\s*"(#[0-9a-f]+)"/i,
  "Day foliage tint"
);
const strength = Number(
  requireMatch(
    daySection,
    /foliageHighlightStrength:\s*([0-9.]+)/,
    "Day foliage strength"
  )
);
const jacarandaCoverage = Number(
  requireMatch(
    gradeSource,
    /\?\s*([0-9.]+)\s*:\s*[0-9.]+;/,
    "Jacaranda coverage"
  )
);
const defaultCoverage = Number(
  requireMatch(gradeSource, /\?\s*[0-9.]+\s*:\s*([0-9.]+);/, "default coverage")
);

const [{ data: color, info }, { data: alpha }] = await Promise.all([
  sharp(sourceColorPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true }),
  sharp(sourceAlphaPath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true }),
]);
const tint = hexToLinearRgb(tintHex);
const tintLuminance = Math.max(luminance(tint), 0.001);
const sourceLuminances = [];
const gradedLuminances = [];
let liftedPixelCount = 0;
let greenDominantBefore = 0;
let greenDominantAfter = 0;

for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
  if (alpha[pixel] / 255 < 0.35) continue;
  const source = [
    srgbToLinear(color[pixel * 3]),
    srgbToLinear(color[pixel * 3 + 1]),
    srgbToLinear(color[pixel * 3 + 2]),
  ];
  const sourceLuminance = luminance(source);
  const greenSignal = smoothstep(
    0.01,
    0.14,
    source[1] - Math.max(source[0], source[2])
  );
  const weight = Math.min(
    1,
    strength * jacarandaCoverage * (0.72 + 0.28 * greenSignal)
  );
  const target = tint.map(
    (channel) => channel * (sourceLuminance / tintLuminance)
  );
  const graded = source.map(
    (channel, index) => channel * (1 - weight) + target[index] * weight
  );
  const gradedLuminance = luminance(graded);
  sourceLuminances.push(sourceLuminance);
  gradedLuminances.push(gradedLuminance);
  if (gradedLuminance > sourceLuminance + 0.002) liftedPixelCount += 1;
  if (source[1] > source[0] && source[1] > source[2]) greenDominantBefore += 1;
  if (graded[1] > graded[0] && graded[1] > graded[2]) greenDominantAfter += 1;
}

const variantCounts = {};
for (const asset of layout.assets) {
  const count = layout.clusters.reduce(
    (sum, cluster) => sum + Number(cluster.counts[asset.id] ?? 0),
    0
  );
  const variants = asset.variants?.length ? asset.variants : [asset];
  variants.forEach((variant, index) => {
    variantCounts[variant.id ?? asset.id] =
      Math.floor(count / variants.length) +
      (index < count % variants.length ? 1 : 0);
  });
}
const exactJacarandaPlacements =
  Number(variantCounts["jacaranda-broad-canopy"] ?? 0) +
  Number(variantCounts["young-jacaranda-canopy"] ?? 0);
const previousExactJacarandaPlacements = 118;

const sourceSummary = summarize(sourceLuminances);
const gradedSummary = summarize(gradedLuminances);
const [environmentGlb, nearFrameGlb] = await Promise.all([
  readGlbJson(environmentPath),
  readGlbJson(nearFramePath),
]);
const output = {
  generatedAt: new Date().toISOString(),
  contract: {
    tintHex,
    strength,
    jacarandaCoverage,
    defaultCoverage,
    alphaCutoff: 0.35,
  },
  jacarandaAtlas: {
    visiblePixelCount: sourceLuminances.length,
    liftedPixelPercent:
      (liftedPixelCount / Math.max(sourceLuminances.length, 1)) * 100,
    greenDominantPercentBefore:
      (greenDominantBefore / sourceLuminances.length) * 100,
    greenDominantPercentAfter:
      (greenDominantAfter / sourceLuminances.length) * 100,
    source: sourceSummary,
    graded: gradedSummary,
    standardDeviationRetention:
      gradedSummary.standardDeviation / sourceSummary.standardDeviation,
    contrastRatioRetention:
      gradedSummary.p90ToP10Ratio / sourceSummary.p90ToP10Ratio,
  },
  repetition: {
    environmentTreeCount: Object.values(variantCounts).reduce(
      (sum, count) => sum + count,
      0
    ),
    sourceVariantCount: Object.keys(variantCounts).length,
    variantCounts,
    previousExactJacarandaPlacements,
    exactJacarandaPlacements,
    exactJacarandaReductionPercent:
      ((previousExactJacarandaPlacements - exactJacarandaPlacements) /
        previousExactJacarandaPlacements) *
      100,
  },
  runtimeAssets: {
    environmentBytes: (await stat(environmentPath)).size,
    nearFrameBytes: (await stat(nearFramePath)).size,
    environmentTrees: analyzeTreeRuntime(environmentGlb),
    nearFrameTrees: analyzeTreeRuntime(nearFrameGlb),
  },
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
