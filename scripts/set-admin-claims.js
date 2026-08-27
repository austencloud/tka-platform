/**
 * Set admin custom claims for a user
 * Usage: node scripts/set-admin-claims.js <email>
 * Example: node scripts/set-admin-claims.js austen@example.com
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

const auth = admin.auth();
const db = admin.firestore();

async function setAdminClaims(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}`);

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);
    console.log(`✅ Found user: ${userRecord.uid}`);

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: true,
      role: "admin",
    });
    console.log("✅ Custom claims set successfully");

    // Update Firestore user document
    const userDocRef = db.collection("users").doc(userRecord.uid);
    await userDocRef.set(
      {
        isAdmin: true,
        role: "admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("✅ Firestore document updated");

    console.log("\n✨ User is now an admin!");
    console.log(
      "⚠️  User must sign out and sign back in for claims to take effect\n"
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.log("\n❌ Error: Email required");
  console.log("Usage: node scripts/set-admin-claims.js <email>");
  console.log("Example: node scripts/set-admin-claims.js austen@example.com\n");
  process.exit(1);
}

setAdminClaims(email);
