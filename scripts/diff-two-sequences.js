#!/usr/bin/env node
/**
 * Deep diff two specific sequences to find every field-level difference.
 */
import { initFirestore } from "./lib/firestore-provider.js";

const AUSTEN_UID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const ID_A = "98984f12-a9e8-4ef8-933c-1faafba7cd8d"; // older (Mar 11)
const ID_B = "73bd83f2-11db-40ba-97c6-5a1ca30bba8f"; // newer (Mar 14)

function deepDiff(a, b, path = "") {
  const diffs = [];
  if (a === b) return diffs;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  ) {
    diffs.push({ path, a, b });
    return diffs;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const maxLen = Math.max(a?.length || 0, b?.length || 0);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...deepDiff(a?.[i], b?.[i], `${path}[${i}]`));
    }
    return diffs;
  }
  // Objects
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    diffs.push(...deepDiff(a[key], b[key], path ? `${path}.${key}` : key));
  }
  return diffs;
}

async function run() {
  const { db } = await initFirestore();
  const refA = db.doc(`users/${AUSTEN_UID}/sequences/${ID_A}`);
  const refB = db.doc(`users/${AUSTEN_UID}/sequences/${ID_B}`);
  const [snapA, snapB] = await Promise.all([refA.get(), refB.get()]);

  const a = snapA.data();
  const b = snapB.data();

  // Skip metadata fields we don't care about
  const skip = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "birthday",
    "dateAdded",
    "_version",
    "thumbnails",
    "contentHash",
    "source",
    "visibility",
    "visibilityChangedAt",
    "lastAccessedAt",
    "ownerDisplayName",
    "ownerAvatarUrl",
    "ownerId",
    "isFavorite",
    "sequenceTags",
    "tagIds",
    "notes",
    "collectionIds",
    "leftPathHash",
    "rightPathHash",
    "leftSoloHash",
    "rightSoloHash",
    "leftSoloProp",
    "rightSoloProp",
    // Legacy persisted aliases remain ignorable when comparing old records.
    "bluePathHash",
    "redPathHash",
    "blueSoloHash",
    "redSoloHash",
    "blueSoloProp",
    "redSoloProp",
    "stepPairings",
    "orientationCycleCount",
  ]);

  const diffs = deepDiff(a, b).filter((d) => !skip.has(d.path.split(".")[0]));

  if (diffs.length === 0) {
    console.log(
      "No motion-relevant differences found. These are exact duplicates."
    );
  } else {
    console.log(`Found ${diffs.length} difference(s):\n`);
    for (const d of diffs) {
      const aStr = JSON.stringify(d.a)?.slice(0, 120) ?? "undefined";
      const bStr = JSON.stringify(d.b)?.slice(0, 120) ?? "undefined";
      console.log(`  ${d.path}`);
      console.log(`    A: ${aStr}`);
      console.log(`    B: ${bStr}`);
      console.log();
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
