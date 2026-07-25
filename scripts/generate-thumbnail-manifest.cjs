/**
 * Generate Thumbnail Manifest
 *
 * Lists all thumbnails in Firebase Storage and generates a manifest.json file.
 * This manifest enables instant cloud cache hits across all devices by pre-populating
 * the "known exists" list on app load.
 *
 * Usage: node scripts/generate-thumbnail-manifest.cjs
 *        node scripts/generate-thumbnail-manifest.cjs --dry-run
 *
 * Requires Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
 */

const admin = require("firebase-admin");
const path = require("path");

const dryRun = process.argv.includes("--dry-run");

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  });
} catch (error) {
  console.error(
    "Failed to load service account. Make sure serviceAccountKey.json exists in the project root."
  );
  console.error(
    "You can download it from Firebase Console > Project Settings > Service Accounts"
  );
  process.exit(1);
}

const bucket = admin.storage().bucket();

/**
 * Convert a storage path to a cache key
 * Path format: thumbnails/{variant}/{propType}/{sequenceName}_{mode}.webp
 * Key format: {variant}/{propType}/{sequenceName}_{mode}
 */
function pathToCacheKey(filePath) {
  // Remove "thumbnails/" prefix and ".webp" suffix
  const withoutPrefix = filePath.replace(/^thumbnails\//, "");
  const withoutSuffix = withoutPrefix.replace(/\.webp$/, "");
  return withoutSuffix;
}

async function generateManifest() {
  console.log("Scanning Firebase Storage for thumbnails...");

  const cacheKeys = [];
  let fileCount = 0;

  // List all files in the thumbnails folder
  const [files] = await bucket.getFiles({ prefix: "thumbnails/" });

  for (const file of files) {
    // Skip directories (they end with /)
    if (file.name.endsWith("/")) continue;

    // Skip manifest itself
    if (file.name === "thumbnails/manifest.json") continue;

    // Only include .webp files
    if (!file.name.endsWith(".webp")) continue;

    const cacheKey = pathToCacheKey(file.name);
    cacheKeys.push(cacheKey);
    fileCount++;

    // Progress indicator every 100 files
    if (fileCount % 100 === 0) {
      console.log(`  Processed ${fileCount} thumbnails...`);
    }
  }

  console.log(`Found ${cacheKeys.length} thumbnails.`);

  // Generate manifest
  const manifest = {
    keys: cacheKeys,
    generated: new Date().toISOString(),
    version: 1,
  };

  // Upload manifest to Firebase Storage with public access
  const manifestPath = "thumbnails/manifest.json";
  if (dryRun) {
    console.log(
      `\nDry run: would replace gs://the-kinetic-alphabet.firebasestorage.app/${manifestPath}`
    );
    console.log(
      `Manifest would contain ${cacheKeys.length} live thumbnail keys.`
    );
    return;
  }

  const manifestFile = bucket.file(manifestPath);

  await manifestFile.save(JSON.stringify(manifest), {
    contentType: "application/json",
    metadata: {
      cacheControl: "public, max-age=300", // 5 minute cache for CDN
    },
    public: true, // Make publicly readable
  });

  // Ensure the file is publicly accessible
  await manifestFile.makePublic();

  console.log(
    `\nManifest uploaded to gs://the-kinetic-alphabet.firebasestorage.app/${manifestPath}`
  );
  console.log(`Total thumbnails indexed: ${cacheKeys.length}`);
}

generateManifest()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error generating manifest:", error);
    process.exit(1);
  });
