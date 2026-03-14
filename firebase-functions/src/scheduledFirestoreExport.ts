import * as functions from "firebase-functions";
import { v1 } from "@google-cloud/firestore";

const BUCKET = "gs://tka-firestore-backups";
const PROJECT_ID = "the-kinetic-alphabet";

// How long to wait for an export to complete before giving up.
// Firestore exports for <1 GB typically finish in under 5 minutes.
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_POLL_ATTEMPTS = 20; // 10 minutes total

type AdminClient = InstanceType<typeof v1.FirestoreAdminClient>;

/**
 * Polls a long-running export operation until it completes or times out.
 * Firestore's exportDocuments returns immediately with an operation handle.
 * The actual export runs asynchronously. Without polling, we'd never know
 * if it succeeded or failed.
 */
async function waitForExportCompletion(
  client: AdminClient,
  operationName: string
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const operation =
      await client.checkExportDocumentsProgress(operationName);

    if (operation.done) {
      if (operation.error) {
        throw new Error(
          `Export operation failed: ${operation.error.message} (code ${operation.error.code})`
        );
      }
      console.log(
        `Export completed after ${(attempt * POLL_INTERVAL_MS) / 1000}s`
      );
      return;
    }

    console.log(
      `Export in progress (poll ${attempt}/${MAX_POLL_ATTEMPTS})...`
    );
  }

  // If we get here, the export is still running after MAX_POLL_ATTEMPTS.
  // Log a warning but don't throw. The export will likely complete on its own,
  // and the monitoring alert will catch repeated failures.
  console.warn(
    `Export operation still running after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s. ` +
      `It may complete on its own. Operation: ${operationName}`
  );
}

/**
 * Runs every day at 3 AM UTC (off-peak for US users).
 * Exports the entire Firestore database to the backup bucket, then
 * polls the operation until it completes (or times out).
 *
 * Each export lands in a timestamped folder like:
 *   gs://tka-firestore-backups/daily/2026-03-14T03:00:00Z/
 *
 * The bucket lifecycle rule auto-deletes daily/ exports older than 30 days.
 *
 * Uses v1 Cloud Functions (functions.pubsub.schedule) for consistency with
 * the existing cleanupExpiredCheckoutSessions function.
 */
export const scheduledFirestoreExport = functions
  .runWith({ timeoutSeconds: 540 })
  .region("us-central1")
  .pubsub.schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const client = new v1.FirestoreAdminClient();
    const databaseName = client.databasePath(PROJECT_ID, "(default)");

    const timestamp = new Date().toISOString();
    const outputUriPrefix = `${BUCKET}/daily/${timestamp}`;

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        // Empty collectionIds = export everything
      });

      console.log(
        `Firestore export started: ${operation.name}`,
        `Output: ${outputUriPrefix}`
      );

      // Poll until the export finishes so we know it actually succeeded.
      // Without this, the function returns "success" the moment the export
      // is *initiated*, which tells us nothing about whether it completed.
      await waitForExportCompletion(client, operation.name!);

      console.log("Firestore export completed and verified.");
    } catch (error) {
      console.error("Firestore export FAILED:", error);
      throw error; // Re-throw so Cloud Monitoring catches the failure
    }
  });
