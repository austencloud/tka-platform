#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const layoutPath = resolve("scripts/forest-tree-layout.json");
const layoutBytes = await readFile(layoutPath);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const cliPath = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateGlb(bytes, label) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`${label} is not a binary glTF`);
  }
}

const prepared = [];
for (const asset of layout.assets) {
  const input = resolve(asset.sourcePath);
  const output = resolve(asset.stagedPath);
  if (!existsSync(input)) throw new Error(`Missing tree source: ${input}`);
  const inputBytes = await readFile(input);
  validateGlb(inputBytes, input);
  await mkdir(dirname(output), { recursive: true });
  execFileSync(process.execPath, [cliPath, "copy", input, output], {
    stdio: "inherit",
  });
  const outputBytes = await readFile(output);
  validateGlb(outputBytes, output);
  prepared.push({
    id: asset.id,
    sourcePath: asset.sourcePath,
    sourceSha256: sha256(inputBytes),
    stagedPath: asset.stagedPath,
    stagedBytes: outputBytes.length,
  });
}

const statePath = resolve("blender/forest-composition-sources/manifest.json");
await writeFile(
  statePath,
  `${JSON.stringify(
    {
      contractVersion: layout.version,
      contractSha256: sha256(layoutBytes),
      prepared,
    },
    null,
    2
  )}\n`
);

console.log(
  JSON.stringify({ layoutVersion: layout.version, prepared }, null, 2)
);
