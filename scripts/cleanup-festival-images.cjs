/**
 * Cleanup Script: Sync festival imageUrl fields with seed data
 *
 * For each festival in Firestore:
 *   - If seed has imageUrl and Firestore differs → update
 *   - If seed has NO imageUrl but Firestore has one → delete the field
 *   - If both match → skip
 *
 * Usage:
 *   node scripts/cleanup-festival-images.cjs              # live run
 *   node scripts/cleanup-festival-images.cjs --dry-run    # report only
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const { join } = require("path");

const SERVICE_ACCOUNT_PATH = join(__dirname, "..", "serviceAccountKey.json");
const DRY_RUN = process.argv.includes("--dry-run");

function initFirebase() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(SERVICE_ACCOUNT_PATH, "utf-8")
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.firestore();
  } catch (err) {
    console.error("Failed to initialize Firebase.");
    console.error(`  Expected service account at: ${SERVICE_ACCOUNT_PATH}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

// Build name → imageUrl|null map from seed data.
// null means the festival exists in seeds but has no imageUrl.
function buildImageMap() {
  const seedPath = join(
    __dirname,
    "..",
    "src/lib/features/festivals/data/festival-seed.ts"
  );
  const content = readFileSync(seedPath, "utf-8");

  const map = new Map();

  const entryRegex = /name:\s*"([^"]+)"/g;
  const imageRegex = /imageUrl:\s*"([^"]+)"/g;

  const names = [];
  const images = [];
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    names.push({ value: match[1], index: match.index });
  }

  while ((match = imageRegex.exec(content)) !== null) {
    images.push({ value: match[1], index: match.index });
  }

  for (let i = 0; i < names.length; i++) {
    const nameEntry = names[i];
    const nextNameIndex = i + 1 < names.length ? names[i + 1].index : Infinity;

    const img = images.find(
      (im) => im.index > nameEntry.index && im.index < nextNameIndex
    );

    // Store the imageUrl if found, otherwise null (meaning "no image in seed")
    map.set(nameEntry.value, img ? img.value : null);
  }

  return map;
}

async function main() {
  const db = initFirebase();
  const imageMap = buildImageMap();

  const withImage = [...imageMap.values()].filter(Boolean).length;
  const withoutImage = imageMap.size - withImage;
  console.log(
    `Seed data: ${imageMap.size} festivals (${withImage} with image, ${withoutImage} without)`
  );
  if (DRY_RUN) console.log("DRY RUN - no writes will be made\n");

  const snapshot = await db.collection("festivals").get();
  console.log(`Firestore: ${snapshot.size} festival documents\n`);

  let updated = 0;
  let removed = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name;

    if (!imageMap.has(name)) {
      noMatch++;
      continue;
    }

    const seedImage = imageMap.get(name);
    const firestoreImage = data.imageUrl || null;

    // Both match (including both being null/undefined)
    if (seedImage === firestoreImage) {
      skipped++;
      continue;
    }

    if (seedImage === null && firestoreImage) {
      // Seed has no image, but Firestore does - remove it
      if (DRY_RUN) {
        console.log(`  REMOVE imageUrl: ${name}`);
        console.log(`    was: ${firestoreImage.substring(0, 80)}...`);
      } else {
        await doc.ref.update({
          imageUrl: admin.firestore.FieldValue.delete(),
        });
        console.log(`  Removed imageUrl: ${name}`);
      }
      removed++;
    } else if (seedImage && seedImage !== firestoreImage) {
      // Seed has a different image than Firestore - update it
      if (DRY_RUN) {
        console.log(`  UPDATE imageUrl: ${name}`);
        console.log(`    from: ${(firestoreImage || "(none)").substring(0, 80)}`);
        console.log(`    to:   ${seedImage.substring(0, 80)}`);
      } else {
        await doc.ref.update({ imageUrl: seedImage });
        console.log(`  Updated imageUrl: ${name}`);
      }
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Removed: ${removed}`);
  console.log(`  Already correct: ${skipped}`);
  console.log(`  Not in seed data: ${noMatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
