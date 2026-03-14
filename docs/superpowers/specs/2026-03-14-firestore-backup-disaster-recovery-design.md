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

A Cloud Function triggered by Cloud Scheduler exports the entire Firestore database to a GCS bucket every day. Exports older than 30 days are automatically deleted by a bucket lifecycle rule.

#### GCS Bucket Setup

```bash
# Create the export bucket in the same region as Firestore
gcloud storage buckets create gs://tka-firestore-backups \
  --project=the-kinetic-alphabet \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention=enforced

# Add 30-day lifecycle rule to auto-delete old exports
gcloud storage buckets update gs://tka-firestore-backups \
  --lifecycle-file=- <<'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 30}
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
import { google } from "googleapis";

const BUCKET = "gs://tka-firestore-backups";
const PROJECT_ID = "the-kinetic-alphabet";

/**
 * Runs every day at 3 AM UTC (off-peak for US users).
 * Exports the entire Firestore database to the backup bucket.
 * Each export lands in a timestamped folder like:
 *   gs://tka-firestore-backups/2026-03-14T03:00:00Z/
 *
 * The bucket lifecycle rule auto-deletes exports older than 30 days.
 */
export const scheduledFirestoreExport = functions
  .region("us-central1")
  .pubsub.schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const firestoreAdmin = google.firestore({
      version: "v1",
      auth: client as any,
    });

    const timestamp = new Date().toISOString();
    const outputUriPrefix = `${BUCKET}/${timestamp}`;

    const databaseName = `projects/${PROJECT_ID}/databases/(default)`;

    try {
      const response = await firestoreAdmin.projects.databases.exportDocuments({
        name: databaseName,
        requestBody: {
          outputUriPrefix,
          // Empty collectionIds = export everything
        },
      });

      console.log(
        `Firestore export started: ${response.data.name}`,
        `Output: ${outputUriPrefix}`
      );
    } catch (error) {
      console.error("Firestore export FAILED:", error);
      throw error; // Re-throw so Cloud Monitoring catches the failure
    }
  });
```

#### Alternative: Using @google-cloud/firestore Admin Client

If the `googleapis` approach causes issues with Cloud Functions bundling, use the Firestore Admin client directly:

```typescript
import * as functions from "firebase-functions";
import { v1 } from "@google-cloud/firestore";

const BUCKET = "gs://tka-firestore-backups";
const PROJECT_ID = "the-kinetic-alphabet";

export const scheduledFirestoreExport = functions
  .region("us-central1")
  .pubsub.schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const client = new v1.FirestoreAdminClient();
    const databaseName = client.databasePath(PROJECT_ID, "(default)");

    const timestamp = new Date().toISOString();
    const outputUriPrefix = `${BUCKET}/${timestamp}`;

    try {
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        // Empty collectionIds = export everything
      });

      console.log(
        `Firestore export started: ${response.name}`,
        `Output: ${outputUriPrefix}`
      );
    } catch (error) {
      console.error("Firestore export FAILED:", error);
      throw error;
    }
  });
```

This approach is cleaner and the `@google-cloud/firestore` package is already a transitive dependency of `firebase-admin`. Use whichever approach resolves cleanly with the existing Cloud Functions build.

#### Export Format

Firestore exports produce a set of files in the bucket:

```
gs://tka-firestore-backups/2026-03-14T03:00:00.000Z/
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
 *
 * WARNING: Importing data overwrites existing documents with the same IDs.
 * It does NOT delete documents that aren't in the backup.
 *
 * Requires: gcloud CLI authenticated with the project.
 */

const { execSync } = require("child_process");

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

function restoreFromBackup(backupUri) {
  // Validate the URI looks right
  if (!backupUri.startsWith("gs://tka-firestore-backups/")) {
    console.error("Backup URI must start with gs://tka-firestore-backups/");
    process.exit(1);
  }

  console.log(`Restoring from: ${backupUri}`);
  console.log();
  console.log(
    "WARNING: This will overwrite documents in Firestore that have " +
    "matching IDs in the backup. Proceed? (Ctrl+C to cancel)"
  );
  console.log();

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

if (backupArg) {
  const backupUri = backupArg.split("=").slice(1).join("=").replace(/"/g, "");
  restoreFromBackup(backupUri);
} else {
  listBackups();
}
```

---

### 4. Monitoring & Alerting

#### Alert Policy on Export Failures

Create a Cloud Monitoring alert that fires when the `scheduledFirestoreExport` function logs an error or returns a non-OK status.

```bash
# Create a notification channel for email
gcloud beta monitoring channels create \
  --display-name="TKA Admin Email" \
  --type=email \
  --channel-labels=email_address=austencloud@gmail.com \
  --project=the-kinetic-alphabet
```

Then create the alert policy. The notification channel ID from the previous command goes into `--notification-channels`.

```bash
# Get the channel ID
CHANNEL_ID=$(gcloud beta monitoring channels list \
  --project=the-kinetic-alphabet \
  --filter='displayName="TKA Admin Email"' \
  --format='value(name)')

# Create alert policy for Cloud Function errors
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

If the gcloud alpha/beta commands are unavailable or finicky, create the alert policy in the Cloud Console instead:

1. Go to **Monitoring > Alerting > Create Policy**
2. Add condition: metric `cloudfunctions.googleapis.com/function/execution_count`, filter by `function_name=scheduledFirestoreExport` and `status!=ok`
3. Threshold: above 0 for 0 minutes (fire immediately on any failure)
4. Notification channel: `austencloud@gmail.com`
5. Documentation: link to the function logs

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
3. Add `googleapis` to `firebase-functions/package.json` if using that approach
4. Build and deploy
5. Verify the Cloud Scheduler job exists
6. Trigger a manual test run: `gcloud scheduler jobs run <JOB_NAME> --project=the-kinetic-alphabet --location=us-central1`
7. Confirm export appears in the bucket

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
- [ ] GCS bucket `tka-firestore-backups` exists with 30-day lifecycle rule
- [ ] `scheduledFirestoreExport` deployed and visible in Cloud Scheduler
- [ ] At least one automated export visible in the bucket
- [ ] `scripts/firestore-backup.cjs` triggers a manual export
- [ ] `scripts/firestore-restore.cjs` lists available backups
- [ ] Manual restore tested with a small collection (e.g., restore `users` to a test database)
- [ ] Cloud Monitoring alert policy created with email notification
- [ ] Alert fires on simulated failure (verified by receiving email)
