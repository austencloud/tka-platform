import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scanTab = readFileSync(
  "src/lib/features/choreo-card/components/scan-activity/ScanActivityTab.svelte",
  "utf8"
);
const choreoCardTab = readFileSync(
  "src/lib/features/choreo-card/components/ChoreoCardTab.svelte",
  "utf8"
);

describe("scan cell backfill wiring", () => {
  it("mounts the cache controls inside Scan Atlas", () => {
    expect(scanTab).toContain("<ScanCellWarmControls");
    expect(scanTab).toContain("selectedCode={scanState.selectedCode}");
  });

  it("owns warm state above the tab so switching Choreo Card views does not cancel it", () => {
    expect(choreoCardTab).toContain("createScanCellWarmState()");
    expect(choreoCardTab).toContain("cellWarmState={scanCellWarm}");
  });
});
