#!/usr/bin/env node
/**
 * One-shot "show me this sequence" pipeline.
 *
 * Takes raw sequence JSON (the same app/MCP format import-sequence.cjs
 * accepts) and in one command: imports it into Austen's library, indexes it
 * in publicSequences, mints a tka.run short code, and prints the link.
 *
 * Usage:
 *   node scripts/show-sequence.mjs sequence.json
 *   node scripts/show-sequence.mjs sequence.json --demo
 *   cat sequence.json | node scripts/show-sequence.mjs --stdin
 *   node scripts/show-sequence.mjs --purge-demos            # list demo entries
 *   node scripts/show-sequence.mjs --purge-demos --confirm  # delete them
 *
 * Idempotent: re-running with the same content reuses the existing library
 * doc (matched by content hash) and its existing short code.
 *
 * Reuses:
 *   - scripts/import-sequence.cjs   (doc building + LOOP detection)
 *   - scripts/create-shortcodes-batch.js (minting, transaction-guarded)
 *   - scripts/lib/firestore-provider.js  (forced to Admin SDK: the pipeline
 *     writes publicSequences and runs query-in-transaction minting)
 */

// Force the Admin SDK before firestore-provider loads its priority chain.
process.env.TKA_ADMIN = "1";

import { readFileSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { initFirestore } from "./lib/firestore-provider.js";
import { createShortcode, findExistingShortcode } from "./create-shortcodes-batch.js";

const require = createRequire(import.meta.url);
const { AUSTEN_UID, detectLoop, buildFirestoreDoc } = require("./import-sequence.cjs");

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = {
  stdin: false,
  demo: false,
  purgeDemos: false,
  confirm: false,
  notes: null,
  prop: null,
};
let jsonPath = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--stdin") flags.stdin = true;
  else if (a === "--demo") flags.demo = true;
  else if (a === "--purge-demos") flags.purgeDemos = true;
  else if (a === "--confirm") flags.confirm = true;
  else if (a === "--notes" && argv[i + 1]) flags.notes = argv[++i];
  else if (a === "--prop" && argv[i + 1]) flags.prop = argv[++i];
  else if (!a.startsWith("--")) jsonPath = a;
}

if (!flags.purgeDemos && !jsonPath && !flags.stdin) {
  console.error("Usage: node scripts/show-sequence.mjs <sequence.json> [--demo] [--notes 'text']");
  console.error("       cat sequence.json | node scripts/show-sequence.mjs --stdin [--demo]");
  console.error("       node scripts/show-sequence.mjs --purge-demos [--confirm]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readInput() {
  if (flags.stdin) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFileSync(resolve(jsonPath), "utf8");
}

/**
 * Deterministic hash of the sequence CONTENT (word + grid + steps), used for
 * idempotency: re-running with the same JSON reuses the existing doc instead
 * of importing a duplicate.
 */
function contentHashOf(raw) {
  const canonical = JSON.stringify({
    word: raw.word || "",
    gridMode: raw.gridMode || "diamond",
    startPosition: raw.startPosition || raw.startingPosition || null,
    steps: raw.steps || [],
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Purge demos
// ---------------------------------------------------------------------------

async function purgeDemos(db) {
  const libSnap = await db
    .collection(`users/${AUSTEN_UID}/sequences`)
    .where("demo", "==", true)
    .get();
  const pubSnap = await db.collection("publicSequences").where("demo", "==", true).get();

  const seqIds = new Set([...libSnap.docs.map((d) => d.id), ...pubSnap.docs.map((d) => d.id)]);
  if (seqIds.size === 0) {
    console.log("No demo sequences found. Nothing to purge.");
    return;
  }

  const codeDocs = [];
  for (const seqId of seqIds) {
    const snap = await db.collection("shortcodes").where("sequenceId", "==", seqId).get();
    snap.docs.forEach((d) => codeDocs.push(d));
  }

  console.log(`Demo entries found:`);
  for (const d of libSnap.docs) {
    console.log(`  library:  users/${AUSTEN_UID}/sequences/${d.id} (${d.data().word || "?"})`);
  }
  for (const d of pubSnap.docs) {
    console.log(`  public:   publicSequences/${d.id} (${d.data().word || "?"})`);
  }
  for (const d of codeDocs) {
    console.log(`  shortcode: ${d.id} -> https://tka.run/${d.id}`);
  }

  if (!flags.confirm) {
    console.log("\nDry run. Re-run with --confirm to delete these docs.");
    return;
  }

  for (const d of libSnap.docs) await d.ref.delete();
  for (const d of pubSnap.docs) await d.ref.delete();
  for (const d of codeDocs) await d.ref.delete();
  console.log(`\nDeleted ${libSnap.size} library, ${pubSnap.size} public, ${codeDocs.length} shortcode docs.`);
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function run() {
  const { db, FieldValue, isAdmin } = await initFirestore();

  if (flags.purgeDemos) {
    await purgeDemos(db);
    return;
  }

  const input = await readInput();
  let raw;
  try {
    raw = JSON.parse(input);
  } catch (err) {
    console.error("Failed to parse JSON:", err.message);
    process.exit(1);
  }

  const hash = contentHashOf(raw);
  console.log(`Sequence "${raw.word || "(no word)"}" (${(raw.steps || []).length} steps, hash ${hash.slice(0, 8)})`);

  // 1. Import into library (or reuse an existing import of the same content).
  const seqCollection = db.collection(`users/${AUSTEN_UID}/sequences`);
  let seqId;
  let libData;
  const dupSnap = await seqCollection.where("contentHash", "==", hash).limit(1).get();
  if (!dupSnap.empty) {
    seqId = dupSnap.docs[0].id;
    libData = dupSnap.docs[0].data();
    console.log(`Reusing existing library doc ${seqId}`);
  } else {
    const loopInfo = detectLoop(raw);
    const { id, data } = buildFirestoreDoc(raw, FieldValue, loopInfo, {
      visibility: "public",
      notes: flags.notes,
      demo: flags.demo,
    });
    data.contentHash = hash;
    if (flags.prop) {
      data.intendedProp = {
        bluePropType: flags.prop,
        redPropType: flags.prop,
        catDogMode: false,
      };
    }
    seqId = id;
    libData = data;
    await seqCollection.doc(seqId).set(data);
    await db.doc(`users/${AUSTEN_UID}`).set(
      {
        sequenceCount: FieldValue.increment(1),
        lastActivityDate: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`Imported as users/${AUSTEN_UID}/sequences/${seqId}`);
  }

  // 2. Index in publicSequences directly (the full all-users sync scan takes
  //    minutes; we know exactly which doc changed).
  const pubRef = db.doc(`publicSequences/${seqId}`);
  const pubSnap = await pubRef.get();
  if (pubSnap.exists) {
    console.log(`publicSequences/${seqId} already exists`);
  } else {
    const userDoc = await db.doc(`users/${AUSTEN_UID}`).get();
    const userData = userDoc.data() || {};
    const pubData = {
      id: seqId,
      sourceRef: `users/${AUSTEN_UID}/sequences/${seqId}`,
      ownerId: AUSTEN_UID,
      ownerDisplayName: userData.displayName || "Unknown",
      name: libData.name || libData.word || seqId,
      word: libData.word || "",
      thumbnails: libData.thumbnails || [],
      sequenceLength: libData.sequenceLength || (libData.steps || []).length,
      viewCount: 0,
      starCount: 0,
      tags: flags.demo ? ["demo"] : [],
      isForked: false,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (userData.photoURL) pubData.ownerAvatarUrl = userData.photoURL;
    if (flags.demo) pubData.demo = true;
    await pubRef.set(pubData);
    console.log(`Indexed in publicSequences/${seqId}`);
  }

  // 3. Mint (or reuse) the tka.run short code. createShortcode is
  //    transaction-guarded against concurrent duplicate mints; this pre-check
  //    just skips the transaction on the common re-run path.
  let code = await findExistingShortcode(db, seqId, isAdmin);
  if (code) {
    console.log(`Reusing existing shortcode ${code}`);
  } else {
    const pubData = (await pubRef.get()).data();
    const sourceData = { steps: libData.steps || [], startPosition: libData.startPosition || null };
    code = await createShortcode(db, seqId, pubData, sourceData, isAdmin, FieldValue);
    console.log(`Minted shortcode ${code}`);
  }

  // The /q scan page reads ?bp=<propType> (validated against the PropType
  // enum) and seeds the viewer's prop settings from it, overriding the staff
  // default. intendedProp on the doc covers app-side loads; the param covers
  // the scan route.
  const propParam = flags.prop ? `?bp=${flags.prop}` : "";
  console.log(`https://tka.run/${code}${propParam}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
