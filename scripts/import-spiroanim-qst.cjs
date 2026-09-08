#!/usr/bin/env node
/**
 * Import the complete 228-pattern Quarter Space Tech archive translated from
 * Mentive's SpiroAnim. Every hand motion carries its authored primary 3D plane.
 *
 * Usage:
 *   node scripts/import-spiroanim-qst.cjs --dry-run
 *   node scripts/import-spiroanim-qst.cjs --commit
 */

const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");
const {
  AUSTEN_UID,
  buildFirestoreDoc,
  normalizeFirestoreDoc,
} = require("./import-sequence.cjs");

const isCommit = process.argv.includes("--commit");
const COLLECTION_ID = "col_spiroanim_qst_archive";
const COLLECTION_NAME = "Quarter Space Tech Archive";
const COLLECTION_CREDIT =
  "Quarter Space Tech source documents by Mentive (@rbgirard), based on Alex Kurowski's grid";
const COLLECTION_DESCRIPTION =
  'All 228 Quarter Space Tech patterns documented by Mentive from Alex Kurowski\'s grid and preserved in SpiroAnim: 56 Quarter "Time" ' +
  "Breaks, 64 Advanced, and 108 Beyond. Each source arc is translated into an " +
  "editable Kinetic Alphabet step with an authored Wall, Wheel, or Floor plane. " +
  "Unlisted patterns are not a positive anatomical-feasibility claim.";

const sequences = JSON.parse(
  readFileSync(
    resolve(__dirname, "../docs/research/spiroanim/qst-228-sequences.json"),
    "utf8"
  )
);

function sequenceId(reference) {
  return `seq_spiroanim_qst_${reference.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

function notesFor(sequence) {
  const metadata = sequence.metadata;
  return (
    `${metadata.sourceReference}: ${sequence.displayName}. ` +
    `${COLLECTION_CREDIT}. Original source: ${metadata.sourceDocument}. ` +
    "Translated from Mentive's SpiroAnim into Flow Arts Composer."
  );
}

function resolveServiceAccountPath() {
  const requested = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const candidate = requested
    ? resolve(requested)
    : resolve(__dirname, "../serviceAccountKey.json");
  if (!existsSync(candidate)) {
    throw new Error(
      "Firebase service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the project root."
    );
  }
  return candidate;
}

async function buildAll() {
  const localClock = { serverTimestamp: () => new Date(0) };
  return Promise.all(
    sequences.map(async (sequence) => {
      const id = sequenceId(sequence.metadata.sourceReference);
      const built = buildFirestoreDoc(sequence, localClock, null, {
        visibility: "private",
        notes: notesFor(sequence),
        forceCircular: true,
      });
      const normalized = await normalizeFirestoreDoc({
        id,
        data: { ...built.data, id },
      });
      return {
        id,
        reference: sequence.metadata.sourceReference,
        data: normalized.data,
      };
    })
  );
}

async function main() {
  if (sequences.length !== 228) {
    throw new Error(`Expected 228 QST sequences, found ${sequences.length}`);
  }

  const built = await buildAll();
  const ids = new Set(built.map(({ id }) => id));
  if (ids.size !== built.length)
    throw new Error("Duplicate deterministic QST IDs");

  const seriesCounts = built.reduce((counts, sequence) => {
    const series = sequence.reference.split("-", 1)[0];
    counts[series] = (counts[series] ?? 0) + 1;
    return counts;
  }, {});
  console.log(
    `Built ${built.length} QST sequences: ${JSON.stringify(seriesCounts)}`
  );
  console.log(`Collection: ${COLLECTION_NAME} (${COLLECTION_ID})`);
  console.log(`Sample: ${built[0].reference} ${built[0].data.word}`);

  if (!isCommit) {
    console.log(
      `[DRY RUN] Would write users/${AUSTEN_UID}/collections/${COLLECTION_ID} and ${built.length} private sequences.`
    );
    return;
  }

  const admin = require("firebase-admin");
  const serviceAccount = JSON.parse(
    readFileSync(resolveServiceAccountPath(), "utf8")
  );
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();
  const fieldValue = admin.firestore.FieldValue;
  const sequenceRefs = built.map(({ id }) =>
    db.doc(`users/${AUSTEN_UID}/sequences/${id}`)
  );
  const sequenceRefById = new Map(
    sequenceRefs.map((reference) => [reference.id, reference])
  );
  const existingSnapshots = await db.getAll(...sequenceRefs);
  const existingById = new Map(
    existingSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()])
  );
  const collectionRef = db.doc(
    `users/${AUSTEN_UID}/collections/${COLLECTION_ID}`
  );
  const existingCollection = await collectionRef.get();

  const batch = db.batch();
  for (const sequence of built) {
    const existing = existingById.get(sequence.id);
    batch.set(sequenceRefById.get(sequence.id), {
      ...sequence.data,
      birthday: existing?.birthday ?? fieldValue.serverTimestamp(),
      createdAt: existing?.createdAt ?? fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp(),
    });
  }
  batch.set(collectionRef, {
    id: COLLECTION_ID,
    name: COLLECTION_NAME,
    description: COLLECTION_DESCRIPTION,
    credit: COLLECTION_CREDIT,
    ownerId: AUSTEN_UID,
    sequenceIds: built.map(({ id }) => id),
    sequenceCount: built.length,
    icon: "fa-cube",
    isPublic: false,
    sortOrder: 0,
    kind: "manual",
    createdAt:
      existingCollection.get("createdAt") ?? fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
  });
  await batch.commit();

  const createdCount = built.length - existingById.size;
  if (createdCount > 0) {
    await db.doc(`users/${AUSTEN_UID}`).set(
      {
        sequenceCount: fieldValue.increment(createdCount),
        lastActivityDate: fieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log(`Wrote ${built.length} sequences (${createdCount} new).`);
  console.log(`Collection: users/${AUSTEN_UID}/collections/${COLLECTION_ID}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
