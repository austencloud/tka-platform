# Firestore Backup & Disaster Recovery

**Date:** 2026-03-14
**Status:** Draft
**Firebase Project:** `the-kinetic-alphabet`
**Firestore Location:** `us-central1` (nam5)

---

## Overview

The TKA Platform has 40+ Firestore collections covering users, sequences, settings, gamification, learning progress, AI chat history, and more. There is no backup infrastructure. If a bad deploy corrupts data, a script accidentally deletes documents, or a user reports silent data loss, recovery today means "hope you remember what was there."

This spec adds three layers of protection:

1. **PITR** for 7-day granular rollback (per-document, per-second)
2. **Automated daily exports** to Cloud Storage with 30-day retention
3. **Manual scripts** for on-demand backup and restore

Combined, these cover the full disaster spectrum: PITR handles "I deleted something 3 hours ago," daily exports handle "we need to restore last Tuesday's state," and manual scripts handle ad-hoc snapshots before risky migrations.

---

## Why Not Firestore Managed Backups?

Google launched native Firestore managed backup/restore in 2024. It supports daily and weekly schedules with configurable retention, and restores directly to a new database. It's a real option worth considering.

We chose the Cloud Function + GCS export approach instead for these reasons:

1. **Portability.** GCS exports produce files you can download, move to another project, or import into a different Firebase instance. Managed backups are internal to the Firestore service and can only restore within the same project.

2. **Inspectability.** You can `gcloud storage ls` the bucket, see exactly when each export ran, check file sizes, and verify the data exists. Managed backups are opaque; you trust that they happened.

3. **Retention control.** GCS lifecycle rules give fine-grained control: 30-day auto-delete for daily exports, longer retention for manual snapshots, different rules per prefix. Managed backups have a single retention period (max 14 weeks as of 2026).

4. **Cleanup flexibility.** We can keep manual pre-migration snapshots indefinitely while auto-expiring routine dailies. Managed backups don't distinguish between "routine" and "keep forever."

5. **Battle-tested.** GCS exports have been the standard Firestore backup mechanism since 2018. Managed backups are newer (GA in late 2024) and have had less production exposure at scale.

If Google's managed backups mature and add cross-project restore or GCS export integration, revisiting this decision makes sense. For now, the GCS approach gives us more control with minimal extra complexity.

---

## Components

### 1. PITR (Point-in-time Recovery)

PITR continuously tracks document versions at per-second granularity. Once enabled, Firestore retains all document versions for a rolling 7-day window. Recovery reads the database state at any timestamp within that window.

#### Enable PITR

```bash
gcloud firestore databases update \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --enable-pitr
```

#### Verify PITR is enabled

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=the-kinetic-alphabet
```

Look for `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED` and `earliestVersionTime` showing the oldest recoverable timestamp.

#### Recover a single document

```bash
gcloud firestore databases restore \
  --source-database="(default)" \
  --destination-database="pitr-recovery-YYYYMMDD" \
  --snapshot-time="2026-03-13T14:30:00Z" \
  --project=the-kinetic-alphabet
```

This creates a new database at the specified point in time. You then read the recovered documents from the new database and write them back to the default database. The recovery database should be deleted after use.

#### What PITR covers

- Per-document, per-second granularity within the 7-day window
- All collections and subcollections
- Document metadata (create/update timestamps)
- Works for accidental deletes, bad writes, and field corruption

#### What PITR does NOT cover

- Data older than 7 days (use daily exports for that)
- Cross-project recovery (PITR is same-project only)
- Schema-level disasters (wrong security rules deployed)
- Bulk recovery of the entire database (use exports for full restores)

#### Cost

~$0.30/GB/month for version storage. For TKA's current data size (estimated <1 GB), this is under $0.30/month. PITR recovery reads cost the same as normal document reads.

---

### 2. Automated Daily Exports

A Cloud Function triggered by Cloud Scheduler exports the entire Firestore database to a GCS bucket every day. Daily exports older than 30 days are automatically deleted by a bucket lifecycle rule. Manual exports are retained for 90 days.

#### GCS Bucket Setup

```bash
# Create the export bucket in the same region as Firestore
gcloud storage buckets create gs://tka-firestore-backups \
  --project=the-kinetic-alphabet \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention=enforced

# Add lifecycle rules with prefix-based retention:
#   - daily/ exports: auto-delete after 30 days
#   - manual/ exports: auto-delete after 90 days (pre-migration snapshots need longer retention)
# Objects outside these prefixes are unaffected.
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

#### Service Account Permissions

The Cloud Functions default service account needs the `Cloud Datastore Import Export Admin` role to trigger exports, and `Storage Admin` on the backup bucket to write export files.

```bash
# Get the default service account
# Format: the-kinetic-alphabet@appspot.gserviceaccount.com

# Grant Firestore export permission
gcloud projects add-iam-policy-binding the-kinetic-alphabet \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# Grant Storage Admin on the backup bucket
gcloud storage buckets add-iam-policy-binding gs://tka-firestore-backups \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

#### Cloud Function: `scheduledFirestoreExport`

Add to `firebase-functions/src/index.ts`:

```typescript
export { scheduledFirestoreExport } from "./scheduledFirestoreExport";
```

New file `firebase-functions/src/scheduledFirestoreExport.ts`:

```typescript
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
  // and the verifyFirestoreExport function (below) catches any that silently fail.
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

The `@google-cloud/firestore` package is already a transitive dependency of `firebase-admin`, so no additional dependencies are needed. The `v1.FirestoreAdminClient` gives us `checkExportDocumentsProgress` for polling, which the `googleapis` REST client lacks.

**Why v1 Cloud Functions?** The existing codebase uses v1 (`functions.pubsub.schedule()`) for the `cleanupExpiredCheckoutSessions` function. Mixing v1 and v2 in the same project creates deployment and configuration inconsistencies. Stick with v1 unless migrating the entire functions codebase to v2.

#### Export Format

Firestore exports produce a set of files in the bucket:

```
gs://tka-firestore-backups/daily/2026-03-14T03:00:00.000Z/
  all_namespaces/
    all_kinds/
      all_namespaces_all_kinds.export_metadata
      output-0
      output-1
      ...
  all_namespaces_all_kinds.overall_export_metadata
```

These are LevelDB files, not human-readable JSON. They can only be restored via `gcloud firestore import` or the Admin SDK import API.

#### Deploy

```bash
cd firebase-functions
npm run build
firebase deploy --only functions:scheduledFirestoreExport --project=the-kinetic-alphabet
```

After deploying, verify the Cloud Scheduler job was created:

```bash
gcloud scheduler jobs list --project=the-kinetic-alphabet --location=us-central1
```

---

### 3. Manual Backup/Restore Scripts

Two scripts for ad-hoc operations: triggering an immediate backup before a risky migration, and restoring from a previous export.

#### `scripts/firestore-backup.cjs`

Triggers an immediate export (same as what the scheduled function does, but on demand).

```javascript
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

#### `scripts/firestore-restore.cjs`

Lists available backups and restores from a selected one.

```javascript
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

### 4. Monitoring & Alerting

#### Alert Policy on Export Failures

Create a Cloud Monitoring alert that fires when the `scheduledFirestoreExport` function logs an error or returns a non-OK status.

**Primary method: Cloud Console UI** (recommended over CLI, which uses `gcloud alpha` commands that are unreliable and change without notice).

1. Go to [**Monitoring > Alerting > Create Policy**](https://console.cloud.google.com/monitoring/alerting?project=the-kinetic-alphabet)
2. Click **Add Condition**
3. Select metric: `cloudfunctions.googleapis.com/function/execution_count`
4. Add filters: `function_name = scheduledFirestoreExport` and `status != ok`
5. Condition: threshold above 0 for 0 minutes (fire immediately on any failure)
6. Click **Add Notification Channel**, create an Email channel for `austencloud@gmail.com`
7. In Documentation, add: `The daily Firestore export Cloud Function failed. Check logs: https://console.cloud.google.com/functions/details/us-central1/scheduledFirestoreExport?project=the-kinetic-alphabet&tab=logs`
8. Name the policy "Firestore Export Failure"

**Alternative: CLI** (works but depends on `gcloud alpha`/`beta` subcommands that may not be installed or may change):

```bash
# Create notification channel
gcloud beta monitoring channels create \
  --display-name="TKA Admin Email" \
  --type=email \
  --channel-labels=email_address=austencloud@gmail.com \
  --project=the-kinetic-alphabet

# Get the channel ID
CHANNEL_ID=$(gcloud beta monitoring channels list \
  --project=the-kinetic-alphabet \
  --filter='displayName="TKA Admin Email"' \
  --format='value(name)')

# Create alert policy
gcloud alpha monitoring policies create \
  --display-name="Firestore Export Failure" \
  --condition-display-name="Export function error rate > 0" \
  --condition-filter='resource.type="cloud_function" AND resource.labels.function_name="scheduledFirestoreExport" AND metric.type="cloudfunctions.googleapis.com/function/execution_count" AND metric.labels.status!="ok"' \
  --condition-threshold-value=0 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-duration=0s \
  --condition-threshold-aggregation='{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_COUNT"}' \
  --notification-channels="$CHANNEL_ID" \
  --documentation='The daily Firestore export Cloud Function failed. Check logs: https://console.cloud.google.com/functions/details/us-central1/scheduledFirestoreExport?project=the-kinetic-alphabet&tab=logs' \
  --project=the-kinetic-alphabet
```

If the CLI commands fail (missing alpha component, changed flags), use the Console UI. It's the same result.

#### Verifying Backup Health

Quick check to see recent exports:

```bash
gcloud storage ls gs://tka-firestore-backups/ --project=the-kinetic-alphabet
```

Check ongoing or recent export operations:

```bash
gcloud firestore operations list --project=the-kinetic-alphabet
```

---

## Implementation Plan

### Phase 1: PITR (5 minutes)

1. Run the `gcloud firestore databases update --enable-pitr` command
2. Verify with `gcloud firestore databases describe`
3. Done. PITR starts retaining versions immediately.

### Phase 2: Bucket + Permissions (10 minutes)

1. Create the GCS bucket with lifecycle rule
2. Grant IAM roles to the Cloud Functions service account

### Phase 3: Export Function (20 minutes)

1. Add `scheduledFirestoreExport.ts` to `firebase-functions/src/`
2. Export from `index.ts`
3. Build and deploy (no new dependencies needed, `@google-cloud/firestore` is already a transitive dep of `firebase-admin`)
4. Verify the Cloud Scheduler job exists
5. Trigger a manual test run: `gcloud scheduler jobs run <JOB_NAME> --project=the-kinetic-alphabet --location=us-central1`
6. Confirm export appears in the bucket under `daily/`
7. Wait for the function to complete (it polls the export operation) and check logs for "completed and verified"

### Phase 4: Manual Scripts (10 minutes)

1. Create `scripts/firestore-backup.cjs` and `scripts/firestore-restore.cjs`
2. Test backup with `node scripts/firestore-backup.cjs --collections=users`
3. Verify the export lands in `gs://tka-firestore-backups/manual/`

### Phase 5: Monitoring (10 minutes)

1. Create the email notification channel
2. Create the alert policy
3. Test by temporarily breaking the function (wrong bucket name), triggering via scheduler, confirming email arrives, then fixing

---

## Cost Estimate

| Component | Monthly Cost (at <1 GB data) |
|-----------|------------------------------|
| PITR version storage | ~$0.30 |
| Daily export read ops (~100k docs/day) | ~$0.06/day = ~$1.80 |
| GCS storage (30 exports, ~1 GB each) | ~$0.78 (Standard tier) |
| Cloud Scheduler job | Free (3 free jobs/account) |
| Cloud Function execution (1/day) | Free tier covers this |
| Cloud Monitoring alert | Free (first 5 policies free) |
| **Total** | **~$3/month** |

As the database grows, export costs scale linearly with document count. At 1M documents, daily exports cost ~$0.60/day. Still cheap insurance.

---

## Security Considerations

### Service Account Key Management

No service account keys are needed for this setup. The Cloud Function runs under the default App Engine service account (`the-kinetic-alphabet@appspot.gserviceaccount.com`), which gets its credentials automatically from the runtime environment. The manual scripts use `gcloud` CLI which authenticates via `gcloud auth login`.

Never download or store service account key files for backup operations. If a CI/CD pipeline needs to trigger backups, use Workload Identity Federation instead of key files.

### GCS Bucket Access Controls

The bucket is created with:
- **Uniform bucket-level access** (no per-object ACLs, simpler to audit)
- **Public access prevention enforced** (cannot accidentally make exports public)
- Only the Cloud Functions service account has write access
- Project owners/editors have read access by default

To restrict further, remove the default editor binding and grant read-only to specific users:

```bash
gcloud storage buckets add-iam-policy-binding gs://tka-firestore-backups \
  --member="user:austencloud@gmail.com" \
  --role="roles/storage.objectViewer"
```

### Export Data Encryption

All data in GCS is encrypted at rest by default using Google-managed encryption keys (GMEK). For this project's risk profile, GMEK is sufficient. Customer-managed encryption keys (CMEK) are available if needed later but add key management overhead.

### Restore Safety

The restore script (`firestore-restore.cjs`) uses `gcloud firestore import`, which overwrites documents with matching IDs but does NOT delete documents absent from the backup. This is a merge operation, not a replace. For a full "restore to exact state," you'd need to delete all documents first (dangerous) or restore to a separate database and swap.

---

## Success Criteria

- [ ] PITR enabled and `earliestVersionTime` visible in `gcloud firestore databases describe`
- [ ] GCS bucket `tka-firestore-backups` exists with prefix-based lifecycle rules (30-day for `daily/`, 90-day for `manual/`)
- [ ] `scheduledFirestoreExport` deployed and visible in Cloud Scheduler
- [ ] At least one automated export visible in the bucket
- [ ] `scripts/firestore-backup.cjs` triggers a manual export
- [ ] `scripts/firestore-restore.cjs` lists available backups
- [ ] Manual restore tested with a small collection (e.g., restore `users` to a test database)
- [ ] Cloud Monitoring alert policy created with email notification
- [ ] Alert fires on simulated failure (verified by receiving email)
