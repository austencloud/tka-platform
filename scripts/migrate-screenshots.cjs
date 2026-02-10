/**
 * migrate-screenshots.cjs
 *
 * One-time migration script: uploads existing local screenshots
 * (from tests/screenshots/captures/) to Firebase Storage and writes
 * Firestore metadata documents.
 *
 * Usage:
 *   node scripts/migrate-screenshots.cjs
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 *   - Or run `firebase login` for user credentials
 *
 * The script is idempotent: it skips files already uploaded (by checking
 * the Firestore collection for matching filenames).
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ============================================================================
// CONFIG
// ============================================================================

const PROJECT_ID = "the-kinetic-alphabet";
const STORAGE_BUCKET = "the-kinetic-alphabet.firebasestorage.app";
const CAPTURES_DIR = path.resolve(__dirname, "../tests/screenshots/captures");

// The user ID to assign screenshots to (Austen's account)
const TARGET_USER_ID = process.argv[2];

if (!TARGET_USER_ID) {
  console.error("Usage: node scripts/migrate-screenshots.cjs <userId>");
  console.error("  Get your userId from Firebase Console > Authentication");
  process.exit(1);
}

// Device dimensions lookup
const DEVICE_MAP = {
  "iphone-se": { name: "iPhone SE", w: 375, h: 667, category: "phone" },
  "iphone-16-pro": { name: "iPhone 16 Pro", w: 393, h: 852, category: "phone" },
  "iphone-16-pro-max": { name: "iPhone 16 Pro Max", w: 430, h: 932, category: "phone" },
  "galaxy-s24": { name: "Galaxy S24", w: 360, h: 780, category: "phone" },
  "galaxy-s24-ultra": { name: "Galaxy S24 Ultra", w: 412, h: 915, category: "phone" },
  "ipad-mini": { name: "iPad Mini", w: 768, h: 1024, category: "tablet" },
  "ipad-air": { name: "iPad Air", w: 820, h: 1180, category: "tablet" },
  "desktop-hd": { name: "Desktop HD", w: 1366, h: 768, category: "desktop" },
  "desktop-fhd": { name: "Desktop FHD", w: 1920, h: 1080, category: "desktop" },
};

// Parse module from route label
function getModuleFromLabel(label) {
  const dashIdx = label.indexOf("--");
  if (dashIdx > 0) return label.substring(0, dashIdx);
  const publicLabels = ["landing", "about", "privacy", "terms", "roots"];
  if (publicLabels.includes(label)) return "public";
  return label;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      storageBucket: STORAGE_BUCKET,
    });
  }

  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const collectionPath = `users/${TARGET_USER_ID}/screenshots`;

  // Check captures directory exists
  if (!fs.existsSync(CAPTURES_DIR)) {
    console.error(`Captures directory not found: ${CAPTURES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CAPTURES_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Found ${files.length} PNG files in ${CAPTURES_DIR}`);

  if (files.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Load existing Firestore docs to detect already-migrated files
  const existingSnapshot = await db.collection(collectionPath).get();
  const existingFilenames = new Set(
    existingSnapshot.docs.map((doc) => doc.data().filename)
  );
  console.log(`${existingFilenames.size} screenshots already in Firestore`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    if (existingFilenames.has(filename)) {
      skipped++;
      continue;
    }

    try {
      // Parse filename: "routeLabel--deviceSlug.png"
      const base = filename.replace(/\.png$/, "");
      const lastDash = base.lastIndexOf("--");
      const routeLabel = lastDash > 0 ? base.substring(0, lastDash) : base;
      const deviceSlug = lastDash > 0 ? base.substring(lastDash + 2) : "";
      const device = DEVICE_MAP[deviceSlug];
      const module = getModuleFromLabel(routeLabel);

      const localPath = path.join(CAPTURES_DIR, filename);
      const stat = fs.statSync(localPath);
      const storagePath = `screenshots/${TARGET_USER_ID}/${filename}`;

      // Upload to Storage
      const fileBuffer = fs.readFileSync(localPath);
      const file = bucket.file(storagePath);
      await file.save(fileBuffer, {
        metadata: {
          contentType: "image/png",
          metadata: {
            userId: TARGET_USER_ID,
            routeLabel,
            module,
            deviceSlug,
            capturedAt: stat.mtime.toISOString(),
          },
        },
      });

      // Make publicly accessible (signed URL)
      await file.makePublic();
      const downloadUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${storagePath}`;

      // Write Firestore doc
      const docData = {
        filename,
        storagePath,
        downloadUrl,
        routeLabel,
        module,
        deviceSlug,
        deviceCategory: device?.category ?? "desktop",
        deviceName: device?.name ?? deviceSlug,
        width: device?.w ?? 0,
        height: device?.h ?? 0,
        tagIds: [],
        capturedAt: admin.firestore.Timestamp.fromDate(stat.mtime),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection(collectionPath).add(docData);
      uploaded++;

      if (uploaded % 10 === 0) {
        console.log(`  Uploaded ${uploaded}/${files.length - skipped}...`);
      }
    } catch (err) {
      console.error(`  Failed: ${filename} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total local files: ${files.length}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
