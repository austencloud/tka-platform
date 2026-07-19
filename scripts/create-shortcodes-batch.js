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

import { pathToFileURL } from "url";
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

async function findExistingShortcode(db, sequenceId) {
  // Works on both SDKs (client rules allow reading shortcodes). Without this
  // check on the client path, every re-run minted a fresh duplicate code.
  try {
    const snapshot = await db
      .collection("shortcodes")
      .where("sequenceId", "==", sequenceId)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  } catch {
    // Rules may block the query for some callers; fall through to minting.
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
      // Transaction guards against the duplicate-mint race: two concurrent
      // runs for the same sequenceId each minted their own code (7KN5/DSV9,
      // 2026-07-18). The admin SDK allows queries inside transactions, so we
      // re-check for an existing code by sequenceId atomically, right before
      // writing.
      try {
        const result = await db.runTransaction(async (tx) => {
          const dup = await tx.get(
            db.collection("shortcodes").where("sequenceId", "==", sequenceId).limit(1)
          );
          if (!dup.empty) return { code: dup.docs[0].id, existed: true };
          const snap = await tx.get(docRef);
          if (snap.exists) throw new Error("collision");
          tx.set(docRef, record);
          return { code, existed: false };
        });
        return result.code;
      } catch (e) {
        if (e.message === "collision") continue;
        throw e;
      }
    } else {
      // Client SDK transactions cannot run queries, so re-check for an
      // existing code as late as possible before the create transaction.
      const dup = await findExistingShortcode(db, sequenceId);
      if (dup) return dup;
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

// Reused by scripts/show-sequence.mjs.
export { findExistingShortcode, createShortcode };

// Only run the CLI when invoked directly. The explicit exit(0) matters:
// Firestore's gRPC/auth handles keep the Node event loop alive after main()
// resolves, so without it this process never exits — which is what made
// generate-qr.mjs (spawnSync of this script) hang forever after minting.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(1);
    });
}
