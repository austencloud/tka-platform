#!/usr/bin/env node
/** Optimize the Blender-authored Moonlit Firefly Forest for WebGL delivery. */

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/forest/forest-environment_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-environment.glb");
const TMP = resolve("static/models/forest/_forest-optimized.glb");
const TMP_TEXTURES = resolve("static/models/forest/_forest-webp.glb");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
  });
}

async function resizeDistanceTierTextures(input, output) {
  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [
    { NodeIO },
    { ALL_EXTENSIONS },
    { simplifyPrimitive, weld },
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
  // Lossless: merges only bitwise-identical vertices. The Blender round-trip
  // splits vertices at every face corner -- the PlantCatalog oak arrived at
  // 2.77 vertices per triangle -- and the simplifier below can only collapse
  // across shared vertices, so welding is both a direct size win and the
  // precondition for the wood reduction to do anything.
  await document.transform(weld());
  const root = document.getRoot();
  const textureTiers = new Map();

  function registerTexture(texture, maxSize, quality) {
    if (!texture) return;
    const current = textureTiers.get(texture);
    textureTiers.set(texture, {
      maxSize: Math.max(maxSize, current?.maxSize ?? 0),
      quality: Math.max(quality, current?.quality ?? 0),
    });
  }

  for (const mesh of root.listMeshes()) {
    const meshName = mesh.getName();
    const isGroundLife = meshName.startsWith("ForestGroundLifeVariantMesh_");
    const isMassForestTree = meshName.startsWith("ForestTreeMesh_");
    const isSemanticSummerTree = meshName.startsWith(
      "ForestTreeMesh_semantic-"
    );
    if (isSemanticSummerTree) {
      const semanticCanopy = mesh
        .listPrimitives()
        .find((primitive) => {
          const name = primitive.getMaterial()?.getName() ?? "";
          return !/_hybrid|_Bark/i.test(name);
        });
      const paletteMaterial = semanticCanopy?.getMaterial();
      if (semanticCanopy && paletteMaterial) {
        const semanticMaterial = paletteMaterial
          .clone()
          .setName(
            `ForestSemanticCanopy_${meshName.replace("ForestTreeMesh_", "")}_foliage_canopy_lod`
          );
        semanticCanopy.setMaterial(semanticMaterial);
      }
    }
    const isTerrain = meshName === "Forest Sculpted Terrain Mesh";
    if (!isGroundLife && !isMassForestTree && !isTerrain) continue;
    const maxSize = isMassForestTree ? 512 : 1024;
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (!material) continue;
      if (isTerrain) {
        registerTexture(material.getBaseColorTexture(), 4096, 91);
        registerTexture(material.getMetallicRoughnessTexture(), 1024, 86);
        registerTexture(material.getNormalTexture(), 1024, 88);
        registerTexture(material.getOcclusionTexture(), 1024, 86);
      } else if (isMassForestTree) {
        const isHybridPhotographicFoliage = /_hybrid/i.test(
          material.getName()
        );
        if (isSemanticSummerTree && !isHybridPhotographicFoliage) {
          // The semantic bark remains a distance-tier Meshy surface. Hybrid
          // crowns below use the same photographic budget as Poly Haven.
          registerTexture(material.getBaseColorTexture(), 256, 82);
          registerTexture(material.getMetallicRoughnessTexture(), 96, 82);
          registerTexture(material.getNormalTexture(), 192, 84);
          registerTexture(material.getOcclusionTexture(), 96, 82);
        } else {
          // Keep the alpha-bearing Poly Haven color atlas at the full mass-tree
          // tier. Its leaf edges carry more visual information than the far
          // response maps.
          registerTexture(material.getBaseColorTexture(), 512, 82);
          registerTexture(material.getMetallicRoughnessTexture(), 256, 84);
          registerTexture(material.getNormalTexture(), 384, 86);
          registerTexture(material.getOcclusionTexture(), 256, 84);
        }
      } else {
        registerTexture(material.getBaseColorTexture(), maxSize, 84);
        registerTexture(material.getMetallicRoughnessTexture(), maxSize, 88);
        registerTexture(material.getNormalTexture(), maxSize, 90);
        registerTexture(material.getOcclusionTexture(), maxSize, 88);
      }
    }
  }

  let resized = 0;
  for (const [texture, tier] of textureTiers) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if (
      (metadata.width ?? 0) <= tier.maxSize &&
      (metadata.height ?? 0) <= tier.maxSize
    ) {
      continue;
    }
    const resizedImage = await sharp(image)
      .resize(tier.maxSize, tier.maxSize, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: tier.quality, effort: 6 })
      .toBuffer();
    texture.setImage(resizedImage);
    texture.setMimeType("image/webp");
    resized += 1;
  }

  let treeTrianglesBefore = 0;
  let treeTrianglesAfter = 0;
  for (const mesh of root.listMeshes()) {
    if (!mesh.getName().startsWith("ForestTreeMesh_")) continue;
    const isSemanticSummerTree = mesh
      .getName()
      .startsWith("ForestTreeMesh_semantic-");
    const meshTriangleCount = mesh
      .listPrimitives()
      .reduce(
        (total, primitive) =>
          total +
          (primitive.getIndices()?.getCount() ??
            primitive.getAttribute("POSITION")?.getCount() ??
            0) /
            3,
        0
      );
    for (const primitive of mesh.listPrimitives()) {
      const materialName = primitive.getMaterial()?.getName() ?? "";
      const isFoliage = /leaves|twig|foliage/i.test(materialName);
      const isCanopyLod = /_canopy_lod/i.test(materialName);
      const isSemanticCanopyLod =
        /ForestSemanticCanopy_.*_canopy_lod/i.test(materialName);
      const isHybridPhotographicFoliage = /_hybrid/i.test(materialName);
      // PlantCatalog cutout cards never enter this ladder: a card's shape lives
      // in its alpha mask rather than in its edges, so the generic foliage
      // branch's 0.53 would only delete leaves -- the exact collapse the
      // canopy_lod branch above already refuses to perform on authored cards.
      // Opaque wood is the opposite case. It is real surface geometry with a
      // bounded silhouette error, the same property the bridge conditioning
      // stage exploits with its own opaque-only simplify, and this file is the
      // distance layer -- the near-frame GLB owns every close-up. Without this
      // branch the seven PlantCatalog trees carry ~81 MB of decoded vertex data
      // into a 20 MiB budget.
      const isPlantCatalog = /^ForestPlantCatalog_/.test(materialName);
      const isPlantCatalogOpaque =
        isPlantCatalog && materialName.includes("_Opaque_");
      const before =
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
      treeTrianglesBefore += before;
      if (isPlantCatalogOpaque && before >= 1_000) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: 0.35,
          error: 0.025,
          lockBorder: false,
        });
      } else if (isPlantCatalog) {
        // Intentionally nothing: cutout cards keep every triangle.
      } else if (isSemanticCanopyLod && before >= 1_000) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: 0.025,
          error: 0.18,
          lockBorder: false,
        });
      } else if (isCanopyLod) {
        // The support primitive is already a sparse authored selection. Any
        // further simplification can collapse its disconnected alpha cards.
      } else if (
        isSemanticSummerTree &&
        !isHybridPhotographicFoliage &&
        before >= 1_000
      ) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: isFoliage ? 0.12 : 0.32,
          error: isFoliage ? 0.035 : 0.02,
          lockBorder: false,
        });
      } else if (isFoliage && meshTriangleCount >= 50_000 && before >= 5_000) {
        // The main environment is never the walk-up foliage layer. Reduce its
        // photographic cards conservatively; the separate near-frame GLB keeps
        // the full close silhouette and texture density.
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: isHybridPhotographicFoliage ? 0.37 : 0.53,
          error: isHybridPhotographicFoliage ? 0.03 : 0.015,
          lockBorder: false,
        });
      } else if (!isFoliage && meshTriangleCount >= 15_000 && before >= 1_000) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: 0.35,
          error: 0.025,
          lockBorder: false,
        });
      }
      treeTrianglesAfter +=
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
    }
  }

  await io.write(output, document);
  console.log(
    `Resized ${resized} Forest textures: Poly Haven color/alpha at 512 px, semantic crown color at 256 px, and distance response maps at 96-384 px`
  );
  console.log(
    `Simplified mass-tree prototypes from ${Math.round(treeTrianglesBefore).toLocaleString()} to ${Math.round(treeTrianglesAfter).toLocaleString()} triangles`
  );
}

if (!existsSync(INPUT)) {
  throw new Error(`Forest source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TMP)) rmSync(TMP);
if (existsSync(TMP_TEXTURES)) rmSync(TMP_TEXTURES);
try {
  run("Deduplicate and resize Forest textures", [
    "optimize",
    INPUT,
    TMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "4096",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  console.log("\nApply Forest distance texture tiers");
  await resizeDistanceTierTextures(TMP, TMP_TEXTURES);
  // Explicit quantization, because the defaults left the PlantCatalog wave at
  // 26.9 MiB against the 20 MiB budget. 12-bit positions resolve to under 4 mm
  // across the largest tree's bounds and ~2 cm across the 80 m terrain --
  // below what the distance tier can show. Normals at 8 bits suit matte
  // foliage; texcoords keep 10 bits so cutout alpha edges stay within one
  // texel of the 512-1024 px atlases; COLOR_0 is the wind mask, and 8 bits
  // still gives 256 amplitude steps to a displacement of a few tens of cm.
  run("Apply Draco geometry compression", [
    "draco",
    TMP_TEXTURES,
    OUTPUT,
    "--quantize-position",
    "12",
    "--quantize-normal",
    "8",
    "--quantize-texcoord",
    "10",
    "--quantize-color",
    "8",
  ]);
} finally {
  if (existsSync(TMP)) rmSync(TMP);
  if (existsSync(TMP_TEXTURES)) rmSync(TMP_TEXTURES);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest asset", ["inspect", OUTPUT]);
