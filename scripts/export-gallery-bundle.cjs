#!/usr/bin/env node
/**
 * Export the public gallery index (`publicSequences`) for the offline desktop
 * build. The desktop seeder writes these documents straight into the gallery's
 * IndexedDB cache on first launch, so Browse opens from disk with no Firestore
 * round-trip. Every document carries the compositional fields the loader
 * hydrates steps from, so the viewer also opens offline.
 *
 * Output: data/gallery/public-sequences.json (gitignored; CI builds it).
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("node:fs");
const path = require("node:path");
const { cleanFirestoreValue } = require("./export-deck-bundle.cjs");

const OUTPUT_DIRECTORY = path.resolve(__dirname, "../data/gallery");
const OUTPUT_FILENAME = "public-sequences.json";

async function exportGalleryBundle(db, outputDirectory = OUTPUT_DIRECTORY) {
  const snapshot = await db.collection("publicSequences").get();
  const sequences = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...cleanFirestoreValue(doc.data()),
  }));
  if (sequences.length === 0) {
    throw new Error("publicSequences returned no documents; refusing to write an empty gallery bundle.");
  }

  const bundle = {
    exportedAt: new Date().toISOString(),
    count: sequences.length,
    sequences,
  };
  fs.mkdirSync(outputDirectory, { recursive: true });
  const target = path.join(outputDirectory, OUTPUT_FILENAME);
  const staging = `${target}.tmp`;
  fs.writeFileSync(staging, JSON.stringify(bundle));
  fs.renameSync(staging, target);

  const bytes = fs.statSync(target).size;
  console.log(
    `Gallery bundle published: ${sequences.length} public sequences (${(bytes / 1e6).toFixed(1)} MB) -> ${target}`
  );
  return { target, count: sequences.length, bytes };
}

async function main() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS must point to a Firebase service account key."
    );
  }
  const serviceAccount = require(path.resolve(serviceAccountPath));
  initializeApp({ credential: cert(serviceAccount) });
  await exportGalleryBundle(getFirestore());
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Gallery bundle export failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { exportGalleryBundle, OUTPUT_DIRECTORY, OUTPUT_FILENAME };
