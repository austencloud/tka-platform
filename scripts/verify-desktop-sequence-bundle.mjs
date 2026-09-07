#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultBundleDirectory = resolve(scriptDirectory, "../data/sequences");

function readJson(filePath, label) {
  let source;
  try {
    source = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label} is unreadable: ${error.message}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

/**
 * Proves that the directory can be consumed by DesktopDataSeeder. The release
 * workflow runs this before uploading the shared bundle and every platform runs
 * it again after downloading, so a partial or stale artifact cannot be packaged.
 */
export function verifyDesktopSequenceBundle(
  bundleDirectory = defaultBundleDirectory
) {
  const resolvedDirectory = resolve(bundleDirectory);
  if (
    !existsSync(resolvedDirectory) ||
    !statSync(resolvedDirectory).isDirectory()
  ) {
    throw new Error(
      `Desktop sequence bundle directory is missing: ${resolvedDirectory}`
    );
  }

  const manifestPath = resolve(resolvedDirectory, "_manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Desktop sequence manifest is missing: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath, "Desktop sequence manifest");
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !Array.isArray(manifest.decks)
  ) {
    throw new Error("Desktop sequence manifest must contain a decks array.");
  }
  if (manifest.decks.length === 0) {
    throw new Error("Desktop sequence manifest contains no decks.");
  }
  requireNonNegativeInteger(manifest.totalSequences, "Manifest totalSequences");
  if (
    typeof manifest.exportedAt !== "string" ||
    Number.isNaN(Date.parse(manifest.exportedAt))
  ) {
    throw new Error("Manifest exportedAt must be a valid timestamp.");
  }

  const deckIds = new Set();
  const filenames = new Set();
  let sequenceCount = 0;

  for (const [index, deck] of manifest.decks.entries()) {
    const label = `Manifest deck ${index + 1}`;
    if (!deck || typeof deck !== "object") {
      throw new Error(`${label} must be an object.`);
    }
    requireNonEmptyString(deck.deckId, `${label} deckId`);
    requireNonEmptyString(deck.filename, `${label} filename`);
    requireNonNegativeInteger(deck.count, `${label} count`);

    if (deckIds.has(deck.deckId)) {
      throw new Error(`Manifest contains duplicate deckId: ${deck.deckId}`);
    }
    deckIds.add(deck.deckId);

    if (
      basename(deck.filename) !== deck.filename ||
      !deck.filename.endsWith(".json") ||
      deck.filename === "_manifest.json"
    ) {
      throw new Error(`${label} has an unsafe filename: ${deck.filename}`);
    }
    if (filenames.has(deck.filename)) {
      throw new Error(`Manifest contains duplicate filename: ${deck.filename}`);
    }
    filenames.add(deck.filename);

    const deckPath = resolve(resolvedDirectory, deck.filename);
    if (!existsSync(deckPath)) {
      throw new Error(
        `Manifest references a missing deck file: ${deck.filename}`
      );
    }

    const bundle = readJson(deckPath, `Deck file ${deck.filename}`);
    if (
      !bundle ||
      typeof bundle !== "object" ||
      !Array.isArray(bundle.sequences)
    ) {
      throw new Error(
        `Deck file ${deck.filename} must contain a sequences array.`
      );
    }
    if (bundle.deckId !== deck.deckId) {
      throw new Error(
        `Deck file ${deck.filename} has deckId ${String(bundle.deckId)}; expected ${deck.deckId}.`
      );
    }
    if (bundle.sequences.length !== deck.count) {
      throw new Error(
        `Deck file ${deck.filename} contains ${bundle.sequences.length} sequences; manifest declares ${deck.count}.`
      );
    }
    if (bundle.metadata?.count !== deck.count) {
      throw new Error(
        `Deck file ${deck.filename} metadata.count is ${String(bundle.metadata?.count)}; expected ${deck.count}.`
      );
    }

    sequenceCount += bundle.sequences.length;
  }

  if (sequenceCount !== manifest.totalSequences) {
    throw new Error(
      `Bundle contains ${sequenceCount} sequences; manifest totalSequences declares ${manifest.totalSequences}.`
    );
  }

  const unlistedFiles = readdirSync(resolvedDirectory)
    .filter(
      (filename) => filename.endsWith(".json") && filename !== "_manifest.json"
    )
    .filter((filename) => !filenames.has(filename));
  if (unlistedFiles.length > 0) {
    throw new Error(
      `Bundle contains JSON files absent from the manifest: ${unlistedFiles.join(", ")}`
    );
  }

  return {
    bundleDirectory: resolvedDirectory,
    deckCount: manifest.decks.length,
    sequenceCount,
    exportedAt: manifest.exportedAt,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const summary = verifyDesktopSequenceBundle(process.argv[2]);
    console.log(
      `Desktop sequence bundle verified: ${summary.deckCount} decks, ${summary.sequenceCount} sequences, exported ${summary.exportedAt}.`
    );
  } catch (error) {
    console.error(
      `Desktop sequence bundle verification failed: ${error.message}`
    );
    process.exitCode = 1;
  }
}
