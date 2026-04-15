import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { v1 } from "@google-cloud/firestore";

const PROJECT_ID = "the-kinetic-alphabet";
const LOCATION = "us-central1";
const MAX_BACKUP_AGE_HOURS = 48;

const backupHealthcheckUrl = defineSecret("BACKUP_HEALTHCHECK_URL");

type AdminClient = InstanceType<typeof v1.FirestoreAdminClient>;

/**
 * Lists all Firestore backups in the project/location and returns the
 * newest one by snapshotTime. Throws if none exist — that's itself a
 * failure condition because Managed Backup schedules should always
 * produce at least one backup after 24 hours.
 */
async function findNewestBackup(client: AdminClient) {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
  const [response] = await client.listBackups({ parent });
  const backups = response.backups;

  if (!backups || backups.length === 0) {
    throw new Error(
      "No Firestore backups exist. Managed backup schedule may not be configured."
    );
  }

  return backups.reduce((a, b) => {
    const aTime = Number(a.snapshotTime?.seconds ?? 0);
    const bTime = Number(b.snapshotTime?.seconds ?? 0);
    return aTime > bTime ? a : b;
  });
}

/**
 * Runs every Monday at 09:00 UTC. Verifies that Firestore Managed Backups
 * are still being produced on schedule. If the newest backup is older than
 * MAX_BACKUP_AGE_HOURS, this throws — which Cloud Monitoring catches and
 * turns into an email alert.
 *
 * On success it pings Healthchecks.io. If Healthchecks.io stops receiving
 * pings (because this function stopped running for any reason — scheduler
 * paused, function deleted, billing disabled, Cloud Monitoring broken),
 * it emails independently. Two alerting paths cover different silent-
 * failure modes.
 */
export const backupHealthCheck = functions
  .runWith({
    timeoutSeconds: 120,
    secrets: [backupHealthcheckUrl],
  })
  .region("us-central1")
  .pubsub.schedule("every monday 09:00")
  .timeZone("UTC")
  .onRun(async () => {
    const client = new v1.FirestoreAdminClient();

    const newest = await findNewestBackup(client);
    const newestSeconds = Number(newest.snapshotTime?.seconds ?? 0);
    const ageHours = (Date.now() / 1000 - newestSeconds) / 3600;

    if (ageHours > MAX_BACKUP_AGE_HOURS) {
      throw new Error(
        `Newest Firestore backup is ${ageHours.toFixed(1)}h old ` +
          `(max ${MAX_BACKUP_AGE_HOURS}h). Backup: ${newest.name}`
      );
    }

    console.log(
      `Backup health OK. Newest: ${newest.name}, age: ${ageHours.toFixed(1)}h`
    );

    const url = backupHealthcheckUrl.value();
    if (url) {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        throw new Error(
          `Healthchecks.io ping failed: ${response.status} ${response.statusText}`
        );
      }
      console.log("Healthchecks.io pinged successfully.");
    } else {
      console.warn(
        "BACKUP_HEALTHCHECK_URL secret not set. Dead man's switch disabled."
      );
    }
  });
