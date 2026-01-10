/**
 * Consolidate releases 0.7.9, 0.7.10, 0.7.11 back to completed status
 * These releases never actually deployed due to build failures
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

const VERSIONS_TO_REMOVE = ["0.7.9", "0.7.10", "0.7.11"];

async function consolidateReleases() {
  console.log("🔄 Consolidating failed releases...\n");
  console.log(`Versions to remove: ${VERSIONS_TO_REMOVE.join(", ")}\n`);

  // Find all feedback items with these versions
  const feedbackSnapshot = await db.collection("feedback").get();

  const itemsToUnarchive = [];

  feedbackSnapshot.forEach((doc) => {
    const data = doc.data();
    if (VERSIONS_TO_REMOVE.includes(data.fixedInVersion)) {
      itemsToUnarchive.push({
        id: doc.id,
        title: data.title || data.description?.substring(0, 50) || "Untitled",
        version: data.fixedInVersion,
        type: data.type,
      });
    }
  });

  console.log(`Found ${itemsToUnarchive.length} feedback items to unarchive:\n`);

  itemsToUnarchive.forEach((item) => {
    const typeEmoji =
      item.type === "bug" ? "🐛" : item.type === "feature" ? "✨" : "🔧";
    console.log(`  ${typeEmoji} [${item.version}] ${item.title}`);
  });

  if (itemsToUnarchive.length === 0) {
    console.log("\nNo feedback items need unarchiving.");
  } else {
    // Unarchive feedback items
    const batch = db.batch();

    itemsToUnarchive.forEach((item) => {
      const ref = db.collection("feedback").doc(item.id);
      batch.update(ref, {
        status: "completed",
        fixedInVersion: admin.firestore.FieldValue.delete(),
        archivedAt: admin.firestore.FieldValue.delete(),
      });
    });

    await batch.commit();
    console.log(`\n✓ Unarchived ${itemsToUnarchive.length} feedback items (set to "completed")`);
  }

  // Delete version documents
  console.log("\nDeleting version documents...");

  for (const version of VERSIONS_TO_REMOVE) {
    const versionRef = db.collection("versions").doc(version);
    const versionDoc = await versionRef.get();

    if (versionDoc.exists) {
      await versionRef.delete();
      console.log(`  ✓ Deleted version document: ${version}`);
    } else {
      console.log(`  - Version document not found: ${version}`);
    }
  }

  console.log("\n✅ Consolidation complete!");
  console.log("Next steps:");
  console.log("  1. Fix the build issues");
  console.log("  2. Deploy to production");
  console.log("  3. Run: node scripts/archive-feedback.js 0.7.9");
  console.log("  4. Create GitHub release for v0.7.9");
}

consolidateReleases().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
