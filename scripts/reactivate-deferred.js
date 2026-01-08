/**
 * Reactivate Deferred Feedback
 *
 * Finds all archived feedback items with deferredUntil dates in the past
 * and moves them back to "new" status.
 *
 * Usage:
 *   node scripts/reactivate-deferred.js           - Reactivate items due today
 *   node scripts/reactivate-deferred.js --dry-run - Preview without changes
 *
 * Intended to run:
 *   - Daily via GitHub Actions cron
 *   - Manually when needed
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function reactivateDeferred() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("⏰ Reactivating Deferred Feedback\n");
  console.log("=".repeat(70));

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  try {
    const now = admin.firestore.Timestamp.now();

    // Query for archived items with deferredUntil <= now
    const snapshot = await db
      .collection("feedback")
      .where("status", "==", "archived")
      .where("deferredUntil", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("\n✅ No deferred items ready for reactivation.");
      console.log("   All deferred items are still in the future.\n");
      return;
    }

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`\n📋 Found ${items.length} item(s) ready to reactivate:\n`);

    items.forEach((item, idx) => {
      const title =
        item.title || item.description?.substring(0, 60) || "Untitled";
      const deferDate =
        item.deferredUntil?.toDate?.().toLocaleDateString() || "Unknown";
      const reason = item.adminNotes || "No reason provided";

      console.log(
        `  ${idx + 1}. ${item.id.substring(0, 8)}... | ${item.type || "N/A"}`
      );
      console.log(`     Title: ${title}${item.title ? "" : "..."}`);
      console.log(`     Deferred until: ${deferDate}`);
      console.log(`     Reason: ${reason}`);
      console.log("");
    });

    console.log("─".repeat(70));

    if (dryRun) {
      console.log(
        "\n🔍 Dry run complete. Run without --dry-run to reactivate.\n"
      );
      return;
    }

    // Reactivate each item
    console.log("\n♻️  Reactivating items...\n");

    const batch = db.batch();

    items.forEach((item) => {
      const ref = db.collection("feedback").doc(item.id);
      batch.update(ref, {
        status: "new",
        deferredUntil: admin.firestore.FieldValue.delete(),
        archivedAt: admin.firestore.FieldValue.delete(),
        reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reactivatedFrom: item.deferredUntil,
      });
    });

    await batch.commit();

    console.log(`✅ Successfully reactivated ${items.length} item(s)!`);
    console.log('\n💡 These items are now back in the "new" queue.');
    console.log("   Run /fb to claim and work on them.\n");

    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("❌ Error reactivating deferred items:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

reactivateDeferred();
