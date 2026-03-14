#!/usr/bin/env node
/**
 * Delete the two known duplicate/broken sequences for word "ΔY-EΦ-ΔY-EΦ-ΔY-EΦ-ΔY-EΦ-".
 *
 * KEEP:   98984f12-a9e8-4ef8-933c-1faafba7cd8d (Mar 11, 16 steps, public, original)
 * DELETE: 73bd83f2-11db-40ba-97c6-5a1ca30bba8f (Mar 14, 16 steps, private, fork duplicate)
 * DELETE: 09260821-9fca-4f9b-8aff-a3df7ec389aa (Mar 13, 0 steps, public, broken)
 */

import { initFirestore } from "./lib/firestore-provider.js";

const AUSTEN_UID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const TO_DELETE = [
  "73bd83f2-11db-40ba-97c6-5a1ca30bba8f",
  "09260821-9fca-4f9b-8aff-a3df7ec389aa",
];

async function run() {
  const { db, FieldValue } = await initFirestore();
  console.log("Connected to Firestore.\n");

  let deleted = 0;

  for (const id of TO_DELETE) {
    const userRef = db.doc(`users/${AUSTEN_UID}/sequences/${id}`);
    const publicRef = db.doc(`publicSequences/${id}`);

    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.log(`  ${id} — already gone from user library`);
    } else {
      const data = userSnap.data();
      console.log(`  ${id} — "${data.word}" | ${(data.steps || []).length} steps | vis: ${data.visibility}`);
      await userRef.delete();
      console.log(`    ✓ Deleted from user library`);
      deleted++;
    }

    const publicSnap = await publicRef.get();
    if (publicSnap.exists) {
      await publicRef.delete();
      console.log(`    ✓ Deleted from publicSequences`);
    }
  }

  if (deleted > 0) {
    const userDocRef = db.doc(`users/${AUSTEN_UID}`);
    await userDocRef.update({ sequenceCount: FieldValue.increment(-deleted) });
    console.log(`\n  Decremented sequenceCount by ${deleted}`);
  }

  console.log(`\nDone. Deleted ${deleted} sequence(s).`);
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
