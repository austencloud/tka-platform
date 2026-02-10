/**
 * Backfill real creation dates from source library docs into publicSequences.
 *
 * For each public sequence with a sourceRef:
 * - Reads the source library document
 * - Copies `birthday` (original creation date) into the public index
 * - Updates `publishedAt` to the source's `birthday` so grouping shows the real date
 *
 * Usage:
 *   node scripts/backfill-dates.cjs --dry-run   (preview, no writes)
 *   node scripts/backfill-dates.cjs --confirm    (actually write)
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");

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

const dryRun = !process.argv.includes("--confirm");

async function backfill() {
  if (dryRun) {
    console.log("=== DRY RUN (pass --confirm to write) ===\n");
  } else {
    console.log("=== LIVE RUN - Writing to Firestore ===\n");
  }

  const publicSnapshot = await db.collection("publicSequences").get();

  let total = 0;
  let updated = 0;
  let noSourceRef = 0;
  let sourceNotFound = 0;
  let noBirthday = 0;
  let errors = 0;

  for (const publicDoc of publicSnapshot.docs) {
    total++;
    const data = publicDoc.data();
    const word = data.word || data.name || publicDoc.id;

    if (!data.sourceRef) {
      noSourceRef++;
      continue;
    }

    try {
      const sourceSnap = await db.doc(data.sourceRef).get();
      if (!sourceSnap.exists) {
        sourceNotFound++;
        console.log(`  MISSING SOURCE: ${word} -> ${data.sourceRef}`);
        continue;
      }

      const sourceData = sourceSnap.data();
      const birthday = sourceData.birthday || sourceData.createdAt;

      if (!birthday) {
        noBirthday++;
        console.log(`  NO DATE: ${word}`);
        continue;
      }

      const dateStr = birthday.toDate ? birthday.toDate().toISOString() : birthday;

      if (dryRun) {
        if (updated < 10) {
          console.log(`  Would update: ${word} -> birthday: ${dateStr}`);
        }
      } else {
        await db.collection("publicSequences").doc(publicDoc.id).update({
          birthday: birthday,
          publishedAt: birthday,
        });
        if (updated < 10 || updated % 50 === 0) {
          console.log(`  Updated: ${word} -> ${dateStr}`);
        }
      }
      updated++;
    } catch (err) {
      errors++;
      console.log(`  ERROR: ${word} - ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total public sequences: ${total}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`No sourceRef: ${noSourceRef}`);
  console.log(`Source not found: ${sourceNotFound}`);
  console.log(`No birthday/createdAt: ${noBirthday}`);
  console.log(`Errors: ${errors}`);

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
