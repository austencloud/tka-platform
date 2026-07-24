/**
 * Sync Static Thumbnails
 *
 * Downloads all cloud-cached thumbnails to /static/thumbnails/ for instant loading.
 * This should be run as part of the release process to bundle thumbnails with the app.
 *
 * 3-tier thumbnail loading strategy:
 * 1. Static bundled (instant) - these files
 * 2. Cloud cache (fast) - Firebase Storage fallback
 * 3. Local render (slow) - final fallback
 *
 * Usage: node scripts/sync-static-thumbnails.cjs
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const https = require("https");

const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");
const STATIC_DIR = path.resolve(__dirname, "../static/thumbnails");

function getStorageBucket() {
  let serviceAccount;
  try {
    serviceAccount = require(serviceAccountPath);
  } catch {
    throw new Error(
      "Failed to load service account. Make sure serviceAccountKey.json exists."
    );
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "the-kinetic-alphabet.firebasestorage.app",
    });
  }
  return admin.storage().bucket();
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https
            .get(response.headers.location, (redirectResponse) => {
              redirectResponse.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
            })
            .on("error", reject);
        } else if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      })
      .on("error", reject);
  });
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sanitize filename for Windows (replace illegal characters)
 */
function sanitizeFilename(filename) {
  // Replace characters that are illegal in Windows filenames
  return filename
    .replace(/:/g, "-") // colons (from timestamps)
    .replace(/\?/g, "_") // question marks
    .replace(/</g, "_") // less than
    .replace(/>/g, "_") // greater than
    .replace(/"/g, "_") // quotes
    .replace(/\|/g, "_") // pipe
    .replace(/\*/g, "_"); // asterisk
}

/**
 * Group manifest keys by the cache dimensions that decide whether Browse can
 * serve a requested thumbnail without entering the renderer.
 */
function buildCoverageSummary(manifestKeys) {
  const coverage = {};

  for (const key of [...manifestKeys].sort()) {
    const parts = key.split("/");
    const hasVariant = parts.length >= 3;
    const variant = hasVariant ? parts[0] : "legacy";
    const prop = hasVariant ? parts[1] : parts[0];
    const filename = hasVariant
      ? parts.slice(2).join("/")
      : parts.slice(1).join("/");
    if (!variant || !prop || !filename) continue;

    const suffix = filename.match(/_(qr_)?(dark|light)$/);
    const mode = suffix?.[2] ?? "unknown";
    const qrClass = suffix?.[1] ? "qr" : "noQr";

    coverage[variant] ??= {};
    coverage[variant][prop] ??= {};
    coverage[variant][prop][mode] ??= { noQr: 0, qr: 0, total: 0 };
    coverage[variant][prop][mode][qrClass]++;
    coverage[variant][prop][mode].total++;
  }

  return coverage;
}

async function syncThumbnails() {
  console.log("Syncing cloud thumbnails to static folder...\n");
  const bucket = getStorageBucket();

  // Clean existing static thumbnails
  if (fs.existsSync(STATIC_DIR)) {
    fs.rmSync(STATIC_DIR, { recursive: true });
  }
  ensureDir(STATIC_DIR);

  // List all thumbnails in cloud storage
  const [files] = await bucket.getFiles({ prefix: "thumbnails/" });

  // Filter to only .webp files (exclude manifest.json and directories)
  const thumbnailFiles = files.filter(
    (f) => f.name.endsWith(".webp") && !f.name.endsWith("/")
  );

  console.log(`Found ${thumbnailFiles.length} thumbnails in cloud storage.\n`);

  let downloaded = 0;
  let failed = 0;
  const BATCH_SIZE = 20;

  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < thumbnailFiles.length; i += BATCH_SIZE) {
    const batch = thumbnailFiles.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (file) => {
        try {
          // Get signed URL for download
          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 60000, // 1 minute
          });

          // Convert cloud path to local path
          // Cloud: thumbnails/gallery/club/Butterfly_dark.webp
          // Local: static/thumbnails/gallery/club/Butterfly_dark.webp
          const relativePath = file.name.replace(/^thumbnails\//, "");
          // Sanitize filename for Windows compatibility
          const pathParts = relativePath.split("/");
          const filename = pathParts.pop();
          const sanitizedFilename = sanitizeFilename(filename);
          const sanitizedPath = [...pathParts, sanitizedFilename].join("/");
          const localPath = path.join(STATIC_DIR, sanitizedPath);

          // Ensure parent directory exists
          ensureDir(path.dirname(localPath));

          // Download
          await downloadFile(url, localPath);
          downloaded++;
        } catch (error) {
          console.warn(`Failed to download ${file.name}: ${error.message}`);
          failed++;
        }
      })
    );

    // Progress
    const progress = Math.min(i + BATCH_SIZE, thumbnailFiles.length);
    process.stdout.write(
      `\rDownloaded ${downloaded}/${thumbnailFiles.length} thumbnails...`
    );
  }

  console.log(`\n\nSync complete!`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Location: ${STATIC_DIR}`);

  // Generate static manifest for the app to use
  // Keys must match what ThumbnailRenderOrchestrator.buildStaticKey() produces
  const manifestKeys = [];
  function collectKeys(dir, prefix = "") {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectKeys(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith(".webp")) {
        // Key format: variant/propType/sequenceName_mode (without .webp)
        // These are already sanitized filenames on disk
        const key = prefix
          ? `${prefix}/${entry.name.replace(".webp", "")}`
          : entry.name.replace(".webp", "");
        manifestKeys.push(key);
      }
    }
  }
  collectKeys(STATIC_DIR);

  const manifest = {
    keys: manifestKeys,
    generated: new Date().toISOString(),
    count: manifestKeys.length,
    coverage: buildCoverageSummary(manifestKeys),
  };

  const manifestPath = path.join(STATIC_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nGenerated manifest with ${manifestKeys.length} entries.`);
  console.log("Coverage summary:");
  console.log(JSON.stringify(manifest.coverage, null, 2));

  // Calculate total size
  let totalSize = 0;
  function calculateSize(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        calculateSize(fullPath);
      } else {
        totalSize += fs.statSync(fullPath).size;
      }
    }
  }
  calculateSize(STATIC_DIR);
  console.log(`  Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

if (require.main === module) {
  syncThumbnails()
    .then(() => {
      console.log("\nDone!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error syncing thumbnails:", error);
      process.exit(1);
    });
}

module.exports = {
  buildCoverageSummary,
  sanitizeFilename,
};
