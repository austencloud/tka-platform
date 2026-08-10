#!/usr/bin/env node
/** Optimize the Olive Cloudbreak production slice for WebGL delivery. */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const integrated = process.argv.includes("--integrated");
const assetStem = integrated
  ? "seraphic-vault-integrated-sanctuaries"
  : "olive-cloudbreak-production-slice";
const temporaryStem = integrated ? "seraphic-integrated" : "olive-cloudbreak";
const INPUT = resolve(`static/models/celestial/${assetStem}_raw.glb`);
const OUTPUT = resolve(`static/models/celestial/${assetStem}.glb`);
const TMP_SLIM = resolve(`static/models/celestial/_${temporaryStem}-slim.glb`);
const TMP_PNG = resolve(`static/models/celestial/_${temporaryStem}-png.glb`);
const TMP_UASTC = resolve(
  `static/models/celestial/_${temporaryStem}-uastc.glb`
);
const TMP_ETC = resolve(`static/models/celestial/_${temporaryStem}-etc.glb`);
const TEMPORARIES = [TMP_SLIM, TMP_PNG, TMP_UASTC, TMP_ETC];

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

if (!existsSync(INPUT)) {
  throw new Error(`Celestial production source does not exist: ${INPUT}`);
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
  run(
    "Preserve the Cloudbreak limestone silhouette while reducing delivery cost",
    [
      `${GLTF_CLI} optimize`,
      `"${INPUT}" "${TMP_SLIM}"`,
      "--compress false",
      "--texture-compress webp",
      "--texture-size 768",
      "--simplify true",
      "--simplify-ratio 0.82",
      "--simplify-error 0.002",
      "--instance true",
      "--flatten false",
      "--join false",
    ].join(" ")
  );

  console.log("\nNormalize textures for KTX2 encoding");
  {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(TMP_SLIM);
    await document.transform(
      textureCompress({ encoder: sharp, targetFormat: "png" })
    );
    await document.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
        resize: [384, 384],
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
