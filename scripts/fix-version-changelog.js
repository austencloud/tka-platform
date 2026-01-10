/**
 * Fix the changelog entries for a version in Firestore
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const version = process.argv[2] || "0.7.9";

const changelogEntries = [
  // ========== ADDED ==========
  { category: "added", text: "App now available in multiple languages" },
  { category: "added", text: "Show or hide the grid overlay on beats" },
  { category: "added", text: "Prop trails now label which end you're tracking" },
  { category: "added", text: "Add custom text to exported images" },
  { category: "added", text: "Help section in the Generator" },

  // ========== IMPROVED ==========
  { category: "improved", text: "More background customization options" },
  { category: "improved", text: "Scrollbars match your chosen background" },
  { category: "improved", text: "Sequence previews load faster when browsing" },
];

async function updateVersionChangelog() {
  console.log(`📝 Updating changelog for v${version}...`);

  const versionRef = db.collection("versions").doc(version);
  const doc = await versionRef.get();

  if (!doc.exists) {
    console.log(`❌ Version ${version} not found`);
    process.exit(1);
  }

  await versionRef.update({
    changelogEntries,
    feedbackCount: changelogEntries.length,
    feedbackSummary: {
      features: changelogEntries.filter(e => e.category === "added").length,
      bugs: changelogEntries.filter(e => e.category === "fixed").length,
      general: changelogEntries.filter(e => e.category === "improved").length,
    }
  });

  console.log(`✅ Updated ${changelogEntries.length} changelog entries`);
  console.log(`   - ${changelogEntries.filter(e => e.category === "added").length} added`);
  console.log(`   - ${changelogEntries.filter(e => e.category === "improved").length} improved`);
  console.log(`   - ${changelogEntries.filter(e => e.category === "fixed").length} fixed`);
}

updateVersionChangelog().catch(console.error);
