import { describe, expect, it } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import type { SmokeIntent } from "$lib/shared/effects/domain/effects-config";
import { resolveSmoke3D } from "$lib/shared/effects/translators/webgl3d-translator";
import type { SmokeTipSource3D } from "$lib/shared/3d/effects/scene-effects/scene-effect-source-3d";
import { QualityTier } from "$lib/shared/3d/effects/types";
import {
  SMOKE_VOLUME_BRICK_SIZE,
  SmokeVolumeSolver3D,
  shiftSmokeVolumeField3D,
} from "$lib/shared/3d/effects/smoke/smoke-volume-solver-3d";
import { resolveSmokeVolumeRaySteps3D } from "$lib/shared/3d/effects/smoke/smoke-volume-renderer-3d";

function smokeSource(
  sourceId = 1,
  palette: SmokeIntent["palette"] = "incense"
): SmokeTipSource3D {
  const intent: SmokeIntent = {
    ...DEFAULT_EFFECTS_CONFIG.smoke,
    palette,
    intensity: 0.8,
    ambientEmission: 0.7,
    motionEmission: 0.8,
  };
  return {
    effect: "smoke",
    sourceId,
    propIndex: 0,
    tipIndex: 0,
    position: { x: 0, y: 1.4, z: 0 },
    velocity: { x: 0.7, y: 0.25, z: -0.35 },
    speed: 0.82,
    currentStep: 0,
    propColor: "#4aa3ff",
    params: resolveSmoke3D(intent),
    qualityTier: QualityTier.HIGH,
  };
}

describe("SmokeVolumeSolver3D", () => {
  it("derives materially different volume behavior for every authored palette", () => {
    const palettes: SmokeIntent["palette"][] = [
      "incense",
      "fog",
      "genie",
      "cursed",
      "spirit",
      "campfire",
    ];
    const signatures = palettes.map((palette) => {
      const profile = smokeSource(1, palette).params.volumeProfile;
      return [
        profile.injectionRadiusWorld,
        profile.density,
        profile.temperature,
        profile.vorticity,
        profile.extinction,
        profile.scattering,
      ].join(":");
    });
    expect(new Set(signatures).size).toBe(palettes.length);
    expect(smokeSource(1, "genie").params.volumeProfile.hueShift).toBe(1);
    expect(
      smokeSource(1, "cursed").params.volumeProfile.extinction
    ).toBeGreaterThan(smokeSource(1, "spirit").params.volumeProfile.extinction);
  });

  it("keeps fixed-step output deterministic across different frame chunking", () => {
    const sixtyFps = new SmokeVolumeSolver3D();
    const thirtyFps = new SmokeVolumeSolver3D();
    const source = smokeSource();
    for (let frame = 0; frame < 60; frame++) sixtyFps.update([source], 1 / 60);
    for (let frame = 0; frame < 30; frame++) thirtyFps.update([source], 1 / 30);

    const sixtySnapshot = sixtyFps.getDebugSnapshot();
    const thirtySnapshot = thirtyFps.getDebugSnapshot();
    expect(sixtySnapshot.simulationSteps).toBe(30);
    expect(thirtySnapshot.simulationSteps).toBe(30);
    expect(sixtySnapshot.densitySum).toBeCloseTo(thirtySnapshot.densitySum, 5);
    expect(Number.isFinite(sixtySnapshot.maxDivergence)).toBe(true);
    sixtyFps.dispose();
    thirtyFps.dispose();
  });

  it("assigns performers to distinct atlas bricks and clears immediately when disabled", () => {
    const solver = new SmokeVolumeSolver3D();
    solver.update([smokeSource(1), smokeSource(5, "fog")], 1 / 30);
    const offsets = solver
      .getRenderBricks()
      .map(
        (brick) =>
          `${brick.atlasOffset.x}:${brick.atlasOffset.y}:${brick.atlasOffset.z}`
      );
    expect(new Set(offsets).size).toBe(2);
    expect(solver.getDebugSnapshot().activeBricks).toBe(2);
    expect(solver.getDebugSnapshot().densitySum).toBeGreaterThan(0);

    solver.update([], 1 / 30);
    expect(solver.getDebugSnapshot()).toMatchObject({
      activeBricks: 0,
      densitySum: 0,
    });
    solver.dispose();
  });

  it("splats the full segment between frames instead of leaving motion gaps", () => {
    const moving = new SmokeVolumeSolver3D();
    const stationary = new SmokeVolumeSolver3D();
    const movingSource = smokeSource();
    const stationarySource = smokeSource();
    movingSource.position.x = -1;
    stationarySource.position.x = 1;
    moving.update([movingSource], 1 / 30);
    stationary.update([stationarySource], 1 / 30);

    movingSource.position.x = 1;
    moving.update([movingSource], 1 / 30);
    stationary.update([stationarySource], 1 / 30);

    expect(moving.getDebugSnapshot().occupiedVoxels).toBeGreaterThan(
      stationary.getDebugSnapshot().occupiedVoxels
    );
    moving.dispose();
    stationary.dispose();
  });

  it("projects velocity to a bounded divergence and releases fields on dispose", () => {
    const solver = new SmokeVolumeSolver3D();
    const source = smokeSource(1, "genie");
    for (let step = 0; step < 12; step++) {
      source.position.x = Math.sin(step * 0.4);
      source.position.z = Math.cos(step * 0.4) * 0.5;
      solver.update([source], 1 / 30);
    }
    const snapshot = solver.getDebugSnapshot();
    expect(snapshot.maxDivergence).toBeLessThan(10);
    expect(snapshot.occupiedVoxels).toBeGreaterThan(0);

    solver.dispose();
    expect(solver.getDebugSnapshot()).toMatchObject({
      activeBricks: 0,
      densitySum: 0,
      occupiedVoxels: 0,
    });
  });

  it("selects the authored ray budget from the active quality tier", () => {
    const high = smokeSource();
    const medium = smokeSource();
    medium.qualityTier = QualityTier.MEDIUM;
    const highCrowd = Array.from({ length: 20 }, (_, index) =>
      smokeSource(index + 1)
    );
    const mediumCrowd = highCrowd.map((source) => ({
      ...source,
      qualityTier: QualityTier.MEDIUM,
    }));
    expect(resolveSmokeVolumeRaySteps3D([high])).toBe(56);
    expect(resolveSmokeVolumeRaySteps3D([medium])).toBe(40);
    expect(resolveSmokeVolumeRaySteps3D(highCrowd)).toBe(28);
    expect(resolveSmokeVolumeRaySteps3D(mediumCrowd)).toBe(24);
  });

  it("shifts fields opposite a moving brick so density remains in world space", () => {
    const fieldLength = SMOKE_VOLUME_BRICK_SIZE ** 3;
    const source = new Float32Array(fieldLength);
    const target = new Float32Array(fieldLength);
    const index = (x: number, y: number, z: number) =>
      x + y * SMOKE_VOLUME_BRICK_SIZE + z * SMOKE_VOLUME_BRICK_SIZE ** 2;
    source[index(10, 11, 12)] = 0.75;

    shiftSmokeVolumeField3D(source, target, 2, -1, 3);

    expect(target[index(8, 12, 9)]).toBeCloseTo(0.75);
    expect(target[index(10, 11, 12)]).toBe(0);
  });
});
