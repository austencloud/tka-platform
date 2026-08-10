#!/usr/bin/env node
/** Optimize Seraphic Vault for mobile WebGL delivery. */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/celestial/celestial-environment_raw.glb");
const OUTPUT = resolve("static/models/celestial/celestial-environment.glb");
const TMP_SLIM = resolve("static/models/celestial/_celestial-slim.glb");
const TMP_INSTANCED = resolve(
  "static/models/celestial/_celestial-instanced.glb"
);
const TMP_PNG = resolve("static/models/celestial/_celestial-png.glb");
const TMP_UASTC = resolve("static/models/celestial/_celestial-uastc.glb");
const TMP_ETC = resolve("static/models/celestial/_celestial-etc.glb");
const TEMPORARIES = [TMP_SLIM, TMP_INSTANCED, TMP_PNG, TMP_UASTC, TMP_ETC];

const KTX_BIN = resolve(".tools/ktx");
const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";
const ENV = {
  ...process.env,
  PATH: `${KTX_BIN}${PATH_SEPARATOR}${process.env.PATH}`,
};
const CLI_PACKAGE = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const GLTF_CLI = `"${process.execPath}" "${resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/bin/cli.js"
)}"`;
const requireFromCli = createRequire(CLI_PACKAGE);
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

function run(label, command) {
  console.log(`\n${label}`);
  console.log(`  ${command}`);
  execSync(command, { stdio: "inherit", env: ENV });
}

function clean() {
  for (const path of TEMPORARIES) {
    if (existsSync(path)) rmSync(path);
  }
}

if (!existsSync(INPUT))
  throw new Error(`Celestial source GLB does not exist: ${INPUT}`);
if (
  !existsSync(resolve(KTX_BIN, "toktx.exe")) &&
  !existsSync(resolve(KTX_BIN, "toktx"))
) {
  throw new Error(`KTX-Software is missing from ${KTX_BIN}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  run(
    "Preserve the feather silhouette while deduplicating delivery data",
    [
      `${GLTF_CLI} optimize`,
      `"${INPUT}" "${TMP_SLIM}"`,
      "--compress false",
      "--texture-compress webp",
      "--texture-size 1024",
      "--simplify true",
      "--simplify-ratio 0.82",
      "--simplify-error 0.002",
      "--instance true",
      "--flatten false",
      "--join false",
    ].join(" ")
  );
  run(
    "Collapse mirrored rib pairs into GPU instances",
    `${GLTF_CLI} instance "${TMP_SLIM}" "${TMP_INSTANCED}" --min 2`
  );

  console.log("\nNormalize textures for KTX2 encoding");
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
    console.log(`  wrote ${TMP_PNG} (${size(TMP_PNG)})`);
  }

  run(
    "Encode normal and material maps as KTX2 UASTC",
    [
      `${GLTF_CLI} uastc`,
      `"${TMP_PNG}" "${TMP_UASTC}"`,
      '--slots "{normalTexture,metallicRoughnessTexture,occlusionTexture}"',
      "--level 4",
      "--zstd 18",
    ].join(" ")
  );
  run(
    "Encode color and emissive maps as KTX2 ETC1S",
    [
      `${GLTF_CLI} etc1s`,
      `"${TMP_UASTC}" "${TMP_ETC}"`,
      '--slots "{baseColorTexture,emissiveTexture}"',
      "--quality 200",
    ].join(" ")
  );
  run(
    "Apply meshopt geometry compression",
    `${GLTF_CLI} meshopt "${TMP_ETC}" "${OUTPUT}"`
  );
} finally {
  clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Celestial asset", `${GLTF_CLI} inspect "${OUTPUT}"`);
