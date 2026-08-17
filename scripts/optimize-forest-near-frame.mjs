#!/usr/bin/env node
/** Optimize the conditional Moonlit Firefly Forest close-frame layer. */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/forest/forest-near-frame_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-near-frame.glb");
const TEMP = resolve("static/models/forest/_forest-near-frame-optimized.glb");
const TEMP_LOD = resolve("static/models/forest/_forest-near-frame-lod.glb");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
const LAYOUT_PATH = resolve("scripts/forest-static-prop-layout.json");
const layoutBytes = readFileSync(LAYOUT_PATH);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");

const GROUND_ECOSYSTEM_SPECIES = new Map([
  ["summer-sward", { tier: "Base", family: "grass" }],
  ["woodland-grass", { tier: "Base", family: "grass" }],
  ["bracken-fern", { tier: "Medium", family: "fern" }],
  ["summer-forb", { tier: "Medium", family: "forb" }],
  ["forest-moss", { tier: "Medium", family: "moss" }],
  ["nettle-colony", { tier: "High", family: "forb" }],
  ["periwinkle-patch", { tier: "High", family: "flower" }],
  ["summer-wildflower", { tier: "High", family: "flower" }],
]);
const GROUND_STRATUM_WIND_RESPONSE = new Map([
  ["worn", 0.18],
  ["carpet", 0.58],
  ["meadow", 1],
  ["seed", 1.22],
]);

function inferGroundEcosystemIdentity(meshName) {
  if (!meshName.startsWith("ForestEcosystemMesh_")) return null;
  for (const [species, identity] of GROUND_ECOSYSTEM_SPECIES) {
    if (meshName.startsWith(`ForestEcosystemMesh_${species}_`)) {
      const stratum = ["worn", "carpet", "meadow", "seed"].find((candidate) =>
        meshName.startsWith(`ForestEcosystemMesh_${species}_${candidate}_`)
      );
      return { species, stratum: stratum ?? "legacy", ...identity };
    }
  }
  return null;
}

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
  });
}

async function simplifyNearFrameTrees(input, output) {
  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [
    { NodeIO },
    { ALL_EXTENSIONS },
    { simplifyPrimitive },
    { MeshoptSimplifier },
  ] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
    import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
  ]);
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const root = document.getRoot();
  let trianglesBefore = 0;
  let trianglesAfter = 0;
  const treeTextures = new Map();

  for (const node of root.listNodes()) {
    const meshName = node.getMesh()?.getName() ?? "";
    const identity = inferGroundEcosystemIdentity(meshName);
    if (!identity) continue;
    const sourceExtras = node.getExtras() ?? {};
    const batch = node.getExtension("EXT_mesh_gpu_instancing");
    const instanceCount = batch?.getAttribute("TRANSLATION")?.getCount() ?? 1;
    const { species, stratum, tier, family } = identity;
    const variant = meshName.replace("ForestEcosystemMesh_", "");
    const sourcePatchIds = String(sourceExtras.tka_ground_patch_ids ?? "");
    node.setName(`Forest_Ecosystem_${tier}_${species}_${variant}`);
    node.setExtras({
      tka_role: "near-frame-ground-ecosystem",
      tka_export_layer: "near-frame",
      tka_static_prop_layout_version: Number(layout.version),
      tka_static_prop_layout_sha256: layoutSha256,
      tka_meadow_system_version: 10,
      tka_ground_ecosystem_version: 7,
      tka_ground_species: species,
      tka_ground_stratum: stratum,
      tka_wind_response: GROUND_STRATUM_WIND_RESPONSE.get(stratum) ?? 1,
      tka_ground_family: sourceExtras.tka_ground_family ?? family,
      ...(sourcePatchIds ? { tka_grass_patch_ids: sourcePatchIds } : {}),
      tka_grass_quality_tier: tier.toLowerCase(),
      tka_grass_clumps: Number(sourceExtras.tka_grass_clumps ?? instanceCount),
    });
  }

  function registerTreeTexture(texture, maxSize, quality) {
    if (!texture) return;
    const current = treeTextures.get(texture);
    treeTextures.set(texture, {
      maxSize: Math.max(maxSize, current?.maxSize ?? 0),
      quality: Math.max(quality, current?.quality ?? 0),
    });
  }

  for (const mesh of root.listMeshes()) {
    const isTree = mesh.getName().startsWith("ForestTreeMesh_");
    const isGroundEcosystem = mesh.getName().startsWith("ForestEcosystemMesh_");
    const isCampShelf = mesh.getName() === "Forest Camp Shelf Mesh";
    if (!isTree && !isCampShelf && !isGroundEcosystem) continue;
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      const materialName = material?.getName() ?? "";
      // PlantCatalog trees name their materials on two axes, and the one that
      // matters here is surface rather than family: a lichen card is wood that
      // still needs a crisp alpha mask, so `_Cutout_` is the test, not the
      // word "leaves". The /leaves|twig/ pattern below matches none of these
      // names, which is how the frame oak lost 78% of its leaf cards to the
      // woody simplify branch on the first integration bake -- 52,480 foliage
      // triangles down to 11,607, on the one tree the camera stands next to.
      const isPlantCatalog = /^ForestPlantCatalog_/.test(materialName);
      const isFoliage = isPlantCatalog
        ? /_Cutout_/.test(materialName)
        : /leaves|twig/i.test(materialName);
      if (material) {
        // Keep the color-and-alpha atlas sharp enough for nearby leaf edges.
        // Surface-response maps can use a smaller tier because they add bark
        // and leaf breakup without carrying the visible silhouette.
        registerTreeTexture(
          material.getBaseColorTexture(),
          isTree ? (isFoliage ? 1024 : 576) : isGroundEcosystem ? 768 : 2048,
          isTree && !isFoliage ? 88 : 90
        );
        registerTreeTexture(
          material.getNormalTexture(),
          isTree ? (isFoliage ? 768 : 512) : isGroundEcosystem ? 640 : 768,
          88
        );
        registerTreeTexture(
          material.getMetallicRoughnessTexture(),
          isTree ? 320 : isGroundEcosystem ? 384 : 768,
          86
        );
        registerTreeTexture(
          material.getOcclusionTexture(),
          isTree ? 320 : isGroundEcosystem ? 384 : 768,
          86
        );
      }
      if (!isTree) continue;
      const before =
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
      trianglesBefore += before;
      if (isPlantCatalog) {
        // Intentionally nothing. These trees arrive already reduced, bounded by
        // an explicit surface error rather than by a ratio, and the tier that
        // reaches the near frame is the low-detail one -- there is no second
        // reduction to take. Handing them to the branch below would spend the
        // same budget twice on the closest tree in the scene.
      } else if (!isFoliage && before >= 1_000) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: 0.22,
          error: 0.018,
          lockBorder: false,
        });
      }
      trianglesAfter +=
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
    }
  }

  let resizedTextures = 0;
  for (const [texture, tier] of treeTextures) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if (
      (metadata.width ?? 0) <= tier.maxSize &&
      (metadata.height ?? 0) <= tier.maxSize
    ) {
      continue;
    }
    texture.setImage(
      await sharp(image)
        .resize(tier.maxSize, tier.maxSize, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: tier.quality, effort: 6 })
        .toBuffer()
    );
    texture.setMimeType("image/webp");
    resizedTextures += 1;
  }

  await io.write(output, document);
  console.log(
    `Simplified near-frame tree prototypes from ${Math.round(trianglesBefore).toLocaleString()} to ${Math.round(trianglesAfter).toLocaleString()} triangles`
  );
  console.log(
    `Resized ${resizedTextures} near-frame tree textures across 1024 px foliage color/alpha, 768 px foliage normals, 576 px woody color, 512 px woody normals, and 320 px response tiers`
  );
}

if (!existsSync(INPUT)) {
  throw new Error(`Forest near-frame source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TEMP)) rmSync(TEMP);
if (existsSync(TEMP_LOD)) rmSync(TEMP_LOD);
try {
  run("Deduplicate and resize Forest near-frame textures", [
    "optimize",
    INPUT,
    TEMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "2048",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  console.log("\nBuild close-frame tree LOD");
  await simplifyNearFrameTrees(TEMP, TEMP_LOD);
  run("Apply Draco geometry compression", ["draco", TEMP_LOD, OUTPUT]);
} finally {
  if (existsSync(TEMP)) rmSync(TEMP);
  if (existsSync(TEMP_LOD)) rmSync(TEMP_LOD);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest near-frame asset", ["inspect", OUTPUT]);
