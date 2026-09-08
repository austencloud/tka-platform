#!/usr/bin/env node

/**
 * Measures the shape of a Flow Fest tree GLB in its own source units.
 *
 * `createForestRuntimeTreeInstances` scales every instance uniformly by
 * `renderedHeightMeters / sourceHeight`, so a source asset's absolute size
 * never reaches the screen — only its PROPORTIONS do. Swapping the tree
 * library therefore changes apparent scale if and only if these ratios move:
 *
 *   crownRadius / height   how wide the canopy reads at a given tree height
 *   trunkHeight / height   how much clear bole stands under the canopy
 *
 * This is the instrument for both sides of that comparison. Run it on the
 * outgoing GLBs, run it on the generated ones, and keep the ratios in the
 * same band.
 *
 *   node scripts/geospatial/measure_flow_fest_trees.mjs [--json] [globs...]
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

/**
 * The top-level `node_modules/@gltf-transform` links vanish while a parallel
 * session's pnpm install is relinking; the `.pnpm` virtual store is stable.
 * Same resolution the LOD builder uses.
 */
function resolveGltfTransformCli() {
  const friendly = resolve("node_modules/@gltf-transform/cli/package.json");
  if (existsSync(friendly)) return realpathSync(friendly);
  const store = realpathSync(resolve("node_modules/.pnpm"));
  const entry = readdirSync(store).find((name) =>
    name.startsWith("@gltf-transform+cli@")
  );
  if (!entry) throw new Error("@gltf-transform/cli not found in pnpm store");
  return resolve(store, entry, "node_modules/@gltf-transform/cli/package.json");
}

export async function createTreeMeasurementIo() {
  const requireFromCli = createRequire(resolveGltfTransformCli());
  const [{ NodeIO }, { ALL_EXTENSIONS }] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  ]);
  const draco3d = requireFromCli("draco3dgltf");
  const { MeshoptDecoder, MeshoptEncoder } = requireFromCli("meshoptimizer");
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
}

/**
 * Same foliage test the runtime uses (`isFlowFestForestFoliageMaterial`):
 * material name says leaf, or the material is an alpha-cutout card.
 */
const FOLIAGE_TOKENS = [
  "leaf",
  "leaves",
  "foliage",
  "twig",
  "frond",
  "needle",
  "canopy",
  "blossom",
  "petal",
];

function isFoliageMaterial(material) {
  if (!material) return false;
  const name = (material.getName() ?? "").toLowerCase();
  if (FOLIAGE_TOKENS.some((token) => name.includes(token))) return true;
  return material.getAlphaMode() === "MASK";
}

function multiplyMatrices(a, b) {
  // Column-major 4x4, glTF convention. Returns a * b.
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.round(fraction * (sortedValues.length - 1)))
  );
  return sortedValues[index];
}

/**
 * Walks the scene graph accumulating world-space vertices, split into wood and
 * foliage. Returns raw samples so callers can derive whatever statistic they
 * need without re-reading the file.
 */
function collectVertices(document) {
  const wood = [];
  const foliage = [];
  let woodTriangles = 0;
  let foliageTriangles = 0;

  const visit = (node, parentMatrix) => {
    const local = node.getMatrix();
    const matrix = multiplyMatrices(parentMatrix, local);
    const mesh = node.getMesh();
    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const material = primitive.getMaterial();
        const target = isFoliageMaterial(material) ? foliage : wood;
        const position = primitive.getAttribute("POSITION");
        if (!position) continue;
        const triangles = Math.round(
          (primitive.getIndices()?.getCount() ?? position.getCount()) / 3
        );
        if (target === foliage) foliageTriangles += triangles;
        else woodTriangles += triangles;
        const scratch = [0, 0, 0];
        for (let index = 0; index < position.getCount(); index += 1) {
          position.getElement(index, scratch);
          target.push(transformPoint(matrix, scratch[0], scratch[1], scratch[2]));
        }
      }
    }
    for (const child of node.listChildren()) visit(child, matrix);
  };

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) visit(node, identity);
  }
  return { wood, foliage, woodTriangles, foliageTriangles };
}

/**
 * The shape report for one tree asset, in the asset's own units plus the
 * scale-invariant ratios that actually survive instancing.
 */
export function summarizeTreeVertices({
  wood,
  foliage,
  woodTriangles,
  foliageTriangles,
}) {
  const all = [...wood, ...foliage];
  if (all.length === 0) return null;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of all) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const height = Math.max(1e-6, maxY - minY);

  // Trunk axis: the horizontal centre of the lowest 10% of the WOOD, which is
  // the bole. Using the whole-model centre would let a lopsided crown drag the
  // axis sideways and inflate the measured crown radius.
  const boleCut = minY + height * 0.1;
  const boleSamples = (wood.length > 0 ? wood : all).filter(
    ([, y]) => y <= boleCut
  );
  const axisSource = boleSamples.length > 0 ? boleSamples : all;
  let axisX = 0;
  let axisZ = 0;
  for (const [x, , z] of axisSource) {
    axisX += x;
    axisZ += z;
  }
  axisX /= axisSource.length;
  axisZ /= axisSource.length;

  const crownSource = foliage.length > 0 ? foliage : all;
  const radii = crownSource
    .map(([x, , z]) => Math.hypot(x - axisX, z - axisZ))
    .sort((a, b) => a - b);

  // Clear bole: where the crown actually starts. The 2nd percentile of foliage
  // height ignores the odd stray leaf card hanging below the canopy mass.
  const foliageHeights = crownSource.map(([, y]) => y - minY).sort((a, b) => a - b);
  const trunkHeight = percentile(foliageHeights, 0.02);

  const crownRadiusMax = radii[radii.length - 1] ?? 0;
  const crownRadiusP95 = percentile(radii, 0.95);

  return {
    height,
    trunkHeight,
    crownRadiusMax,
    crownRadiusP95,
    crownRadiusRatio: crownRadiusP95 / height,
    crownRadiusMaxRatio: crownRadiusMax / height,
    trunkHeightRatio: trunkHeight / height,
    woodTriangles,
    foliageTriangles,
    triangles: woodTriangles + foliageTriangles,
  };
}

export async function measureTreeGlb(io, path) {
  const document = await io.read(path);
  const summary = summarizeTreeVertices(collectVertices(document));
  if (!summary) return null;
  return { path, bytes: statSync(path).size, ...summary };
}

/**
 * Projects a source asset's proportions into world metres at the rendered
 * heights the ecology actually assigns (`renderedHeightMeters`, 7.5-19 m).
 */
export function projectToWorldMeters(summary, renderedHeightMeters) {
  const scale = renderedHeightMeters / summary.height;
  return {
    renderedHeightMeters,
    trunkHeightMeters: summary.trunkHeight * scale,
    crownRadiusMeters: summary.crownRadiusP95 * scale,
    crownRadiusMaxMeters: summary.crownRadiusMax * scale,
  };
}

const REPRESENTATIVE_RENDERED_HEIGHTS = [7.5, 13.5, 19];

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length === 0) {
    console.error(
      "usage: node scripts/geospatial/measure_flow_fest_trees.mjs [--json] <glb...>"
    );
    process.exitCode = 1;
    return;
  }

  const io = await createTreeMeasurementIo();
  const rows = [];
  for (const path of paths) {
    const absolute = resolve(path);
    if (!existsSync(absolute)) {
      console.error(`missing: ${path}`);
      continue;
    }
    const measurement = await measureTreeGlb(io, absolute);
    if (measurement) rows.push({ id: basename(absolute, ".glb"), ...measurement });
  }

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const pad = (value, width) => String(value).padStart(width);
  console.log(
    `${"asset".padEnd(38)} ${pad("h", 8)} ${pad("crownR", 8)} ${pad("trunkH", 8)} ${pad("cR/h", 6)} ${pad("tH/h", 6)} ${pad("tris", 8)} ${pad("foliage%", 8)}`
  );
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(38)} ${pad(row.height.toFixed(2), 8)} ${pad(row.crownRadiusP95.toFixed(2), 8)} ${pad(row.trunkHeight.toFixed(2), 8)} ${pad(row.crownRadiusRatio.toFixed(3), 6)} ${pad(row.trunkHeightRatio.toFixed(3), 6)} ${pad(row.triangles, 8)} ${pad(((row.foliageTriangles / Math.max(1, row.triangles)) * 100).toFixed(0), 8)}`
    );
  }

  if (rows.length > 1) {
    const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
    console.log("");
    console.log(
      `mean crownRadius/height ${mean((r) => r.crownRadiusRatio).toFixed(3)}   mean trunkHeight/height ${mean((r) => r.trunkHeightRatio).toFixed(3)}`
    );
    for (const renderedHeight of REPRESENTATIVE_RENDERED_HEIGHTS) {
      const crown = mean((r) => r.crownRadiusRatio) * renderedHeight;
      const trunk = mean((r) => r.trunkHeightRatio) * renderedHeight;
      console.log(
        `  at ${renderedHeight} m rendered height: crown radius ${crown.toFixed(2)} m, clear bole ${trunk.toFixed(2)} m`
      );
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
