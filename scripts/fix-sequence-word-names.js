#!/usr/bin/env node
/**
 * Fix sequences where `word` or `name` is "sequence" or "sequence [timestamp]"
 * instead of the actual word derived from the step letters.
 *
 * The bug occurs when sequences are saved without properly deriving the word
 * from the steps array. The fix reads each step's `letter` field and
 * concatenates them to produce the correct word.
 *
 * Usage:
 *   node scripts/fix-sequence-word-names.js                    # Dry run (all users)
 *   node scripts/fix-sequence-word-names.js --user elizabeth   # Dry run for specific user
 *   node scripts/fix-sequence-word-names.js --confirm          # Actually fix
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIRM_FLAG = process.argv.includes("--confirm");
const userFilter = (() => {
  const idx = process.argv.indexOf("--user");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Pattern: "sequence" optionally followed by timestamp or other suffix
const GENERIC_NAME_PATTERN = /^sequence\s*(\d|$)/i;

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error("Failed to load service account:", error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Derive word from beats/steps array (same logic as WordDeriver.deriveFromBeats)
 * Checks multiple possible field names: steps, beats, sequenceData.steps, sequenceData.beats
 */
function deriveWordFromData(data) {
  const seqData = data.sequenceData || {};

  // Try all possible locations for the beat/step array
  const candidates = [
    data.steps,
    data.beats,
    seqData.steps,
    seqData.beats,
  ];

  for (const arr of candidates) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) continue;
    const word = arr
      .map((beat) => beat.letter ?? "")
      .filter((letter) => letter !== "")
      .join("");
    if (word.length > 0) return word;
  }

  return null;
}

/**
 * Check if a word/name looks like a generic "sequence [timestamp]" placeholder
 * or is empty/missing
 */
function isGenericOrEmpty(value) {
  if (!value || typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return GENERIC_NAME_PATTERN.test(trimmed);
}

async function findAndFixGenericNames() {
  console.log("Scanning for sequences with generic 'sequence' names...\n");

  const problemSequences = [];

  // Get all users (or filter to specific user)
  const usersSnapshot = await db.collection("users").get();
  console.log(`Found ${usersSnapshot.size} users total\n`);

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const displayName = userData.displayName || userData.username || userDoc.id;

    // Filter by user if specified
    if (userFilter) {
      const nameMatch =
        displayName.toLowerCase().includes(userFilter.toLowerCase()) ||
        (userData.username || "").toLowerCase().includes(userFilter.toLowerCase());
      if (!nameMatch) continue;
    }

    // Get user's sequences
    const seqSnapshot = await db
      .collection("users")
      .doc(userDoc.id)
      .collection("sequences")
      .get();

    if (seqSnapshot.empty) continue;

    for (const seqDoc of seqSnapshot.docs) {
      const data = seqDoc.data();
      const seqData = data.sequenceData || {};

      const currentWord = data.word || seqData.word;
      const currentName = data.name || seqData.name;

      // Check if word or name is a generic placeholder or empty
      const wordIsGeneric = isGenericOrEmpty(currentWord);
      const nameIsGeneric = isGenericOrEmpty(currentName);

      if (!wordIsGeneric && !nameIsGeneric) continue;

      // Try to derive the correct word from beats/steps
      const derivedWord = deriveWordFromData(data);

      if (!derivedWord) {
        // Can't fix without steps data
        problemSequences.push({
          docId: seqDoc.id,
          userId: userDoc.id,
          userName: displayName,
          currentWord,
          currentName,
          derivedWord: null,
          path: `users/${userDoc.id}/sequences/${seqDoc.id}`,
          canFix: false,
          reason: "No steps data available to derive word",
          visibility: data.visibility,
        });
        continue;
      }

      // Only flag if the derived word is different from what's stored
      if (derivedWord === currentWord && derivedWord === currentName) continue;

      problemSequences.push({
        docId: seqDoc.id,
        userId: userDoc.id,
        userName: displayName,
        currentWord,
        currentName,
        derivedWord,
        path: `users/${userDoc.id}/sequences/${seqDoc.id}`,
        canFix: true,
        visibility: data.visibility,
      });
    }
  }

  // Also check publicSequences
  const publicSnapshot = await db.collection("publicSequences").get();
  console.log(`Checking ${publicSnapshot.size} public sequences...\n`);

  for (const doc of publicSnapshot.docs) {
    const data = doc.data();
    const currentWord = data.word;
    const currentName = data.name;

    if (!isGenericOrEmpty(currentWord) && !isGenericOrEmpty(currentName)) continue;

    // Public sequences may not have steps/beats, but try
    // Also try to load from source ref if available
    let derivedWord = deriveWordFromData(data);

    // If public doc doesn't have beats, try loading from source user's sequence
    if (!derivedWord && data.sourceRef) {
      try {
        const sourceDoc = await db.doc(data.sourceRef).get();
        if (sourceDoc.exists) {
          derivedWord = deriveWordFromData(sourceDoc.data());
        }
      } catch (e) {
        // Source ref might be invalid
      }
    }

    problemSequences.push({
      docId: doc.id,
      currentWord,
      currentName,
      derivedWord,
      path: `publicSequences/${doc.id}`,
      isPublic: true,
      canFix: !!derivedWord,
      reason: derivedWord ? undefined : "No steps data in public index",
      sourceRef: data.sourceRef,
    });
  }

  if (problemSequences.length === 0) {
    console.log("No sequences with generic 'sequence' names found!");
    return;
  }

  // Display findings
  const fixable = problemSequences.filter((s) => s.canFix);
  const unfixable = problemSequences.filter((s) => !s.canFix);

  console.log(`Found ${problemSequences.length} sequences with generic names:`);
  console.log(`  ${fixable.length} can be fixed (have steps data)`);
  console.log(`  ${unfixable.length} need manual review (no steps data)\n`);
  console.log("-".repeat(80));

  for (const seq of problemSequences) {
    console.log(`  ${seq.canFix ? "FIX" : "MANUAL"} ${seq.isPublic ? "[PUBLIC]" : `[${seq.userName}]`}`);
    console.log(`    Path: ${seq.path}`);
    console.log(`    Current word: "${seq.currentWord || "(none)"}"`);
    console.log(`    Current name: "${seq.currentName || "(none)"}"`);
    if (seq.canFix) {
      console.log(`    Derived word: "${seq.derivedWord}"`);
    } else {
      console.log(`    Issue: ${seq.reason}`);
      if (seq.sourceRef) {
        console.log(`    Source ref: ${seq.sourceRef}`);
      }
    }
    console.log("");
  }
  console.log("-".repeat(80));

  if (!CONFIRM_FLAG) {
    console.log("\nDRY RUN - No changes made.");
    console.log("Run with --confirm to fix these sequences.\n");
    console.log("  node scripts/fix-sequence-word-names.js --confirm");
    return;
  }

  // Fix the sequences
  console.log("\nFixing sequences...\n");
  let fixed = 0;
  let skipped = 0;

  for (const seq of fixable) {
    try {
      const docRef = db.doc(seq.path);

      if (seq.isPublic) {
        // Public sequence - update word and name directly
        await docRef.update({
          word: seq.derivedWord,
          name: seq.derivedWord,
        });
      } else {
        // User sequence - update in both top-level and nested sequenceData
        const updateData = {
          word: seq.derivedWord,
          name: seq.derivedWord,
        };

        // Also update nested sequenceData if it exists
        const doc = await docRef.get();
        const data = doc.data();
        if (data && data.sequenceData) {
          updateData["sequenceData.word"] = seq.derivedWord;
          updateData["sequenceData.name"] = seq.derivedWord;
        }

        await docRef.update(updateData);

        // If the sequence is public, also update the public index
        if (seq.visibility === "public") {
          const publicRef = db.collection("publicSequences").doc(seq.docId);
          const publicDoc = await publicRef.get();
          if (publicDoc.exists) {
            await publicRef.update({
              word: seq.derivedWord,
              name: seq.derivedWord,
            });
            console.log(`    Also updated public index`);
          }
        }
      }

      console.log(`  Fixed: "${seq.currentWord || seq.currentName}" -> "${seq.derivedWord}"${seq.userName ? ` (${seq.userName})` : ""}`);
      fixed++;
    } catch (err) {
      console.error(`  FAILED: ${seq.path} - ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}, Manual review: ${unfixable.length}`);
}

findAndFixGenericNames()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
