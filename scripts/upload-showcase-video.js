#!/usr/bin/env node
/**
 * Upload a video to Firebase Storage and create a CollaborativeVideo record.
 * Usage: node scripts/upload-showcase-video.js <videoPath> <sequenceId> [description]
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { stat } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const videoPath = process.argv[2];
const sequenceId = process.argv[3];
const description = process.argv[4] || "";

if (!videoPath || !sequenceId) {
  console.error("Usage: node scripts/upload-showcase-video.js <videoPath> <sequenceId> [description]");
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Austen's user ID (found earlier)
const AUSTEN_USER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

async function uploadShowcaseVideo() {
  console.log(`Uploading video: ${videoPath}`);
  console.log(`Sequence ID: ${sequenceId}`);
  
  // Get file stats
  const fileStat = await stat(videoPath);
  const fileSize = fileStat.size;
  console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Read video file
  const videoBuffer = readFileSync(videoPath);
  
  // Generate storage path
  const timestamp = Date.now();
  const storagePath = `users/${AUSTEN_USER_ID}/recordings/${sequenceId}/${timestamp}.mp4`;
  
  console.log(`Storage path: ${storagePath}`);
  
  // Upload to Firebase Storage
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
  
  // Make file publicly accessible and get URL
  await file.makePublic();
  const [metadata] = await file.getMetadata();
  const videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  
  console.log(`Uploaded! URL: ${videoUrl}`);
  
  // Get sequence data for the name
  const sequenceDoc = await db.doc(`users/${AUSTEN_USER_ID}/sequences/${sequenceId}`).get();
  const sequenceData = sequenceDoc.data();
  const sequenceName = sequenceData?.name || sequenceData?.word || sequenceId;
  
  // Create CollaborativeVideo record
  const videoId = `${sequenceId}_${timestamp}`;
  const collaborativeVideo = {
    id: videoId,
    sequenceId: sequenceId,
    sequenceName: sequenceName,
    sequenceOwnerId: AUSTEN_USER_ID,
    creatorId: AUSTEN_USER_ID,
    creatorDisplayName: "Austen Cloud",
    videoUrl: videoUrl,
    storagePath: storagePath,
    duration: 45, // Approximate - from Instagram metadata
    fileSize: fileSize,
    mimeType: "video/mp4",
    visibility: "public",
    collaborators: [],
    collaboratorIds: [],
    pendingInvites: [],
    pendingInviteUserIds: [],
    description: description || `Performance video for ${sequenceName}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  // Save to videos collection
  await db.collection("videos").doc(videoId).set(collaborativeVideo);
  
  console.log(`\n✅ Created CollaborativeVideo record: ${videoId}`);
  console.log(`Video URL: ${videoUrl}`);
  console.log(`Sequence: ${sequenceName} (${sequenceId})`);
  
  return { videoId, videoUrl, storagePath };
}

uploadShowcaseVideo()
  .then(result => {
    console.log("\nDone!");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
