#!/usr/bin/env node
/**
 * Batch Upload Instagram Videos to Firebase Storage
 *
 * Uploads all videos from the Instagram download folder to Firebase Storage.
 * Creates metadata records in Firestore for later curation.
 *
 * Storage path: showcase/instagram/{shortcode}.mp4
 * Firestore: showcaseVideos collection
 *
 * Usage: node scripts/batch-upload-instagram-videos.js [--dry-run] [--limit N]
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, basename, parse } from "path";
import { fileURLToPath } from "url";
import { stat } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

// Paths
const INSTAGRAM_FOLDER = resolve(__dirname, "../downloads/instagram/tkaflowarts");
const SERVICE_ACCOUNT_PATH = resolve(__dirname, "../serviceAccountKey.json");

// Initialize Firebase Admin (only if not dry run)
let db, bucket;
if (!dryRun) {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  });
  db = admin.firestore();
  bucket = admin.storage().bucket();
}

// Austen's user ID
const AUSTEN_USER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

/**
 * Parse Instagram filename to extract metadata
 * Format: 2024-10-02_18-20-33__DAoaTPxv70h.mp4
 */
function parseInstagramFilename(filename) {
  const parsed = parse(filename);
  const name = parsed.name;

  // Extract date and shortcode
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})__([A-Za-z0-9_-]+)/);
  if (!match) {
    return { date: null, shortcode: name, originalFilename: filename };
  }

  const [, dateStr, timeStr, shortcode] = match;
  const date = new Date(`${dateStr}T${timeStr.replace(/-/g, ":")}Z`);

  return {
    date,
    shortcode: shortcode.replace(/_\d+$/, ""), // Remove _1, _2 suffix for carousel items
    originalFilename: filename,
  };
}

/**
 * Get all mp4 files from the Instagram folder
 */
function getVideoFiles() {
  const files = readdirSync(INSTAGRAM_FOLDER)
    .filter(f => f.endsWith(".mp4"))
    .sort((a, b) => {
      // Sort by date (newest first)
      const dateA = parseInstagramFilename(a).date;
      const dateB = parseInstagramFilename(b).date;
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });

  return limit ? files.slice(0, limit) : files;
}

/**
 * Upload a single video
 */
async function uploadVideo(filename, index, total) {
  const filePath = resolve(INSTAGRAM_FOLDER, filename);
  const { date, shortcode, originalFilename } = parseInstagramFilename(filename);

  // Get file stats
  const fileStat = await stat(filePath);
  const fileSize = fileStat.size;
  const sizeMB = (fileSize / 1024 / 1024).toFixed(2);

  console.log(`[${index + 1}/${total}] ${filename} (${sizeMB} MB)`);

  if (dryRun) {
    console.log(`  -> Would upload to: showcase/instagram/${shortcode}.mp4`);
    console.log(`  -> Date: ${date ? date.toISOString() : "unknown"}`);
    return { shortcode, skipped: true };
  }

  // Check if already uploaded
  const existingDoc = await db.collection("showcaseVideos").doc(shortcode).get();
  if (existingDoc.exists) {
    console.log(`  -> Already exists, skipping`);
    return { shortcode, skipped: true };
  }

  // Read video file
  const videoBuffer = readFileSync(filePath);

  // Upload to Firebase Storage
  const storagePath = `showcase/instagram/${shortcode}.mp4`;
  const file = bucket.file(storagePath);

  await file.save(videoBuffer, {
    metadata: {
      contentType: "video/mp4",
      // Instagram shortcodes are content-addressed in practice: a new post gets
      // a new path. Let browsers and the CDN keep these immutable showcase
      // clips instead of revalidating the same bytes every hour.
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        shortcode,
        source: "instagram",
        originalFilename,
        uploadedAt: new Date().toISOString(),
        instagramDate: date ? date.toISOString() : null,
      },
    },
  });

  // Make file publicly accessible
  await file.makePublic();
  const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  // Create Firestore record
  const videoDoc = {
    shortcode,
    source: "instagram",
    videoUrl,
    storagePath,
    fileSize,
    originalFilename,
    instagramDate: date ? admin.firestore.Timestamp.fromDate(date) : null,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Curation fields (to be filled later)
    sequenceId: null,
    sequenceWord: null,
    tags: [],
    category: null, // "tutorial", "performance", "showcase", etc.
    featured: false,
    approved: false,
    title: null,
    description: null,
    creatorId: AUSTEN_USER_ID,
  };

  await db.collection("showcaseVideos").doc(shortcode).set(videoDoc);

  console.log(`  -> Uploaded: ${videoUrl}`);

  return { shortcode, videoUrl, skipped: false };
}

/**
 * Main function
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Instagram Video Batch Uploader");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n*** DRY RUN - No files will be uploaded ***\n");
  }

  const files = getVideoFiles();
  console.log(`Found ${files.length} video(s) to process\n`);

  if (files.length === 0) {
    console.log("No videos found in:", INSTAGRAM_FOLDER);
    process.exit(0);
  }

  const results = {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    urls: [],
  };

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadVideo(files[i], i, files.length);
      if (result.skipped) {
        results.skipped++;
      } else {
        results.uploaded++;
        results.urls.push(result.videoUrl);
      }
    } catch (error) {
      console.error(`  -> FAILED: ${error.message}`);
      results.failed++;
    }

    // Small delay to avoid rate limiting
    if (!dryRun && i < files.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Uploaded: ${results.uploaded}`);
  console.log(`  Skipped:  ${results.skipped}`);
  console.log(`  Failed:   ${results.failed}`);
  console.log("=".repeat(60));

  if (!dryRun && results.uploaded > 0) {
    console.log("\nNext steps:");
    console.log("1. Open the Video Curator UI to tag and categorize videos");
    console.log("2. Link videos to sequences");
    console.log("3. Mark featured videos for the landing page");
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
