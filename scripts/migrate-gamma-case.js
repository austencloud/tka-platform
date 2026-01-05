/**
 * Gamma Case Migration Script
 *
 * Fixes uppercase gamma (Γ) to lowercase gamma (γ) in Firebase sequences.
 * The code expects lowercase γ but some stored data has uppercase Γ.
 *
 * Usage: node scripts/migrate-gamma-case.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without writing to Firebase
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// The problematic characters
const UPPERCASE_GAMMA = "Γ";
const LOWERCASE_GAMMA = "γ";

/**
 * Recursively search and replace uppercase gamma in an object
 * Returns { modified: boolean, data: object }
 */
function fixGammaInObject(obj) {
  if (obj === null || obj === undefined) {
    return { modified: false, data: obj };
  }

  if (typeof obj === "string") {
    if (obj === UPPERCASE_GAMMA) {
      return { modified: true, data: LOWERCASE_GAMMA };
    }
    if (obj.includes(UPPERCASE_GAMMA)) {
      return {
        modified: true,
        data: obj.replace(new RegExp(UPPERCASE_GAMMA, "g"), LOWERCASE_GAMMA),
      };
    }
    return { modified: false, data: obj };
  }

  if (Array.isArray(obj)) {
    let anyModified = false;
    const newArr = obj.map((item) => {
      const result = fixGammaInObject(item);
      if (result.modified) anyModified = true;
      return result.data;
    });
    return { modified: anyModified, data: newArr };
  }

  if (typeof obj === "object") {
    let anyModified = false;
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const result = fixGammaInObject(value);
      if (result.modified) anyModified = true;
      newObj[key] = result.data;
    }
    return { modified: anyModified, data: newObj };
  }

  return { modified: false, data: obj };
}

/**
 * Process a single sequence document
 */
function processSequence(docData) {
  const result = fixGammaInObject(docData);
  return result;
}

/**
 * Migrate all sequences in a collection
 */
async function migrateCollection(collectionPath, dryRun, stats) {
  console.log(`\n📂 Processing: ${collectionPath}`);

  const snapshot = await db.collection(collectionPath).get();
  console.log(`   Found ${snapshot.size} documents`);

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 500;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const result = processSequence(data);

    if (result.modified) {
      stats.modified++;
      console.log(`   ✏️  Fixing: ${doc.id} (word: ${data.word || data.name || "unknown"})`);

      if (!dryRun) {
        batch.set(doc.ref, result.data, { merge: true });
        batchCount++;

        // Commit batch if reaching limit
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      }
    } else {
      stats.unchanged++;
    }
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`   💾 Committed final batch of ${batchCount} documents`);
  }
}

/**
 * Migrate all user sequences
 */
async function migrateUserSequences(dryRun, stats) {
  console.log("\n👥 Finding all users with sequences...");

  // Get all users
  const usersSnapshot = await db.collection("users").get();
  console.log(`   Found ${usersSnapshot.size} users`);

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const sequencesPath = `users/${userId}/sequences`;

    // Check if user has sequences subcollection
    const sequencesRef = db.collection(sequencesPath);
    const sequencesSnapshot = await sequencesRef.limit(1).get();

    if (!sequencesSnapshot.empty) {
      await migrateCollection(sequencesPath, dryRun, stats);
    }
  }
}

/**
 * Main migration function
 */
async function migrateGammaCase(dryRun = false) {
  console.log(`\n🔄 Gamma Case Migration${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Fixing: ${UPPERCASE_GAMMA} → ${LOWERCASE_GAMMA}\n`);

  const stats = {
    modified: 0,
    unchanged: 0,
    errors: 0,
  };

  try {
    // 1. Migrate publicSequences collection
    await migrateCollection("publicSequences", dryRun, stats);

    // 2. Migrate all user sequences
    await migrateUserSequences(dryRun, stats);

    // Print results
    console.log("\n📊 Migration Results\n");
    console.log(`   ${dryRun ? "Would modify" : "Modified"}:  ${stats.modified}`);
    console.log(`   Unchanged:  ${stats.unchanged}`);
    console.log(`   Errors:     ${stats.errors}`);

    if (dryRun) {
      console.log("\n⚠️  Dry run complete. No changes were made.");
      console.log("   Run without --dry-run to apply changes.\n");
    } else {
      console.log("\n✅ Migration complete!\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    stats.errors++;
    process.exit(1);
  }
}

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

migrateGammaCase(dryRun).then(() => process.exit(0));
