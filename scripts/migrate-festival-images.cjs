/**
 * Migration Script: Add imageUrl to existing festival documents
 *
 * Matches festivals by name to seed data and updates their imageUrl field.
 *
 * Usage:
 *   node scripts/migrate-festival-images.cjs              # live run
 *   node scripts/migrate-festival-images.cjs --dry-run    # report only
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

// Build name → imageUrl map from seed data
function buildImageMap() {
  // Read the seed file and extract the image URLs via regex
  // (Can't import .ts directly in CJS)
  const seedPath = join(
    __dirname,
    "..",
    "src/lib/features/festivals/data/festival-seed.ts"
  );
  const content = readFileSync(seedPath, "utf-8");

  const map = new Map();

  // Match each festival entry: find name and imageUrl pairs
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

  // For each name, find the imageUrl that appears after it (before the next name)
  for (let i = 0; i < names.length; i++) {
    const nameEntry = names[i];
    const nextNameIndex = i + 1 < names.length ? names[i + 1].index : Infinity;

    const img = images.find(
      (im) => im.index > nameEntry.index && im.index < nextNameIndex
    );
    if (img) {
      map.set(nameEntry.value, img.value);
    }
  }

  return map;
}

async function main() {
  const db = initFirebase();
  const imageMap = buildImageMap();

  console.log(`Found ${imageMap.size} festivals with images in seed data`);
  if (DRY_RUN) console.log("DRY RUN — no writes will be made\n");

  const snapshot = await db.collection("festivals").get();
  console.log(`Found ${snapshot.size} festival documents in Firestore\n`);

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name;

    if (data.imageUrl) {
      skipped++;
      continue;
    }

    const imageUrl = imageMap.get(name);
    if (!imageUrl) {
      noMatch++;
      console.log(`  No image found for: ${name}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  Would update: ${name}`);
      console.log(`    imageUrl: ${imageUrl.substring(0, 80)}...`);
    } else {
      await doc.ref.update({ imageUrl });
      console.log(`  Updated: ${name}`);
    }
    updated++;
  }

  console.log(`\nDone.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had image: ${skipped}`);
  console.log(`  No match in seed data: ${noMatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
