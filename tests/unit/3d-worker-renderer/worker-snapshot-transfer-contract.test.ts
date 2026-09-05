import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viewerSource = readFileSync(
  "src/lib/shared/3d/components/WorkerViewer3DScene.svelte",
  "utf8"
);
const rendererSource = readFileSync(
  "src/lib/shared/3d/worker-renderer/components/WorkerEnvironmentRenderer.svelte",
  "utf8"
);

describe("worker snapshot transfer boundary", () => {
  it("keeps frame snapshots raw and lets postMessage own the single clone", () => {
    expect(viewerSource).toMatch(
      /let performers = \$state\.raw<readonly WorkerPerformerSnapshot\[\]>/
    );
    expect(viewerSource).toMatch(
      /let effects = \$state\.raw<WorkerSceneEffectsSnapshot>/
    );
    expect(viewerSource).toMatch(
      /let interactionFrame = \$state\.raw<WorkerPerformerInteractionFrame \| null>/
    );
    expect(rendererSource).not.toContain("$state.snapshot(performers)");
    expect(rendererSource).not.toContain("$state.snapshot(effects)");
  });
});
