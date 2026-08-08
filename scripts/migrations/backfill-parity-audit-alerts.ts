/**
 * Upgrade the older parity-audit notifications that only carried a sentence
 * and a local filename. The current report payload is copied into each alert
 * so its new admin destination can render the affected records on any device.
 * Existing read state and timestamps are preserved.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-parity-audit-alerts.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/backfill-parity-audit-alerts.ts --apply
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatParityAuditMessage,
  isParityAuditReportFilename,
  toParityAuditViolation,
} from "../diagnostics/parity-audit-alert";
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;

const APPLY = process.argv.includes("--apply");
const BACKUP_DIRECTORY = join("scripts", "migrations", "backups");

interface AuditReport {
  generatedAt: string;
  reconcile: { actionable: AnyRec[] };
  shortcodes: { actionable: AnyRec[] };
}

function latestReport(): { filename: string; report: AuditReport } {
  const filename = readdirSync(BACKUP_DIRECTORY)
    .filter(isParityAuditReportFilename)
    .sort()
    .at(-1);
  if (!filename) throw new Error("no parity-audit report found");
  return {
    filename,
    report: JSON.parse(
      readFileSync(join(BACKUP_DIRECTORY, filename), "utf8")
    ) as AuditReport,
  };
}

async function main(): Promise<void> {
  if (!existsSync(BACKUP_DIRECTORY)) {
    throw new Error(`missing ${BACKUP_DIRECTORY}`);
  }
  const {
    db: rawDb,
    isAdmin,
    sdk,
  } = (await initFirestore()) as AnyRec & {
    db: unknown;
    isAdmin: boolean;
    sdk: string;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");
  const db = rawDb as FirebaseFirestore.Firestore;

  const { filename, report } = latestReport();
  const reconcile = report.reconcile.actionable;
  const shortcodes = report.shortcodes.actionable;
  if (reconcile.length + shortcodes.length === 0) {
    throw new Error(
      `latest report ${filename} is clean; refusing to overwrite historical violation alerts`
    );
  }
  const admins = await db
    .collection("users")
    .where("role", "==", "admin")
    .get();
  const alerts: Array<{ ref: AnyRec; path: string; data: AnyRec }> = [];

  for (const admin of admins.docs) {
    const snapshot = await admin.ref
      .collection("notifications")
      .where("type", "==", "admin-parity-audit")
      .get();
    for (const alert of snapshot.docs) {
      alerts.push({
        ref: alert.ref,
        path: alert.ref.path as string,
        data: alert.data(),
      });
    }
  }

  console.log(
    `via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"} — ${alerts.length} alert(s), source ${filename}`
  );
  if (!APPLY) {
    for (const alert of alerts) console.log(`  would update ${alert.path}`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    BACKUP_DIRECTORY,
    `parity-audit-alert-backfill-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceReport: filename,
        documents: alerts.map(({ path, data }) => ({ path, data })),
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  const violations = [
    ...reconcile.map((record) => toParityAuditViolation("reconcile", record)),
    ...shortcodes.map((record) => toParityAuditViolation("shortcode", record)),
  ];
  const message = formatParityAuditMessage(reconcile.length, shortcodes.length);
  const batch = db.batch();
  for (const alert of alerts) {
    batch.update(alert.ref, {
      message,
      auditStatus: "violations",
      actionUrl: `/admin/parity-audit?notification=${encodeURIComponent(String(alert.ref.id))}`,
      reportFile: filename,
      reportGeneratedAt: report.generatedAt,
      auditReconcileCount: reconcile.length,
      auditShortcodeCount: shortcodes.length,
      auditViolations: violations,
    });
  }
  await batch.commit();

  const verified = await Promise.all(
    alerts.map(async ({ ref }) => {
      const snapshot = await ref.get();
      const data = snapshot.data() as AnyRec;
      return (
        data["actionUrl"] ===
          `/admin/parity-audit?notification=${encodeURIComponent(String(ref.id))}` &&
        Array.isArray(data["auditViolations"]) &&
        data["auditViolations"].length === violations.length
      );
    })
  );
  if (verified.some((value) => !value)) {
    throw new Error("one or more parity alerts failed verification");
  }
  console.log(`updated and verified ${verified.length} alert(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
