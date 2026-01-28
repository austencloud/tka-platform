#!/usr/bin/env node
/**
 * Migrate Orphaned Feedback Items
 *
 * One-time migration script to fix items with status="in-progress" but no active claim.
 * These "orphaned" items should be reset to "new" so they appear in the unclaimed queue.
 *
 * Usage:
 *   node scripts/migrate-orphaned-feedback.js           # Dry run (preview only)
 *   node scripts/migrate-orphaned-feedback.js --commit  # Actually make changes
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

// Stale threshold: 2 hours (same as in config)
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

async function migrateOrphanedItems() {
  const isDryRun = !process.argv.includes("--commit");

  console.log("\n" + "=".repeat(70));
  console.log("  ORPHANED FEEDBACK MIGRATION");
  console.log("=".repeat(70));

  if (isDryRun) {
    console.log("\n  ⚠️  DRY RUN MODE - No changes will be made");
    console.log("     Add --commit to actually perform the migration\n");
  } else {
    console.log("\n  🚀 COMMIT MODE - Changes will be written to Firestore\n");
  }

  // Find all in-progress items
  const inProgressSnapshot = await db
    .collection("feedback")
    .where("status", "==", "in-progress")
    .get();

  console.log(`  Found ${inProgressSnapshot.size} items with status="in-progress"\n`);

  const orphaned = [];
  const stale = [];
  const active = [];

  for (const doc of inProgressSnapshot.docs) {
    const data = doc.data();
    const hasClaim = Boolean(data.claimToken && data.claimedAt);
    const title = (data.title || data.description || "Untitled").substring(0, 50);

    if (!hasClaim) {
      orphaned.push({ id: doc.id, title, data });
    } else {
      const claimAge = Date.now() - data.claimedAt.toDate().getTime();
      if (claimAge > STALE_THRESHOLD_MS) {
        stale.push({ id: doc.id, title, data, claimAge });
      } else {
        active.push({ id: doc.id, title, data, claimAge });
      }
    }
  }

  // Report findings
  console.log("─".repeat(70));
  console.log("  FINDINGS:\n");

  if (active.length > 0) {
    console.log(`  ✅ Active claims (${active.length}):`);
    for (const item of active) {
      const ageMin = Math.floor(item.claimAge / 60000);
      const token = item.data.claimToken?.substring(0, 8) || "unknown";
      console.log(`     [${token}] ${item.id.substring(0, 8)}... - ${ageMin}m ago - ${item.title}`);
    }
    console.log();
  }

  if (orphaned.length > 0) {
    console.log(`  ⚠️  Orphaned (no claim): ${orphaned.length}`);
    for (const item of orphaned) {
      console.log(`     ${item.id.substring(0, 8)}... - ${item.title}`);
    }
    console.log();
  }

  if (stale.length > 0) {
    console.log(`  ⏰ Stale claims (${stale.length}):`);
    for (const item of stale) {
      const ageHrs = Math.floor(item.claimAge / 3600000);
      const token = item.data.claimToken?.substring(0, 8) || "unknown";
      console.log(`     [${token}] ${item.id.substring(0, 8)}... - ${ageHrs}h ago - ${item.title}`);
    }
    console.log();
  }

  // Items to migrate: orphaned + stale
  const toMigrate = [...orphaned, ...stale];

  if (toMigrate.length === 0) {
    console.log("  🎉 No items need migration!\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  console.log("─".repeat(70));
  console.log(`  MIGRATION: Reset ${toMigrate.length} items to status="new"\n`);

  if (isDryRun) {
    console.log("  Would reset:");
    for (const item of toMigrate) {
      console.log(`     ${item.id.substring(0, 8)}... - ${item.title}`);
    }
    console.log("\n  Run with --commit to execute migration.\n");
  } else {
    // Perform migration
    const batch = db.batch();

    for (const item of toMigrate) {
      const docRef = db.collection("feedback").doc(item.id);
      batch.update(docRef, {
        status: "new",
        claimToken: admin.firestore.FieldValue.delete(),
        claimedAt: admin.firestore.FieldValue.delete(),
        claimedBy: admin.firestore.FieldValue.delete(),
        claimSession: admin.firestore.FieldValue.delete(),
        // Add migration note to history
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "new",
          fromStatus: "in-progress",
          timestamp: new Date(),
          actorId: "system",
          actorName: "Migration Script",
          notes: "Reset orphaned/stale item to new (claim-derived-status migration)",
        }),
      });
    }

    await batch.commit();

    console.log(`  ✅ Successfully migrated ${toMigrate.length} items:\n`);
    for (const item of toMigrate) {
      console.log(`     ${item.id.substring(0, 8)}... - ${item.title}`);
    }
    console.log();
  }

  console.log("=".repeat(70) + "\n");
}

migrateOrphanedItems()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
