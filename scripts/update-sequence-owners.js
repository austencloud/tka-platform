/**
 * Paginated Sequence Owner Update Script
 *
 * Updates public sequences with Austen's owner data using pagination
 * to avoid Firestore quota limits.
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import config from "../config/feedback.config.js";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Use admin user from config
const AUSTEN_USER = {
  ownerId: config.ADMIN_USER.userId,
  ownerDisplayName: config.ADMIN_USER.displayName,
  ownerAvatarUrl: config.ADMIN_USER.photoURL,
};

const PAGE_SIZE = 20; // Very small page size to stay under quota
const DELAY_MS = 2000; // 2 second delay between pages

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateSequencesInPages() {
  console.log("\n📦 Starting paginated sequence owner update...\n");

  let lastDoc = null;
  let totalUpdated = 0;
  let pageNum = 0;

  while (true) {
    pageNum++;
    console.log(
      `\n📄 Page ${pageNum}: Fetching up to ${PAGE_SIZE} sequences...`
    );

    try {
      // Build query with pagination
      let query = db
        .collection("publicSequences")
        .orderBy("__name__") // Order by document ID for stable pagination
        .limit(PAGE_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log("\n✅ No more documents to process!");
        break;
      }

      console.log(`   Found ${snapshot.docs.length} documents`);

      // Filter to only sequences without owner data
      const docsToUpdate = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return !data.ownerId;
      });

      console.log(`   ${docsToUpdate.length} need owner data`);

      if (docsToUpdate.length > 0) {
        // Update in a batch
        const batch = db.batch();
        docsToUpdate.forEach((doc) => {
          batch.update(doc.ref, AUSTEN_USER);
        });

        await batch.commit();
        totalUpdated += docsToUpdate.length;
        console.log(
          `   ✅ Updated ${docsToUpdate.length} sequences (total: ${totalUpdated})`
        );
      }

      // Save last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Check if this was the last page
      if (snapshot.docs.length < PAGE_SIZE) {
        console.log("\n✅ Reached end of collection!");
        break;
      }

      // Delay before next page to respect quota
      console.log(`   Waiting ${DELAY_MS}ms before next page...`);
      await sleep(DELAY_MS);
    } catch (error) {
      if (error.code === 8 || error.message.includes("RESOURCE_EXHAUSTED")) {
        console.log(`\n⏸️  Quota exceeded. Waiting 30 seconds before retry...`);
        await sleep(30000);
        // Don't increment lastDoc - retry same page
        pageNum--;
      } else {
        console.error("\n❌ Error:", error.message);
        throw error;
      }
    }
  }

  console.log(`\n🎉 Complete! Updated ${totalUpdated} sequences total.\n`);
}

updateSequencesInPages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
