/**
 * Migration: Remove email fields from userReports documents
 *
 * Security fix - reports stored reporterEmail and reportedUserEmail which should not
 * be in a collection that admins can read (email is sensitive PII).
 *
 * Usage:
 *   node scripts/migrate-remove-report-emails.js --dry-run   # Preview changes
 *   node scripts/migrate-remove-report-emails.js --confirm   # Execute migration
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
║  Migration: Remove email fields from userReports                 ║
╠══════════════════════════════════════════════════════════════════╣
║  This removes reporterEmail and reportedUserEmail fields.        ║
║                                                                  ║
║  Options:                                                        ║
║    --dry-run   Preview which documents would be modified         ║
║    --confirm   Execute the migration                             ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

async function migrate() {
  console.log("\n🔍 Scanning userReports collection...\n");

  const reportsRef = db.collection("userReports");
  const snapshot = await reportsRef.get();

  const reportsWithEmail = [];

  // Scan all reports
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasReporterEmail = data.reporterEmail !== undefined;
    const hasReportedEmail = data.reportedUserEmail !== undefined;

    if (hasReporterEmail || hasReportedEmail) {
      reportsWithEmail.push({
        id: doc.id,
        category: data.category || "unknown",
        status: data.status || "unknown",
        reporterEmail: data.reporterEmail,
        reportedUserEmail: data.reportedUserEmail,
        createdAt: data.createdAt?.toDate?.() || "unknown",
      });
    }
  }

  console.log(`📊 Summary:`);
  console.log(`   Total reports: ${snapshot.size}`);
  console.log(`   Reports with email fields: ${reportsWithEmail.length}`);
  console.log("");

  if (reportsWithEmail.length === 0) {
    console.log("✅ No reports have email fields. Nothing to migrate.\n");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("📋 Reports that would be updated:\n");
    for (const report of reportsWithEmail) {
      console.log(`   ${report.id}`);
      console.log(`      Category: ${report.category}`);
      console.log(`      Status: ${report.status}`);
      if (report.reporterEmail) {
        console.log(`      Reporter email to remove: ${maskEmail(report.reporterEmail)}`);
      }
      if (report.reportedUserEmail) {
        console.log(`      Reported user email to remove: ${maskEmail(report.reportedUserEmail)}`);
      }
      console.log("");
    }
    console.log("Run with --confirm to execute the migration.\n");
    process.exit(0);
  }

  // Execute migration
  console.log("🚀 Starting migration...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const report of reportsWithEmail) {
    try {
      const updateData = {};
      if (report.reporterEmail !== undefined) {
        updateData.reporterEmail = admin.firestore.FieldValue.delete();
      }
      if (report.reportedUserEmail !== undefined) {
        updateData.reportedUserEmail = admin.firestore.FieldValue.delete();
      }

      await reportsRef.doc(report.id).update(updateData);
      successCount++;
      console.log(`   ✓ ${report.id} (${report.category})`);
    } catch (error) {
      errorCount++;
      console.error(`   ✗ ${report.id}: ${error.message}`);
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
