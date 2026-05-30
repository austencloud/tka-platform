/**
 * Export Default Arrow Placements from Firestore back to the static JSON files.
 *
 * Usage: npx tsx scripts/export-default-arrow-placements.ts
 *
 * Reads the default_arrow_adjustments docs and overwrites the 10 static JSON
 * files so the repo stays the long-term canonical record. Run after editing
 * defaults via the Inspect dock, then review + commit the JSON diff.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

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
    console.error("Missing firebase-service-account.json in project root.");
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
      const docId = `${gridMode}_${motionType}`;
      const snap = await db.collection(collectionName).doc(docId).get();
      if (!snap.exists) {
        console.warn(`  ⚠ no doc ${docId} — leaving JSON untouched`);
        continue;
      }
      const placements = snap.data()?.placements ?? {};
      const file = staticFilePath(gridMode, motionType);
      fs.writeFileSync(file, JSON.stringify(placements, null, 2) + "\n", "utf-8");
      written++;
      console.log(`  ✓ ${docId} → ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`\nDone. Exported ${written} docs to JSON. Review + commit the diff.`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
