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

  it("prepares the server record once and retains the browser fallback", () => {
    const page = source("src/routes/q/[code]/QScanPage.svelte");
    const server = source("src/routes/q/[code]/+page.server.ts");
    expect(server).toContain("fromFirestoreFields");
    expect(server).toContain("prepareScanPayload(");
    expect(server).toContain("preparedSequence: prepared?.sequence ?? null");
    expect(server).toContain("scanCard: prepared?.card ?? null");
    expect(page).toContain("data.preparedSequence");
    expect(page).toContain(
      "shortCodeManager.resolveShortCodeWithRecord(shortCode, data.record)"
    );
  });

  it("paints canonical SSR cells before importing the full viewer", () => {
    const route = source("src/routes/q/[code]/+page.svelte");
    const bootstrap = source("src/routes/q/[code]/ScanCardBootstrap.svelte");

    expect(route).toContain("<ScanCardBootstrap");
    expect(route).toContain('import("./QScanPage.svelte")');
    expect(route).toContain("onStable={handleBootstrapStable}");
    expect(bootstrap).toContain("data-scan-cell-image");
    expect(bootstrap).toContain('markScanAfterPaint("all-cells-stable")');
  });

  it("keeps scan step numbers out of the cached bitmap pipeline", () => {
    const card = source(
      "src/lib/shared/sequence-viewer/components/ChoreoCard.svelte"
    );
    const cell = source(
      "src/lib/shared/sequence-viewer/components/CellRenderer.svelte"
    );
    expect(card).toContain(
      "showStepNumbers: cloudProbeEnabled ? false : showStepNumbers"
    );
    expect(cell).toContain("scanUsesHtmlStepNumbers");
  });

  it("presents the card before activating interactive viewer services", () => {
    const page = source("src/routes/q/[code]/QScanPage.svelte");
    expect(page).toContain('initialViewerMode="card"');
    expect(page).toContain("deferInteractiveStartup");
    expect(page).toContain("startInCardThenSplit");
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
