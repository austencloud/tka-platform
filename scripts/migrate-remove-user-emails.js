/**
 * Migration: Remove email field from user documents
 *
 * Security fix - user documents are publicly readable, so email should not be stored there.
 * This script removes the email field from all existing user documents.
 *
 * Usage:
 *   node scripts/migrate-remove-user-emails.js --dry-run   # Preview changes
 *   node scripts/migrate-remove-user-emails.js --confirm   # Execute migration
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

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirm = args.includes("--confirm");

if (!isDryRun && !isConfirm) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Migration: Remove email field from user documents               ║
╠══════════════════════════════════════════════════════════════════╣
║  This is a DESTRUCTIVE operation. Email data will be removed.    ║
║                                                                  ║
║  Options:                                                        ║
║    --dry-run   Preview which documents would be modified         ║
║    --confirm   Execute the migration                             ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

async function migrate() {
  console.log("\n🔍 Scanning users collection...\n");

  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();

  const usersWithEmail = [];
  const usersWithoutEmail = [];

  // Scan all users
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.email !== undefined) {
      usersWithEmail.push({
        id: doc.id,
        displayName: data.displayName || data.username || "Unknown",
        email: data.email,
      });
    } else {
      usersWithoutEmail.push(doc.id);
    }
  }

  console.log(`📊 Summary:`);
  console.log(`   Total users: ${snapshot.size}`);
  console.log(`   Users with email field: ${usersWithEmail.length}`);
  console.log(`   Users without email field: ${usersWithoutEmail.length}`);
  console.log("");

  if (usersWithEmail.length === 0) {
    console.log("✅ No users have email field. Nothing to migrate.\n");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("📋 Users that would be updated:\n");
    for (const user of usersWithEmail) {
      console.log(`   ${user.id}`);
      console.log(`      Name: ${user.displayName}`);
      console.log(`      Email to remove: ${maskEmail(user.email)}`);
      console.log("");
    }
    console.log("Run with --confirm to execute the migration.\n");
    process.exit(0);
  }

  // Execute migration
  console.log("🚀 Starting migration...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const user of usersWithEmail) {
    try {
      await usersRef.doc(user.id).update({
        email: admin.firestore.FieldValue.delete(),
      });
      successCount++;
      console.log(`   ✓ ${user.displayName} (${user.id})`);
    } catch (error) {
      errorCount++;
      console.error(`   ✗ ${user.id}: ${error.message}`);
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log(`\n✅ Migration complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log("");

  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Mask email for privacy in logs
 * user@example.com -> u***@e***.com
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "(invalid)";
  const [local, domain] = email.split("@");
  if (!domain) return "(invalid format)";
  const [domainName, tld] = domain.split(".");
  return `${local[0]}***@${domainName[0]}***.${tld}`;
}

migrate().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
