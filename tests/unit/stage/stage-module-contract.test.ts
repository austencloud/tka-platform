import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

const STAGE = "src/lib/features/stage/StageModule.svelte";

describe("One Stage ownership", () => {
  it("hosts the canonical 3D surface so the shared control rail reaches real rigs", () => {
    const stage = read(STAGE);
    // Every tool in SceneControlWorkspace reads getViewer3DContext(). A host
    // that never establishes it renders a rail of controls that do nothing,
    // which is exactly what the old Stage editor did.
    expect(stage).toContain("setViewer3DContext");
    expect(stage).toContain("createViewer3DState");
    expect(stage).toContain("<Viewer3DFullscreen");
    expect(stage).not.toMatch(
      /import\s+.*SequenceViewer(?:Shell|Orchestrator)/
    );
  });

  it("has no second viewer, no second sidebar, and no scene/editor split", () => {
    expect(exists("src/lib/features/stage/components/StageViewer.svelte")).toBe(
      false
    );
    expect(
      exists("src/lib/features/stage/components/StageSidebar.svelte")
    ).toBe(false);
    expect(exists("src/lib/features/stage/scene/SceneStudio.svelte")).toBe(
      false
    );

    const stage = read(STAGE);
    expect(stage).not.toContain('class="scene-rail"');
    expect(stage).not.toContain('class="stage-inspector"');
    expect(stage).not.toContain("navigationState.activeTab");
  });

  it("keeps one tab under the stage module id", () => {
    const tabs = read("src/lib/shared/navigation/config/tab-definitions.ts");
    const stageTabs = tabs.slice(tabs.indexOf("export const STAGE_TABS"));
    const block = stageTabs.slice(0, stageTabs.indexOf("];"));
    expect(block.match(/id: "/g)?.length).toBe(1);
    expect(block).not.toContain('id: "editor"');

    const modules = read(
      "src/lib/shared/navigation/config/module-definitions.ts"
    );
    expect(modules).toContain('id: "stage"');
    expect(modules).toContain('label: "3D Studio"');
  });

  it("drives lanes through the per-performer step seam, not the shared clock", () => {
    const stage = read(STAGE);
    expect(stage).toContain("performerSteps");
    expect(stage).toContain("samplePerformerSequenceAtBeat");

    const scene = read("src/lib/shared/3d/components/Viewer3DScene.svelte");
    expect(scene).toContain("resolvePerformerStepSource");
  });

  it("draws the drill on the floor through the world-geometry seam", () => {
    const stage = read(STAGE);
    expect(stage).toContain("worldChildren");
    expect(stage).toContain("<StageFloorPaths");

    const paths = read(
      "src/lib/features/stage/components/StageFloorPaths.svelte"
    );
    expect(paths).toContain("stageToWorld");
  });

  it("owns its only save action and its own timeline", () => {
    const stage = read(STAGE);
    // The artifact here is a choreography document, not a saved look, and the
    // Stage renders StageTimeline — the canvas must not add a second one.
    expect(stage).toContain("allowSaveScene={false}");
    expect(stage).toContain("hideCanvasOverlays");
    expect(stage).toContain("<StageTimeline");
  });

  it("keeps saved-scene handoffs out of the first-run starter", () => {
    const stage = read(STAGE);

    expect(stage).toContain("consumeSceneStudioHandoff");
    expect(stage).toContain("{:else if !handoff}");
    expect(stage).toContain("<StageStarter");
    expect(stage).not.toContain("StageFirstRun");
  });

  it("keeps choreography hidden until the user asks for precision tools", () => {
    const stage = read(STAGE);
    const starter = read(
      "src/lib/features/stage/components/StageStarter.svelte"
    );
    const timeline = read(
      "src/lib/features/stage/components/StageTimeline.svelte"
    );

    expect(stage).toContain(
      'type TimelineDisclosure = "hidden" | "dock" | "editor"'
    );
    expect(stage).toContain('timelineDisclosure === "hidden"');
    expect(stage).toContain('timelineDisclosure === "dock"');
    expect(stage).toContain('mode="dock"');
    expect(stage).toContain('mode="editor"');
    expect(starter).toContain("onVisibilityChange(!dismissed)");
    expect(starter).toContain("Choreograph the performance");
    expect(timeline).toContain('{#if mode === "editor"}');
    expect(timeline).toContain("grid-auto-rows: 3.5rem");
    expect(timeline).not.toContain("grid-auto-rows: minmax(3.5rem, 1fr)");
  });

  it("says nothing about phrases", () => {
    const stage = read(STAGE);
    const state = read(
      "src/lib/features/stage/state/stage-choreography-state.svelte.ts"
    );
    const timeline = read(
      "src/lib/features/stage/components/StageTimeline.svelte"
    );
    for (const source of [stage, state, timeline]) {
      expect(source.toLowerCase()).not.toContain("phrase");
    }
    expect(state).toContain("clipLabel");
  });

  it("keeps fullscreen mechanics outside Sequence Viewer ownership", () => {
    expect(() =>
      read("src/lib/shared/fullscreen/state/fullscreen-controller.svelte.ts")
    ).not.toThrow();
    expect(() =>
      read(
        "src/lib/shared/sequence-viewer/state/fullscreen-controller.svelte.ts"
      )
    ).toThrow();
  });
});
