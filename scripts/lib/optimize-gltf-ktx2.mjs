import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const KTX_BIN = resolve(".tools/ktx");
const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";
const ENV = {
  ...process.env,
  PATH: `${KTX_BIN}${PATH_SEPARATOR}${process.env.PATH}`,
};
const CLI_PACKAGE = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const CLI_ENTRY = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/bin/cli.js"
);
const GLTF_CLI = `"${process.execPath}" "${CLI_ENTRY}"`;
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

function formattedSize(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, command) {
  console.log(`\n${label}`);
  console.log(`  ${command}`);
  execSync(command, { stdio: "inherit", env: ENV });
}

function assertToolchain() {
  if (!existsSync(CLI_PACKAGE)) {
    throw new Error(`glTF Transform CLI is missing: ${CLI_PACKAGE}`);
  }
  if (
    !existsSync(resolve(KTX_BIN, "toktx.exe")) &&
    !existsSync(resolve(KTX_BIN, "toktx"))
  ) {
    throw new Error(`KTX-Software is missing from ${KTX_BIN}`);
  }
}

/**
 * Optimize a Blender-authored GLB for the repository's shared WebGL path.
 *
 * Geometry work stays uncompressed until texture processing is complete.
 * Color/emissive maps use ETC1S, material/normal maps use UASTC, and meshopt
 * runs last so runtime loaders can stream compact GPU-ready data.
 */
export async function optimizeGltfKtx2({
  input,
  output,
  temporaryStem,
  label,
  textureSize = 1024,
  materialTextureSize = 512,
  simplifyRatio = 0.9,
  simplifyError = 0.001,
  palette = true,
  instanceMin = null,
  materialTransform = null,
  inspect = true,
}) {
  const source = resolve(input);
  const destination = resolve(output);
  const tempDirectory = dirname(destination);
  const stem = temporaryStem.replaceAll(/[^a-z0-9-]/gi, "-");
  const slim = resolve(tempDirectory, `_${stem}-slim.glb`);
  const instanced = resolve(tempDirectory, `_${stem}-instanced.glb`);
  const png = resolve(tempDirectory, `_${stem}-png.glb`);
  const uastc = resolve(tempDirectory, `_${stem}-uastc.glb`);
  const etc = resolve(tempDirectory, `_${stem}-etc.glb`);
  const temporaries = [slim, instanced, png, uastc, etc];

  assertToolchain();
  if (!existsSync(source)) {
    throw new Error(`${label} source GLB does not exist: ${source}`);
  }
  for (const path of temporaries) {
    if (existsSync(path)) rmSync(path);
  }

  console.log(`Input: ${source} (${formattedSize(source)})`);
  try {
    run(
      `Preserve ${label} while deduplicating delivery data`,
      [
        `${GLTF_CLI} optimize`,
        `"${source}" "${slim}"`,
        "--compress false",
        "--texture-compress webp",
        `--texture-size ${textureSize}`,
        "--simplify true",
        `--simplify-ratio ${simplifyRatio}`,
        `--simplify-error ${simplifyError}`,
        `--palette ${palette}`,
        "--instance true",
        "--flatten false",
        "--join false",
      ].join(" ")
    );

    let geometryInput = slim;
    if (instanceMin != null) {
      run(
        `Collapse repeated ${label} meshes into GPU instances`,
        `${GLTF_CLI} instance "${slim}" "${instanced}" --min ${instanceMin}`
      );
      geometryInput = instanced;
    }

    console.log("\nNormalize textures and apply the asset material profile");
    {
      const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
      const document = await io.read(geometryInput);
      if (materialTransform) await materialTransform(document);
      await document.transform(
        textureCompress({ encoder: sharp, targetFormat: "png" })
      );
      await document.transform(
        textureCompress({
          encoder: sharp,
          targetFormat: "png",
          slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
          resize: [materialTextureSize, materialTextureSize],
        })
      );
      await io.write(png, document);
      console.log(`  wrote ${png} (${formattedSize(png)})`);
    }

    run(
      "Encode normal and material maps as KTX2 UASTC",
      [
        `${GLTF_CLI} uastc`,
        `"${png}" "${uastc}"`,
        '--slots "{normalTexture,metallicRoughnessTexture,occlusionTexture}"',
        "--level 4",
        "--zstd 18",
      ].join(" ")
    );
    run(
      "Encode color and emissive maps as KTX2 ETC1S",
      [
        `${GLTF_CLI} etc1s`,
        `"${uastc}" "${etc}"`,
        '--slots "{baseColorTexture,emissiveTexture}"',
        "--quality 200",
      ].join(" ")
    );
    run(
      "Apply meshopt geometry compression",
      `${GLTF_CLI} meshopt "${etc}" "${destination}"`
    );
  } finally {
    for (const path of temporaries) {
      if (existsSync(path)) rmSync(path);
    }
  }

  console.log(`\nOutput: ${destination} (${formattedSize(destination)})`);
  if (inspect) {
    run(`Inspect optimized ${label}`, `${GLTF_CLI} inspect "${destination}"`);
  }
  return {
    inputBytes: statSync(source).size,
    outputBytes: statSync(destination).size,
  };
}
