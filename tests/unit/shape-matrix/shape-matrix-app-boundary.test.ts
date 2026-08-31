import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve("src/lib/shared/shape-matrix/app");

function readTree(directory: string): string {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory()
        ? readTree(path)
        : readFileSync(path, "utf8");
    })
    .join("\n");
}

describe("Shape Matrix app boundary", () => {
  it("keeps route navigation and viewport ownership outside the embeddable app", () => {
    const appSource = readTree(APP_ROOT);

    expect(appSource).not.toContain('href="/notation"');
    expect(appSource).not.toContain("$app/");
    expect(appSource).not.toContain("window.location");
    expect(appSource).not.toMatch(/position:\s*fixed/);
    expect(appSource).toContain("ResizeObserver");
    expect(appSource).toContain("container: shape-matrix-app / size");
  });

  it("keeps URL persistence in the public route host", () => {
    const pageSource = readFileSync(
      resolve("src/routes/(public)/notation/shape-matrix/+page.svelte"),
      "utf8"
    );

    expect(pageSource).toContain(
      "$lib/shared/shape-matrix/app/ShapeMatrixApp.svelte"
    );
    expect(pageSource).toContain("mutateCurrentUrl");
    expect(pageSource).toContain("<ShapeMatrixApp {persistence} />");
  });

  it("reuses the canonical animation menu and pictograph carousel", () => {
    const drillSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte"),
      "utf8"
    );

    expect(drillSource).toContain("disableContextMenu: false");
    expect(drillSource).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(drillSource).toContain("includeStartPosition: false");
    expect(drillSource).toContain("currentStep: visibleStep");
    expect(drillSource).toContain("initialQualityTier: QualityTier.LOW");
    expect(drillSource).toContain("resolveRealizationEntryStep");
    expect(drillSource).toContain("initialStep: layer.initialStep");
    expect(drillSource).toContain("onsettled={finishCrossfade}");
    expect(drillSource).not.toContain("fadeSettlementTimer");
    expect(drillSource).toContain("retryPlayerLoad");
    expect(drillSource).toContain("railLoadError");
  });

  it("loads public base words from the checked-in snapshot, not Firebase", () => {
    const flowerSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/services/rotation-style-archetypes.ts"
      ),
      "utf8"
    );
    const realizationSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/services/build-realization-sequence.ts"
      ),
      "utf8"
    );
    const snapshot = JSON.parse(
      readFileSync(resolve("static/data/hero/tnd-base-words.json"), "utf8")
    ) as unknown[];

    expect(flowerSource).toContain("loadTndBaseWords");
    expect(flowerSource).not.toContain("loadCatalogSequences");
    expect(realizationSource).toContain("loadTndBaseWords");
    expect(realizationSource).not.toContain("loadCatalogSequences");
    expect(snapshot).toHaveLength(22);
  });
});
