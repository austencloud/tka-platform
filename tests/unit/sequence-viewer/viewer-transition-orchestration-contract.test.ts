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
const geometryTrace = read(
  "src/routes/test/sequence-viewer-transitions/_components/TransitionGeometryTrace.svelte"
);
const motionSurface = read(
  "src/lib/shared/sequence-viewer/components/ViewerMotionSurface.svelte"
);
const sceneLoadingCurtain = read(
  "src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte"
);
const scenePreparationSurface = read(
  "src/lib/shared/3d/scene-features/components/ScenePreparationSurface.svelte"
);
const companionSurface = read(
  "src/lib/shared/sequence-viewer/components/ViewerCompanionSurface.svelte"
);
const artPane = read(
  "src/lib/shared/sequence-viewer/components/ArtPane.svelte"
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
    expect(workspacePanels).toContain('id: "export-inspector-stacked"');
    expect(workspacePanels).toContain("!inspectorActive || inspectorCollapsed");
    expect(workspacePanels).toContain('if (direction === "horizontal")');
    expect(workspacePanels).toContain("else if (inspectorActive)");
    expect(workspacePanels).toContain("fixedSize:");
    expect(workspacePanels).toContain("preferredSize:");
    expect(workspacePanels).toContain("resizable: inspectorResizable");
    expect(workspacePanels).toContain(
      "gap={inspectorResizable ? VIEWER_INSPECTOR_HANDLE_SIZE : 0}"
    );
    expect(workspacePanels).toContain(
      "if (inspectorActive) workspaceDirection = direction;"
    );
    expect(workspacePanels).toContain(
      "<PanelGroup\n  direction={workspaceDirection}"
    );
    expect(panelGroup).toContain("style={getFlexStyle(panel, i)}");
    expect(panelGroup).toContain("const fixedSize = panel.fixedSize;");
    expect(panelGroup).toContain("data-manually-sized=");
    expect(panelGroup).toContain("panel.resizeLabel ??");
    expect(shell).toContain("data-effects-inspector");
    expect(shell).toContain("> :global(.export-panel.sidebar)");
    expect(shell).toContain("--card-sidebar-width: clamp(480px, 28vw, 640px)");
    expect(shell).toContain('panel-wrapper[data-manually-sized="true"]');
    expect(geometryTrace).toContain("Card → Effects seam");
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
      "{#key `${selectedViewport.id}-${review.activeGateId}-${frameVersion}`}"
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

  it("presents an honest 3D-owned preparation surface on first activation", () => {
    expect(motionSurface).toContain("const is3DPresented = $derived(");
    expect(motionSurface).toContain("is3DActive || keep3DUntilTunnelPaints");
    expect(motionSurface).toContain(
      "is2DActive || (isTunnelActive && !keep3DUntilTunnelPaints)"
    );
    expect(motionSurface).toContain('initialRevealMode: "gated"');
    expect(motionSurface).toContain(
      '<ScenePreparationSurface statusText="Opening 3D" />'
    );
    expect(sceneLoadingCurtain).toContain(
      '<ScenePreparationSurface {statusText} {progress} />'
    );
    expect(scenePreparationSurface).toContain("data-scene-preparation");
    expect(scenePreparationSurface).toContain("3D viewer");
    expect(scenePreparationSurface).toContain('role="progressbar"');
    expect(scenePreparationSurface).toContain('aria-valuenow={percent ?? undefined}');
    expect(motionSurface).not.toContain("viewer-3d-handoff-status");
    expect(motionSurface).toContain(
      "class:canvas-2d-preparation-held={preparationCanvasWidth !== null}"
    );
    expect(motionSurface).toContain(
      "data-3d-preparation-held={preparationCanvasWidth !== null || undefined}"
    );
    expect(splitPaneCss).toContain(
      ".canvas-2d-layer.canvas-2d-preparation-held"
    );
    expect(splitPaneCss).toContain("width: var(--preparation-canvas-width)");
    expect(motionSurface).toContain("data-scene-ready={scene3DReady}");
    expect(motionSurface).toContain("inert={!is3DActive}");
    expect(motionSurface).toContain("inert={!isAnimatorActive}");
    expect(motionSurface).toContain("const releaseWhenCovered = () =>");
    expect(motionSurface).toContain("requestAnimationFrame(");
    expect(motionSurface).toContain(
      "getComputedStyle(pane2D).opacity"
    );
    expect(splitPaneCss).toContain("opacity var(--transition-emphasis)");
    expect(viewerModeDissolve).toContain(
      'previousMode === "animation" && nextMode === "animation-3d"'
    );
    expect(reviewFrame).toContain('message.command === "3d-first"');
    expect(reviewFrame).toContain("await waitFor3DReady(version)");
    expect(scenePreparationSurface).toContain(
      "data-scene-preparation-progress"
    );
    expect(geometryTrace).toContain("Misidentified 3D frames");
    expect(geometryTrace).toContain("Progress regressions");
    expect(reviewPage).toContain("Replay first 3D");
    expect(reviewPage).toContain("Replay repeat switch");
    expect(reviewPage).toContain(
      'import { fits3DViewport } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte"'
    );
    expect(reviewPage).toContain("!activeGateCanReplay");
    expect(reviewPage).toContain(
      "3D is intentionally withheld at this viewport."
    );
  });

  it("keeps reduced 2D and 3D motion to a canonical opacity-only handoff", () => {
    expect(splitPaneCss).toContain(
      ".media-pane.persistent-3d[data-motion-surface]"
    );
    expect(splitPaneCss).toContain(
      ".media-pane.persistent-2d[data-motion-surface]"
    );
    expect(splitPaneCss).toContain(
      "transition-property: opacity, visibility !important;"
    );
    expect(splitPaneCss).toContain(
      "transition-duration: var(--duration-normal), 0s !important;"
    );
    expect(splitPaneCss).toContain(
      "transition-delay: 0s, var(--duration-normal) !important;"
    );
  });

  it("keeps one inspector shell while 2D and Tunnel controls trade places", () => {
    expect(shell).toContain("createViewerInspectorHostState()");
    expect(shell).toContain("setViewerInspectorHostContext(inspectorHost)");
    expect(shell).toContain("layout.isWorkspaceInspectorActive");
    expect(shell).toContain("data-viewer-art-inspector-target");
    expect(artPane).toContain(
      "use:reparentToInspector={externalInspectorTarget}"
    );
    expect(artPane).toContain("data-art-settings={artType}");
    expect(artPane).toContain("data-active={presented}");
  });

  it("morphs the persistent Animator canvas into Tunnel without a canvas swap", () => {
    expect(companionSurface).toContain('data-companion-surface="tunnel"');
    expect(companionSurface).toContain("sharedTunnelCanvas");
    expect(companionSurface).toContain("controller={tunnelStage.controller}");
    expect(motionSurface).toContain("data-persistent-animator");
    expect(motionSurface).toContain("data-tunnel-blend");
    expect(motionSurface).toContain("additionalLayers={tunnelLayers}");
    expect(motionSurface.match(/<AnimatorCanvas/g)).toHaveLength(1);
    expect(motionSurface).toContain(
      "resolveTunnelLayerOpacity(\n        tunnelReveal.current"
    );
    expect(viewerModeDissolve).toContain(
      'GATE_THREE_STAGE_MODES.has(previousMode) && nextMode === "tunnel"'
    );
    expect(reviewFrame).toContain('message.command === "tunnel-first"');
    expect(reviewPage).toContain("Replay first Tunnel");
    expect(reviewPage).toContain("Replay from 3D");
  });

  it("instruments singleton identity instead of inferring continuity from opacity", () => {
    expect(reviewFrame).toContain("const elementIdentities = new WeakMap");
    expect(reviewFrame).toContain(
      'animatorIdentity: elementIdentity("[data-persistent-animator]")'
    );
    expect(reviewFrame).toContain("activeArtSettingsCount:");
    expect(geometryTrace).toContain("Animator remounts:");
    expect(geometryTrace).toContain("Inspector remounts:");
    expect(geometryTrace).toContain("Non-singleton canvas frames:");
  });
});
