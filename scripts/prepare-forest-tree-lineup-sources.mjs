#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-tree-lineup.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

async function download(url, destination, expectedMd5) {
  try {
    const existing = await readFile(destination);
    const existingMd5 = createHash("md5").update(existing).digest("hex");
    if (!expectedMd5 || existingMd5 === expectedMd5) {
      return { bytes: existing.length, reused: true };
    }
  } catch {
    // A first run has no source file to reuse.
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualMd5 = createHash("md5").update(bytes).digest("hex");
  if (expectedMd5 && actualMd5 !== expectedMd5) {
    throw new Error(
      `Checksum mismatch for ${url}: expected ${expectedMd5}, received ${actualMd5}`
    );
  }
  await writeFile(destination, bytes);
  return { bytes: bytes.length, reused: false };
}

const downloads = new Map();
for (const candidate of manifest.candidates) {
  if (candidate.source.kind === "r2-gltf") {
    const localPath = resolve(candidate.source.localPath);
    downloads.set(candidate.source.url, { destination: localPath });
    for (const dependencyUrl of candidate.source.dependencies ?? []) {
      downloads.set(dependencyUrl, {
        destination: resolve(dirname(localPath), basename(dependencyUrl)),
      });
    }
    continue;
  }

  if (candidate.source.kind === "polyhaven-gltf") {
    const resolution = candidate.source.resolution ?? "1k";
    const response = await fetch(
      `https://api.polyhaven.com/files/${candidate.source.assetId}`
    );
    if (!response.ok) {
      throw new Error(
        `Poly Haven manifest request failed for ${candidate.source.assetId}: HTTP ${response.status}`
      );
    }
    const files = await response.json();
    const gltf = files.gltf?.[resolution]?.gltf;
    if (!gltf?.url || !gltf?.include) {
      throw new Error(
        `Poly Haven did not return a ${resolution} glTF package for ${candidate.source.assetId}`
      );
    }

    const localPath = resolve(candidate.source.localPath);
    downloads.set(gltf.url, {
      destination: localPath,
      expectedMd5: gltf.md5,
    });
    for (const [relativePath, dependency] of Object.entries(gltf.include)) {
      downloads.set(dependency.url, {
        destination: resolve(dirname(localPath), relativePath),
        expectedMd5: dependency.md5,
      });
    }
  }
}

const results = [];
for (const [url, entry] of downloads) {
  const result = await download(url, entry.destination, entry.expectedMd5);
  results.push({ url, destination: entry.destination, ...result });
}

console.log(
  JSON.stringify(
    { manifestVersion: manifest.version, downloads: results },
    null,
    2
  )
);
