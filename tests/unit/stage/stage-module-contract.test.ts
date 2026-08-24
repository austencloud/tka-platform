import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("3D Studio ownership", () => {
  it("mounts the production Scene workspace without a Sequence Viewer shell", () => {
    const scene = read("src/lib/features/stage/scene/SceneStudio.svelte");
    const lab = read("src/lib/features/lab/LabModule.svelte");
    expect(scene).toContain("<Viewer3DFullscreen");
    expect(scene).not.toMatch(/import\s+.*SequenceViewer(?:Shell|Orchestrator)/);
    expect(lab).not.toContain('"viewer-3d"');
  });

  it("gives Stage the multi-performer clip timeline and floating setup rail", () => {
    const stage = read("src/lib/features/stage/StageModule.svelte");
    const timeline = read(
      "src/lib/features/stage/components/StageTimeline.svelte"
    );
    expect(stage).toContain('class="scene-rail"');
    expect(stage).toContain('class="stage-inspector"');
    expect(stage).not.toContain('direction="horizontal"');
    expect(timeline).toContain("performer.sequenceClips");
    expect(timeline).toContain("<SequencePickerModal");
    expect(timeline).not.toContain("animation-timeline-js");
  });

  it("exposes Scene before Stage under the existing module id", () => {
    const tabs = read("src/lib/shared/navigation/config/tab-definitions.ts");
    const modules = read("src/lib/shared/navigation/config/module-definitions.ts");
    expect(tabs.indexOf('id: "scene"')).toBeLessThan(
      tabs.indexOf('id: "editor"')
    );
    expect(modules).toContain('id: "stage"');
    expect(modules).toContain('label: "3D Studio"');
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
