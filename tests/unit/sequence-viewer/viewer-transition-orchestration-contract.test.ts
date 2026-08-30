import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const splitPane = read(
  "src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte"
);
const splitPaneCss = read(
  "src/lib/shared/sequence-viewer/components/viewer-split-pane.css"
);
const shell = read(
  "src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte"
);
const workspacePanels = read(
  "src/lib/shared/sequence-viewer/components/ViewerWorkspacePanels.svelte"
);
const panelGroup = read("src/lib/shared/panels/PanelGroup.svelte");
const viewerModeDissolve = read(
  "src/lib/shared/transitions/viewer-mode-dissolve.ts"
);
const viewTransitions = read("src/lib/shared/transitions/view-transitions.css");
const reviewPage = read(
  "src/routes/test/sequence-viewer-transitions/+page.svelte"
);
const reviewFrame = read(
  "src/routes/test/sequence-viewer-transitions/_components/SequenceViewerTransitionReviewFrame.svelte"
);

describe("Sequence Viewer transition orchestration contract", () => {
  it("routes split geometry through the canonical PanelGroup owner", () => {
    expect(splitPane).toContain(
      'import PanelGroup from "$lib/shared/panels/PanelGroup.svelte"'
    );
    expect(splitPane).toContain("{#snippet animationPanel()}");
    expect(splitPane).toContain("{#snippet previewPanel()}");
    expect(splitPane).toContain(
      "<PanelGroup\n    direction={panelLayout.direction}"
    );
    expect(splitPane).toContain(
      '{ id: "animation", content: animationPanel, resizable: false }'
    );
    expect(splitPane).toContain("content: previewPanel");
  });

  it("keeps collapsed production panes mounted, hidden, and inert", () => {
    expect(splitPane).toContain('inert={layout.focusedPane === "image"}');
    expect(splitPane).toContain('inert={layout.focusedPane === "animation"}');
    expect(splitPane).toContain('aria-hidden={layout.focusedPane === "image"}');
    expect(splitPane).toContain(
      'aria-hidden={layout.focusedPane === "animation"}'
    );
    expect(splitPane).not.toContain("{#if layout.focusedPane");
  });

  it("uses the shared emphasis clock instead of focused grid endpoints", () => {
    expect(splitPaneCss).toContain(
      "transition: opacity var(--transition-fast);"
    );
    expect(splitPaneCss).toContain('data-readable="false"');
    expect(splitPaneCss).toContain(
      ':root[data-motion-preference="reduce"] .split-view'
    );
    expect(splitPaneCss).toContain("transition: none !important;");
    expect(splitPaneCss).not.toMatch(
      /\[data-focused=[^\]]+\]\s*\{[^}]*grid-template/s
    );
    expect(splitPane).not.toContain("data-landscape=");
    expect(splitPane).not.toContain("data-fullscreen-stack=");
    expect(splitPane).not.toContain("data-adaptive-stack=");
  });

  it("routes inspector presence through the same canonical panel owner", () => {
    expect(shell).toContain("<ViewerWorkspacePanels");
    expect(shell).toContain(
      'direction={layout.effectiveMobile ? "vertical" : "horizontal"}'
    );
    expect(shell).not.toContain("grid-template-columns: 1fr 0px");
    expect(shell).not.toContain("transition: grid-template-columns");
    expect(workspacePanels).toContain(
      'import PanelGroup, {\n    type PanelDefinition,\n  } from "$lib/shared/panels/PanelGroup.svelte"'
    );
    expect(workspacePanels).toContain('id: "export-inspector"');
    expect(workspacePanels).toContain("fixedSize: inspectorCollapsed");
    expect(workspacePanels).toContain(
      "if (inspectorActive) workspaceDirection = direction;"
    );
    expect(workspacePanels).toContain(
      "<PanelGroup direction={workspaceDirection}"
    );
    expect(panelGroup).toContain("style={getFlexStyle(panel, i)}");
    expect(panelGroup).toContain("const fixedSize = panel.fixedSize;");
  });

  it("reviews the real production shell through production mode buttons", () => {
    expect(reviewFrame).toContain("<SequenceViewerOrchestrator");
    expect(reviewFrame).toContain("<SequenceViewerShell");
    expect(reviewFrame).toContain(
      'document.querySelectorAll<HTMLButtonElement>("button[aria-label]")'
    );
    expect(reviewFrame).toContain("button.click()");
    expect(reviewPage).toContain("Stress reversal");
    expect(reviewPage).toContain('{ value: "reduce", label: "Reduced" }');
    expect(reviewPage).toContain("No viewport overflow");
    expect(reviewFrame).toContain('action: "motion"');
    expect(reviewFrame).toContain("scheduleMetrics()");
    expect(reviewPage).toContain('onclick={() => review.mark("approved")}');
  });

  it("starts mobile review frames at their final geometry and keeps the gate scrollable", () => {
    expect(reviewFrame).toContain(
      "let isMobile = $state(browser && window.innerWidth < 768);"
    );
    expect(reviewFrame).toContain('button.classList.contains("active")');
    expect(reviewPage).toContain("onchange={setViewport}");
    expect(reviewPage).toContain(
      "{#key `${selectedViewport.id}-${review.activeGateId}`}"
    );
    expect(reviewPage).toContain("height: 100dvh;");
    expect(reviewPage).toContain("overflow-y: auto;");
  });

  it("uses a no-remount opacity dissolve for Gate 1 reduced motion", () => {
    expect(shell).toContain("bind:this={viewerWorkspaceElement}");
    expect(viewerModeDissolve).toContain("document.startViewTransition");
    expect(viewerModeDissolve).toContain("flushSync(mutate)");
    expect(viewerModeDissolve).toContain("reducedMotion()");
    expect(viewerModeDissolve).not.toContain("Crossfade.svelte");
    expect(viewTransitions).toContain(
      "::view-transition-group(\n    sequence-viewer-workspace"
    );
    expect(viewTransitions).toContain("animation: none !important;");
    expect(viewTransitions).toContain("sequence-viewer-dissolve-out");
    expect(viewTransitions).toContain("sequence-viewer-dissolve-in");
    expect(reviewPage).toContain("Reduced motion · dissolve");
  });
});
