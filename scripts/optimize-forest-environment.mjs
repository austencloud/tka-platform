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

async function resizeGroundLifeTextures(input, output) {
  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [{ NodeIO }, { ALL_EXTENSIONS }] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  ]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const root = document.getRoot();
  const groundTextures = new Map();

  function registerTexture(texture, quality) {
    if (!texture) return;
    groundTextures.set(
      texture,
      Math.max(quality, groundTextures.get(texture) ?? 0)
    );
  }

  for (const mesh of root.listMeshes()) {
    if (!mesh.getName().startsWith("ForestGroundLifeVariantMesh_")) continue;
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (!material) continue;
      registerTexture(material.getBaseColorTexture(), 84);
      registerTexture(material.getMetallicRoughnessTexture(), 90);
      registerTexture(material.getNormalTexture(), 92);
      registerTexture(material.getOcclusionTexture(), 90);
    }
  }

  let resized = 0;
  for (const [texture, quality] of groundTextures) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if ((metadata.width ?? 0) <= 1024 && (metadata.height ?? 0) <= 1024) {
      continue;
    }
    const resizedImage = await sharp(image)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
    texture.setImage(resizedImage);
    texture.setMimeType("image/webp");
    resized += 1;
  }

  await io.write(output, document);
  console.log(`Resized ${resized} Forest ground-life textures to 1024 px`);
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
  console.log("\nResize Forest ground-life textures");
  await resizeGroundLifeTextures(TMP, TMP_TEXTURES);
  run("Apply meshopt geometry compression", ["meshopt", TMP_TEXTURES, OUTPUT]);
} finally {
  if (existsSync(TMP)) rmSync(TMP);
  if (existsSync(TMP_TEXTURES)) rmSync(TMP_TEXTURES);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest asset", ["inspect", OUTPUT]);
