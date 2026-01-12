#!/usr/bin/env node
/**
 * Find a sequence by ID or word in publicSequences
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const searchTerm = process.argv[2] || "fe36e95d-b5a5-4e31-997d-8e7a89f0b753";

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

async function findSequence() {
  console.log(`🔍 Searching for: "${searchTerm}"\n`);

  // Try to get by document ID
  const byId = await db.collection("publicSequences").doc(searchTerm).get();
  if (byId.exists) {
    console.log("✅ Found by document ID:");
    console.log(JSON.stringify(byId.data(), null, 2));
    return;
  }

  // Search by word field
  const byWord = await db.collection("publicSequences").where("word", "==", searchTerm).get();
  if (!byWord.empty) {
    console.log(`✅ Found ${byWord.size} by word field:`);
    byWord.forEach(doc => {
      console.log(`  ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
    return;
  }

  // Search by name field
  const byName = await db.collection("publicSequences").where("name", "==", searchTerm).get();
  if (!byName.empty) {
    console.log(`✅ Found ${byName.size} by name field:`);
    byName.forEach(doc => {
      console.log(`  ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
    return;
  }

  console.log("❌ Not found in publicSequences collection");

  // Check if it exists as a user library sequence
  console.log("\n🔍 Checking user libraries...");

  // This UUID format suggests it might be in a user's sequences subcollection
  // Let's check if it looks like a Firestore document ID
  const usersRef = db.collection("users");
  const usersSnap = await usersRef.limit(50).get();

  for (const userDoc of usersSnap.docs) {
    const seqRef = userDoc.ref.collection("sequences").doc(searchTerm);
    const seqDoc = await seqRef.get();
    if (seqDoc.exists) {
      console.log(`✅ Found in user ${userDoc.id}'s sequences:`);
      console.log(JSON.stringify(seqDoc.data(), null, 2));
      return;
    }
  }

  console.log("❌ Not found in any checked user libraries either");
}

findSequence()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
