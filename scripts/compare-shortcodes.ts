#!/usr/bin/env tsx
/**
 * Compare two shortcode docs side-by-side.
 * Usage: npx tsx scripts/compare-shortcodes.ts CODE1 CODE2
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, "..", "serviceAccountKey.json"), "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length !== 2) {
    console.error("Usage: compare-shortcodes.ts CODE1 CODE2");
    process.exit(1);
  }

  for (const code of codes) {
    const snap = await db.collection("shortcodes").doc(code).get();
    if (!snap.exists) {
      console.log(`\n=== ${code}: NOT FOUND ===\n`);
      continue;
    }
    const d = snap.data()!;
    console.log(`\n=== ${code} ===`);
    console.log(`  word           : ${d.sequence}`);
    console.log(`  sequenceId     : ${d.sequenceId ?? "(none)"}`);
    console.log(`  ownerId        : ${d.ownerId ?? "(none)"}`);
    console.log(`  encoderHash    : ${d.encoderHash ?? "(MISSING)"}`);
    console.log(`  createdAt      : ${d.createdAt}`);
    console.log(`  scanCount      : ${d.scanCount}`);
    console.log(`  lastScannedAt  : ${d.lastScannedAt ?? "(none)"}`);
    console.log(`  has encoded    : ${typeof d.encoded === "string" ? d.encoded.length + " chars" : "NO"}`);
    console.log(`  has sequenceData: ${d.sequenceData ? "yes (" + ((d.sequenceData as any).steps?.length ?? 0) + " steps)" : "no"}`);
    if (typeof d.encoded === "string") {
      console.log(`  encoded prefix : ${d.encoded.slice(0, 60)}…`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
