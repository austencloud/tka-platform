import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const orchestrator = read(
  "src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte"
);
const contextContract = read(
  "src/lib/shared/sequence-viewer/domain/viewer-orchestrator-context.ts"
);
const interactiveServices = read(
  "src/lib/shared/sequence-viewer/state/viewer-interactive-services-state.svelte.ts"
);
const playbackPresentation = read(
  "src/lib/shared/sequence-viewer/state/viewer-playback-presentation-state.svelte.ts"
);
const lanSync = read(
  "src/lib/shared/sequence-viewer/state/viewer-lan-sync-state.svelte.ts"
);
const contextState = read(
  "src/lib/shared/sequence-viewer/state/viewer-orchestrator-context-state.svelte.ts"
);
const editMode = read(
  "src/lib/shared/sequence-viewer/state/viewer-edit-mode-state.svelte.ts"
);
const propVisibility = read(
  "src/lib/shared/sequence-viewer/state/viewer-prop-visibility-state.svelte.ts"
);
const shareActions = read(
  "src/lib/shared/sequence-viewer/services/viewer-share-actions.ts"
);
const destinationActions = read(
  "src/lib/shared/sequence-viewer/services/viewer-destination-actions.ts"
);

describe("sequence viewer orchestrator decomposition", () => {
  it("keeps the component as the composition root", () => {
    expect(orchestrator).toContain("createViewerInteractiveServicesState");
    expect(orchestrator).toContain("createViewerPlaybackPresentationState");
    expect(orchestrator).toContain("createViewerLanSyncState");
    expect(orchestrator).toContain("createViewerOrchestratorContextState");
    expect(orchestrator).toContain("createViewerEditModeState");
    expect(orchestrator).toContain("createViewerPropVisibilityState");
    expect(orchestrator).toContain("createViewerShareActions");
    expect(orchestrator).toContain("createViewerDestinationActions");
    expect(orchestrator).toContain("{@render children(contextState.value)}");
  });

  it("moves focused behavior out of the component", () => {
    expect(orchestrator).not.toContain("async function loadServices");
    expect(orchestrator).not.toContain("async function initializeAnimation");
    expect(orchestrator).not.toContain("let lastAppliedSyncTimestamp");
    expect(orchestrator).not.toContain("function handleVideoTimeUpdate");
    expect(orchestrator).not.toContain("function enterEditMode");
    expect(orchestrator).not.toContain("function handleOpenInCompose");
    expect(orchestrator).not.toContain("function handleShare");
    expect(orchestrator).not.toContain("const context: OrchestratorContext");

    expect(interactiveServices).toContain("async function initializeAnimation");
    expect(playbackPresentation).toContain("function handleVideoTimeUpdate");
    expect(lanSync).toContain("lastAppliedSyncTimestamp");
    expect(contextState).toContain("const value = $derived.by");
    expect(editMode).toContain("function enterEditMode");
    expect(propVisibility).toContain("function handlePropTypeChange");
    expect(shareActions).toContain("function handleShare");
    expect(destinationActions).toContain("function handleOpenInCompose");
  });

  it("gives the public context a component-independent owner", () => {
    expect(contextContract).toContain("export interface OrchestratorContext");
    expect(contextContract).toContain("export type PlaybackSource");

    const consumers = [
      "src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte",
      "src/lib/shared/sequence-viewer/components/ViewerHeader.svelte",
      "src/lib/shared/sequence-viewer/services/viewer-actions.ts",
      "src/lib/shared/sequence-viewer/state/viewer-shell-layout-state.svelte.ts",
      "src/lib/shared/sequence-viewer/state/viewer-shell-share-state.svelte.ts",
      "src/lib/shared/sequence-viewer/state/viewer-shell-interaction-state.svelte.ts",
      "src/routes/q/[code]/QScanPage.svelte",
      "src/routes/sequence/[id]/SequenceViewerPage.svelte",
    ].map(read);

    for (const consumer of consumers) {
      expect(consumer).not.toContain(
        'from "../components/SequenceViewerOrchestrator.svelte"'
      );
      expect(consumer).not.toContain(
        'from "./SequenceViewerOrchestrator.svelte"'
      );
    }
  });

  it("wires the seeded effects config to the visibility manager eagerly", () => {
    // A full-state link can boot straight into the 3D pane, where no 2D
    // CanvasSurface ever mounts — and CanvasSurface is otherwise the only
    // assigner of `visibilityManager.effectsConfigState`. Viewer3DScene reads
    // that field for its tip effect map, so without this eager assignment a
    // seeded fx slice (e.g. sparkles) renders nowhere in 3D until an unrelated
    // pane switch mounts a canvas.
    const assignment =
      "getAnimationVisibilityManager().effectsConfigState = effectsConfigState;";
    expect(orchestrator).toContain(assignment);
    // The assignment must precede fx slice registration so captures and the
    // 3D bridge observe the same instance from the first frame.
    expect(orchestrator.indexOf(assignment)).toBeLessThan(
      orchestrator.indexOf('urlSession.registerSlice("fx"')
    );
  });
});
