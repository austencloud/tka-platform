#!/usr/bin/env node
/**
 * Backfill `loopType` on sequences that never got one.
 *
 * scripts/import-sequence.cjs called the LOOP detector with steps shaped as
 * `blueMotion`/`redMotion`, but the detector's sameLOOPSignal reads
 * `step.motions.{blue,red}`. It threw on every call and the catch swallowed it
 * as "detection unavailable", so every script-imported sequence landed without
 * a loopType. The converter is fixed; this repairs the docs it already wrote.
 *
 * Non-circular sequences legitimately have no loopType and are left alone.
 *
 * Usage:
 *   node scripts/backfill-sequence-loop-type.cjs                    # dry-run
 *   node scripts/backfill-sequence-loop-type.cjs --commit
 *   node scripts/backfill-sequence-loop-type.cjs --uid <uid> --commit
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");
const { AUSTEN_UID, detectLoop } = require("./import-sequence.cjs");

const args = process.argv.slice(2);
const isCommit = args.includes("--commit");
const uidIdx = args.indexOf("--uid");
const uid = uidIdx >= 0 ? args[uidIdx + 1] : AUSTEN_UID;

const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8"))
  ),
});
const db = admin.firestore();

async function main() {
  const snap = await db.collection(`users/${uid}/sequences`).get();
  console.log(`Scanned ${snap.size} sequences for ${uid}`);

  const updates = [];
  let alreadySet = 0;
  let notCircular = 0;
  let undetectable = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.loopType) {
      alreadySet++;
      return;
    }
    const info = detectLoop(data);
    if (!info) {
      undetectable++;
      return;
    }
    if (!info.loopType) {
      // Circular-but-freeform and plain linear sequences both land here and
      // correctly keep no loopType. isCircular is still worth repairing.
      if (info.isCircular && !data.isCircular) {
        updates.push({ ref: docSnap.ref, word: data.word, patch: { isCircular: true }, note: "isCircular only" });
      } else {
        notCircular++;
      }
      return;
    }
    const patch = { loopType: info.loopType };
    if (info.isCircular && !data.isCircular) patch.isCircular = true;
    updates.push({ ref: docSnap.ref, word: data.word, patch, note: info.loopType });
  });

  console.log(
    `already set: ${alreadySet}   no loop signal: ${notCircular}   ` +
      `detector unavailable: ${undetectable}   to update: ${updates.length}`
  );
  for (const u of updates.slice(0, 15)) {
    console.log(`  ${String(u.word).slice(0, 24).padEnd(26)} ${u.note}`);
  }
  if (updates.length > 15) console.log(`  ... and ${updates.length - 15} more`);

  if (!isCommit) {
    console.log("\n[DRY RUN] no writes. Re-run with --commit.");
    return;
  }
  if (updates.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  // Firestore batches cap at 500 writes.
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    for (const u of updates.slice(i, i + 400)) {
      batch.update(u.ref, { ...u.patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }
  console.log(`\nUpdated ${updates.length} sequences.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
