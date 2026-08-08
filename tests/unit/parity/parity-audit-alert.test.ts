import { describe, expect, it } from "vitest";
import {
  formatParityAuditMessage,
  isParityAuditReportFilename,
  parityAuditFingerprint,
} from "../../../scripts/diagnostics/parity-audit-alert";

describe("parity audit alert deduplication", () => {
  it("ignores scan-time preconditions and changed-key ordering", () => {
    const first = [
      {
        id: "sequence-1",
        classification: "SAFE_REPROJECT",
        changedKeys: ["word", "encoderHash"],
        precondition: { publicUpdatedAtMillis: 100 },
      },
    ];
    const next = [
      {
        changedKeys: ["encoderHash", "word"],
        classification: "SAFE_REPROJECT",
        id: "sequence-1",
        precondition: { publicUpdatedAtMillis: 200 },
      },
    ];

    expect(parityAuditFingerprint(first, [])).toBe(
      parityAuditFingerprint(next, [])
    );
  });

  it("changes when the actionable set changes", () => {
    const existing = [{ id: "sequence-1", classification: "SAFE_REPROJECT" }];
    const changed = [{ id: "sequence-1", classification: "ORPHAN_PUBLIC" }];

    expect(parityAuditFingerprint(existing, [])).not.toBe(
      parityAuditFingerprint(changed, [])
    );
  });

  it("uses concrete notification copy", () => {
    expect(formatParityAuditMessage(3, 0)).toBe(
      "Parity audit found 3 data mismatches: 3 sequence projections, 0 QR codes. Open the report for the affected records."
    );
    expect(formatParityAuditMessage(0, 1)).toBe(
      "Parity audit found 1 data mismatch: 0 sequence projections, 1 QR code. Open the report for the affected records."
    );
  });

  it("distinguishes audit reports from notification backups", () => {
    expect(
      isParityAuditReportFilename("parity-audit-2026-08-08T18-18-50-087Z.json")
    ).toBe(true);
    expect(
      isParityAuditReportFilename(
        "parity-audit-alert-backfill-2026-08-08T18-26-52-791Z.json"
      )
    ).toBe(false);
  });
});
