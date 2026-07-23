/**
 * Cleanup Staged Uploads
 *
 * Runs every 30 minutes and removes abandoned temporary uploads.
 *
 * This is a safety net — the client cleans up on image removal,
 * but if the user closes the browser mid-upload or never submits,
 * orphaned files would accumulate without this.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const STAGING_PREFIXES = ["feedback-staging/", "message-image-staging/"];
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export const cleanupStagedUploads = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    const bucket = admin.storage().bucket();
    const cutoff = Date.now() - MAX_AGE_MS;

    const fileGroups = await Promise.all(
      STAGING_PREFIXES.map(async (prefix) => {
        const [files] = await bucket.getFiles({ prefix });
        return files;
      })
    );
    const files = fileGroups.flat();

    let deletedCount = 0;
    for (const file of files) {
      const timeCreated = file.metadata?.timeCreated;
      if (!timeCreated) continue;
      const created = new Date(timeCreated).getTime();

      if (created < cutoff) {
        await file.delete();
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[cleanupStagedUploads] Deleted ${deletedCount} orphaned staged uploads`
      );
    }

    return null;
  });
