#!/usr/bin/env node

/**
 * Builds the mid/far distance tiers for every Flow Fest tree family.
 *
 * The tiers ship geometry + UVs + the ORIGINAL material names, but no
 * textures: `createForestRuntimeTreeInstances` re-binds materials by name
 * from the loaded near-tier asset, so a distance tree renders with the real
 * bark and leaf atlases while its GLB stays a few hundred kilobytes.
 *
 * Reduction follows the plantcatalog conditioning doctrine: opaque wood is
 * meshopt-simplified with an explicit error bound; foliage cutout cards are
 * never simplified — a card is kept whole or dropped whole, and the survivors
 * grow to preserve silhouette coverage. Simplifying a cutout card shreds its
 * alpha silhouette, which is exactly the "different tree up close" defect
 * this build replaces.
 *
 * Also measures each family's trunk, emitting the per-family collision
 * profile consumed by `flow-fest-forest-ecology.ts`.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The top-level `node_modules/@gltf-transform` links vanish while a parallel
 * session's pnpm install is relinking; the `.pnpm` virtual store is stable.
 * Resolve the CLI package there when the friendly path is missing.
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

const OUTPUT_DIRECTORY = resolve(
  "static/models/flow-fest-sim/ecology/distance-lod"
);
const MANIFEST_PATH = resolve(OUTPUT_DIRECTORY, "manifest.json");
const ISLAND_ROOT = "static/models/flow-fest-sim/ecology";
const PLANTCATALOG_ROOT = "static/models/forest/trees/candidates/plantcatalog-r1";

/**
 * Family ids match `FLOW_FEST_FOREST_TREE_ASSETS`. Sources are the accepted
 * near-tier GLBs; every family listed here gets a `<id>-mid.glb` and
 * `<id>-far.glb`. Extend this table when new conditioned candidates join the
 * roster (the R3 export set adds twelve more).
 */
const FAMILIES = [
  { id: "island-tree-01", source: `${ISLAND_ROOT}/island-tree-01-flow-lod-512.glb` },
  { id: "island-tree-02", source: `${ISLAND_ROOT}/island-tree-02-flow-lod-512.glb` },
  { id: "island-tree-03", source: `${ISLAND_ROOT}/island-tree-03-flow-lod-512.glb` },
  { id: "tree-small-02", source: `${ISLAND_ROOT}/tree-small-02-flow-lod-512.glb` },
  { id: "plantcatalog-aesculus-carnea", source: `${PLANTCATALOG_ROOT}/aesculus-carnea-ld-s23.glb` },
  { id: "plantcatalog-oak-urban", source: `${PLANTCATALOG_ROOT}/quercus-robur-urban-ld-s13.glb` },
  { id: "plantcatalog-oak-colonised", source: `${PLANTCATALOG_ROOT}/quercus-robur-colonised-ld-s29.glb` },
  { id: "plantcatalog-willow", source: `${PLANTCATALOG_ROOT}/salix-alba-ld-s11.glb` },
  { id: "plantcatalog-buckeye-31", source: `${PLANTCATALOG_ROOT}/aesculus-pavia-ld-s31.glb` },
  { id: "plantcatalog-buckeye-79", source: `${PLANTCATALOG_ROOT}/aesculus-pavia-ld-s79.glb` },
  { id: "plantcatalog-habitat-snag", source: `${PLANTCATALOG_ROOT}/quercus-robur-dead-ld-s37.glb` },
  { id: "plantcatalog-oak-forest-41", source: `${PLANTCATALOG_ROOT}/quercus-robur-forest-ld-s41.glb` },
  { id: "plantcatalog-oak-forest-67", source: `${PLANTCATALOG_ROOT}/quercus-robur-forest-ld-s67.glb` },
  { id: "plantcatalog-oak-forest-89", source: `${PLANTCATALOG_ROOT}/quercus-robur-forest-ld-s89.glb` },
  // quercus-robur-lone-ld-s7 stays off the roster: 525k tris, far over the
  // 150k conditioning budget. The R3 export's lone-ld-s57 replaces it.
];

const OPTIONAL_FAMILIES = [
  { id: "plantcatalog-oak-forest-101", source: `${PLANTCATALOG_ROOT}/quercus-robur-forest-ld-s101.glb` },
  { id: "plantcatalog-oak-forest-113", source: `${PLANTCATALOG_ROOT}/quercus-robur-forest-ld-s113.glb` },
  { id: "plantcatalog-oak-lone-57", source: `${PLANTCATALOG_ROOT}/quercus-robur-lone-ld-s57.glb` },
  { id: "plantcatalog-oak-urban-71", source: `${PLANTCATALOG_ROOT}/quercus-robur-urban-ld-s71.glb` },
  { id: "plantcatalog-oak-colonised-61", source: `${PLANTCATALOG_ROOT}/quercus-robur-colonised-ld-s61.glb` },
  { id: "plantcatalog-carnea-47", source: `${PLANTCATALOG_ROOT}/aesculus-carnea-ld-s47.glb` },
  { id: "plantcatalog-buckeye-103", source: `${PLANTCATALOG_ROOT}/aesculus-pavia-ld-s103.glb` },
  { id: "plantcatalog-willow-53", source: `${PLANTCATALOG_ROOT}/salix-alba-ld-s53.glb` },
  { id: "plantcatalog-weeping-willow-19", source: `${PLANTCATALOG_ROOT}/salix-babylonica-ld-s19.glb` },
  { id: "plantcatalog-weeping-willow-43", source: `${PLANTCATALOG_ROOT}/salix-babylonica-ld-s43.glb` },
  { id: "plantcatalog-goldenrain-17", source: `${PLANTCATALOG_ROOT}/koelreuteria-bipinnata-ld-s17.glb` },
  { id: "plantcatalog-chinaberry-27", source: `${PLANTCATALOG_ROOT}/melia-azedarach-ld-s27.glb` },
];

/**
 * Plantcatalog foliage prims are per-leaf billboards (~2 triangles per card),
 * so card pruning behaves as leaf thinning: aggressive keep ratios with
 * scaled-up survivors read as the same tree, thinner. Ratios are sized to the
 * instance budget — mid renders ~150 trees, far ~250 — not to per-tree looks.
 */
const TIERS = [
  { id: "mid", woodRatio: 0.22, woodError: 0.25, foliageKeepRatio: 0.12, scaleCap: 2.2, maxTriangles: 20_000 },
  { id: "far", woodRatio: 0.08, woodError: 0.6, foliageKeepRatio: 0.035, scaleCap: 3.2, maxTriangles: 5_000 },
];

/**
 * The tier budget is a triangle count, not a ratio. The ratios above land
 * inside `maxTriangles` for every source at or under the ~150k-triangle
 * conditioning budget, but a heavier source carries proportionally more
 * geometry through the same ratio and overshoots — the R3 urban-71 and
 * carnea-47 oaks arrive at 216k and 286k source triangles. Re-running that
 * family with both ratios tightened by the measured overshoot (with headroom,
 * since simplification is not linear in the requested ratio) puts it in the
 * same rendered envelope as its siblings instead of quietly spending another
 * family's share of the instance budget.
 */
const TIER_CAP_ATTEMPTS = 4;

/** Survivor cards grow to cover the silhouette the dropped cards vacated. */
function survivorScale(keepRatio, scaleCap) {
  return Math.min(scaleCap, 1 / Math.sqrt(keepRatio));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function primitiveTriangleCount(primitive) {
  return Math.round(
    (primitive.getIndices()?.getCount() ??
      primitive.getAttribute("POSITION")?.getCount() ??
      0) / 3
  );
}

function documentTriangleCount(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      triangles += primitiveTriangleCount(primitive);
    }
  }
  return triangles;
}

function isFoliagePrimitive(primitive) {
  return primitive.getMaterial()?.getAlphaMode() === "MASK";
}

function readIndices(primitive) {
  const indices = primitive.getIndices();
  if (indices) return Uint32Array.from(indices.getArray());
  const vertexCount = primitive.getAttribute("POSITION").getCount();
  const sequential = new Uint32Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) sequential[index] = index;
  return sequential;
}

function readPositionsAsFloat(primitive) {
  const accessor = primitive.getAttribute("POSITION");
  const source = accessor.getArray();
  const elementSize = accessor.getElementSize();
  const count = accessor.getCount();
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = source[index * elementSize];
    positions[index * 3 + 1] = source[index * elementSize + 1];
    positions[index * 3 + 2] = source[index * elementSize + 2];
  }
  return positions;
}

/**
 * Replaces a primitive's index + vertex streams with the subset used by the
 * kept triangles, compacting every attribute. `positionOverride` supplies
 * per-vertex replacement positions (raw attribute space) for scaled cards.
 */
function rebuildPrimitive(document, primitive, keptIndices, positionOverride) {
  const buffer =
    document.getRoot().listBuffers()[0] ?? document.createBuffer("lod");
  const remap = new Map();
  const newIndexArray = new Uint32Array(keptIndices.length);
  for (let index = 0; index < keptIndices.length; index += 1) {
    const oldVertex = keptIndices[index];
    let newVertex = remap.get(oldVertex);
    if (newVertex === undefined) {
      newVertex = remap.size;
      remap.set(oldVertex, newVertex);
    }
    newIndexArray[index] = newVertex;
  }
  const vertexCount = remap.size;

  for (const semantic of primitive.listSemantics()) {
    const accessor = primitive.getAttribute(semantic);
    const source = accessor.getArray();
    const elementSize = accessor.getElementSize();
    const TypedArray = source.constructor;
    const target = new TypedArray(vertexCount * elementSize);
    const isPosition = semantic === "POSITION";
    const isIntegerPosition = isPosition && !(source instanceof Float32Array);
    for (const [oldVertex, newVertex] of remap) {
      for (let component = 0; component < elementSize; component += 1) {
        let value;
        if (isPosition && positionOverride) {
          value = positionOverride[oldVertex * 3 + component];
          if (isIntegerPosition) value = Math.round(value);
        } else {
          value = source[oldVertex * elementSize + component];
        }
        target[newVertex * elementSize + component] = value;
      }
    }
    const rebuilt = document
      .createAccessor()
      .setType(accessor.getType())
      .setNormalized(accessor.getNormalized())
      .setArray(target)
      .setBuffer(buffer);
    primitive.setAttribute(semantic, rebuilt);
  }

  const indexArray =
    vertexCount > 65535 ? newIndexArray : Uint16Array.from(newIndexArray);
  const rebuiltIndices = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(indexArray)
    .setBuffer(buffer);
  primitive.setIndices(rebuiltIndices);
}

/** Union-find over triangle vertices: connected components = cutout cards. */
function findCardComponents(indices) {
  const parent = new Map();
  const find = (a) => {
    let root = a;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(a) !== root) {
      const next = parent.get(a);
      parent.set(a, root);
      a = next;
    }
    return root;
  };
  const union = (a, b) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    union(indices[triangle], indices[triangle + 1]);
    union(indices[triangle], indices[triangle + 2]);
  }
  const components = new Map();
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const key = find(indices[triangle]);
    let list = components.get(key);
    if (!list) {
      list = [];
      components.set(key, list);
    }
    list.push(triangle);
  }
  return [...components.values()];
}

/** Fallback for welded foliage: cluster triangles into spatial grid cells. */
function clusterTrianglesByGrid(indices, positions, cellSize) {
  const cells = new Map();
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    let centroidX = 0;
    let centroidY = 0;
    let centroidZ = 0;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = indices[triangle + corner];
      centroidX += positions[vertex * 3];
      centroidY += positions[vertex * 3 + 1];
      centroidZ += positions[vertex * 3 + 2];
    }
    const key = `${Math.floor(centroidX / 3 / cellSize)}:${Math.floor(centroidY / 3 / cellSize)}:${Math.floor(centroidZ / 3 / cellSize)}`;
    let list = cells.get(key);
    if (!list) {
      list = [];
      cells.set(key, list);
    }
    list.push(triangle);
  }
  return [...cells.values()];
}

function componentCentroid(component, indices, positions) {
  let x = 0;
  let y = 0;
  let z = 0;
  let samples = 0;
  for (const triangle of component) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = indices[triangle + corner];
      x += positions[vertex * 3];
      y += positions[vertex * 3 + 1];
      z += positions[vertex * 3 + 2];
      samples += 1;
    }
  }
  return { x: x / samples, y: y / samples, z: z / samples };
}

/** Deterministic per-card ordering: hash of the quantized card centroid. */
function centroidHash(centroid, salt) {
  const digest = createHash("sha1")
    .update(
      `${salt}:${Math.round(centroid.x * 8)}:${Math.round(centroid.y * 8)}:${Math.round(centroid.z * 8)}`
    )
    .digest();
  return digest.readUInt32BE(0);
}

/**
 * Whole-card foliage reduction: rank cards by centroid hash, keep the first
 * `keepRatio`, scale survivors about their own centroid. Cards are
 * vertex-disjoint in component mode, so the scale never tears shared edges;
 * grid-fallback cells can share welded vertices, so fallback skips the scale.
 */
function pruneFoliageCards(document, primitive, keepRatio, scaleCap, salt) {
  const indices = readIndices(primitive);
  const positions = readPositionsAsFloat(primitive);
  const totalTriangles = indices.length / 3;
  let components = findCardComponents(indices);
  const largestShare =
    Math.max(...components.map((component) => component.length)) /
    totalTriangles;
  let scaled = true;
  if (components.length < 12 || largestShare > 0.35) {
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = positions[vertex * 3 + axis];
        if (value < bounds.min[axis]) bounds.min[axis] = value;
        if (value > bounds.max[axis]) bounds.max[axis] = value;
      }
    }
    const diagonal = Math.hypot(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2]
    );
    components = clusterTrianglesByGrid(indices, positions, Math.max(diagonal / 28, 1e-3));
    scaled = false;
  }

  const ranked = components
    .map((component) => {
      const centroid = componentCentroid(component, indices, positions);
      return { component, centroid, hash: centroidHash(centroid, salt) };
    })
    .sort((a, b) => a.hash - b.hash);
  const keepCount = Math.max(1, Math.ceil(ranked.length * keepRatio));
  const kept = ranked.slice(0, keepCount);

  let positionOverride;
  if (scaled) {
    const scale = survivorScale(keepRatio, scaleCap);
    positionOverride = Float32Array.from(positions);
    for (const { component, centroid } of kept) {
      const seen = new Set();
      for (const triangle of component) {
        for (let corner = 0; corner < 3; corner += 1) {
          const vertex = indices[triangle + corner];
          if (seen.has(vertex)) continue;
          seen.add(vertex);
          positionOverride[vertex * 3] =
            centroid.x + (positions[vertex * 3] - centroid.x) * scale;
          positionOverride[vertex * 3 + 1] =
            centroid.y + (positions[vertex * 3 + 1] - centroid.y) * scale;
          positionOverride[vertex * 3 + 2] =
            centroid.z + (positions[vertex * 3 + 2] - centroid.z) * scale;
        }
      }
    }
  }

  const keptIndices = [];
  for (const { component } of kept) {
    for (const triangle of component) {
      keptIndices.push(indices[triangle], indices[triangle + 1], indices[triangle + 2]);
    }
  }
  rebuildPrimitive(document, primitive, keptIndices, positionOverride);
  return {
    cardsTotal: ranked.length,
    cardsKept: keepCount,
    scaled,
    trianglesBefore: totalTriangles,
    trianglesAfter: keptIndices.length / 3,
  };
}

function simplifyWood(document, primitive, ratio, error, simplifier) {
  const indices = readIndices(primitive);
  if (indices.length / 3 < 200) return null;
  const positions = readPositionsAsFloat(primitive);
  const targetIndexCount = Math.max(
    3,
    Math.floor((indices.length * ratio) / 3) * 3
  );
  // PlantFactory wood is hundreds of disjoint branch tubes; without `Prune`
  // the simplifier cannot remove twigs and stalls far above the target ratio.
  let simplified;
  try {
    [simplified] = simplifier.simplify(
      indices,
      positions,
      3,
      targetIndexCount,
      error,
      ["Prune"]
    );
  } catch {
    [simplified] = simplifier.simplify(
      indices,
      positions,
      3,
      targetIndexCount,
      error,
      []
    );
  }
  if (!simplified || simplified.length === 0 || simplified.length >= indices.length) {
    return null;
  }
  rebuildPrimitive(document, primitive, Array.from(simplified));
  return {
    trianglesBefore: indices.length / 3,
    trianglesAfter: simplified.length / 3,
  };
}

function multiplyMatrixPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function collectWorldVertices(document) {
  const wood = [];
  const all = [];
  const element = [0, 0, 0];
  const visit = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const matrix = node.getWorldMatrix();
      for (const primitive of mesh.listPrimitives()) {
        const accessor = primitive.getAttribute("POSITION");
        const foliage = isFoliagePrimitive(primitive);
        const count = accessor.getCount();
        for (let vertex = 0; vertex < count; vertex += 1) {
          // getElement denormalizes quantized (normalized int16) positions,
          // so the node transform lands these in real meters.
          accessor.getElement(vertex, element);
          const world = multiplyMatrixPoint(
            matrix,
            element[0],
            element[1],
            element[2]
          );
          all.push(world);
          if (!foliage) wood.push(world);
        }
      }
    }
    for (const child of node.listChildren()) visit(child);
  };
  for (const scene of document.getRoot().listScenes()) {
    for (const node of scene.listChildren()) visit(node);
  }
  return { wood, all };
}

/**
 * Bark radius of the main trunk, measured on wood vertices in a low band
 * above the root flare and below the first limbs. The 35th percentile of
 * horizontal distance from the band's own axis targets the stem cluster:
 * higher percentiles catch low branches on spreading and multi-stem trees.
 */
function measureTrunk(document) {
  const { wood, all } = collectWorldVertices(document);
  if (all.length === 0) return null;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of all) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const height = maxY - minY;
  for (const band of [
    [0.02, 0.07],
    [0.02, 0.2],
  ]) {
    const low = minY + height * band[0];
    const high = minY + height * band[1];
    const slice = wood.filter(([, y]) => y >= low && y <= high);
    if (slice.length < 24) continue;
    const axisX = slice.reduce((sum, [x]) => sum + x, 0) / slice.length;
    const axisZ = slice.reduce((sum, [, , z]) => sum + z, 0) / slice.length;
    const distances = slice
      .map(([x, , z]) => Math.hypot(x - axisX, z - axisZ))
      .sort((a, b) => a - b);
    return {
      sourceHeightMeters: height,
      trunkRadiusMeters: distances[Math.floor(distances.length * 0.35)],
    };
  }
  return { sourceHeightMeters: height, trunkRadiusMeters: null };
}

async function main() {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const requireFromCli = createRequire(resolveGltfTransformCli());
  const [{ NodeIO }, { ALL_EXTENSIONS, EXTMeshoptCompression }, { prune, reorder }] =
    await Promise.all([
      import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
      import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
      import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
    ]);
  const draco3d = requireFromCli("draco3dgltf");
  const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } =
    requireFromCli("meshoptimizer");
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

  const families = [
    ...FAMILIES,
    ...OPTIONAL_FAMILIES.filter((family) => existsSync(resolve(family.source))),
  ];
  const skippedOptional = OPTIONAL_FAMILIES.filter(
    (family) => !existsSync(resolve(family.source))
  );
  if (skippedOptional.length > 0) {
    console.log(
      `Skipping ${skippedOptional.length} optional families with no conditioned source yet: ${skippedOptional.map((family) => family.id).join(", ")}`
    );
  }

  const manifest = {
    schemaVersion: 2,
    purpose:
      "Textured distance tiers for Flow Fest trees: geometry + UVs + original material names, no textures. Runtime re-binds the accepted near-tier materials by name. Wood is meshopt-simplified; foliage cutout cards are kept whole or dropped whole, survivors scaled to preserve silhouette.",
    tiers: Object.fromEntries(
      TIERS.map((tier) => [
        tier.id,
        {
          woodRatio: tier.woodRatio,
          woodError: tier.woodError,
          foliageKeepRatio: tier.foliageKeepRatio,
          survivorScale: Number(
            survivorScale(tier.foliageKeepRatio, tier.scaleCap).toFixed(3)
          ),
        },
      ])
    ),
    families: [],
  };
  const trunkProfiles = [];

  for (const family of families) {
    const sourcePath = resolve(family.source);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing source tree for ${family.id}: ${sourcePath}`);
    }
    const sourceDocument = await io.read(sourcePath);
    const sourceTriangles = documentTriangleCount(sourceDocument);
    const trunk = measureTrunk(sourceDocument);
    trunkProfiles.push({ id: family.id, ...trunk });

    const familyEntry = {
      id: family.id,
      source: basename(sourcePath),
      sourceSha256: sha256(sourcePath),
      sourceTriangles,
      sourceHeightMeters: trunk ? Number(trunk.sourceHeightMeters.toFixed(2)) : null,
      trunkRadiusMeters:
        trunk?.trunkRadiusMeters != null
          ? Number(trunk.trunkRadiusMeters.toFixed(3))
          : null,
      tiers: {},
    };

    for (const tier of TIERS) {
      let tighten = 1;
      for (let attempt = 0; attempt < TIER_CAP_ATTEMPTS; attempt += 1) {
      const woodRatio = tier.woodRatio * tighten;
      const foliageKeepRatio = tier.foliageKeepRatio * tighten;
      const document = await io.read(sourcePath);
      // Re-encoding compression buys nothing at these sizes and would force
      // decoder round-trips; the extensions must go or NodeIO re-applies them.
      for (const extension of document.getRoot().listExtensionsUsed()) {
        if (
          [
            "KHR_draco_mesh_compression",
            "EXT_meshopt_compression",
            "KHR_texture_basisu",
          ].includes(extension.extensionName)
        ) {
          extension.dispose();
        }
      }

      const foliageStats = [];
      const woodStats = [];
      for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
          if (isFoliagePrimitive(primitive)) {
            foliageStats.push(
              pruneFoliageCards(
                document,
                primitive,
                foliageKeepRatio,
                tier.scaleCap,
                `${family.id}:${tier.id}`
              )
            );
          } else {
            const stats = simplifyWood(
              document,
              primitive,
              woodRatio,
              tier.woodError,
              MeshoptSimplifier
            );
            if (stats) woodStats.push(stats);
          }
        }
      }

      const placeholders = new Map();
      for (const mesh of document.getRoot().listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
          const sourceMaterial = primitive.getMaterial();
          const materialName = sourceMaterial?.getName() || "tree-material";
          let placeholder = placeholders.get(materialName);
          if (!placeholder) {
            placeholder = document
              .createMaterial(materialName)
              .setExtras({ tka_source_material_name: materialName })
              .setDoubleSided(sourceMaterial?.getDoubleSided() ?? false)
              .setAlphaMode(sourceMaterial?.getAlphaMode() ?? "OPAQUE")
              .setAlphaCutoff(sourceMaterial?.getAlphaCutoff() ?? 0.5);
            placeholders.set(materialName, placeholder);
          }
          primitive.setMaterial(placeholder);
        }
      }
      await document.transform(prune({ keepAttributes: true }));
      // Geometry-only files meshopt-compress 3-5x; the runtime loader already
      // registers the decoder for the near-tier plantcatalog assets.
      await document.transform(reorder({ encoder: MeshoptEncoder }));
      document
        .createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

      const outputPath = resolve(OUTPUT_DIRECTORY, `${family.id}-${tier.id}.glb`);
      await io.write(outputPath, document);
      const outputTriangles = documentTriangleCount(document);
      familyEntry.tiers[tier.id] = {
        output: basename(outputPath),
        outputSha256: sha256(outputPath),
        outputBytes: statSync(outputPath).size,
        outputTriangles,
        foliageCardsTotal: foliageStats.reduce((sum, s) => sum + s.cardsTotal, 0),
        foliageCardsKept: foliageStats.reduce((sum, s) => sum + s.cardsKept, 0),
        foliageScaled: foliageStats.every((s) => s.scaled),
        woodTrianglesBefore: woodStats.reduce((sum, s) => sum + s.trianglesBefore, 0),
        woodTrianglesAfter: woodStats.reduce((sum, s) => sum + s.trianglesAfter, 0),
      };
      console.log(
        `${family.id} ${tier.id}: ${sourceTriangles} -> ${outputTriangles} tris, ` +
          `${familyEntry.tiers[tier.id].foliageCardsKept}/${familyEntry.tiers[tier.id].foliageCardsTotal} cards, ` +
          `${(statSync(outputPath).size / 1024).toFixed(0)} KiB` +
          (tighten < 1 ? ` (ratios x${tighten.toFixed(3)} for the tier cap)` : "")
      );

      if (outputTriangles <= tier.maxTriangles) break;
      if (attempt === TIER_CAP_ATTEMPTS - 1) {
        throw new Error(
          `${family.id} ${tier.id} stayed over its ${tier.maxTriangles}-triangle ` +
            `cap at ${outputTriangles} after ${TIER_CAP_ATTEMPTS} attempts`
        );
      }
      tighten *= (tier.maxTriangles / outputTriangles) * 0.9;
      }
    }
    manifest.families.push(familyEntry);
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nManifest: ${MANIFEST_PATH}`);

  console.log(
    "\n// Trunk profiles measured from wood geometry (paste into flow-fest-forest-ecology.ts):"
  );
  console.log(
    "export const FLOW_FEST_FOREST_TRUNK_PROFILES: Record<string, { radiusPerHeight: number }> = {"
  );
  for (const profile of trunkProfiles) {
    if (profile.trunkRadiusMeters == null) {
      console.log(`  // ${profile.id}: no measurable trunk band`);
      continue;
    }
    const perHeight = profile.trunkRadiusMeters / profile.sourceHeightMeters;
    console.log(
      `  "${profile.id}": { radiusPerHeight: ${perHeight.toFixed(4)} }, // r=${profile.trunkRadiusMeters.toFixed(2)}m at h=${profile.sourceHeightMeters.toFixed(1)}m`
    );
  }
  console.log("};");
}

await main();
