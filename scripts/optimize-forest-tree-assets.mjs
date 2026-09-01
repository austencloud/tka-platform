#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const args = process.argv.slice(2);
const reviewOnly = args.includes("--review-only");
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-meshy-images.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const outputDirectory = manifest.outputDirectory
  ? resolve(manifest.outputDirectory)
  : null;

async function synthesizeFoliageAlpha(input, output, asset) {
  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [
    { NodeIO },
    { ALL_EXTENSIONS },
    { MeshoptDecoder, MeshoptEncoder },
  ] =
    await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
  ]);
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  const document = await io.read(input);
  let processed = 0;
  let foliageMaterials = 0;

  function findDominantColor(data, channels) {
    const bins = new Map();
    for (let offset = 0; offset < data.length; offset += channels) {
      const key = `${data[offset] >> 3},${data[offset + 1] >> 3},${
        data[offset + 2] >> 3
      }`;
      const bin = bins.get(key) ?? {
        count: 0,
        right: 0,
        green: 0,
        left: 0,
      };
      bin.count += 1;
      bin.right += data[offset];
      bin.green += data[offset + 1];
      bin.left += data[offset + 2];
      bins.set(key, bin);
    }
    const dominant = [...bins.values()].sort(
      (left, right) => right.count - left.count
    )[0];
    return [
      dominant.right / dominant.count,
      dominant.green / dominant.count,
      dominant.left / dominant.count,
    ];
  }

  for (const material of document.getRoot().listMaterials()) {
    if (!/leaves|twig/i.test(material.getName())) continue;
    foliageMaterials += 1;
    const texture = material.getBaseColorTexture();
    const image = texture?.getImage();
    if (!texture || !image) continue;
    const sourceMetadata = await sharp(image).metadata();
    const { data, info } = await sharp(image)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const embeddedAlpha = sourceMetadata.hasAlpha
      ? await sharp(image).ensureAlpha().raw().toBuffer()
      : null;
    const authoredAlpha = asset.foliageAlphaPath
      ? await sharp(resolve(asset.foliageAlphaPath))
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true })
      : null;
    if (
      authoredAlpha &&
      (authoredAlpha.info.width !== info.width ||
        authoredAlpha.info.height !== info.height)
    ) {
      throw new Error(
        `Authored foliage alpha does not match ${material.getName()} atlas dimensions`
      );
    }
    let blackBackgroundPixels = 0;
    for (let offset = 0; offset < data.length; offset += 3) {
      if (
        Math.max(data[offset], data[offset + 1], data[offset + 2]) <= 24
      ) {
        blackBackgroundPixels += 1;
      }
    }
    const usesBlackBackground =
      !authoredAlpha &&
      !embeddedAlpha &&
      blackBackgroundPixels / (info.width * info.height) >= 0.1;
    const normalImage = material.getNormalTexture()?.getImage();
    const normal =
      !authoredAlpha && !embeddedAlpha && !usesBlackBackground && normalImage
        ? await sharp(normalImage)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
        : null;
    if (
      !authoredAlpha &&
      !embeddedAlpha &&
      !usesBlackBackground &&
      (!normal ||
        normal.info.width !== info.width ||
        normal.info.height !== info.height)
    ) {
      throw new Error(
        `Foliage material ${material.getName()} needs a matching normal atlas to synthesize alpha`
      );
    }
    const neutralNormal = normal
      ? findDominantColor(normal.data, normal.info.channels)
      : null;
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let source = 0, target = 0; source < data.length; source += 3) {
      const right = data[source];
      const green = data[source + 1];
      const left = data[source + 2];
      let alpha;
      if (authoredAlpha) {
        alpha = authoredAlpha.data[source / 3];
        rgba[target] = right;
        rgba[target + 1] = green;
        rgba[target + 2] = left;
      } else if (embeddedAlpha) {
        alpha = embeddedAlpha[(source / 3) * 4 + 3];
        rgba[target] = right;
        rgba[target + 1] = green;
        rgba[target + 2] = left;
      } else if (usesBlackBackground) {
        const signal = Math.max(right, green, left);
        alpha = Math.max(0, Math.min(255, ((signal - 8) / 24) * 255));
        const coverage = Math.max(alpha / 255, 0.25);
        rgba[target] = Math.min(255, Math.round(right / coverage));
        rgba[target + 1] = Math.min(255, Math.round(green / coverage));
        rgba[target + 2] = Math.min(255, Math.round(left / coverage));
      } else {
        const normalOffset = (source / 3) * normal.info.channels;
        const rightDelta = normal.data[normalOffset] - neutralNormal[0];
        const greenDelta = normal.data[normalOffset + 1] - neutralNormal[1];
        const leftDelta = normal.data[normalOffset + 2] - neutralNormal[2];
        const normalDistance = Math.sqrt(
          rightDelta * rightDelta +
            greenDelta * greenDelta +
            leftDelta * leftDelta
        );
        alpha = Math.max(
          0,
          Math.min(255, ((normalDistance - 18) / 32) * 255)
        );
        rgba[target] = right;
        rgba[target + 1] = green;
        rgba[target + 2] = left;
      }
      rgba[target + 3] = Math.round(alpha);
      target += 4;
    }
    texture.setImage(
      await sharp(rgba, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png({ compressionLevel: 9 })
        .toBuffer()
    );
    texture.setMimeType("image/png");
    material.setAlphaMode("MASK");
    material.setAlphaCutoff(0.35);
    material.setDoubleSided(true);
    processed += 1;
    console.log(
      `${material.getName()}: ${
        authoredAlpha
          ? "authored-map"
          : embeddedAlpha
            ? "embedded"
            : usesBlackBackground
              ? "base-color"
              : "normal-map"
      } alpha source`
    );
  }

  if (foliageMaterials > 0 && processed === 0) {
    throw new Error(`No foliage materials received an alpha mask: ${input}`);
  }
  await io.write(output, document);
  console.log(`Synthesized alpha masks for ${processed} foliage materials`);
}

for (const asset of manifest.assets) {
  if (only && asset.id !== only) continue;
  const input = asset.sourcePath
    ? resolve(asset.sourcePath)
    : resolve(outputDirectory, `${asset.id}_raw.glb`);
  const output = asset.outputPath
    ? resolve(asset.outputPath)
    : resolve(outputDirectory, `${asset.id}.glb`);
  if (!existsSync(input)) {
    console.warn(`skip ${asset.id}: ${input} missing`);
    continue;
  }
  mkdirSync(dirname(output), { recursive: true });
  console.log(`\n${asset.id}: ${(statSync(input).size / 1024).toFixed(1)} KiB`);
  const alphaInput = resolve(dirname(output), `_${asset.id}-foliage-alpha.glb`);
  let optimizationInput = input;
  if (
    !reviewOnly &&
    (asset.synthesizeFoliageAlpha ?? manifest.synthesizeFoliageAlpha)
  ) {
    if (existsSync(alphaInput)) rmSync(alphaInput);
    await synthesizeFoliageAlpha(input, alphaInput, asset);
    optimizationInput = alphaInput;
  }
  const command = [
    resolve("node_modules/@gltf-transform/cli/bin/cli.js"),
    "optimize",
    optimizationInput,
    output,
    "--texture-compress",
    asset.textureFormat ?? "webp",
    "--texture-size",
    String(asset.textureSize ?? 1024),
    "--compress",
    asset.compression ?? "meshopt",
    "--meshopt-level",
    asset.meshoptLevel ?? "high",
    "--simplify",
    String(asset.simplify ?? true),
    "--simplify-ratio",
    String(asset.simplifyRatio ?? 0),
    "--simplify-error",
    String(asset.simplifyError ?? 0.001),
    "--simplify-lock-border",
    String(asset.simplifyLockBorder ?? false),
    "--palette",
    String(asset.palette ?? false),
    "--join",
    String(asset.join ?? false),
    "--instance",
    String(asset.instance ?? true),
    "--flatten",
    String(asset.flatten ?? true),
  ];
  if (!reviewOnly) {
    try {
      execFileSync(process.execPath, command, { stdio: "inherit" });
      console.log(
        `-> ${output} (${(statSync(output).size / 1024).toFixed(1)} KiB)`
      );
    } finally {
      if (existsSync(alphaInput)) rmSync(alphaInput);
    }
  } else if (!existsSync(output)) {
    console.warn(`skip ${asset.id} review twin: ${output} missing`);
    continue;
  }

  if (asset.reviewOutputPath) {
    const reviewOutput = resolve(asset.reviewOutputPath);
    mkdirSync(dirname(reviewOutput), { recursive: true });
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/@gltf-transform/cli/bin/cli.js"),
        "optimize",
        output,
        reviewOutput,
        "--compress",
        "false",
        "--texture-compress",
        "false",
        "--simplify",
        "false",
        "--join",
        "false",
        "--palette",
        "false",
        "--instance",
        "false",
        "--flatten",
        "false",
      ],
      { stdio: "inherit" }
    );
    console.log(
      `-> ${reviewOutput} (${(statSync(reviewOutput).size / 1024).toFixed(1)} KiB review twin)`
    );
  }
}
