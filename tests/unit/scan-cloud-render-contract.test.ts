import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("QR scan cloud-render contract", () => {
  it("does not initialize the complete pictograph renderer on the scan route", () => {
    const page = source("src/routes/q/[code]/QScanPage.svelte");
    expect(page).not.toContain("getGlyphCache().initialize()");
  });

  it("makes scan-card cell resolution cloud-only", () => {
    const card = source(
      "src/lib/shared/sequence-viewer/components/ChoreoCard.svelte"
    );
    expect(card).toContain("probeCloud: cloudProbeEnabled");
    expect(card).toContain("cloudOnly: cloudProbeEnabled");
  });

  it("does not launch the local card pre-warmer for a cloud-backed scan", () => {
    const orchestrator = source(
      "src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte"
    );
    expect(orchestrator).toMatch(
      /if \(!cloudBackedScan\) \{\s*cellPreWarmer\.preWarmSequence/
    );
  });
});
