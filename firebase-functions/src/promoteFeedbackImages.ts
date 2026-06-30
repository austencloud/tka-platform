/**
 * Promote Feedback Images
 *
 * Fires when a feedback doc is created. Images are pre-uploaded to
 * feedback-staging/{userId}/ the moment the user attaches them, so submit is
 * instant — the client just writes the doc with a `stagedImagePaths` array and
 * returns. This trigger then copies each staged file server-side into the
 * permanent feedback/{userId}/{feedbackId}/ path, mints a download token, writes
 * the resulting URLs to `imageUrls`, and deletes the staged copies.
 *
 * Why server-side copy instead of referencing the staging URL directly: the
 * scheduled cleanupStagedUploads function deletes everything under
 * feedback-staging/ after 30 minutes, so a saved staging URL would 404 once the
 * cleanup runs. Promoting to the permanent path makes the record durable while
 * keeping the staging-cleanup safe and age-based (no Firestore cross-checks).
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { randomUUID } from "crypto";

const STAGING_PREFIX = "feedback-staging/";

function buildDownloadUrl(
  bucketName: string,
  objectPath: string,
  token: string
): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  );
}

export const promoteFeedbackImages = functions.firestore
  .document("feedback/{feedbackId}")
  .onCreate(async (snap, context) => {
    const { feedbackId } = context.params;
    const data = snap.data();

    const stagedPaths = data?.stagedImagePaths;
    const userId = data?.userId;

    if (!Array.isArray(stagedPaths) || stagedPaths.length === 0) {
      return null;
    }

    if (typeof userId !== "string" || userId.length === 0) {
      console.warn(
        `[promoteFeedbackImages] ${feedbackId}: missing userId, skipping`
      );
      // Clear the field so the doc doesn't carry a dangling staging reference
      await snap.ref.update({
        stagedImagePaths: admin.firestore.FieldValue.delete(),
      });
      return null;
    }

    const bucket = admin.storage().bucket();
    // Security: a client can only promote files it uploaded. The feedback create
    // rule forces doc.userId == auth.uid, and staging files are written under
    // that same uid — so this prefix is the user's own staging namespace.
    const ownerPrefix = `${STAGING_PREFIX}${userId}/`;

    const imageUrls: string[] = [];

    for (const raw of stagedPaths) {
      if (typeof raw !== "string") continue;

      if (!raw.startsWith(ownerPrefix)) {
        console.warn(
          `[promoteFeedbackImages] ${feedbackId}: rejecting non-owned staged path ${raw}`
        );
        continue;
      }

      const filename = raw.substring(ownerPrefix.length);
      const destPath = `feedback/${userId}/${feedbackId}/${filename}`;
      const srcFile = bucket.file(raw);
      const destFile = bucket.file(destPath);

      try {
        const [exists] = await srcFile.exists();
        if (!exists) {
          console.warn(
            `[promoteFeedbackImages] ${feedbackId}: staged file gone ${raw}`
          );
          continue;
        }

        // Server-side copy (no bytes traverse the client) preserves contentType.
        await srcFile.copy(destFile);

        // Mint a fresh download token so the permanent URL works regardless of
        // whatever token the staged copy carried.
        const token = randomUUID();
        await destFile.setMetadata({
          metadata: { firebaseStorageDownloadTokens: token },
        });

        imageUrls.push(buildDownloadUrl(bucket.name, destPath, token));

        // Best-effort: the staged copy is now redundant. The scheduled
        // cleanup would catch it anyway, but delete eagerly to keep staging lean.
        await srcFile.delete().catch(() => {
          /* best effort */
        });
      } catch (err) {
        console.error(
          `[promoteFeedbackImages] ${feedbackId}: failed to promote ${raw}`,
          err
        );
      }
    }

    const update: Record<string, unknown> = {
      // Always clear the staging reference — promotion is terminal.
      stagedImagePaths: admin.firestore.FieldValue.delete(),
    };
    if (imageUrls.length > 0) {
      update.imageUrls = imageUrls;
    }

    await snap.ref.update(update);

    console.log(
      `[promoteFeedbackImages] ${feedbackId}: promoted ${imageUrls.length}/${stagedPaths.length} images`
    );

    return null;
  });
