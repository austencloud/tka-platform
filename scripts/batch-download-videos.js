#!/usr/bin/env node
/**
 * Batch download Instagram videos and upload to Firebase Storage.
 * Usage: node scripts/batch-download-videos.js
 *
 * This script processes a list of video metadata (URL, word) and:
 * 1. Downloads from CDN URL
 * 2. Uploads to Firebase Storage
 * 3. Creates CollaborativeVideo record
 */
import admin from "firebase-admin";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const AUSTEN_USER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

// Videos to process - add entries here
const VIDEOS = [
  // Format: { cdnUrl, word, instagramUrl, description }
];

async function downloadVideo(cdnUrl, outputPath) {
  const psScript = `
$url = "${cdnUrl}"
Invoke-WebRequest -Uri $url -OutFile "${outputPath}"
(Get-Item "${outputPath}").Length
`;
  const tempScript = resolve(__dirname, "../temp-download.ps1");
  writeFileSync(tempScript, psScript);

  try {
    const result = execSync(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, {
      encoding: "utf8",
      timeout: 120000,
    });
    unlinkSync(tempScript);
    return parseInt(result.trim(), 10);
  } catch (err) {
    unlinkSync(tempScript);
    throw err;
  }
}

async function uploadVideo(videoPath, sequenceId, description) {
  const videoBuffer = readFileSync(videoPath);
  const timestamp = Date.now();
  const storagePath = `users/${AUSTEN_USER_ID}/recordings/${sequenceId}/${timestamp}.mp4`;

  const file = bucket.file(storagePath);
  await file.save(videoBuffer, {
    metadata: {
      contentType: "video/mp4",
      metadata: {
        sequenceId,
        userId: AUSTEN_USER_ID,
        uploadedAt: new Date().toISOString(),
      },
    },
  });

  await file.makePublic();
  const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  // Create CollaborativeVideo record
  const videoId = `${sequenceId}_${timestamp}`;
  const collaborativeVideo = {
    id: videoId,
    sequenceId,
    sequenceName: sequenceId,
    sequenceOwnerId: AUSTEN_USER_ID,
    creatorId: AUSTEN_USER_ID,
    creatorDisplayName: "Austen Cloud",
    videoUrl,
    storagePath,
    duration: 0,
    fileSize: videoBuffer.length,
    mimeType: "video/mp4",
    visibility: "public",
    collaborators: [],
    collaboratorIds: [],
    pendingInvites: [],
    pendingInviteUserIds: [],
    description: description || `Performance video for ${sequenceId}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("videos").doc(videoId).set(collaborativeVideo);

  return { videoId, videoUrl, storagePath };
}

async function processVideo(video, index) {
  console.log(`\n[${index + 1}/${VIDEOS.length}] Processing: ${video.word}`);
  console.log(`  Instagram: ${video.instagramUrl}`);

  const tempPath = resolve(__dirname, `../temp-video-${index}.mp4`);

  try {
    // Download
    console.log("  Downloading...");
    const fileSize = await downloadVideo(video.cdnUrl, tempPath);
    console.log(`  Downloaded: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Upload
    console.log("  Uploading to Firebase...");
    const result = await uploadVideo(tempPath, video.word, video.description);
    console.log(`  ✅ Uploaded: ${result.videoUrl}`);

    // Cleanup
    unlinkSync(tempPath);

    return { success: true, ...result, word: video.word };
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    try { unlinkSync(tempPath); } catch {}
    return { success: false, word: video.word, error: err.message };
  }
}

async function main() {
  if (VIDEOS.length === 0) {
    console.log("No videos to process. Add videos to the VIDEOS array.");
    return;
  }

  console.log(`Processing ${VIDEOS.length} videos...`);

  const results = [];
  for (let i = 0; i < VIDEOS.length; i++) {
    const result = await processVideo(VIDEOS[i], i);
    results.push(result);
  }

  console.log("\n=== Summary ===");
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  successful.forEach(r => console.log(`   - ${r.word}: ${r.videoUrl}`));

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(r => console.log(`   - ${r.word}: ${r.error}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
