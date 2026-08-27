/**
 * Seed Prop Geometry Adjustments to Firestore
 *
 * Usage: npx tsx scripts/seed-prop-geometry-adjustments.ts
 *
 * Reads adjustment entries from the ADJUSTMENTS array below and writes
 * them to the prop_geometry_adjustments Firestore collection. Safe to
 * run multiple times — existing entries are overwritten, not duplicated.
 *
 * Add new entries to the ADJUSTMENTS array as scenarios are identified
 * through the pictograph review workflow.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

// Each entry maps a physical scenario (prop type + orientations + position)
// to a base pixel adjustment. The adjustment goes through directional tuple
// rotation in the pipeline, so one entry covers all four quadrants.
//
// Key: gridMode|propType|otherPropType|positionType|endOri|otherEndOri|motionType|turns|arrowColor

interface AdjustmentEntry {
  gridMode: string;
  propType: string;
  otherPropType: string;
  positionType: string;
  endOrientation: string;
  otherEndOrientation: string;
  motionType: string;
  turns: string;
  arrowColor: string;
  adjustmentX: number;
  adjustmentY: number;
  description: string;
}

const ADJUSTMENTS: AdjustmentEntry[] = [
  // TRIAD + TRIAD at BETA — Diamond Grid
  // Scenario: Blue pro 1-turn arrow ending "out" at beta, red ending "in"
  // The triad's arms extend outward when in "out" orientation, pushing into
  // the arrow's default position. Nudge arrow away from the triad body.
  {
    gridMode: "diamond",
    propType: "triad",
    otherPropType: "triad",
    positionType: "beta",
    endOrientation: "out",
    otherEndOrientation: "in",
    motionType: "pro",
    turns: "1",
    arrowColor: "blue",
    adjustmentX: 20,
    adjustmentY: -50,
    description:
      "Triad arms extend into blue pro-1 arrow when ending out at beta (other hand in)",
  },
];


function generateKey(entry: AdjustmentEntry): string {
  return [
    entry.gridMode,
    entry.propType,
    entry.otherPropType,
    entry.positionType,
    entry.endOrientation,
    entry.otherEndOrientation,
    entry.motionType,
    entry.turns,
    entry.arrowColor,
  ].join("|");
}

async function main() {
  // Look for service account key
  const serviceAccountPath = path.resolve(
    __dirname,
    "../firebase-service-account.json"
  );
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(
      "Missing firebase-service-account.json in project root.\n" +
        "Download from Firebase Console → Project Settings → Service Accounts."
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8")
  );

  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();
  const collectionName = "prop_geometry_adjustments";

  console.log(
    `\nSeeding ${ADJUSTMENTS.length} prop geometry adjustment(s)...\n`
  );

  for (const entry of ADJUSTMENTS) {
    const key = generateKey(entry);
    const docRef = db.collection(collectionName).doc(key);

    await docRef.set({
      gridMode: entry.gridMode,
      propType: entry.propType,
      otherPropType: entry.otherPropType,
      positionType: entry.positionType,
      endOrientation: entry.endOrientation,
      otherEndOrientation: entry.otherEndOrientation,
      motionType: entry.motionType,
      turns: entry.turns,
      arrowColor: entry.arrowColor,
      adjustmentX: entry.adjustmentX,
      adjustmentY: entry.adjustmentY,
      updatedAt: new Date(),
      updatedBy: "austencloud@gmail.com",
    });

    console.log(`  ✓ ${key}`);
    console.log(`    → (${entry.adjustmentX}, ${entry.adjustmentY})`);
    console.log(`    ${entry.description}\n`);
  }

  console.log("Done. All adjustments seeded successfully.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
