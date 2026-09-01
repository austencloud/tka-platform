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
    expect(drillSource).toContain('disassemblyLayout: "sidecar"');
    expect(drillSource).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(drillSource).toContain("includeStartPosition: false");
    expect(drillSource).toContain("currentStep: visibleStep");
    expect(drillSource).toContain("propElementalType: railPropElementalType");
    expect(drillSource).toContain("initialQualityTier: QualityTier.LOW");
    expect(drillSource).toContain("resolveRealizationEntryStep");
    expect(drillSource).toContain("initialStep: layer.initialStep");
    expect(drillSource).toContain("onsettled={finishCrossfade}");
    expect(drillSource).not.toContain("fadeSettlementTimer");
    expect(drillSource).toContain("retryPlayerLoad");
    expect(drillSource).toContain("railLoadError");
    expect(drillSource).toContain(
      '<i class="fas fa-arrow-right derivation-arrow" aria-hidden="true"></i>'
    );
    expect(drillSource).toContain('<span class="sr-only">produces</span>');
  });

  it("keeps embedded disassembly inside the Shape Matrix atmosphere", () => {
    const inlinePlayerSource = readFileSync(
      resolve(
        "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
      ),
      "utf8"
    );
    const animatorSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/AnimatorCanvas.svelte"
      ),
      "utf8"
    );
    const splitSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/SplitCanvasView.svelte"
      ),
      "utf8"
    );
    const frameSystemSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/managers/frame-system.ts"
      ),
      "utf8"
    );
    const playbackSyncSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/managers/playback-sync.ts"
      ),
      "utf8"
    );
    const renderLoopSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/animation-render-loop.ts"
      ),
      "utf8"
    );

    expect(inlinePlayerSource).toContain("{disassemblyLayout}");
    expect(animatorSource).toContain(
      "data-disassembly-layout={disassemblyLayout}"
    );
    expect(animatorSource).toContain("layout={disassemblyLayout}");
    expect(animatorSource).toContain("{backgroundAlpha}");
    expect(splitSource.match(/\{backgroundAlpha\}/g)).toHaveLength(2);
    expect(splitSource).not.toContain("backgroundAlpha={1}");
    expect(splitSource.match(/mandalaVisibleOverride=\{true\}/g)).toHaveLength(
      2
    );
    expect(frameSystemSource).toContain(
      "props.mandalaVisibleOverride ?? this.state.visibilityState.mandala"
    );
    expect(playbackSyncSource).toContain(
      "props.mandalaVisibleOverride ?? this.state.visibilityState.mandala"
    );
    expect(playbackSyncSource).toContain(
      "this._lastPropsRef?.mandalaVisibleOverride ?? state.mandala"
    );
    expect(renderLoopSource).toContain("const show: MandalaHandVisibility");
    expect(renderLoopSource).toContain(
      'showLeft && showRight ? "both" : showLeft ? "left" : "right"'
    );
  });

  it("does not reserve an empty hand-path row for ordinary prop relationships", () => {
    const propPickerSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/PropRelationshipChipRow.svelte"
      ),
      "utf8"
    );

    expect(propPickerSource).not.toContain("hand-choice-slot");
    expect(propPickerSource).toContain(
      "selectedGroup && selectedGroup.candidates.length > 1"
    );
    expect(propPickerSource).toContain('transition:growFade={{ axis: "y" }}');
  });

  it("keeps each elemental button's visible mode and name in its accessible name", () => {
    const elementChipSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/components/ElementChipRow.svelte"),
      "utf8"
    );

    expect(elementChipSource).toContain(
      "ariaLabel={`${c.mode} ${elementName(c.el.element)} (${c.label})${"
    );
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
