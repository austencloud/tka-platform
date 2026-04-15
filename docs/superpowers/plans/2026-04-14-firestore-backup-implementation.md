# Firestore Backup & Disaster Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up hands-off Firestore backup + disaster recovery using Google-operated Managed Backups, PITR, and a Healthchecks.io dead man's switch.

**Architecture:** Enable Firestore Managed Backup Schedules (daily + weekly) and PITR via `gcloud`. Replace the obsolete custom-export Cloud Function with a weekly `backupHealthCheck` Cloud Function that verifies backups are fresh and pings Healthchecks.io. If the function fails, Cloud Monitoring emails; if the function stops running entirely, Healthchecks.io emails.

**Tech Stack:** Firebase Cloud Functions v5 (v1 scheduler style), `@google-cloud/firestore`, `defineSecret` for config, `gcloud` CLI, Healthchecks.io, Cloud Monitoring.

**Spec:** `docs/superpowers/specs/2026-03-14-firestore-backup-disaster-recovery-design.md`

**Supersedes:** `docs/superpowers/plans/2026-03-14-firestore-backup-implementation.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `firebase-functions/src/scheduledFirestoreExport.ts` | Delete | Obsolete — Managed Backups replace this |
| `firebase-functions/src/index.ts` | Modify | Remove `scheduledFirestoreExport` export, add `backupHealthCheck` export |
| `firebase-functions/src/backupHealthCheck.ts` | Create | Weekly Cloud Function: verify backup freshness, ping Healthchecks.io |
| `docs/superpowers/plans/2026-03-14-firestore-backup-implementation.md` | Delete | Superseded by this plan |

No changes to `scripts/firestore-backup.cjs` or `scripts/firestore-restore.cjs`. They continue to work as manual pre-migration snapshot tools.

---

## Task 0: Pre-flight Checks

Confirms the engineer's local environment has what the plan needs. Nothing changes yet.

- [ ] **Step 1: Confirm `gcloud` is installed and authenticated**

```bash
gcloud --version
gcloud auth list
gcloud config get-value project
```

Expected: gcloud version string, an active account (likely `austencloud@gmail.com`), project set to `the-kinetic-alphabet`. If project is different, set it:

```bash
gcloud config set project the-kinetic-alphabet
```

- [ ] **Step 2: Confirm `firebase` CLI is installed and logged in**

```bash
firebase --version
firebase projects:list
```

Expected: version string, list includes `the-kinetic-alphabet`.

- [ ] **Step 3: Confirm no unfinished Firestore export operations are in flight**

```bash
gcloud firestore operations list --project=the-kinetic-alphabet --database="(default)" --filter="NOT done" --format=json
```

Expected: `[]` (empty array). If any operation is in progress, wait for it to finish before continuing — overlapping operations cause failures.

- [ ] **Step 4: Verify the old `scheduledFirestoreExport` is NOT actually running in prod**

```bash
gcloud scheduler jobs list --project=the-kinetic-alphabet --location=us-central1 --format="value(name)" | grep -i scheduledFirestoreExport || echo "Not deployed — safe to remove"
```

Expected: `Not deployed — safe to remove`. If the job exists, deletion is handled in Task 1.

---

## Task 1: Remove Obsolete `scheduledFirestoreExport` Function

The previous plan created this file and exported it but never deployed the Cloud Scheduler job. Remove the code to prevent a future `firebase deploy` from accidentally activating the obsolete function alongside Managed Backups.

**Files:**
- Delete: `firebase-functions/src/scheduledFirestoreExport.ts`
- Modify: `firebase-functions/src/index.ts` (remove export line 24-25)
- Delete: `docs/superpowers/plans/2026-03-14-firestore-backup-implementation.md`

- [ ] **Step 1: Delete the Cloud Function source file**

```bash
rm firebase-functions/src/scheduledFirestoreExport.ts
```

- [ ] **Step 2: Remove the export from `index.ts`**

Open `firebase-functions/src/index.ts` and delete these two lines (currently lines 24-25):

```typescript
// Export scheduled Firestore backup function
export { scheduledFirestoreExport } from "./scheduledFirestoreExport";
```

- [ ] **Step 3: Delete the superseded plan**

```bash
rm docs/superpowers/plans/2026-03-14-firestore-backup-implementation.md
```

- [ ] **Step 4: If the function was somehow deployed, delete it from Firebase**

Re-run the check from Task 0 Step 4. If the Cloud Scheduler job exists in prod:

```bash
firebase functions:delete scheduledFirestoreExport --region=us-central1 --project=the-kinetic-alphabet --force
```

If `Not deployed — safe to remove`, skip this step.

- [ ] **Step 5: Build the functions package to verify the removal compiles**

```bash
cd firebase-functions && npm run build
```

Expected: `tsc` finishes with no errors, `copy-templates` runs, exit code 0.

- [ ] **Step 6: Commit**

```bash
cd E:/tka-platform
git add firebase-functions/src/scheduledFirestoreExport.ts firebase-functions/src/index.ts docs/superpowers/plans/2026-03-14-firestore-backup-implementation.md
git commit -m "$(cat <<'EOF'
chore(backup): remove obsolete scheduledFirestoreExport and superseded plan

The 2026-03-14 plan created this Cloud Function but never deployed it.
The revised spec uses Firestore Managed Backups instead, which do not
require a custom Cloud Function. Removing the code avoids an accidental
deploy activating the wrong backup path.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Enable Point-in-time Recovery (PITR)

Enables per-second rollback within a 7-day window. No code change, one gcloud command, takes seconds to apply.

- [ ] **Step 1: Enable PITR on the default database**

```bash
gcloud firestore databases update \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --enable-pitr
```

Expected: `Updated Firestore database [projects/the-kinetic-alphabet/databases/(default)]`.

- [ ] **Step 2: Verify PITR is enabled and has an `earliestVersionTime`**

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=the-kinetic-alphabet
```

Expected output includes these lines:

```
pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
earliestVersionTime: '2026-04-14T...Z'
```

If `earliestVersionTime` is missing, wait 2-3 minutes and re-run. PITR starts retaining versions immediately but the reported timestamp can lag.

---

## Task 3: Create Firestore Managed Backup Schedules

Two schedules: daily (7-day retention, covers recent recovery needs) and weekly (14-week retention, covers long-tail recovery).

- [ ] **Step 1: Create the daily schedule**

```bash
gcloud firestore backups schedules create \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --recurrence=daily \
  --retention=7d
```

Expected: JSON output with a `name` like `projects/the-kinetic-alphabet/databases/(default)/backupSchedules/<ID>` and `retention: 604800s`.

- [ ] **Step 2: Create the weekly schedule**

```bash
gcloud firestore backups schedules create \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --recurrence=weekly \
  --retention=14w \
  --day-of-week=SUN
```

Expected: JSON output with `retention: 8467200s` (14 weeks in seconds) and `weeklyRecurrence.day: SUNDAY`.

- [ ] **Step 3: Verify both schedules exist**

```bash
gcloud firestore backups schedules list \
  --database="(default)" \
  --project=the-kinetic-alphabet
```

Expected: Two rows, one with `dailyRecurrence` and one with `weeklyRecurrence.day: SUNDAY`.

- [ ] **Step 4: Note the first daily backup takes up to 24 hours to produce**

Do not proceed to Task 9 (health check first-run) until at least one backup is visible:

```bash
gcloud firestore backups list --project=the-kinetic-alphabet
```

Expected once Google has run the schedule: at least one entry with `state: READY`. This is just a note for the engineer — no action required right now. The rest of the plan can proceed.

---

## Task 4: Create GCS Bucket for Manual Exports

The existing `scripts/firestore-backup.cjs` and `scripts/firestore-restore.cjs` write to this bucket. It isn't used for automated daily backups anymore (Managed Backups replace that) so only the `manual/` prefix lifecycle rule from the old plan is needed.

- [ ] **Step 1: Create the bucket**

```bash
gcloud storage buckets create gs://tka-firestore-backups \
  --project=the-kinetic-alphabet \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention=enforced
```

Expected: `Creating gs://tka-firestore-backups/...`. If the bucket already exists, the command errors with `Your previous request to create the named bucket succeeded and you already own it` — that's fine, move on.

- [ ] **Step 2: Apply the 90-day lifecycle rule for the `manual/` prefix**

```bash
gcloud storage buckets update gs://tka-firestore-backups \
  --lifecycle-file=- <<'EOF'
{
  "rule": [
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

Expected: `Updating gs://tka-firestore-backups/...`, no errors.

- [ ] **Step 3: Grant the App Engine service account permission to trigger Firestore exports**

```bash
gcloud projects add-iam-policy-binding the-kinetic-alphabet \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"
```

Expected: Updated IAM policy printed to stdout, no errors.

- [ ] **Step 4: Grant the App Engine service account write access to the bucket**

```bash
gcloud storage buckets add-iam-policy-binding gs://tka-firestore-backups \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

Expected: Bucket IAM policy updated, no errors.

- [ ] **Step 5: Verify the bucket + lifecycle rule**

```bash
gcloud storage buckets describe gs://tka-firestore-backups \
  --format="json(name,location,lifecycle)"
```

Expected JSON shows `location: US-CENTRAL1` and the lifecycle rule with `matchesPrefix: [manual/]` and `age: 90`.

- [ ] **Step 6: Smoke-test the existing manual backup script with a tiny collection**

```bash
cd E:/tka-platform
node scripts/firestore-backup.cjs --collections=users
```

Expected: "Starting Firestore export...", destination under `gs://tka-firestore-backups/manual/<timestamp>/`, "Export started."

- [ ] **Step 7: Verify the test export appeared in the bucket**

```bash
gcloud storage ls gs://tka-firestore-backups/manual/ --project=the-kinetic-alphabet
```

Expected: At least one timestamped folder. The export may still be running; that's fine — we only need to know the destination is writable.

---

## Task 5: Set Up Healthchecks.io

External service that alerts on absence-of-signal. Free tier is sufficient.

- [ ] **Step 1: Create a Healthchecks.io account**

Go to https://healthchecks.io/accounts/signup/ and register with `austencloud@gmail.com`. Verify the email.

- [ ] **Step 2: Create a new check**

In the Healthchecks.io dashboard:
- Click **Add Check**
- Name: `TKA Backup Health`
- Schedule type: **Simple**
- Period: **1 week**
- Grace time: **2 days**
- Save

- [ ] **Step 3: Copy the ping URL**

On the check's detail page, copy the URL in the format `https://hc-ping.com/<UUID>`. You'll store this in Firebase Secret Manager in Task 6.

- [ ] **Step 4: Verify email notifications are enabled**

Under the check's **Integrations** tab, confirm the default email channel for the account is enabled for this check. If not, enable it.

- [ ] **Step 5: Send a manual test ping to confirm the URL works**

```bash
curl -fsS https://hc-ping.com/<UUID-FROM-STEP-3>
```

Expected: `OK` response. The check in the dashboard should turn green within a few seconds.

---

## Task 6: Configure Firebase Secret for the Healthchecks URL

Rather than `functions.config()` (deprecated in firebase-functions v5), this project uses `defineSecret()`. Matches the R2 functions pattern.

- [ ] **Step 1: Store the Healthchecks.io URL as a Firebase Secret**

```bash
firebase functions:secrets:set BACKUP_HEALTHCHECK_URL --project=the-kinetic-alphabet
```

When prompted `Enter a value for BACKUP_HEALTHCHECK_URL`, paste the `https://hc-ping.com/<UUID>` URL from Task 5 Step 3.

Expected output includes `Secret BACKUP_HEALTHCHECK_URL@<version> created`.

- [ ] **Step 2: Verify the secret exists**

```bash
firebase functions:secrets:access BACKUP_HEALTHCHECK_URL --project=the-kinetic-alphabet
```

Expected: The URL is printed. Confirms the value was stored correctly.

---

## Task 7: Create the `backupHealthCheck` Cloud Function

**Files:**
- Create: `firebase-functions/src/backupHealthCheck.ts`

- [ ] **Step 1: Create the Cloud Function source file**

Create `firebase-functions/src/backupHealthCheck.ts` with this exact content:

```typescript
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
```

- [ ] **Step 2: Build to verify compilation**

```bash
cd firebase-functions && npm run build
```

Expected: `tsc` succeeds with no errors. Confirms the `@google-cloud/firestore` types resolve (it's already a transitive dep of `firebase-admin`) and the v1 scheduler/secrets syntax is valid.

---

## Task 8: Register and Deploy `backupHealthCheck`

- [ ] **Step 1: Add the export to `firebase-functions/src/index.ts`**

Open `firebase-functions/src/index.ts` and add this block after the last non-feedbackClaims export (right after the `cleanupStagedUploads` or `push` block, in the same style — exact location isn't load-bearing, just keep it readable):

```typescript
// Export backup health check (dead man's switch for Firestore Managed Backups)
export { backupHealthCheck } from "./backupHealthCheck";
```

- [ ] **Step 2: Rebuild**

```bash
cd firebase-functions && npm run build
```

Expected: tsc succeeds.

- [ ] **Step 3: Deploy only the new function**

```bash
firebase deploy --only functions:backupHealthCheck --project=the-kinetic-alphabet
```

Expected output:
- `i functions: creating Node.js 20 (1st Gen) function backupHealthCheck(us-central1)...`
- `+ functions[backupHealthCheck(us-central1)] Successful create operation.`
- `i scheduler: creating Cloud Scheduler job firebase-schedule-backupHealthCheck-us-central1(us-central1)...`

- [ ] **Step 4: Verify the Cloud Scheduler job was created**

```bash
gcloud scheduler jobs describe firebase-schedule-backupHealthCheck-us-central1 \
  --location=us-central1 \
  --project=the-kinetic-alphabet \
  --format="value(schedule,state,timeZone)"
```

Expected: `every monday 09:00  ENABLED  UTC` (or similar).

- [ ] **Step 5: Commit**

```bash
cd E:/tka-platform
git add firebase-functions/src/backupHealthCheck.ts firebase-functions/src/index.ts
git commit -m "$(cat <<'EOF'
feat(backup): add backupHealthCheck Cloud Function

Weekly (Monday 09:00 UTC) function that lists Firestore Managed Backups,
fails if the newest is older than 48h, and pings Healthchecks.io on
success. The Healthchecks.io check alerts independently if this function
itself stops running — covers "Cloud Monitoring is broken" silent
failure mode.

Healthchecks URL is stored in Firebase Secret Manager as
BACKUP_HEALTHCHECK_URL (defineSecret pattern, matches R2 functions).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: First-Run Verification

Manually trigger the scheduler job and confirm the full path works end-to-end.

- [ ] **Step 1: Wait for the first Managed Backup to produce**

Re-check until at least one backup is `READY`:

```bash
gcloud firestore backups list --project=the-kinetic-alphabet
```

Expected: at least one row with `state: READY`. If none yet, wait — Google runs the daily schedule once per 24-hour window, so the first backup may take up to a day after Task 3.

**Do not proceed to Step 2 until a backup exists.** Running the health check against zero backups produces a (correct) failure, which is noise.

- [ ] **Step 2: Trigger the health check function manually**

```bash
gcloud scheduler jobs run firebase-schedule-backupHealthCheck-us-central1 \
  --location=us-central1 \
  --project=the-kinetic-alphabet
```

Expected: Command exits 0. The function runs asynchronously.

- [ ] **Step 3: Read the function logs**

Wait 30 seconds, then:

```bash
firebase functions:log --only backupHealthCheck --project=the-kinetic-alphabet --lines=30
```

Expected log lines in order:
- `Backup health OK. Newest: projects/.../backups/<id>, age: N.Nh`
- `Healthchecks.io pinged successfully.`
- Final `Function execution took Xms, finished with status code: 200`.

If the logs show `No Firestore backups exist`, the Managed Backup schedules aren't producing backups — revisit Task 3.

- [ ] **Step 4: Verify Healthchecks.io received the ping**

Open the Healthchecks.io dashboard. The `TKA Backup Health` check should show:
- Green status
- `Last ping: X seconds ago`
- Ping count incremented by 1

If the check is still red/yellow, the secret URL is wrong — run `firebase functions:secrets:access BACKUP_HEALTHCHECK_URL` to confirm the stored value matches the Healthchecks.io ping URL.

---

## Task 10: Create Cloud Monitoring Alert on Function Failure

Cloud Console UI is required (gcloud alpha is unreliable for alerting). This is a one-time setup.

- [ ] **Step 1: Create the email notification channel (if one doesn't already exist)**

Open https://console.cloud.google.com/monitoring/alerting?project=the-kinetic-alphabet and click **Edit Notification Channels** (top right).

Under **Email**:
- Click **Add New** (if no entry for `austencloud@gmail.com` exists)
- Email: `austencloud@gmail.com`
- Display name: `TKA Admin Email`
- Save

Verify the channel by responding to the confirmation email Google sends.

- [ ] **Step 2: Create the alert policy**

Go to https://console.cloud.google.com/monitoring/alerting/policies/create?project=the-kinetic-alphabet.

- Click **Select a metric**
- Resource type: `Cloud Function`
- Metric category: `Function`
- Metric: `Execution count` (full ID: `cloudfunctions.googleapis.com/function/execution_count`)
- Click **Apply**

Under **Add filter**:
- `function_name = backupHealthCheck`
- `status != ok`

Aggregation:
- Rolling window: `5 min`
- Rolling window function: `sum`

Configure alert trigger:
- Threshold: `Above`
- Threshold value: `0`
- For: `most recent value`

Click **Next**.

Notifications:
- Add the `TKA Admin Email` channel
- Incident autoclose duration: 1 hour
- Alert policy name: `Firestore Backup Health Check Failure`
- Documentation (the markdown that appears in the alert email):

```
The Firestore backup health check function failed. Either the Managed
Backups have stopped producing on schedule, or the function itself is
broken.

Check logs:
https://console.cloud.google.com/functions/details/us-central1/backupHealthCheck?project=the-kinetic-alphabet&tab=logs

Check backup status:
gcloud firestore backups list --project=the-kinetic-alphabet
```

Click **Next** then **Create Policy**.

- [ ] **Step 3: Test-fire the alert by causing a failure**

Temporarily edit `firebase-functions/src/backupHealthCheck.ts` line with the `MAX_BACKUP_AGE_HOURS` constant and change to `0.001` (0.001h = 3.6 seconds, which guarantees the newest backup is "too old"):

```typescript
const MAX_BACKUP_AGE_HOURS = 0.001;
```

Build and redeploy:

```bash
cd firebase-functions && npm run build && firebase deploy --only functions:backupHealthCheck --project=the-kinetic-alphabet
```

Trigger the function:

```bash
gcloud scheduler jobs run firebase-schedule-backupHealthCheck-us-central1 \
  --location=us-central1 --project=the-kinetic-alphabet
```

Wait ~2 minutes and check email. Expected: an email from Google Cloud Monitoring with subject containing "Firestore Backup Health Check Failure".

- [ ] **Step 4: Revert the test change**

Restore `MAX_BACKUP_AGE_HOURS` to `48` and redeploy:

```bash
cd firebase-functions && npm run build && firebase deploy --only functions:backupHealthCheck --project=the-kinetic-alphabet
```

Re-run the scheduler job and confirm the logs show `Backup health OK.` and the alert auto-closes (or manually close it in the Cloud Console).

Do NOT commit the 0.001 value — this was transient. `git diff firebase-functions/src/backupHealthCheck.ts` should show no changes after revert.

---

## Task 11: End-to-End Restore Drill

Required to confirm backups are actually restorable, not just that they exist. One-time verification per the spec's success criteria.

- [ ] **Step 1: Pick the newest `READY` backup**

```bash
gcloud firestore backups list --project=the-kinetic-alphabet \
  --format="value(name,state,snapshotTime)" | sort -k3 -r | head -1
```

Expected: one line, something like `projects/.../backups/<BACKUP_ID>  READY  2026-04-14T...Z`. Copy the full `projects/.../backups/<BACKUP_ID>` string — you'll paste it into Step 2.

- [ ] **Step 2: Restore the backup into a fresh scratch database**

```bash
gcloud firestore databases restore \
  --source-backup="<PASTE FULL BACKUP NAME FROM STEP 1>" \
  --destination-database="restore-drill-2026-04-14" \
  --project=the-kinetic-alphabet
```

Expected: Long-running operation starts. Poll with:

```bash
gcloud firestore operations list --project=the-kinetic-alphabet --filter="NOT done"
```

Wait until no in-progress operations remain (typically 5–15 minutes for <1 GB).

- [ ] **Step 3: Verify the scratch database exists and is queryable**

```bash
gcloud firestore databases describe --database="restore-drill-2026-04-14" --project=the-kinetic-alphabet
```

Expected: Database description with `type: FIRESTORE_NATIVE` and `state: ACTIVE`.

- [ ] **Step 4: Spot-check a few collection doc counts against production**

`gcloud` does not expose a document-count command, so use the Firebase Console UI for the spot-check.

Open two browser tabs:

- Production: https://console.firebase.google.com/project/the-kinetic-alphabet/firestore/databases/-default-/data
- Restore scratch: https://console.firebase.google.com/project/the-kinetic-alphabet/firestore/databases/restore-drill-2026-04-14/data

For each of these three collections, click the collection name in each tab and note the document count shown in the collection header (the console shows an estimated count or page-of-N indicator):

- `users`
- `sequences`
- `customers`

Expected: counts in the scratch database are within 5% of production. Slight differences are expected because production kept writing after the backup was taken.

If any collection's count differs by more than 5%, something went wrong — do NOT proceed to Step 5. Investigate logs from the restore operation first:

```bash
gcloud firestore operations list --project=the-kinetic-alphabet --filter="done" --limit=5
```

- [ ] **Step 5: Delete the scratch database**

Critical — leaving this around costs money and creates confusion.

```bash
gcloud firestore databases delete \
  --database="restore-drill-2026-04-14" \
  --project=the-kinetic-alphabet
```

Type `Y` to confirm when prompted. Expected: `Deleted Firestore database [restore-drill-2026-04-14]`.

- [ ] **Step 6: Verify the scratch database is gone**

```bash
gcloud firestore databases list --project=the-kinetic-alphabet --format="value(name)"
```

Expected: Only `projects/the-kinetic-alphabet/databases/(default)` appears. No `restore-drill-*` entries.

---

## Task 12: Success Criteria Sign-Off

Final verification against the spec. Every item must be a literal "yes, verified" — not "looks right."

- [ ] **Step 1: PITR confirmed enabled**

```bash
gcloud firestore databases describe --database="(default)" --project=the-kinetic-alphabet | grep -E "pointInTimeRecoveryEnablement|earliestVersionTime"
```

Expected: `POINT_IN_TIME_RECOVERY_ENABLED` and a recent `earliestVersionTime`.

- [ ] **Step 2: Both backup schedules present**

```bash
gcloud firestore backups schedules list --database="(default)" --project=the-kinetic-alphabet --format="value(recurrence)"
```

Expected: two lines, one with daily, one with weekly.

- [ ] **Step 3: At least one Managed Backup is `READY`**

```bash
gcloud firestore backups list --project=the-kinetic-alphabet --format="value(state)"
```

Expected: at least one line showing `READY`.

- [ ] **Step 4: GCS bucket has the `manual/` lifecycle rule**

```bash
gcloud storage buckets describe gs://tka-firestore-backups --format="json(lifecycle)"
```

Expected: JSON contains a rule with `matchesPrefix: [manual/]` and `age: 90`.

- [ ] **Step 5: Service account has the required roles**

```bash
gcloud projects get-iam-policy the-kinetic-alphabet --flatten="bindings[].members" --filter="bindings.members:serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" --format="value(bindings.role)"
```

Expected: list includes `roles/datastore.importExportAdmin`.

```bash
gcloud storage buckets get-iam-policy gs://tka-firestore-backups --format="value(bindings.role)" | grep storage.admin
```

Expected: one line containing `roles/storage.admin`.

- [ ] **Step 6: Healthchecks.io check is green**

Visit the Healthchecks.io dashboard. The `TKA Backup Health` check shows green and the most recent ping is from the manual trigger in Task 9.

- [ ] **Step 7: `backupHealthCheck` deployed and scheduled**

```bash
gcloud functions list --project=the-kinetic-alphabet --filter="name:backupHealthCheck" --format="value(name,state)"
```

Expected: one line, `backupHealthCheck ACTIVE` (or similar — the key is it exists in `us-central1` and is ACTIVE).

- [ ] **Step 8: `BACKUP_HEALTHCHECK_URL` secret is stored**

```bash
firebase functions:secrets:access BACKUP_HEALTHCHECK_URL --project=the-kinetic-alphabet | grep -c '^https://hc-ping.com/'
```

Expected: `1`.

- [ ] **Step 9: Cloud Monitoring alert policy exists**

Open https://console.cloud.google.com/monitoring/alerting/policies?project=the-kinetic-alphabet in a browser. The policy list should include a row named **Firestore Backup Health Check Failure** with status "Enabled."

- [ ] **Step 10: Restore drill completed, scratch DB deleted**

Confirm Task 11 was fully executed (especially Step 5 — scratch DB deleted). No remaining `restore-drill-*` databases.

---

## Rollback Plan

If any task needs to be rolled back:

- **Managed Backup Schedules:** `gcloud firestore backups schedules delete <SCHEDULE_ID> --database="(default)" --project=the-kinetic-alphabet`
- **PITR:** `gcloud firestore databases update --database="(default)" --project=the-kinetic-alphabet --no-enable-pitr`
- **GCS bucket:** `gcloud storage rm --recursive gs://tka-firestore-backups` then `gcloud storage buckets delete gs://tka-firestore-backups`
- **Cloud Function:** `firebase functions:delete backupHealthCheck --region=us-central1 --project=the-kinetic-alphabet --force`
- **Secret:** `firebase functions:secrets:destroy BACKUP_HEALTHCHECK_URL --project=the-kinetic-alphabet`
- **Cloud Monitoring alert:** delete via Cloud Console UI (same place it was created)
- **Healthchecks.io check:** delete from the Healthchecks.io dashboard
