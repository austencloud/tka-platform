# Firestore Backup & Disaster Recovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three layers of data protection: PITR for 7-day rollback, automated daily exports to GCS, and manual backup/restore scripts with monitoring.

**Architecture:** Cloud Function (v1) triggered by Cloud Scheduler exports Firestore daily to a GCS bucket. Manual scripts provide on-demand backup and restore. Cloud Monitoring alerts on failures.

**Tech Stack:** Firebase Cloud Functions v1, @google-cloud/firestore, GCS, Cloud Scheduler, Cloud Monitoring

**Spec:** `docs/superpowers/specs/2026-03-14-firestore-backup-disaster-recovery-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `firebase-functions/src/scheduledFirestoreExport.ts` | Create | Cloud Function: daily Firestore export to GCS with polling |
| `firebase-functions/src/index.ts` | Modify | Add export for scheduledFirestoreExport |
| `scripts/firestore-backup.cjs` | Create | Manual on-demand Firestore export script |
| `scripts/firestore-restore.cjs` | Create | Manual Firestore restore with confirmation gate |

---

## Task 1: Enable PITR

No code changes. CLI only.

- [ ] **Step 1: Enable PITR on the default database**

```bash
gcloud firestore databases update \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --enable-pitr
```

- [ ] **Step 2: Verify PITR is enabled**

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=the-kinetic-alphabet
```

Expected output should include:
```
pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
earliestVersionTime: <timestamp>
```

---

## Task 2: Create GCS Bucket with Lifecycle Rules

No code changes. CLI only.

- [ ] **Step 1: Create the export bucket**

```bash
gcloud storage buckets create gs://tka-firestore-backups \
  --project=the-kinetic-alphabet \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention=enforced
```

- [ ] **Step 2: Apply prefix-based lifecycle rules**

Daily exports auto-delete after 30 days. Manual exports auto-delete after 90 days.

```bash
gcloud storage buckets update gs://tka-firestore-backups \
  --lifecycle-file=- <<'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "age": 30,
        "matchesPrefix": ["daily/"]
      }
    },
    {
      "action": {"type": "Delete"},
      "condition": {
        "age": 90,
        "matchesPrefix": ["manual/"]
      }
    }
  ]
}
EOF
```

- [ ] **Step 3: Grant IAM roles to the Cloud Functions service account**

```bash
# Grant Firestore export permission
gcloud projects add-iam-policy-binding the-kinetic-alphabet \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# Grant Storage Admin on the backup bucket
gcloud storage buckets add-iam-policy-binding gs://tka-firestore-backups \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

- [ ] **Step 4: Verify bucket exists and lifecycle rules are applied**

```bash
gcloud storage ls --project=the-kinetic-alphabet | grep tka-firestore-backups
gcloud storage buckets describe gs://tka-firestore-backups --format="json(lifecycle)"
```

---

## Task 3: Create Cloud Function

**Files:**
- Create: `firebase-functions/src/scheduledFirestoreExport.ts`
- Modify: `firebase-functions/src/index.ts`

- [ ] **Step 1: Create the Cloud Function**

```typescript
// firebase-functions/src/scheduledFirestoreExport.ts
import * as functions from "firebase-functions";
import { v1 } from "@google-cloud/firestore";

const BUCKET = "gs://tka-firestore-backups";
const PROJECT_ID = "the-kinetic-alphabet";

// How long to wait for an export to complete before giving up.
// Firestore exports for <1 GB typically finish in under 5 minutes.
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_POLL_ATTEMPTS = 20; // 10 minutes total

/**
 * Polls a long-running export operation until it completes or times out.
 * Firestore's exportDocuments returns immediately with an operation handle.
 * The actual export runs asynchronously. Without polling, we'd never know
 * if it succeeded or failed.
 */
async function waitForExportCompletion(
  client: v1.FirestoreAdminClient,
  operationName: string
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const [operation] = await client.checkExportDocumentsProgress(operationName);

    if (operation.done) {
      if (operation.error) {
        throw new Error(
          `Export operation failed: ${operation.error.message} (code ${operation.error.code})`
        );
      }
      console.log(`Export completed after ${attempt * POLL_INTERVAL_MS / 1000}s`);
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
 * Checks whether any Firestore export is already in progress. Prevents
 * overlapping exports which waste resources and can produce corrupt output
 * if two exports write to similar prefixes.
 */
async function hasInProgressExport(
  client: v1.FirestoreAdminClient,
  databaseName: string
): Promise<boolean> {
  const [operations] = await client.listOperations({
    name: databaseName,
    filter: 'metadata.@type="type.googleapis.com/google.firestore.admin.v1.ExportDocumentsMetadata"',
  });

  return operations.some((op) => !op.done);
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

    // Guard against overlapping exports
    if (await hasInProgressExport(client, databaseName)) {
      console.warn("Another export is already in progress. Skipping.");
      return;
    }

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
```

- [ ] **Step 2: Add export to index.ts**

Add this line to `firebase-functions/src/index.ts` after the existing exports:

```typescript
// Export scheduled Firestore backup function
export { scheduledFirestoreExport } from "./scheduledFirestoreExport";
```

- [ ] **Step 3: Build and verify compilation**

```bash
cd firebase-functions && npm run build
```

Expected: Build succeeds with no errors. No new dependencies needed since `@google-cloud/firestore` is already a transitive dependency of `firebase-admin`.

---

## Task 4: Create Manual Backup Script

**Files:**
- Create: `scripts/firestore-backup.cjs`

- [ ] **Step 1: Create the backup script**

```javascript
// scripts/firestore-backup.cjs
/**
 * Trigger an immediate Firestore export to the backup bucket.
 *
 * Usage:
 *   node scripts/firestore-backup.cjs
 *   node scripts/firestore-backup.cjs --collections users,sequences
 *
 * Requires: gcloud CLI authenticated with the project.
 */

const { execSync } = require("child_process");

const PROJECT_ID = "the-kinetic-alphabet";
const BUCKET = "gs://tka-firestore-backups";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputUri = `${BUCKET}/manual/${timestamp}`;

// Parse optional --collections flag
const collectionsArg = process.argv.find((a) => a.startsWith("--collections="));
const collections = collectionsArg
  ? collectionsArg.split("=")[1]
  : "";

const collectionsFlag = collections
  ? `--collection-ids=${collections}`
  : "";

// Check for in-progress exports before starting a new one.
// Overlapping exports waste resources and can produce garbled output.
try {
  const opsOutput = execSync(
    `gcloud firestore operations list --project=${PROJECT_ID} --database="(default)" --format=json`,
    { encoding: "utf-8" }
  );
  const ops = JSON.parse(opsOutput || "[]");
  const inProgress = ops.filter(
    (op) => !op.done && op.metadata && op.metadata["@type"].includes("ExportDocuments")
  );
  if (inProgress.length > 0) {
    console.error("Another export is already in progress:");
    inProgress.forEach((op) => console.error(`  ${op.name}`));
    console.error("\nWait for it to finish or cancel it with:");
    console.error(`  gcloud firestore operations cancel <operation-name> --project=${PROJECT_ID}`);
    process.exit(1);
  }
} catch (error) {
  // If we can't check operations, warn but continue. The export API
  // itself will reject if there's a conflict.
  console.warn("Could not check for in-progress exports. Proceeding anyway.");
}

const command = [
  "gcloud firestore export",
  `"${outputUri}"`,
  `--project=${PROJECT_ID}`,
  `--database="(default)"`,
  collectionsFlag,
].filter(Boolean).join(" ");

console.log(`Starting Firestore export...`);
console.log(`Destination: ${outputUri}`);
if (collections) {
  console.log(`Collections: ${collections}`);
} else {
  console.log(`Collections: ALL`);
}
console.log();

try {
  const output = execSync(command, { encoding: "utf-8", stdio: "inherit" });
  console.log();
  console.log("Export started. Monitor progress:");
  console.log(`  gcloud firestore operations list --project=${PROJECT_ID}`);
} catch (error) {
  console.error("Export failed. Make sure gcloud is authenticated:");
  console.error(`  gcloud auth login`);
  console.error(`  gcloud config set project ${PROJECT_ID}`);
  process.exit(1);
}
```

---

## Task 5: Create Manual Restore Script

**Files:**
- Create: `scripts/firestore-restore.cjs`

- [ ] **Step 1: Create the restore script**

```javascript
// scripts/firestore-restore.cjs
/**
 * Restore Firestore from a previous export.
 *
 * Usage:
 *   node scripts/firestore-restore.cjs                  # List available backups
 *   node scripts/firestore-restore.cjs --backup=<uri>   # Restore from specific backup
 *   node scripts/firestore-restore.cjs --backup=<uri> --force  # Skip confirmation (scripted use)
 *
 * WARNING: Importing data overwrites existing documents with the same IDs.
 * It does NOT delete documents that aren't in the backup.
 *
 * Requires: gcloud CLI authenticated with the project.
 */

const { execSync } = require("child_process");
const readline = require("readline");

const PROJECT_ID = "the-kinetic-alphabet";
const BUCKET = "tka-firestore-backups";

function listBackups() {
  console.log("Available backups in gs://tka-firestore-backups/:\n");

  try {
    // List top-level "folders" in the bucket (each is one export)
    const output = execSync(
      `gcloud storage ls gs://${BUCKET}/ --project=${PROJECT_ID}`,
      { encoding: "utf-8" }
    );

    const folders = output.trim().split("\n").filter(Boolean);

    if (folders.length === 0) {
      console.log("No backups found.");
      return;
    }

    folders.forEach((folder, i) => {
      // Extract timestamp from folder name
      const name = folder.replace(`gs://${BUCKET}/`, "").replace(/\/$/, "");
      console.log(`  [${i + 1}] ${name}`);
    });

    console.log();
    console.log("To restore, run:");
    console.log(
      '  node scripts/firestore-restore.cjs --backup="gs://tka-firestore-backups/<folder>"'
    );
    console.log();
    console.log(
      "WARNING: Import overwrites documents with matching IDs. " +
      "It does not delete documents absent from the backup."
    );
  } catch (error) {
    console.error("Failed to list backups. Check gcloud auth.");
    process.exit(1);
  }
}

/**
 * Prompts the user to type "RESTORE" to confirm. Returns a promise that
 * resolves to true if confirmed, false otherwise. This is a hard gate,
 * not a "press Ctrl+C" suggestion. This project has a history of
 * accidental data loss, so an explicit confirmation is non-negotiable.
 */
function confirmRestore(backupUri) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log();
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║  WARNING: This will overwrite documents in production   ║");
    console.log("║  Firestore that have matching IDs in the backup.        ║");
    console.log("║                                                         ║");
    console.log("║  This is NOT reversible without another backup.         ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log();
    console.log(`  Source: ${backupUri}`);
    console.log(`  Target: projects/${PROJECT_ID}/databases/(default)`);
    console.log();

    rl.question('Type RESTORE to proceed (anything else cancels): ', (answer) => {
      rl.close();
      if (answer.trim() === "RESTORE") {
        resolve(true);
      } else {
        console.log("Cancelled.");
        resolve(false);
      }
    });
  });
}

async function restoreFromBackup(backupUri, skipConfirmation) {
  // Validate the URI looks right
  if (!backupUri.startsWith("gs://tka-firestore-backups/")) {
    console.error("Backup URI must start with gs://tka-firestore-backups/");
    process.exit(1);
  }

  console.log(`Restoring from: ${backupUri}`);

  if (!skipConfirmation) {
    const confirmed = await confirmRestore(backupUri);
    if (!confirmed) {
      process.exit(0);
    }
  } else {
    console.log("(--force flag set, skipping confirmation)");
  }

  // Parse optional --collections flag
  const collectionsArg = process.argv.find((a) =>
    a.startsWith("--collections=")
  );
  const collections = collectionsArg ? collectionsArg.split("=")[1] : "";
  const collectionsFlag = collections
    ? `--collection-ids=${collections}`
    : "";

  const command = [
    "gcloud firestore import",
    `"${backupUri}"`,
    `--project=${PROJECT_ID}`,
    `--database="(default)"`,
    collectionsFlag,
  ].filter(Boolean).join(" ");

  try {
    execSync(command, { encoding: "utf-8", stdio: "inherit" });
    console.log();
    console.log("Import started. Monitor progress:");
    console.log(`  gcloud firestore operations list --project=${PROJECT_ID}`);
  } catch (error) {
    console.error("Import failed.");
    process.exit(1);
  }
}

// Main
const backupArg = process.argv.find((a) => a.startsWith("--backup="));
const forceFlag = process.argv.includes("--force");

if (backupArg) {
  const backupUri = backupArg.split("=").slice(1).join("=").replace(/"/g, "");
  restoreFromBackup(backupUri, forceFlag);
} else {
  listBackups();
}
```

---

## Task 6: Commit All Code Changes

- [ ] **Step 1: Stage the new and modified files**

```bash
git add firebase-functions/src/scheduledFirestoreExport.ts
git add firebase-functions/src/index.ts
git add scripts/firestore-backup.cjs
git add scripts/firestore-restore.cjs
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(backup): add automated Firestore export function and manual backup/restore scripts

Adds scheduledFirestoreExport Cloud Function (v1) that runs daily at 3 AM UTC,
exports entire Firestore to gs://tka-firestore-backups/daily/ with 30-day retention.
Includes polling for export completion and concurrent export protection.

Manual scripts: firestore-backup.cjs for on-demand exports to manual/ prefix (90-day
retention), firestore-restore.cjs with RESTORE confirmation gate for safety.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Deploy and Verify

- [ ] **Step 1: Deploy the Cloud Function**

```bash
cd firebase-functions && npm run build && firebase deploy --only functions:scheduledFirestoreExport --project=the-kinetic-alphabet
```

- [ ] **Step 2: Verify Cloud Scheduler job was created**

```bash
gcloud scheduler jobs list --project=the-kinetic-alphabet --location=us-central1
```

Expected: A job named something like `firebase-schedule-scheduledFirestoreExport-us-central1` with schedule `every day 03:00`.

- [ ] **Step 3: Trigger a manual test run**

```bash
# Get the exact job name from the previous step, then:
gcloud scheduler jobs run firebase-schedule-scheduledFirestoreExport-us-central1 \
  --project=the-kinetic-alphabet \
  --location=us-central1
```

- [ ] **Step 4: Monitor the function execution**

```bash
# Wait ~2 minutes, then check logs
gcloud functions logs read scheduledFirestoreExport \
  --project=the-kinetic-alphabet \
  --region=us-central1 \
  --limit=20
```

Expected: Logs showing "Firestore export started", polling messages, then "Firestore export completed and verified."

- [ ] **Step 5: Verify export appeared in the bucket**

```bash
gcloud storage ls gs://tka-firestore-backups/daily/ --project=the-kinetic-alphabet
```

Expected: A timestamped folder like `gs://tka-firestore-backups/daily/2026-03-14T...Z/`

---

## Task 8: Set Up Monitoring

This is a manual Cloud Console task. No code changes.

- [ ] **Step 1: Create email notification channel**

1. Go to [Monitoring > Alerting](https://console.cloud.google.com/monitoring/alerting?project=the-kinetic-alphabet)
2. Click **Edit Notification Channels** (top right)
3. Under **Email**, click **Add New**
4. Enter `austencloud@gmail.com`, display name "TKA Admin Email"
5. Save

- [ ] **Step 2: Create alert policy for export failures**

1. Go to [Monitoring > Alerting > Create Policy](https://console.cloud.google.com/monitoring/alerting?project=the-kinetic-alphabet)
2. Click **Add Condition**
3. Select metric: `cloudfunctions.googleapis.com/function/execution_count`
4. Add filter: `function_name = scheduledFirestoreExport`
5. Add filter: `status != ok`
6. Condition type: Threshold, above 0, for 0 minutes (fire immediately)
7. Click **Add Notification Channel**, select the "TKA Admin Email" channel
8. In Documentation, add:
   ```
   The daily Firestore export Cloud Function failed. Check logs:
   https://console.cloud.google.com/functions/details/us-central1/scheduledFirestoreExport?project=the-kinetic-alphabet&tab=logs
   ```
9. Name the policy "Firestore Export Failure"
10. Save

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Test manual backup with a small collection**

```bash
node scripts/firestore-backup.cjs --collections=users
```

Expected: Output showing "Starting Firestore export...", destination under `manual/`, collection "users", then "Export started."

- [ ] **Step 2: Verify manual backup landed in the bucket**

```bash
gcloud storage ls gs://tka-firestore-backups/manual/ --project=the-kinetic-alphabet
```

Expected: A timestamped folder under `manual/`.

- [ ] **Step 3: Test restore script listing**

```bash
node scripts/firestore-restore.cjs
```

Expected: Lists available backups (both `daily/` and `manual/` folders) with numbered entries and usage instructions.

- [ ] **Step 4: Test restore confirmation gate**

```bash
node scripts/firestore-restore.cjs --backup="gs://tka-firestore-backups/manual/<timestamp>"
```

Expected: Shows the WARNING box, prompts "Type RESTORE to proceed". Typing anything other than RESTORE cancels.

- [ ] **Step 5: Verify lifecycle rules are working**

```bash
gcloud storage buckets describe gs://tka-firestore-backups --format="json(lifecycle)"
```

Expected: Two rules visible -- `daily/` prefix with 30-day age, `manual/` prefix with 90-day age.

- [ ] **Step 6: Verify PITR status**

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=the-kinetic-alphabet
```

Expected: `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED` with an `earliestVersionTime` timestamp.
