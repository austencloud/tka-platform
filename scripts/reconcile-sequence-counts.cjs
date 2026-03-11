/**
 * One-time migration: reconcile sequenceCount for all users.
 *
 * The denormalized `sequenceCount` field on user documents can drift
 * from reality when increment writes fail silently. This script
 * counts actual sequences per user and writes the correct value.
 *
 * Usage:
 *   node scripts/reconcile-sequence-counts.cjs          # dry run
 *   node scripts/reconcile-sequence-counts.cjs --apply   # write fixes
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin with service account
const serviceAccountPath = path.resolve(
  __dirname,
  "../firebase-service-account.json"
);

let app;
try {
  app = admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch {
  // Already initialized
  app = admin.app();
}

const db = admin.firestore();
const dryRun = !process.argv.includes("--apply");

async function reconcile() {
  if (dryRun) {
    console.log("🔍 DRY RUN — no changes will be written\n");
  } else {
    console.log("🔧 APPLYING FIXES\n");
  }

  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} users\n`);

  let fixed = 0;
  let alreadyCorrect = 0;
  let errors = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const data = userDoc.data();
    const storedCount = data.sequenceCount ?? 0;
    const displayName = data.displayName || data.username || userId;

    try {
      // Count actual sequences in the user's subcollection
      const seqSnap = await db
        .collection(`users/${userId}/sequences`)
        .count()
        .get();
      const actualCount = seqSnap.data().count;

      if (storedCount !== actualCount) {
        const delta = actualCount - storedCount;
        const sign = delta > 0 ? "+" : "";
        console.log(
          `  ✏️  ${displayName}: ${storedCount} → ${actualCount} (${sign}${delta})`
        );

        if (!dryRun) {
          await db
            .collection("users")
            .doc(userId)
            .update({ sequenceCount: actualCount });
        }
        fixed++;
      } else {
        alreadyCorrect++;
      }
    } catch (err) {
      console.error(`  ❌ ${displayName}: ${err.message}`);
      errors++;
    }
  }

  console.log(
    `\n${dryRun ? "Would fix" : "Fixed"}: ${fixed} | Already correct: ${alreadyCorrect} | Errors: ${errors}`
  );

  if (dryRun && fixed > 0) {
    console.log("\nRun with --apply to write the fixes.");
  }

  process.exit(0);
}

reconcile().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
