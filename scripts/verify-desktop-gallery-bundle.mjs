#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultBundlePath = resolve(
  scriptDirectory,
  "../data/gallery/public-sequences.json"
);

/**
 * Proves the exported public index can seed the desktop gallery cache: every
 * document has an id and a word, and the document count matches the header.
 * Missing file is reported distinctly so a credential-less local build can
 * choose to proceed without a gallery bundle.
 */
export function verifyDesktopGalleryBundle(bundlePath = defaultBundlePath) {
  const resolved = resolve(bundlePath);
  if (!existsSync(resolved)) {
    const error = new Error(`Desktop gallery bundle is missing: ${resolved}`);
    error.code = "GALLERY_BUNDLE_MISSING";
    throw error;
  }
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new Error(`Desktop gallery bundle is not valid JSON: ${error.message}`);
  }
  if (
    typeof bundle?.exportedAt !== "string" ||
    Number.isNaN(Date.parse(bundle.exportedAt))
  ) {
    throw new Error("Gallery bundle exportedAt must be a valid timestamp.");
  }
  if (!Array.isArray(bundle.sequences) || bundle.sequences.length === 0) {
    throw new Error("Gallery bundle contains no sequences.");
  }
  if (bundle.count !== bundle.sequences.length) {
    throw new Error(
      `Gallery bundle declares ${String(bundle.count)} sequences but contains ${bundle.sequences.length}.`
    );
  }
  const ids = new Set();
  for (const [index, sequence] of bundle.sequences.entries()) {
    if (typeof sequence?.id !== "string" || sequence.id.length === 0) {
      throw new Error(`Gallery bundle sequence ${index} has no id.`);
    }
    if (ids.has(sequence.id)) {
      throw new Error(`Gallery bundle has a duplicate id: ${sequence.id}`);
    }
    ids.add(sequence.id);
    if (typeof sequence.word !== "string" || sequence.word.length === 0) {
      throw new Error(`Gallery bundle sequence ${sequence.id} has no word.`);
    }
  }
  return {
    bundlePath: resolved,
    sequenceCount: bundle.sequences.length,
    exportedAt: bundle.exportedAt,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const summary = verifyDesktopGalleryBundle(process.argv[2]);
    console.log(
      `Desktop gallery bundle verified: ${summary.sequenceCount} public sequences, exported ${summary.exportedAt}.`
    );
  } catch (error) {
    console.error(`Desktop gallery bundle verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
