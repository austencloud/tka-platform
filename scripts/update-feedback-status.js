/**
 * Update feedback item status
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

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

async function updateFeedbackStatus() {
  const feedbackId = process.argv[2];
  const status = process.argv[3];
  const notes = process.argv[4];

  if (!feedbackId || !status) {
    console.error(
      "Usage: node scripts/update-feedback-status.js <feedbackId> <status> [notes]"
    );
    console.error(
      "Valid statuses: new, in-progress, in-review, completed, archived"
    );
    process.exit(1);
  }

  const validStatuses = [
    "new",
    "in-progress",
    "in-review",
    "completed",
    "archived",
  ];
  if (!validStatuses.includes(status)) {
    console.error(`Invalid status: ${status}`);
    console.error(`Valid statuses: ${validStatuses.join(", ")}`);
    process.exit(1);
  }

  console.log(`Updating feedback ${feedbackId} to ${status}...`);

  const ref = db.collection("feedback").doc(feedbackId);
  const updateData = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (notes) {
    updateData.adminNotes = notes;
  }

  await ref.update(updateData);

  console.log(`✓ Updated feedback ${feedbackId} to ${status}`);
  if (notes) {
    console.log(`✓ Added resolution notes: ${notes}`);
  }
}

updateFeedbackStatus().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
