# Firestore Backup & Disaster Recovery

**Date:** 2026-04-14 (supersedes 2026-03-14 draft)
**Status:** Draft
**Firebase Project:** `the-kinetic-alphabet`
**Firestore Location:** `us-central1` (nam5)

---

## Overview

TKA has no production backup infrastructure today. If a bad deploy corrupts data, a script accidentally deletes documents, or a user reports silent data loss, recovery today means "hope you remember what was there."

This spec adds three layers of protection, designed for hands-off operation. The user's stated constraint is "a solution that involves me not having to think about it," so every design choice here prioritizes smaller failure surface and Google-operated components over self-operated ones.

1. **Firestore Managed Backup Schedules** — Google-operated daily + weekly backups, up to 14-week retention
2. **Point-in-time Recovery (PITR)** — 7-day per-second rollback window
3. **Weekly health check with dead man's switch** — alerts if backups stop happening OR if the alert system itself breaks

A fourth layer — manual GCS export/restore scripts that already exist — is retained for ad-hoc pre-migration snapshots where a portable, downloadable backup file matters.

---

## Architectural Choice: Managed Backups vs Custom Export Pipeline

The 2026-03-14 draft of this spec proposed a custom Cloud Function running `gcloud firestore export` on a Cloud Scheduler trigger, with lifecycle-managed retention in GCS. That approach prioritized **control and portability** (downloadable files, prefix-based retention, inspectable bucket contents).

The revised approach prioritizes **operational simplicity**:

| Concern | Managed Backups | Custom Cloud Function Export |
|---------|-----------------|------------------------------|
| Code to deploy and maintain | None | ~100 lines of TypeScript + IAM config |
| Failure modes | Google's SLA | Function bugs, scheduler misfires, IAM drift, dependency updates |
| Retention | Up to 14 weeks, configurable per schedule | Lifecycle rules on GCS bucket |
| Portability | Same-project restore only | Downloadable GCS files |
| Inspectability | `gcloud firestore backups list` | `gcloud storage ls` |
| Cost at <1 GB | ~$0.50/mo | ~$3/mo |

For a solo-dev project whose primary recovery scenarios are "I did something bad to Firestore" or "a bad deploy corrupted data," Google-operated backups have a smaller failure surface than custom code doing the same thing. Portability is preserved via the retained manual export script for the rare cases that genuinely need a downloadable snapshot (pre-migration, legal retention, moving data between projects).

The tradeoff: no cross-project restore from managed backups. Accepted because the manual script exists for that case.

---

## Components

### 1. Firestore Managed Backup Schedules

Two schedules, both same-region (us-central1) for fast restore:

```bash
# Daily backup, 7-day retention (granular recent recovery)
gcloud firestore backups schedules create \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --recurrence=daily \
  --retention=7d

# Weekly backup, 14-week retention (long-tail recovery)
gcloud firestore backups schedules create \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --recurrence=weekly \
  --retention=14w \
  --day-of-week=SUN
```

Inspect:

```bash
gcloud firestore backups schedules list \
  --database="(default)" --project=the-kinetic-alphabet

gcloud firestore backups list --project=the-kinetic-alphabet
```

Restore a backup to a new database:

```bash
gcloud firestore databases restore \
  --source-backup="projects/the-kinetic-alphabet/locations/us-central1/backups/<BACKUP_ID>" \
  --destination-database="restore-from-backup" \
  --project=the-kinetic-alphabet
```

Managed restores always create a new database. You migrate data out of the new database and then delete it when done. This is Google's design — it prevents the restore operation from compounding the disaster by overwriting live data directly.

**What managed backups cover:** full database recovery at a daily/weekly cadence, up to ~14 weeks of history.

**What they don't cover:**
- Sub-daily recovery → PITR handles that
- Cross-project restore → manual GCS export handles that

---

### 2. Point-in-time Recovery (PITR)

PITR is Firestore's per-second version history. Once enabled, the database retains all document versions for a rolling 7-day window.

```bash
gcloud firestore databases update \
  --database="(default)" \
  --project=the-kinetic-alphabet \
  --enable-pitr
```

Verify:

```bash
gcloud firestore databases describe \
  --database="(default)" --project=the-kinetic-alphabet
# Expect: pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
# And: earliestVersionTime: <timestamp>
```

Recover to a specific moment within the past 7 days:

```bash
gcloud firestore databases restore \
  --source-database="(default)" \
  --destination-database="pitr-recovery-YYYYMMDD" \
  --snapshot-time="2026-04-14T14:30:00Z" \
  --project=the-kinetic-alphabet
```

**PITR covers:** per-document, per-second granularity within 7 days, all collections/subcollections, accidental deletes, bad writes, field-level corruption.

**PITR doesn't cover:** data older than 7 days (Managed Backups cover that), cross-project recovery (manual export covers that), bulk full-database restore (use Managed Backup for that).

Cost: ~$0.30/GB/month for version storage. At <1 GB current data size, roughly $0.30/mo.

---

### 3. Dead Man's Switch (Weekly Health Check)

The riskiest silent failure for a managed-backup setup is **"Google's backups stopped happening and nobody noticed."** Google's own monitoring might catch this internally, but it won't surface to us. This component fixes that.

**Design:** A weekly Cloud Scheduler job triggers a Cloud Function. The function:

1. Lists Firestore backups via the Firestore Admin SDK
2. Asserts the newest backup is less than 48 hours old
3. On success: pings a Healthchecks.io URL
4. On failure: throws, so Cloud Monitoring catches it and emails

Two independent alerting paths, covering different failure modes:

| Failure Mode | Caught By |
|--------------|-----------|
| Managed Backups stopped producing new backups | Health check throws → Cloud Monitoring email |
| Health check Cloud Function itself stopped running (scheduler paused, function deleted, billing disabled) | Healthchecks.io missing-heartbeat email |
| Cloud Monitoring itself broken | Healthchecks.io missing-heartbeat email |

Why Healthchecks.io: Cloud Monitoring alerts on *things that run and fail*. If a thing stops running entirely, Cloud Monitoring has nothing to alert on. Healthchecks.io inverts the model — it alerts on *absence of a signal*, which is the real silent-failure mode for backup systems. It's been in operation since 2015, the free tier is genuine (up to 20 checks), and if it ever disappears we lose the dead man's switch but not the underlying backups.

**New file `firebase-functions/src/backupHealthCheck.ts`:**

```typescript
import * as functions from "firebase-functions";
import { v1 } from "@google-cloud/firestore";

const PROJECT_ID = "the-kinetic-alphabet";
const LOCATION = "us-central1";
const MAX_BACKUP_AGE_HOURS = 48;

/**
 * Runs every Monday at 09:00 UTC. Verifies that Firestore Managed Backups
 * are still being produced on schedule. If the newest backup is older than
 * 48 hours, this throws — which Cloud Monitoring catches and turns into
 * an email alert.
 *
 * On success, it pings Healthchecks.io. If Healthchecks.io stops receiving
 * pings (because this function stopped running for any reason), it emails
 * independently. This covers the "Cloud Monitoring itself is broken"
 * silent-failure mode.
 */
export const backupHealthCheck = functions
  .runWith({ timeoutSeconds: 120 })
  .region("us-central1")
  .pubsub.schedule("every monday 09:00")
  .timeZone("UTC")
  .onRun(async () => {
    const client = new v1.FirestoreAdminClient();
    const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;

    const [response] = await client.listBackups({ parent });
    const backups = response.backups;

    if (!backups || backups.length === 0) {
      throw new Error(
        "No Firestore backups exist. Managed backup schedule may not be configured."
      );
    }

    const newest = backups.reduce((a, b) => {
      const aTime = Number(a.snapshotTime?.seconds ?? 0);
      const bTime = Number(b.snapshotTime?.seconds ?? 0);
      return aTime > bTime ? a : b;
    });

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

    const healthcheckUrl = functions.config().backup?.healthcheck_url;
    if (healthcheckUrl) {
      await fetch(healthcheckUrl, { method: "GET" });
    } else {
      console.warn(
        "backup.healthcheck_url not configured. Dead man's switch disabled."
      );
    }
  });
```

Register in `firebase-functions/src/index.ts`:

```typescript
export { backupHealthCheck } from "./backupHealthCheck";
```

Configure the Healthchecks.io URL (the `functions.config()` path matches the v1 convention already used in this project):

```bash
firebase functions:config:set \
  backup.healthcheck_url="https://hc-ping.com/<UUID>" \
  --project=the-kinetic-alphabet
```

**Healthchecks.io setup:**
1. Create account at https://healthchecks.io (free hobby tier)
2. Create a check named "TKA Backup Health"
3. Schedule: **weekly** with a **2-day grace period** (the Monday run has time to succeed before Healthchecks.io considers it late)
4. Copy the ping URL (the `hc-ping.com/<UUID>` endpoint)
5. Add `austencloud@gmail.com` as a notification channel on the check

---

### 4. Manual Backup/Restore Scripts (Retained, Unchanged)

The existing scripts at `scripts/firestore-backup.cjs` and `scripts/firestore-restore.cjs` are kept as-is. They write to `gs://tka-firestore-backups/manual/` with 90-day retention. Use them when:

- About to run a risky migration and want a snapshot first
- Need a downloadable, portable copy for off-platform storage
- Need to move data between projects (managed backups can't do this)

The scripts aren't part of routine backup operation — Managed Backups handle that. They sit idle unless something risky is happening.

The bucket `tka-firestore-backups` still needs to exist for these scripts to work. The 2026-03-14 draft designed prefix-based lifecycle rules for `daily/` and `manual/`; only the `manual/` rule is needed now:

```bash
gcloud storage buckets create gs://tka-firestore-backups \
  --project=the-kinetic-alphabet \
  --location=us-central1 \
  --uniform-bucket-level-access \
  --public-access-prevention=enforced

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

# Service account needs import/export role for the scripts to work
gcloud projects add-iam-policy-binding the-kinetic-alphabet \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

gcloud storage buckets add-iam-policy-binding gs://tka-firestore-backups \
  --member="serviceAccount:the-kinetic-alphabet@appspot.gserviceaccount.com" \
  --role="roles/storage.admin"
```

---

## Cloud Monitoring Alert

One alert policy, created via Cloud Console UI (not `gcloud alpha`, which is unreliable):

- **Metric:** `cloudfunctions.googleapis.com/function/execution_count`
- **Filters:** `function_name = backupHealthCheck` AND `status != ok`
- **Threshold:** > 0 for 0 minutes (fire immediately on any failure)
- **Notification channel:** Email to `austencloud@gmail.com`
- **Documentation:** Link to Cloud Function logs

Combined with the Healthchecks.io alert, this gives two independent paths:

- Health check ran and found a problem → Cloud Monitoring email
- Health check didn't run at all → Healthchecks.io email

---

## Cost Estimate

| Component | Monthly Cost (at <1 GB data) |
|-----------|------------------------------|
| Managed Backups storage (daily 7d + weekly 14w) | ~$0.30 |
| PITR version storage | ~$0.30 |
| Cloud Function execution (weekly health check) | Free tier |
| Cloud Scheduler (1 job) | Free tier (3 free jobs/account) |
| Healthchecks.io | Free (hobby tier) |
| GCS for manual exports (empty most months) | <$0.10 |
| **Total** | **~$1/mo** |

Scales roughly linearly with data size. At 10 GB, ~$10/mo.

---

## Security Considerations

- **No service account keys.** The health check Cloud Function runs under the default App Engine service account and inherits IAM automatically. The manual scripts use `gcloud auth login`.
- **Healthchecks.io URL is not secret-level sensitive** (possession of the URL only lets someone send pings on your behalf, which can't cause data loss), but it's stored in `functions.config()` rather than checked into git as a matter of hygiene.
- **Managed backups inherit the project's encryption** (Google-managed keys by default; CMEK available if required later).
- **GCS bucket for manual exports:** uniform bucket-level access, public access prevention enforced.
- **Restore always targets a new database.** Both managed restore and PITR restore create new databases rather than overwriting the default one. Data is then migrated out manually, and the scratch database is deleted. This is Google's design and prevents compounding disasters.

---

## Implementation Plan (High-Level)

The detailed plan will be authored by the writing-plans skill after this spec is approved.

1. Enable PITR (one `gcloud` command)
2. Create daily + weekly Managed Backup schedules (two `gcloud` commands)
3. Create GCS bucket `tka-firestore-backups` with `manual/` lifecycle rule (existing manual scripts depend on it)
4. Grant IAM roles on the bucket for the Cloud Functions service account
5. Sign up for Healthchecks.io, create weekly check with 2-day grace period, copy ping URL
6. Add `backupHealthCheck.ts` Cloud Function, register in `index.ts`, set `functions.config()`, deploy
7. Create Cloud Monitoring alert on function failures (via Console UI)
8. End-to-end test: trigger health check manually, confirm Healthchecks.io receives ping, confirm failure path emails
9. Restore drill: restore newest backup to scratch database, verify collection doc counts match production within 5%, delete scratch database

---

## Success Criteria

- [ ] PITR enabled; `gcloud firestore databases describe` shows `POINT_IN_TIME_RECOVERY_ENABLED` with `earliestVersionTime`
- [ ] Daily + weekly Managed Backup schedules visible in `gcloud firestore backups schedules list`
- [ ] At least one backup visible in `gcloud firestore backups list` after the first daily run
- [ ] GCS bucket `tka-firestore-backups` exists with 90-day lifecycle rule on `manual/` prefix
- [ ] Service account has `datastore.importExportAdmin` and `storage.admin` on the bucket
- [ ] Healthchecks.io check created, grace period 2 days, email notification configured
- [ ] `backupHealthCheck` Cloud Function deployed with `backup.healthcheck_url` config
- [ ] Manually triggered `backupHealthCheck` succeeds and Healthchecks.io receives the ping
- [ ] Cloud Monitoring alert on function failure created; test-fire (e.g., temporarily break the function) sends an email
- [ ] Restore drill completed: newest backup restored to a scratch database, collection doc counts match production within 5%, scratch database deleted

---

## What Changed From the 2026-03-14 Draft

- **Dropped:** `scheduledFirestoreExport` Cloud Function (replaced by native Managed Backups)
- **Dropped:** Cloud Scheduler job for daily exports (Managed Backups include scheduling)
- **Dropped:** `daily/` prefix lifecycle rule (Managed Backups have their own retention)
- **Added:** Daily + weekly Managed Backup schedules
- **Added:** `backupHealthCheck` Cloud Function as a dead man's switch
- **Added:** Healthchecks.io integration for "alert on absence of signal"
- **Unchanged:** PITR enablement
- **Unchanged:** `scripts/firestore-backup.cjs` and `scripts/firestore-restore.cjs`
- **Reduced scope:** `gs://tka-firestore-backups/` now hosts only the manual-snapshot `manual/` prefix, not automated daily exports

Net effect: fewer lines of custom code, smaller failure surface, lower cost, stronger monitoring.
