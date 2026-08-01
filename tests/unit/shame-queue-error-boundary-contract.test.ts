import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/admin/components/ShameQueuePanel.svelte"
  ),
  "utf8"
);

function functionSource(name: string, nextName: string): string {
  const start = panelSource.indexOf(`function ${name}`);
  const end = panelSource.indexOf(`function ${nextName}`, start + 1);

  expect(start, `${name} should exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${nextName} should follow ${name}`).toBeGreaterThan(start);

  return panelSource.slice(start, end);
}

describe("Hall of Shame moderation error boundary", () => {
  it("uses the shared warning tier with stable admin telemetry context", () => {
    const reporter = functionSource("showModerationFailure", "handleApprove");

    expect(reporter).toContain("getErrorHandler().showUserError({");
    expect(reporter).toContain('severity: "warning"');
    expect(reporter).toContain('module: "admin"');
    expect(reporter).toContain('tab: "hall-of-shame"');
    expect(reporter).toContain("technicalDetails: failure.message");
  });

  it.each([
    ["handleApprove", "openRejectModal", "approveEntry"],
    ["handleReject", "handleHide", "rejectEntry"],
    ["handleHide", "handleFeature", "setEntryHidden"],
    ["handleFeature", "formatDate", "setEntryFeatured"],
  ])("routes %s failures without replacing the queue", (name, next, action) => {
    const handler = functionSource(name, next);

    expect(handler).toContain("showModerationFailure(");
    expect(handler).toContain(`"${action}"`);
    expect(handler).not.toMatch(/error\s*=\s*"Failed to/);
  });
});
