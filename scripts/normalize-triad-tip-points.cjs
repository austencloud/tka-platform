#!/usr/bin/env node
/**
 * Normalize config/effectPoints.triad to the club's canonical tip reach.
 *
 * Dry-run is the default. Pass --apply to write. The write is deliberately
 * guarded: it only accepts the known 2026-07-26 triad values (or the already
 * normalized target) so a newer hand-tuned configuration cannot be replaced.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = process.env.TKA_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.TKA_SERVICE_ACCOUNT_PATH)
  : path.join(PROJECT_ROOT, "serviceAccountKey.json");
const DOCUMENT_PATH = "config/effectPoints";
const UPDATED_BY = "normalize-triad-to-club-reach-2026-09-01";
const APPLY = process.argv.includes("--apply");

const LEGACY_TRIAD_POINTS = [
  { dx: -62.2, dy: -107.8 },
  { dx: 124.4, dy: 0 },
  { dx: -62.2, dy: 107.8 },
];

const CLUB_TIP_REACH = 258.67 / 2;
const TARGET_TRIAD_POINTS = Array.from({ length: 3 }, (_, index) => {
  const radians = ((-120 + 120 * index) * Math.PI) / 180;
  const dx = CLUB_TIP_REACH * Math.cos(radians);
  const dy = CLUB_TIP_REACH * Math.sin(radians);
  return {
    dx: Math.abs(dx) < 1e-12 ? 0 : dx,
    dy: Math.abs(dy) < 1e-12 ? 0 : dy,
  };
});

function pointsEqual(actual, expected, tolerance = 1e-9) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every(
      (point, index) =>
        typeof point?.dx === "number" &&
        typeof point?.dy === "number" &&
        Math.abs(point.dx - expected[index].dx) <= tolerance &&
        Math.abs(point.dy - expected[index].dy) <= tolerance
    )
  );
}

function classify(points) {
  if (pointsEqual(points, TARGET_TRIAD_POINTS)) return "target";
  if (pointsEqual(points, LEGACY_TRIAD_POINTS, 1e-6)) return "legacy";
  return "unexpected";
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Missing service account key: ${SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
  );
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const db = admin.firestore();
  const ref = db.doc(DOCUMENT_PATH);
  const before = await ref.get();
  if (!before.exists) throw new Error(`${DOCUMENT_PATH} does not exist`);

  const current = before.data()?.triad;
  const state = classify(current);
  console.log(`Current ${DOCUMENT_PATH}.triad state: ${state}`);
  console.log(JSON.stringify(current, null, 2));

  if (state === "unexpected") {
    throw new Error(
      "Refusing to replace triad points that do not match the known legacy or target values."
    );
  }
  if (state === "target") {
    console.log("No change needed; triad is already normalized.");
    return;
  }
  if (!APPLY) {
    console.log("Dry run only. Target values:");
    console.log(JSON.stringify(TARGET_TRIAD_POINTS, null, 2));
    console.log("Run with --apply to write the guarded migration.");
    return;
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const points = snapshot.data()?.triad;
    const transactionState = classify(points);
    if (transactionState === "target") return;
    if (transactionState !== "legacy") {
      throw new Error(
        "Triad points changed after the initial read; refusing to overwrite them."
      );
    }
    transaction.update(ref, {
      triad: TARGET_TRIAD_POINTS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: UPDATED_BY,
    });
  });

  const after = await ref.get();
  const updated = after.data();
  if (!pointsEqual(updated?.triad, TARGET_TRIAD_POINTS)) {
    throw new Error("Post-write verification failed for triad tip points.");
  }

  console.log(`Updated and verified ${DOCUMENT_PATH}.triad.`);
  console.log(`updatedBy: ${updated?.updatedBy}`);
  console.log(JSON.stringify(updated?.triad, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(admin.apps.map((app) => app.delete()));
  });
