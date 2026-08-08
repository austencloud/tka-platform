#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const manifestPath = resolve("scripts/forest-tree-lineup.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes.length;
}

const downloads = new Map();
for (const candidate of manifest.candidates) {
  if (candidate.source.kind !== "r2-gltf") continue;

  const localPath = resolve(candidate.source.localPath);
  downloads.set(candidate.source.url, localPath);
  for (const dependencyUrl of candidate.source.dependencies ?? []) {
    downloads.set(
      dependencyUrl,
      resolve(dirname(localPath), basename(dependencyUrl))
    );
  }
}

const results = [];
for (const [url, destination] of downloads) {
  const bytes = await download(url, destination);
  results.push({ url, destination, bytes });
}

console.log(
  JSON.stringify(
    { manifestVersion: manifest.version, downloads: results },
    null,
    2
  )
);
