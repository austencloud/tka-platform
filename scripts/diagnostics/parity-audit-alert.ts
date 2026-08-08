import type { ParityAuditViolation } from "../../src/lib/shared/feedback/domain/models/notification-models";

type AuditRecord = Record<string, unknown>;

const VOLATILE_KEYS = new Set(["precondition", "applied", "applyError"]);

export function isParityAuditReportFilename(filename: string): boolean {
  return /^parity-audit-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/.test(
    filename
  );
}

function stableValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => stableValue(item));
    return key === "changedKeys"
      ? normalized.sort((a, b) => String(a).localeCompare(String(b)))
      : normalized;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as AuditRecord)
        .filter(([entryKey]) => !VOLATILE_KEYS.has(entryKey))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([entryKey, entryValue]) => [
          entryKey,
          stableValue(entryValue, entryKey),
        ])
    );
  }
  return value;
}

/**
 * Stable identity for the actionable part of an audit report. Scan-time
 * timestamps are excluded so an unchanged violation set does not generate a
 * fresh alert every morning.
 */
export function parityAuditFingerprint(
  reconcile: readonly AuditRecord[],
  shortcodes: readonly AuditRecord[]
): string {
  const entries = [
    ...reconcile.map((record) => ({ source: "reconcile", record })),
    ...shortcodes.map((record) => ({ source: "shortcode", record })),
  ]
    .map(({ source, record }) =>
      JSON.stringify({ source, record: stableValue(record) })
    )
    .sort();

  return entries.join("\n");
}

export function formatParityAuditMessage(
  reconcileCount: number,
  shortcodeCount: number
): string {
  const total = reconcileCount + shortcodeCount;
  const mismatchLabel = total === 1 ? "mismatch" : "mismatches";
  const projectionLabel =
    reconcileCount === 1 ? "sequence projection" : "sequence projections";
  const shortcodeLabel = shortcodeCount === 1 ? "QR code" : "QR codes";

  return (
    `Parity audit found ${total} data ${mismatchLabel}: ` +
    `${reconcileCount} ${projectionLabel}, ${shortcodeCount} ${shortcodeLabel}. ` +
    "Open the report for the affected records."
  );
}

export function toParityAuditViolation(
  source: ParityAuditViolation["source"],
  record: AuditRecord
): ParityAuditViolation {
  return {
    source,
    classification: String(
      record["classification"] ?? record["cls"] ?? "UNKNOWN"
    ),
    ...(typeof record["id"] === "string" && { id: record["id"] }),
    ...(typeof record["code"] === "string" && { code: record["code"] }),
    ...(typeof record["ownerId"] === "string" && {
      ownerId: record["ownerId"],
    }),
    ...(record["ownerId"] === null && { ownerId: null }),
    ...(typeof record["detail"] === "string" && {
      detail: record["detail"],
    }),
    ...(typeof record["storedWord"] === "string" && {
      storedWord: record["storedWord"],
    }),
    ...(typeof record["expectedWord"] === "string" && {
      expectedWord: record["expectedWord"],
    }),
    ...(Array.isArray(record["changedKeys"]) && {
      changedKeys: record["changedKeys"].filter(
        (key): key is string => typeof key === "string"
      ),
    }),
  };
}
