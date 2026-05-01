/**
 * Batch create shortcodes for sequences that don't have them.
 *
 * Takes sequence IDs from publicSequences, resolves full data via sourceRef,
 * and creates shortcode docs with embedded sequenceData for durability.
 *
 * Usage:
 *   node scripts/create-shortcodes-batch.js LFCC "EΦ-JΨ-DΦ-KΨ-"
 *   node scripts/create-shortcodes-batch.js --file ids.txt
 */

import { initFirestore } from "./lib/firestore-provider.js";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 4;
const MAX_RETRIES = 20;

function generateCode(length = CODE_LENGTH) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function findExistingShortcode(db, sequenceId, isAdmin) {
  if (isAdmin) {
    const snapshot = await db
      .collection("shortcodes")
      .where("sequenceId", "==", sequenceId)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  }
  return null;
}

async function createShortcode(db, sequenceId, publicDoc, sourceDoc, isAdmin, FieldValue) {
  const word = publicDoc.word || sequenceId;
  const ownerId = publicDoc.ownerId || null;

  const record = {
    sequence: word,
    sequenceId,
    ownerId,
    createdAt: isAdmin ? FieldValue.serverTimestamp() : new Date(),
    createdBy: "system",
    scanCount: 0,
  };

  if (sourceDoc) {
    const { beats, steps, startPosition, startingPosition } = sourceDoc;
    const stepsData = beats || steps || [];
    const startPos = startPosition || startingPosition || null;
    if (stepsData.length > 0) {
      record.sequenceData = { steps: stepsData };
      if (startPos) {
        record.sequenceData.startPosition = startPos;
      }
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode();
    const docRef = db.collection("shortcodes").doc(code);

    if (isAdmin) {
      const existing = await docRef.get();
      if (existing.exists) continue;
      await docRef.set(record);
      return code;
    } else {
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(docRef);
          if (snap.exists) throw new Error("collision");
          tx.set(docRef, record);
        });
        return code;
      } catch (e) {
        if (e.message === "collision") continue;
        throw e;
      }
    }
  }
  throw new Error(`Failed to find unused code after ${MAX_RETRIES} attempts`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/create-shortcodes-batch.js <sequenceId1> [sequenceId2] ...");
    process.exit(1);
  }

  const sequenceIds = args;
  const { db, FieldValue, isAdmin, sdk } = await initFirestore();
  console.log(`Connected via ${sdk} SDK (admin=${isAdmin})`);
  console.log(`Creating shortcodes for ${sequenceIds.length} sequences\n`);

  const results = [];

  for (const seqId of sequenceIds) {
    process.stdout.write(`${seqId}... `);

    const existing = await findExistingShortcode(db, seqId, isAdmin);
    if (existing) {
      console.log(`already has shortcode: ${existing} → https://tka.run/${existing}`);
      results.push({ id: seqId, code: existing, existed: true });
      continue;
    }

    const pubDoc = await db.collection("publicSequences").doc(seqId).get();
    if (!pubDoc.exists) {
      console.log("NOT FOUND in publicSequences");
      results.push({ id: seqId, code: null, error: "not in publicSequences" });
      continue;
    }
    const pubData = pubDoc.data();

    let sourceData = null;
    const sourceRef = pubData.sourceRef;
    if (sourceRef) {
      try {
        const sourceSnap = await db.doc(sourceRef).get();
        if (sourceSnap.exists) {
          sourceData = sourceSnap.data();
        }
      } catch (e) {
        console.log(`(source fetch failed: ${e.message})`);
      }
    }

    try {
      const code = await createShortcode(db, seqId, pubData, sourceData, isAdmin, FieldValue);
      console.log(`created → https://tka.run/${code}`);
      results.push({ id: seqId, code, existed: false });
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      results.push({ id: seqId, code: null, error: e.message });
    }
  }

  console.log("\n--- RESULTS ---");
  for (const r of results) {
    if (r.code) {
      const word = r.id.length > 30 ? r.id.slice(0, 27) + "..." : r.id;
      console.log(`  ${word.padEnd(32)} https://tka.run/${r.code}${r.existed ? " (existing)" : ""}`);
    } else {
      console.log(`  ${r.id}: ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
