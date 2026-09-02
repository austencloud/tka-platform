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
    // The drill lets the animator pick sidecar vs stacked from its host box.
    expect(drillSource).toContain('disassemblyLayout: "auto"');
    expect(drillSource).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(drillSource).toContain("includeStartPosition: false");
    expect(drillSource).toContain("currentStep: visibleStep");
    expect(drillSource).toContain("propElementalType: railPropElementalType");
    expect(drillSource).toContain(
      "propElementalType: propElementalTypeOf(layer.realization)"
    );
    expect(drillSource).toContain("initialQualityTier: QualityTier.LOW");
    expect(drillSource).toContain("resolveRealizationEntryStep");
    expect(drillSource).toContain("initialStep: layer.initialStep");
    expect(drillSource).toContain("onsettled={finishCrossfade}");
    expect(drillSource).not.toContain("fadeSettlementTimer");
    expect(drillSource).toContain("retryPlayerLoad");
    expect(drillSource).toContain("railLoadError");
    // The Hands -> Props derivation lives in the shared relationship bridge.
    const bridgeSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/PropRelationshipChipRow.svelte"
      ),
      "utf8"
    );
    expect(drillSource).toContain("PropRelationshipChipRow");
    expect(bridgeSource).toContain(
      '<i class="fas fa-arrow-right bridge-arrow" aria-hidden="true"></i>'
    );
    expect(bridgeSource).toContain('<span class="sr-only">produces</span>');
  });

  it("threads the optional prop element through the canonical animation overlay", () => {
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
    const surfaceSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/CanvasSurface.svelte"
      ),
      "utf8"
    );
    const overlaySource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/layers/GlyphOverlay.svelte"
      ),
      "utf8"
    );

    expect(inlinePlayerSource).toContain("{propElementalType}");
    expect(animatorSource).toContain("{propElementalType}");
    expect(surfaceSource).toContain("{propElementalType}");
    expect(overlaySource).toContain('corner="top-right"');
    expect(overlaySource).toContain("Prop timing and direction element:");
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
      "data-disassembly-layout={resolvedDisassemblyLayout}"
    );
    expect(animatorSource).toContain("layout={resolvedDisassemblyLayout}");
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

    // No reserved hand-path row and no in-flow slot that could reflow the
    // stage. The result crossfade is content-sized with an eased height: the
    // branching phase variant is taller than the one-line result, and `fill`
    // made its absolute layers spill out over the animation below.
    expect(propPickerSource).not.toContain("hand-choice-slot");
    expect(propPickerSource).toContain(
      "<Crossfade key={resultKey} animateHeight"
    );
    expect(propPickerSource).not.toContain("<Crossfade key={resultKey} fill");
    expect(propPickerSource).not.toContain("transition:growFade");
  });

  it("chooses a prop beside the animation, never over it", () => {
    const drillSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte"),
      "utf8"
    );
    const detailSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixDetailPane.svelte"
      ),
      "utf8"
    );
    const appSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/app/ShapeMatrixApp.svelte"),
      "utf8"
    );
    const stateSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte.ts"
      ),
      "utf8"
    );

    // The catalogue is a region of the drill, so the element relationships and
    // the pictograph carousel stay on screen while a prop is chosen.
    expect(drillSource).toContain("BentoPropGrid");
    expect(drillSource).toContain('class="prop-catalogue"');
    expect(drillSource).toContain("class:picking-props={propPickerOpen}");
    // Survivors travel to their new boxes through the canonical owner.
    expect(drillSource).toContain("createLayoutMotion");
    expect(drillSource).toContain('data-drill-region="hero"');
    // FLIP membership is for survivors only. capture() cancels every animation
    // on the elements it tracks, so tracking the catalogue would cancel the
    // very outro that removes it and strand a sliver of it on the stage.
    expect(drillSource).not.toContain('data-drill-region="props"');

    // No drawer, and prop choosing is not one of the dock's tray sections.
    expect(appSource).not.toContain("PropPickerModal");
    expect(detailSource).not.toContain('setActiveSection("props")');

    // Choosing keeps the catalogue open, so the change can be watched: pick a
    // prop, see the shape traced by it, pick the next one.
    expect(stateSource).toContain("async function setPropType");
    expect(stateSource).toContain("The picker stays open.");
  });

  it("offers prop choice once, under the animation", () => {
    const overflowSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixOverflowMenu.svelte"
      ),
      "utf8"
    );

    // The Props control under the canvas owns the choice; a second entry in
    // the overflow menu pointed at the same catalogue.
    expect(overflowSource).not.toContain("Choose prop");
    expect(overflowSource).not.toContain("getPropTypeDisplayInfo");
  });

  it("marks the chosen relationship with more than a colour", () => {
    const chipSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/RelationshipChoiceChip.svelte"
      ),
      "utf8"
    );

    // Six element accents, several of them dark: a tint difference alone did
    // not answer "which one did I pick?" at a glance.
    expect(chipSource).toContain('class="choice-check"');
    expect(chipSource).toContain("aria-pressed={active}");
    expect(chipSource).toContain(
      ".relationship-choice.active .choice-check {"
    );
    // Whole-surface treatment, never a decorative edge strip.
    expect(chipSource).toContain("inset 0 0 0 2px var(--choice-accent)");
    expect(chipSource).not.toMatch(/border-(left|right|top|bottom):\s*\d/);
  });

  it("wraps a long turn palette instead of scrolling it sideways", () => {
    const turnSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnControls.svelte"
      ),
      "utf8"
    );
    const segmentedSource = readFileSync(
      resolve("src/lib/shared/ui/components/SegmentedControl.svelte"),
      "utf8"
    );

    // Level 4 lists fourteen ratios. The tray splits them over two rows and
    // spends the saved room on full-size segments.
    expect(turnSource).toContain("columns={trayColumns}");
    expect(turnSource).toContain(
      ".turn-editor:not(.tray) .turn-control :global(.segmented-control)"
    );
    // The indicator tracks the chosen cell on both axes.
    expect(segmentedSource).toContain(".grid .indicator {");
    expect(segmentedSource).toContain("--row: {selectedRow}");
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
