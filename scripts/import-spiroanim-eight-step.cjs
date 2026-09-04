#!/usr/bin/env node
/**
 * Import the 72 SpiroAnim Eight Step base cells as 12-step CAP sequences,
 * then group them in a "Gage's 12-step CAPs" collection.
 *
 * Source data: docs/research/spiroanim/eightstep-72-sequences.json, produced
 * and validated by tests/unit/spiroanim-72-validate.test.ts (1728/1728
 * orientation agreements against TKA's own engine, 0 continuity breaks).
 *
 * Concepts and handpaths are Gage DeMello's; the generated geometry is
 * Mentive's spiroanim implementation over them. ("Mentive" is the handle he
 * goes by and prefers — the only name his repo and posts actually carry.)
 *
 * Usage:
 *   node scripts/import-spiroanim-eight-step.cjs --dry-run
 *   node scripts/import-spiroanim-eight-step.cjs --commit
 */

const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");
const crypto = require("crypto");
const {
  AUSTEN_UID,
  buildFirestoreDoc,
  normalizeFirestoreDoc,
  stampNewSequenceTimestamps,
} = require("./import-sequence.cjs");

const args = process.argv.slice(2);
const isCommit = args.includes("--commit");

const COLLECTION_NAME = "Gage's 12-step CAPs";
const COLLECTION_DESCRIPTION =
  "The 72 base cells of the 8-Step Concepts, by Gage DeMello. Each is a closed " +
  "12-step capped antispin pattern: one hand caps while the other runs continually. " +
  "Transcribed from Mentive's spiroanim, which generates the geometry.";
const COLLECTION_CREDIT =
  "8-Step Concepts and handpaths by Gage DeMello; transcription source: Mentive's SpiroAnim (@rbgirard)";
const NOTES = "8-Step Concepts by Gage DeMello — spiroanim cell";

const cells = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../docs/research/spiroanim/eightstep-72-sequences.json"
    ),
    "utf8"
  )
);

async function main() {
  console.log(`Cells: ${cells.length}`);

  const localClock = { serverTimestamp: () => new Date() };

  let db = null;
  let writeFieldValue = localClock;
  if (isCommit) {
    const admin = require("firebase-admin");
    const requestedKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccountPath = requestedKey
      ? resolve(requestedKey)
      : resolve(__dirname, "../serviceAccountKey.json");
    if (!existsSync(serviceAccountPath)) {
      throw new Error(
        "Firebase service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the project root."
      );
    }
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    db = admin.firestore();
    writeFieldValue = admin.firestore.FieldValue;

    const existingCollections = await db
      .collection(`users/${AUSTEN_UID}/collections`)
      .where("name", "==", COLLECTION_NAME)
      .limit(1)
      .get();
    if (!existingCollections.empty) {
      const existingCollection = existingCollections.docs[0];
      const sequenceIds = existingCollection.get("sequenceIds") ?? [];
      const refs = sequenceIds.map((id) =>
        db.doc(`users/${AUSTEN_UID}/sequences/${id}`)
      );
      const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
      const byCell = new Map(
        snapshots.flatMap((snapshot) => {
          const match = String(snapshot.get("notes") ?? "").match(
            /spiroanim cell (\d-[A-Z]{2})/
          );
          return match ? [[match[1], snapshot]] : [];
        })
      );

      if (byCell.size !== cells.length) {
        throw new Error(
          `Existing collection has ${byCell.size}/${cells.length} identifiable Eight Step cells`
        );
      }

      const batch = db.batch();
      for (const cell of cells) {
        const snapshot = byCell.get(cell.metadata.cell);
        const sourceAssessment = cell.metadata.wallPlaneSourceAssessment;
        batch.set(
          snapshot.ref,
          {
            metadata: {
              ...(snapshot.get("metadata") ?? {}),
              source: cell.metadata.source,
              cell: cell.metadata.cell,
              attribution: cell.metadata.attribution,
              ...(sourceAssessment && {
                wallPlaneSourceAssessment: sourceAssessment,
              }),
            },
            notes:
              `${NOTES} ${cell.metadata.cell}` +
              (sourceAssessment
                ? " — SpiroAnim wall-plane flag: potentially difficult or impossible without significant modification."
                : ""),
            updatedAt: writeFieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      batch.set(
        existingCollection.ref,
        {
          description: COLLECTION_DESCRIPTION,
          credit: COLLECTION_CREDIT,
          updatedAt: writeFieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
      console.log(`Updated ${cells.length} existing Eight Step sequences.`);
      console.log(`Collection: ${existingCollection.ref.path}`);
      return;
    }
  }

  const built = [];
  for (const cell of cells) {
    const { id, data } = buildFirestoreDoc(cell, localClock, null, {
      visibility: "private",
      notes: `${NOTES} ${cell.metadata.cell}`,
      forceCircular: true,
    });
    // Collision guard: buildFirestoreDoc derives ids from Date.now() + 4 random
    // bytes, and 72 docs are minted inside the same millisecond.
    const uniqueId = `${id}_${cell.metadata.cell.replace("-", "")}`;
    const normalized = await normalizeFirestoreDoc({
      id: uniqueId,
      data: { ...data, id: uniqueId },
    });
    built.push({
      id: uniqueId,
      data: normalized.data,
      cell: cell.metadata.cell,
    });
  }

  const ids = new Set(built.map((b) => b.id));
  if (ids.size !== built.length) throw new Error("duplicate sequence ids");

  const circular = built.filter((b) => b.data.isCircular).length;
  const withLoop = built.filter((b) => b.data.loopType).length;
  console.log(
    `Built: ${built.length}   circular: ${circular}   loopType detected: ${withLoop}`
  );
  console.log(
    `Sample: ${built[0].cell} "${built[0].data.word}" loopType=${built[0].data.loopType ?? "-"}`
  );
  console.log(`Fields: ${Object.keys(built[0].data).join(", ")}`);

  const collectionId = `col_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const collectionDoc = {
    id: collectionId,
    name: COLLECTION_NAME,
    description: COLLECTION_DESCRIPTION,
    ownerId: AUSTEN_UID,
    sequenceIds: built.map((b) => b.id),
    sequenceCount: built.length,
    icon: "fa-folder",
    isPublic: false,
    sortOrder: 0,
    kind: "manual",
    credit: COLLECTION_CREDIT,
    createdAt: writeFieldValue.serverTimestamp(),
    updatedAt: writeFieldValue.serverTimestamp(),
  };

  if (!isCommit) {
    console.log(
      `\n[DRY RUN] Would write ${built.length} docs to users/${AUSTEN_UID}/sequences/`
    );
    console.log(
      `[DRY RUN] Would write collection users/${AUSTEN_UID}/collections/${collectionId}`
    );
    console.log(
      `[DRY RUN] "${COLLECTION_NAME}" with ${collectionDoc.sequenceCount} sequences`
    );
    return;
  }

  // Firestore batches cap at 500 writes; 72 + 1 fits in one.
  const batch = db.batch();
  for (const b of built) {
    batch.set(
      db.doc(`users/${AUSTEN_UID}/sequences/${b.id}`),
      stampNewSequenceTimestamps(b.data, writeFieldValue)
    );
  }
  batch.set(
    db.doc(`users/${AUSTEN_UID}/collections/${collectionId}`),
    collectionDoc
  );
  await batch.commit();

  const admin = require("firebase-admin");
  await db.doc(`users/${AUSTEN_UID}`).set(
    {
      sequenceCount: admin.firestore.FieldValue.increment(built.length),
      lastActivityDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`\nWrote ${built.length} sequences.`);
  console.log(`Collection: users/${AUSTEN_UID}/collections/${collectionId}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
