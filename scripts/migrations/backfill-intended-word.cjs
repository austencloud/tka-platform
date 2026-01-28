#!/usr/bin/env node
/**
 * Migration: Backfill intendedWord from spellData.originalWord
 *
 * For all sequences that have metadata.spellData.originalWord but no intendedWord,
 * copies the originalWord value to the intendedWord field.
 *
 * Usage:
 *   node scripts/migrations/backfill-intended-word.cjs --dry-run   # Preview changes
 *   node scripts/migrations/backfill-intended-word.cjs --execute   # Apply changes
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  console.error("Failed to load service account from:", serviceAccountPath);
  console.error("Make sure serviceAccountKey.json exists in the project root.");
  process.exit(1);
}

const db = admin.firestore();

async function findSequencesNeedingMigration() {
  const results = [];
  const stats = { total: 0, withSpellData: 0, withDifferentNameWord: 0 };

  // Check user libraries (users/{uid}/library/{sequenceId})
  const usersSnapshot = await db.collection("users").get();

  for (const userDoc of usersSnapshot.docs) {
    const libraryRef = db.collection(`users/${userDoc.id}/library`);
    const librarySnapshot = await libraryRef.get();

    for (const seqDoc of librarySnapshot.docs) {
      const data = seqDoc.data();
      stats.total++;

      // Check if has spellData.originalWord but no intendedWord
      const originalWord = data.metadata?.spellData?.originalWord;
      const hasIntendedWord = data.intendedWord !== undefined;

      if (originalWord && !hasIntendedWord) {
        stats.withSpellData++;
        results.push({
          path: `users/${userDoc.id}/library/${seqDoc.id}`,
          ref: seqDoc.ref,
          currentWord: data.word,
          originalWord: originalWord,
          name: data.name,
          source: "spellData",
        });
      }
      // Also check if name differs from word (possible spelled sequence without metadata)
      else if (!hasIntendedWord && data.name && data.word && data.name !== data.word) {
        // Only include if name looks like an intended spelled word:
        // 1. Name is all uppercase letters (TKA letters are uppercase)
        // 2. Name is shorter than word (bridges make word longer)
        // 3. Name doesn't contain spaces (spelled words are continuous)
        // 4. Name doesn't contain Greek letters (user typed English)
        const nameIsAllCaps = /^[A-Z]+$/.test(data.name);
        const nameIsShorter = data.name.length < data.word.length;
        const nameHasNoSpaces = !data.name.includes(" ");
        const nameHasNoGreek = !/[ΣΔΘΩΦΨΛαβγ-]/.test(data.name);

        if (nameIsAllCaps && nameIsShorter && nameHasNoSpaces && nameHasNoGreek) {
          stats.withDifferentNameWord++;
          results.push({
            path: `users/${userDoc.id}/library/${seqDoc.id}`,
            ref: seqDoc.ref,
            currentWord: data.word,
            originalWord: data.name, // Use name as the intended word
            name: data.name,
            source: "name!=word",
          });
        }
      }
    }
  }

  // Check public sequences (publicSequences/{sequenceId})
  const publicSnapshot = await db.collection("publicSequences").get();

  for (const seqDoc of publicSnapshot.docs) {
    const data = seqDoc.data();
    stats.total++;

    const originalWord = data.metadata?.spellData?.originalWord;
    const hasIntendedWord = data.intendedWord !== undefined;

    if (originalWord && !hasIntendedWord) {
      stats.withSpellData++;
      results.push({
        path: `publicSequences/${seqDoc.id}`,
        ref: seqDoc.ref,
        currentWord: data.word,
        originalWord: originalWord,
        name: data.name,
        source: "spellData",
      });
    }
    else if (!hasIntendedWord && data.name && data.word && data.name !== data.word) {
      const nameIsAllCaps = /^[A-Z]+$/.test(data.name);
      const nameIsShorter = data.name.length < data.word.length;
      const nameHasNoSpaces = !data.name.includes(" ");
      const nameHasNoGreek = !/[ΣΔΘΩΦΨΛαβγ-]/.test(data.name);

      if (nameIsAllCaps && nameIsShorter && nameHasNoSpaces && nameHasNoGreek) {
        stats.withDifferentNameWord++;
        results.push({
          path: `publicSequences/${seqDoc.id}`,
          ref: seqDoc.ref,
          currentWord: data.word,
          originalWord: data.name,
          name: data.name,
          source: "name!=word",
        });
      }
    }
  }

  console.log(`Scanned ${stats.total} sequences:`);
  console.log(`  - ${stats.withSpellData} have spellData.originalWord`);
  console.log(`  - ${stats.withDifferentNameWord} have name != word (possible spelled sequences)`);

  return results;
}

async function executeMigration(sequences, dryRun) {
  console.log(`\nFound ${sequences.length} sequences to migrate.\n`);

  if (sequences.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  // Show preview
  console.log("Sequences to update:");
  console.log("─".repeat(80));

  for (const seq of sequences) {
    const wordChanged = seq.currentWord !== seq.originalWord;
    console.log(`  ${seq.path}`);
    console.log(`    name: ${seq.name || "(none)"}`);
    console.log(`    word: ${seq.currentWord}`);
    console.log(`    intendedWord: ${seq.originalWord}${wordChanged ? " (differs from word)" : ""}`);
    console.log("");
  }

  console.log("─".repeat(80));

  if (dryRun) {
    console.log("\n🔍 DRY RUN - No changes made.");
    console.log(`   Run with --execute to apply changes to ${sequences.length} sequences.`);
    return;
  }

  // Execute migration in batches
  console.log("\n⏳ Executing migration...\n");

  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < sequences.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = sequences.slice(i, i + BATCH_SIZE);

    for (const seq of chunk) {
      batch.update(seq.ref, {
        intendedWord: seq.originalWord,
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`  Updated ${updated}/${sequences.length} sequences...`);
  }

  console.log(`\n✅ Migration complete. Updated ${updated} sequences.`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const execute = args.includes("--execute");

  if (!dryRun && !execute) {
    console.log("Usage:");
    console.log("  node scripts/migrations/backfill-intended-word.cjs --dry-run   # Preview changes");
    console.log("  node scripts/migrations/backfill-intended-word.cjs --execute   # Apply changes");
    process.exit(1);
  }

  console.log("🔍 Scanning for sequences with spellData.originalWord but no intendedWord...\n");

  try {
    const sequences = await findSequencesNeedingMigration();
    await executeMigration(sequences, dryRun);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
