#!/usr/bin/env node
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const searchWord = process.argv[2] || "X-BΦ-θ-";

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function findSequenceByWord() {
  console.log(`Searching for word: "${searchWord}"\n`);

  // Check public sequences first
  console.log("Checking publicSequences...");
  const publicResults = await db.collection("publicSequences")
    .where("word", "==", searchWord)
    .get();

  if (!publicResults.empty) {
    console.log(`Found ${publicResults.size} in publicSequences:`);
    publicResults.forEach(doc => {
      const data = doc.data();
      console.log(`  ID: ${doc.id}`);
      console.log(`  Word: ${data.word}`);
      console.log(`  Name: ${data.name || "(no name)"}`);
    });
    return;
  }

  // Check Austen's sequences specifically
  console.log("Checking Austen's sequences...");
  // Find Austen's user ID first
  const usersRef = await db.collection("users")
    .where("email", "==", "austencloud@gmail.com")
    .limit(1)
    .get();
  
  if (usersRef.empty) {
    console.log("User not found by email, trying username...");
    // Try by username
    const byUsername = await db.collection("users")
      .where("username", "==", "austen")
      .limit(1)
      .get();
    
    if (byUsername.empty) {
      console.log("User not found");
      return;
    }
    
    const userId = byUsername.docs[0].id;
    console.log(`Found user: ${userId}`);
    await searchUserSequences(userId);
  } else {
    const userId = usersRef.docs[0].id;
    console.log(`Found user: ${userId}`);
    await searchUserSequences(userId);
  }
}

async function searchUserSequences(userId) {
  const userSeqs = await db.collection(`users/${userId}/sequences`)
    .where("word", "==", searchWord)
    .get();

  if (!userSeqs.empty) {
    console.log(`Found ${userSeqs.size} sequence(s):`);
    userSeqs.forEach(doc => {
      const data = doc.data();
      console.log(`  ID: ${doc.id}`);
      console.log(`  Word: ${data.word}`);
      console.log(`  Name: ${data.name || "(no name)"}`);
    });
  } else {
    console.log("No sequences found with exact word match");
    console.log("Searching for partial matches...");
    
    // Get all sequences and search manually
    const allSeqs = await db.collection(`users/${userId}/sequences`).get();
    let found = false;
    allSeqs.forEach(doc => {
      const data = doc.data();
      if (data.word && data.word.includes("X-B") && data.word.includes("Φ")) {
        found = true;
        console.log(`  Found similar: ID=${doc.id}, Word="${data.word}"`);
      }
    });
    if (!found) {
      console.log("No partial matches found either");
    }
  }
}

findSequenceByWord()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
