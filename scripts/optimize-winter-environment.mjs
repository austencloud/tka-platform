#!/usr/bin/env node
/**
 * Optimize the Blender-authored Moonlit Winter Hollow for WebGL delivery.
 *
 * Geometry is simplified and instanced first. Textures are then normalized to
 * PNG for KTX-Software, encoded as GPU-compressed KTX2, and meshopt is applied
 * last. WebP reduced the download but expanded all 42 Winter textures back to
 * raw pixels in VRAM; the runtime already wires KTX2Loader, so the asset should
 * use the format its loader advertises.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/winter/winter-environment_raw.glb");
const OUTPUT = resolve("static/models/winter/winter-environment.glb");
const TMP_SLIM = resolve("static/models/winter/_winter-slim.glb");
const TMP_INSTANCED = resolve("static/models/winter/_winter-instanced.glb");
const TMP_PNG = resolve("static/models/winter/_winter-png.glb");
const TMP_UASTC = resolve("static/models/winter/_winter-uastc.glb");
const TMP_ETC = resolve("static/models/winter/_winter-etc.glb");
const TEMPORARIES = [TMP_SLIM, TMP_INSTANCED, TMP_PNG, TMP_UASTC, TMP_ETC];
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
const KTX_BIN = resolve(".tools/ktx");
const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";
const ENVIRONMENT = {
  ...process.env,
  PATH: `${KTX_BIN}${PATH_SEPARATOR}${process.env.PATH}`,
};

const CLI_PACKAGE_JSON = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const requireFromCli = createRequire(CLI_PACKAGE_JSON);
const { NodeIO } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))
);
const { textureCompress } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))
);

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
    env: ENVIRONMENT,
  });
}

function clean() {
  for (const path of TEMPORARIES) {
    if (existsSync(path)) rmSync(path);
  }
}

if (!existsSync(INPUT)) {
  throw new Error(`Winter source GLB does not exist: ${INPUT}`);
}
if (
  !existsSync(resolve(KTX_BIN, "toktx.exe")) &&
  !existsSync(resolve(KTX_BIN, "toktx"))
) {
  throw new Error(`KTX-Software is missing from ${KTX_BIN}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  run("Simplify, deduplicate, resize, and preserve linked scenery", [
    "optimize",
    INPUT,
    TMP_SLIM,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "1024",
    "--simplify",
    "true",
    "--simplify-ratio",
    "0.10",
    "--simplify-error",
    "0.05",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  run("Convert every repeated optimized mesh to GPU instances", [
    "instance",
    TMP_SLIM,
    TMP_INSTANCED,
    "--min",
    "2",
  ]);

  console.log("\nNormalize textures to PNG; detail maps to 512px");
  {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(TMP_INSTANCED);
    await document.transform(
      textureCompress({ encoder: sharp, targetFormat: "png" })
    );
    await document.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
        resize: [512, 512],
      })
    );
    await io.write(TMP_PNG, document);
    console.log(`PNG intermediate: ${size(TMP_PNG)}`);
  }

  run("Encode normal, metallic-roughness, and occlusion maps as KTX2 UASTC", [
    "uastc",
    TMP_PNG,
    TMP_UASTC,
    "--slots",
    "{normalTexture,metallicRoughnessTexture,occlusionTexture}",
    "--level",
    "4",
    "--zstd",
    "18",
  ]);
  run("Encode color and emissive maps as KTX2 ETC1S", [
    "etc1s",
    TMP_UASTC,
    TMP_ETC,
    "--slots",
    "{baseColorTexture,emissiveTexture}",
    "--quality",
    "200",
  ]);
  run("Apply meshopt geometry compression", ["meshopt", TMP_ETC, OUTPUT]);
} finally {
  clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Winter asset", ["inspect", OUTPUT]);
