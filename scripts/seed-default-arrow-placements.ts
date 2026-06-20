/**
 * Seed Default Arrow Placements to Firestore
 *
 * Usage: npx tsx scripts/seed-default-arrow-placements.ts
 *
 * Reads the 10 static default placement JSON files (the staff baseline) and
 * writes one Firestore doc per {gridMode}_staff_{motionType} into
 * default_arrow_adjustments. The "staff" segment is REQUIRED: the read path
 * (generateDefaultDocId) and every admin override are prop-scoped, so a 2-part
 * "{gridMode}_{motionType}" id collides with the canonical 3-part id on reload.
 * Idempotent — a re-run overwrites the docs back to the committed JSON baseline.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRID_MODES = ["box", "diamond"] as const;
const MOTION_TYPES = ["pro", "anti", "float", "dash", "static"] as const;

function staticFilePath(gridMode: string, motionType: string): string {
  return path.resolve(
    __dirname,
    `../static/data/arrow_placement/${gridMode}/default/default_${gridMode}_${motionType}_placements.json`,
  );
}

async function main() {
  const serviceAccountPath = path.resolve(
    __dirname,
    "../firebase-service-account.json",
  );
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(
      "Missing firebase-service-account.json in project root.\n" +
        "Download from Firebase Console → Project Settings → Service Accounts.",
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8"),
  );
  initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore();
  const collectionName = "default_arrow_adjustments";

  let written = 0;
  for (const gridMode of GRID_MODES) {
    for (const motionType of MOTION_TYPES) {
      const file = staticFilePath(gridMode, motionType);
      if (!fs.existsSync(file)) {
        console.warn(`  ⚠ missing ${file} — skipping`);
        continue;
      }
      const placements = JSON.parse(fs.readFileSync(file, "utf-8"));
      // Staff baseline → canonical 3-part id. propType is stored explicitly so
      // the doc is self-describing and the read path resolves it directly.
      const propType = "staff";
      const docId = `${gridMode}_${propType}_${motionType}`;
      await db.collection(collectionName).doc(docId).set({
        gridMode,
        propType,
        motionType,
        placements,
        updatedAt: new Date(),
        updatedBy: "seed",
      });
      written++;
      console.log(`  ✓ ${docId} (${Object.keys(placements).length} placement keys)`);
    }
  }

  console.log(`\nDone. Seeded ${written} default placement docs.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
