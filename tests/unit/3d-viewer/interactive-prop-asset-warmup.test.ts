import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const warmupSource = readFileSync(
  resolve("src/lib/shared/3d/components/InteractivePropAssetWarmup.svelte"),
  "utf8"
);
const canvasSource = readFileSync(
  resolve("src/lib/shared/3d/components/Viewer3DCanvas.svelte"),
  "utf8"
);

describe("interactive prop asset warmup", () => {
  it("prepares the canonical Fire Staff model in the live Canvas cache", () => {
    expect(warmupSource).toContain(
      "PROP_MODEL_REGISTRY[PropType.FIRE_DOUBLE_STAFF]"
    );
    expect(warmupSource).toContain("useGltf(fireStaffEntry.modelUrl)");
    expect(warmupSource).toContain("$fireStaff?.scene.clone(true)");
    expect(warmupSource).toContain("new FireRenderer3D(QualityTier.HIGH");
    expect(warmupSource).toContain("fireWarmup.primeGpuUpload()");
    expect(warmupSource).toContain("handles.renderer.compileAsync(");
  });

  it("holds the gated reveal until the interactive prop is ready", () => {
    expect(canvasSource).toContain("<InteractivePropAssetWarmup");
    expect(canvasSource).toContain(
      "additionalReady={performersReady && interactivePropsReady}"
    );
  });
});
