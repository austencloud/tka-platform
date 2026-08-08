#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const SOURCE_ROOT = resolve("assets/3d-source/winter");
const TEXTURE_ROOT = resolve("static/textures/winter");

const MODEL_IDS = [
  "fir_sapling",
  "fir_sapling_medium",
  "pine_sapling_small",
  "tree_stump_01",
  "dead_tree_trunk_02",
];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Asset manifest request failed (${response.status}): ${url}`
    );
  }
  return response.json();
}

async function download(url, destination, expectedMd5) {
  await mkdir(dirname(destination), { recursive: true });

  try {
    const existing = await readFile(destination);
    const existingMd5 = createHash("md5").update(existing).digest("hex");
    if (!expectedMd5 || existingMd5 === expectedMd5) {
      console.log(`  reuse ${destination}`);
      return;
    }
  } catch {
    // The first run has nothing to reuse.
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status}): ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualMd5 = createHash("md5").update(bytes).digest("hex");
  if (expectedMd5 && actualMd5 !== expectedMd5) {
    throw new Error(
      `Checksum mismatch for ${url}: expected ${expectedMd5}, received ${actualMd5}`
    );
  }
  await writeFile(destination, bytes);
  console.log(
    `  wrote ${destination} (${(bytes.length / 1024 / 1024).toFixed(2)} MiB)`
  );
}

async function fetchModel(id) {
  console.log(`\n${id}`);
  const manifest = await fetchJson(`https://api.polyhaven.com/files/${id}`);
  const gltf = manifest.gltf?.["1k"]?.gltf;
  if (!gltf?.url || !gltf?.include) {
    throw new Error(`Poly Haven did not return a 1K glTF package for ${id}`);
  }

  const modelRoot = resolve(SOURCE_ROOT, id);
  await download(
    gltf.url,
    resolve(modelRoot, basename(new URL(gltf.url).pathname)),
    gltf.md5
  );

  for (const [relativePath, file] of Object.entries(gltf.include)) {
    await download(file.url, resolve(modelRoot, relativePath), file.md5);
  }
}

async function fetchTextureSet() {
  console.log("\nsnow_02");
  const manifest = await fetchJson("https://api.polyhaven.com/files/snow_02");
  const files = [
    [manifest.Diffuse?.["1k"]?.jpg, "snow-albedo.jpg"],
    [manifest.nor_gl?.["1k"]?.jpg, "snow-normal.jpg"],
    [manifest.Rough?.["1k"]?.jpg, "snow-roughness.jpg"],
  ];

  for (const [file, name] of files) {
    if (!file?.url) throw new Error(`Poly Haven Snow 02 is missing ${name}`);
    await download(file.url, resolve(TEXTURE_ROOT, name), file.md5);
  }
}

async function fetchQaHdri() {
  console.log("\npassendorf_snow");
  const manifest = await fetchJson(
    "https://api.polyhaven.com/files/passendorf_snow"
  );
  const file = manifest.hdri?.["1k"]?.hdr;
  if (!file?.url)
    throw new Error("Poly Haven Passendorf Snow is missing its 1K HDRI");
  await download(
    file.url,
    resolve(SOURCE_ROOT, "passendorf_snow_1k.hdr"),
    file.md5
  );
}

await mkdir(SOURCE_ROOT, { recursive: true });
await mkdir(TEXTURE_ROOT, { recursive: true });

for (const id of MODEL_IDS) await fetchModel(id);
await fetchTextureSet();
await fetchQaHdri();

console.log("\nWinter source assets are ready.");
