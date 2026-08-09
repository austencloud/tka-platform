#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import JSZip from "jszip";

const SOURCE_ROOT = resolve("assets/3d-source/winter");
const TEXTURE_ROOT = resolve("static/textures/winter");

const MODEL_IDS = [
  "fir_sapling",
  "fir_sapling_medium",
  "pine_sapling_small",
  "tree_stump_01",
  "dead_tree_trunk_02",
];

const SNOW_ARCHIVE_URL =
  "https://ambientcg.com/get?file=Snow004_1K-JPG.zip";
const SNOW_ARCHIVE_SHA256 =
  "8d954173843674de72662459d79dbaa145e8562ede541f457c8460724a8d67e3";

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

async function writeAssetBytes(destination, bytes) {
  await mkdir(dirname(destination), { recursive: true });
  const expectedSha256 = createHash("sha256").update(bytes).digest("hex");

  try {
    const existing = await readFile(destination);
    const existingSha256 = createHash("sha256")
      .update(existing)
      .digest("hex");
    if (existingSha256 === expectedSha256) {
      console.log(`  reuse ${destination}`);
      return;
    }
  } catch {
    // The first run has nothing to reuse.
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
  console.log("\nambientCG Snow 004 (CC0)");
  const response = await fetch(SNOW_ARCHIVE_URL);
  if (!response.ok) {
    throw new Error(
      `Snow archive request failed (${response.status}): ${SNOW_ARCHIVE_URL}`
    );
  }

  const archive = Buffer.from(await response.arrayBuffer());
  const archiveSha256 = createHash("sha256").update(archive).digest("hex");
  if (archiveSha256 !== SNOW_ARCHIVE_SHA256) {
    throw new Error(
      `Snow archive checksum mismatch: expected ${SNOW_ARCHIVE_SHA256}, received ${archiveSha256}`
    );
  }

  const zip = await JSZip.loadAsync(archive);
  const files = [
    ["Snow004_1K-JPG_Color.jpg", "snow-albedo.jpg"],
    ["Snow004_1K-JPG_NormalGL.jpg", "snow-normal.jpg"],
    ["Snow004_1K-JPG_Roughness.jpg", "snow-roughness.jpg"],
    ["Snow004_1K-JPG_Displacement.jpg", "snow-displacement.jpg"],
  ];

  for (const [entryName, destinationName] of files) {
    const entry = zip.file(entryName);
    if (!entry) throw new Error(`Snow archive is missing ${entryName}`);
    const bytes = await entry.async("nodebuffer");
    await writeAssetBytes(resolve(TEXTURE_ROOT, destinationName), bytes);
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
