#!/usr/bin/env node
/**
 * Optimize the Blender-authored Astral Reliquary for mobile WebGL.
 *
 * Geometry is simplified conservatively, color maps use KTX2 ETC1S,
 * quality-sensitive maps use KTX2 UASTC, and meshopt is applied last.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, rmSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import sharp from "sharp";

const INPUT = resolve("static/models/cosmic/cosmic-reliquary_raw.glb");
const OUTPUT = resolve("static/models/cosmic/cosmic-reliquary.glb");
const TMP_SLIM = resolve("static/models/cosmic/_tmp_cosmic_slim.glb");
const TMP_PNG = resolve("static/models/cosmic/_tmp_cosmic_png.glb");
const TMP_UASTC = resolve("static/models/cosmic/_tmp_cosmic_uastc.glb");
const TMP_ETC = resolve("static/models/cosmic/_tmp_cosmic_etc.glb");
const TEMPORARIES = [TMP_SLIM, TMP_PNG, TMP_UASTC, TMP_ETC];

const KTX_BIN = resolve(".tools/ktx");
const separator = process.platform === "win32" ? ";" : ":";
const environment = { ...process.env, PATH: `${KTX_BIN}${separator}${process.env.PATH}` };

const cliPackage = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json",
);
const requireFromCli = createRequire(cliPackage);
const { NodeIO } = await import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core")));
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions")),
);
const { textureCompress } = await import(
  pathToFileURL(requireFromCli.resolve("@gltf-transform/functions")),
);

const sizeInMb = (path) => (statSync(path).size / 1024 / 1024).toFixed(1);

function run(label, command) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit", env: environment });
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  process.exit(1);
}
if (!existsSync(resolve(KTX_BIN, "toktx.exe")) && !existsSync(resolve(KTX_BIN, "toktx"))) {
  console.error(`KTX-Software not found in ${KTX_BIN}.`);
  process.exit(1);
}

try {
  console.log(`Input: ${INPUT} (${sizeInMb(INPUT)} MB)`);
  run(
    "Geometry, instancing, and texture resize",
    [
      "npx gltf-transform optimize",
      `"${INPUT}" "${TMP_SLIM}"`,
      "--compress false",
      "--texture-compress webp",
      "--texture-size 1024",
      "--simplify true",
      "--simplify-ratio 0.72",
      "--simplify-error 0.02",
      "--instance true",
      "--flatten true",
    ].join(" "),
  );

  console.log("\n── Normalize textures to PNG for KTX-Software ──");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(TMP_SLIM);
  await document.transform(textureCompress({ encoder: sharp, targetFormat: "png" }));
  await io.write(TMP_PNG, document);

  run(
    "KTX2 UASTC for normal and data maps",
    [
      "npx gltf-transform uastc",
      `"${TMP_PNG}" "${TMP_UASTC}"`,
      '--slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}"',
      "--level 4",
      "--zstd 18",
    ].join(" "),
  );
  run(
    "KTX2 ETC1S for base color and emission",
    [
      "npx gltf-transform etc1s",
      `"${TMP_UASTC}" "${TMP_ETC}"`,
      '--slots "{baseColorTexture,emissiveTexture}"',
      "--quality 220",
    ].join(" "),
  );
  run("Meshopt geometry compression", `npx gltf-transform meshopt "${TMP_ETC}" "${OUTPUT}"`);
  console.log(`\nOutput: ${OUTPUT} (${sizeInMb(OUTPUT)} MB)`);
  run("Validate result", `npx gltf-transform validate "${OUTPUT}"`);
  run("Inspect result", `npx gltf-transform inspect "${OUTPUT}"`);
} finally {
  for (const temporary of TEMPORARIES) {
    if (existsSync(temporary)) rmSync(temporary);
  }
}
