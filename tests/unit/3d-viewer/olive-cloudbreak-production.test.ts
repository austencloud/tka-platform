import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultCelestialConfig } from "../../../src/lib/shared/3d/environments/domain/models/scene-configs/celestial-scene-config";

const sceneSource = readFileSync(
  resolve("src/lib/shared/3d/environments/scenes/CelestialScene.svelte"),
  "utf8"
);
const sunSource = readFileSync(
  resolve(
    "src/lib/shared/3d/environments/scenes/celestial/CelestialSun.svelte"
  ),
  "utf8"
);
const sliceSource = readFileSync(
  resolve(
    "src/lib/shared/3d/environments/scenes/celestial/OliveCloudbreakSlice.svelte"
  ),
  "utf8"
);

describe("Olive Cloudbreak production contract", () => {
  it("makes the approved Cloudbreak slice the sole celestial geometry owner", () => {
    expect(sceneSource).toContain("<OliveCloudbreakSlice");
    expect(sliceSource).toContain(
      "/models/celestial/olive-cloudbreak-production-slice.glb"
    );
    expect(sceneSource).not.toContain("CelestialSanctuaries");
    expect(sceneSource).not.toContain("celestial-environment.glb");
  });

  it("keeps one natural far sun aligned with the lighting configuration", () => {
    expect(createDefaultCelestialConfig().sunLight?.position).toEqual([
      0, 14, -115,
    ]);
    expect(sunSource).toContain("position = [0, 14, -115]");
    expect(sunSource).not.toMatch(/aureole|ringOne|ringTwo|spoke/i);
    expect(sceneSource).not.toContain("<T.PointLight");
  });

  it("keeps the approved landmass fixed when the shared performer stage expands", () => {
    expect(sceneSource).toContain("<OliveCloudbreakSlice");
    expect(sceneSource).not.toMatch(
      /<OliveCloudbreakSlice[\s\S]*?stageZOffset/
    );
    expect(sliceSource).not.toContain("position.z={stageZOffset}");
  });

  it("anchors the authored terrace to the avatar feet plane", () => {
    expect(sliceSource).toContain(
      'import { userProportionsState } from "@austencloud/scene-3d"'
    );
    expect(sliceSource).toContain(
      "position.y={userProportionsState.groundY}"
    );
  });
});
