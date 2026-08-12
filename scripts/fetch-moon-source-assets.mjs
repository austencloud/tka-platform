#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify");
const refreshLock = args.has("--refresh-lock");
if (verifyOnly && refreshLock) {
  throw new Error("Use either --verify or --refresh-lock, not both.");
}
const manifestPath = resolve("scripts/moon-source-assets.json");
const lockPath = resolve("scripts/moon-source-assets.lock.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let lock = null;
if (!refreshLock) {
  try {
    lock = JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    if (verifyOnly) {
      throw new Error(`Moon source lockfile is missing: ${lockPath}`);
    }
  }
}
const sourceRoot = resolve(manifest.sourceRoot);
const inventoryPath = resolve(sourceRoot, "inventory.json");

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

async function hashFile(path, algorithm) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function inspectExisting(destination, expected) {
  try {
    const fileStat = await stat(destination);
    if (expected.expectedBytes && fileStat.size !== expected.expectedBytes) {
      return null;
    }
    if (expected.md5) {
      const md5 = await hashFile(destination, "md5");
      if (md5 !== expected.md5) return null;
    }
    return {
      bytes: fileStat.size,
      md5: await hashFile(destination, "md5"),
      sha256: await hashFile(destination, "sha256"),
      reused: true,
    };
  } catch {
    return null;
  }
}

async function downloadFile(file) {
  const destination = resolve(sourceRoot, file.destination);
  const existing = await inspectExisting(destination, file);
  if (existing) return { ...file, ...existing };
  if (verifyOnly) {
    throw new Error(`Missing or invalid source asset: ${file.destination}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.part`;
  await rm(temporary, { force: true });

  const response = await fetch(file.url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${file.url}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (
    file.expectedBytes &&
    Number.isFinite(contentLength) &&
    contentLength !== file.expectedBytes
  ) {
    throw new Error(
      `Remote size changed for ${file.id}: expected ${file.expectedBytes}, received ${contentLength}`
    );
  }

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporary, { flags: "wx" })
    );
    const downloaded = await inspectExisting(temporary, file);
    if (!downloaded) {
      throw new Error(`Checksum or size mismatch for ${file.id}`);
    }
    await rename(temporary, destination);
    return { ...file, ...downloaded, reused: false };
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function resolvePolyHavenAsset(asset) {
  const response = await fetch(
    `https://api.polyhaven.com/files/${asset.assetId}`
  );
  if (!response.ok) {
    throw new Error(
      `Poly Haven manifest failed (${response.status}): ${asset.assetId}`
    );
  }
  const files = await response.json();
  const gltf = files.gltf?.[asset.resolution]?.gltf;
  if (!gltf?.url || !gltf?.include) {
    throw new Error(
      `Poly Haven is missing the ${asset.resolution} glTF package for ${asset.assetId}`
    );
  }

  const destinationRoot = asset.destinationDirectory;
  const downloads = [
    {
      id: `${asset.id}-gltf`,
      parentAssetId: asset.id,
      url: gltf.url,
      md5: gltf.md5,
      expectedBytes: gltf.size,
      destination: `${destinationRoot}/${basename(new URL(gltf.url).pathname)}`,
    },
  ];

  for (const [relativePath, dependency] of Object.entries(gltf.include)) {
    downloads.push({
      id: `${asset.id}-${relativePath}`,
      parentAssetId: asset.id,
      url: dependency.url,
      md5: dependency.md5,
      expectedBytes: dependency.size,
      destination: `${destinationRoot}/${relativePath}`,
    });
  }

  for (const supplemental of asset.supplementalMaps ?? []) {
    const resolution = supplemental.resolution ?? asset.resolution;
    const file =
      files[supplemental.channel]?.[resolution]?.[supplemental.format];
    if (!file?.url) {
      throw new Error(
        `Poly Haven is missing ${supplemental.channel} ${resolution} ${supplemental.format} for ${asset.assetId}`
      );
    }
    downloads.push({
      id: `${asset.id}-${supplemental.channel}-${resolution}-${supplemental.format}`,
      parentAssetId: asset.id,
      url: file.url,
      md5: file.md5,
      expectedBytes: file.size,
      destination: `${destinationRoot}/textures/${basename(new URL(file.url).pathname)}`,
    });
  }
  return downloads;
}

const downloads = [];
if (lock) {
  downloads.push(
    ...lock.files.map((file) => ({
      id: file.id,
      destination: file.destination,
      url: file.url,
      expectedBytes: file.expectedBytes,
      md5: file.md5,
      sha256: file.sha256,
    }))
  );
} else {
  for (const asset of manifest.assets) {
    if (asset.kind === "polyhaven-gltf") {
      downloads.push(...(await resolvePolyHavenAsset(asset)));
      continue;
    }
    downloads.push(asset);
  }
}

if (lock) {
  const lockedFiles = new Map(lock.files.map((file) => [file.id, file]));
  for (const file of downloads) {
    const locked = lockedFiles.get(file.id);
    if (!locked) throw new Error(`Moon source lockfile is missing ${file.id}`);
    for (const field of ["destination", "url", "expectedBytes", "md5"]) {
      if (locked[field] !== file[field]) {
        throw new Error(
          `Moon source lockfile mismatch for ${file.id}.${field}: expected ${locked[field]}, resolved ${file[field]}`
        );
      }
    }
    file.sha256 = locked.sha256;
  }
}

await mkdir(sourceRoot, { recursive: true });
const results = [];
for (const file of downloads) {
  const result = await downloadFile(file);
  if (file.sha256 && result.sha256 !== file.sha256) {
    throw new Error(
      `SHA-256 mismatch for ${file.id}: expected ${file.sha256}, received ${result.sha256}`
    );
  }
  results.push({
    id: result.id,
    parentAssetId: result.parentAssetId,
    destination: normalizePath(result.destination),
    sourceUrl: result.url,
    bytes: result.bytes,
    md5: result.md5,
    sha256: result.sha256,
  });
  console.log(
    `${result.reused ? "verified" : "downloaded"} ${result.destination} (${(
      result.bytes /
      1024 /
      1024
    ).toFixed(2)} MiB)`
  );
}

const inventory = {
  manifestVersion: manifest.version,
  preparedOn: manifest.preparedOn,
  verifiedAt: new Date().toISOString(),
  sourceRoot: manifest.sourceRoot,
  fileCount: results.length,
  totalBytes: results.reduce((total, file) => total + file.bytes, 0),
  files: results,
};
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

if (!lock) {
  const generatedLock = {
    manifestVersion: manifest.version,
    preparedOn: manifest.preparedOn,
    files: downloads.map((download) => {
      const result = results.find((file) => file.id === download.id);
      return {
        id: download.id,
        destination: normalizePath(download.destination),
        url: download.url,
        expectedBytes: download.expectedBytes,
        md5: download.md5,
        sha256: result.sha256,
      };
    }),
  };
  await writeFile(lockPath, `${JSON.stringify(generatedLock, null, 2)}\n`);
  console.log(`Created lockfile: ${normalizePath(lockPath)}`);
}

console.log(
  `Moon source package verified: ${inventory.fileCount} files, ${(
    inventory.totalBytes /
    1024 /
    1024
  ).toFixed(2)} MiB`
);
console.log(`Inventory: ${normalizePath(inventoryPath)}`);
