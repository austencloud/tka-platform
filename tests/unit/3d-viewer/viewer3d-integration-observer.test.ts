import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const canvasSource = readSource(
  "src/lib/shared/3d/components/Viewer3DCanvas.svelte"
);
const canvasRefSource = readSource(
  "src/lib/shared/3d/components/Viewer3DCanvasRef.svelte"
);
const sceneSource = readSource(
  "src/lib/shared/3d/components/Viewer3DScene.svelte"
);
const environmentSource = readSource(
  "src/lib/shared/3d/environments/components/Environment3D.svelte"
);

describe("Viewer3D Gate 5 observation seam", () => {
  it("forwards the production renderer without creating a second canvas owner", () => {
    expect(canvasSource).toContain("<Viewer3DCanvasRef {onRendererReady} />");
    expect(canvasRefSource).toContain("onRendererReady?.(getRenderer())");
    expect(canvasRefSource).toContain("onRendererReady?.(null)");
  });

  it("forwards semantic environment transition observations through the production viewer", () => {
    expect(canvasSource).toContain("{onEnvironmentTransitionChange}");
    expect(sceneSource).toContain(
      "onTransitionChange={onEnvironmentTransitionChange}"
    );
    expect(environmentSource).toContain(
      "untrack(() => onTransitionChange?.(observation))"
    );
    expect(environmentSource).toContain("settled:");
  });

  it("clears environment readiness before the replacement scene can report ready", () => {
    expect(environmentSource).toContain(
      'sceneFeatures.resetReady("environment")'
    );
    expect(environmentSource).not.toContain(
      'queueMicrotask(() => sceneFeatures.resetReady("environment"))'
    );
  });
});
