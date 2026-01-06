/**
 * Migration Script: Force-Publish All Sequences
 *
 * This script updates all sequences in Firestore to be public.
 * Run this after removing the visibility toggle feature.
 *
 * Usage: node scripts/migrate-all-public.js
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *   --confirm    Actually apply the changes (required)
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin
const serviceAccountPath = path.join(
  __dirname,
  "../config/firebase-service-account.json"
);

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error.message);
  console.log(
    "\nMake sure you have a service account JSON file at:",
    serviceAccountPath
  );
  process.exit(1);
}

const db = admin.firestore();

async function migrateSequences(dryRun = true) {
  console.log(`\n${"=".repeat(60)}`);
  console.log("  Force-Publish All Sequences Migration");
  console.log(`${"=".repeat(60)}\n`);

  if (dryRun) {
    console.log("DRY RUN MODE - No changes will be made\n");
  } else {
    console.log("LIVE MODE - Changes will be applied!\n");
  }

  try {
    // Query all sequences that are not already public
    const sequencesRef = db.collection("sequences");
    const snapshot = await sequencesRef.get();

    if (snapshot.empty) {
      console.log("No sequences found in the database.");
      return;
    }

    console.log(`Found ${snapshot.size} total sequences\n`);

    let publicCount = 0;
    let privateCount = 0;
    let unlistedCount = 0;
    let noVisibilityCount = 0;
    const toUpdate = [];

    // Categorize sequences
    snapshot.forEach((doc) => {
      const data = doc.data();
      const visibility = data.visibility;

      if (visibility === "public") {
        publicCount++;
      } else if (visibility === "private") {
        privateCount++;
        toUpdate.push({ id: doc.id, currentVisibility: visibility });
      } else if (visibility === "unlisted") {
        unlistedCount++;
        toUpdate.push({ id: doc.id, currentVisibility: visibility });
      } else {
        noVisibilityCount++;
        toUpdate.push({ id: doc.id, currentVisibility: "undefined" });
      }
    });

    console.log("Current visibility distribution:");
    console.log(`  - Public:     ${publicCount}`);
    console.log(`  - Private:    ${privateCount}`);
    console.log(`  - Unlisted:   ${unlistedCount}`);
    console.log(`  - No value:   ${noVisibilityCount}`);
    console.log(`\nSequences to update: ${toUpdate.length}\n`);

    if (toUpdate.length === 0) {
      console.log("All sequences are already public. No migration needed.");
      return;
    }

    if (dryRun) {
      console.log("Sequences that would be updated to 'public':");
      toUpdate.slice(0, 20).forEach((seq) => {
        console.log(`  - ${seq.id} (was: ${seq.currentVisibility})`);
      });
      if (toUpdate.length > 20) {
        console.log(`  ... and ${toUpdate.length - 20} more`);
      }
      console.log("\nRun with --confirm to apply these changes.");
      return;
    }

    // Apply updates in batches
    console.log("Updating sequences...");
    const batchSize = 500;
    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = db.batch();
      const chunk = toUpdate.slice(i, i + batchSize);

      chunk.forEach((seq) => {
        const docRef = sequencesRef.doc(seq.id);
        batch.update(docRef, {
          visibility: "public",
          isPublic: true, // Legacy field
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      updated += chunk.length;
      console.log(`  Updated ${updated}/${toUpdate.length} sequences`);
    }

    console.log(`\nMigration complete! ${updated} sequences now public.`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes("--confirm");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Usage: node scripts/migrate-all-public.js [options]

Options:
  --dry-run    Preview changes without applying them (default)
  --confirm    Actually apply the changes
  --help, -h   Show this help message
`);
  process.exit(0);
}

migrateSequences(isDryRun).then(() => {
  process.exit(0);
});
