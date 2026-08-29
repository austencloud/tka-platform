import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createDefaultEmberConfig } from "$lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config";
import { getCanonicalPerformerStageBounds } from "$lib/shared/3d/environments/domain/performer-stage-bounds";
import {
  createEmberSurfaceEcology,
  distanceToEmberLavaCorridor,
} from "$lib/shared/3d/environments/scenes/ember/ember-surface-ecology";
import { createEmberSurfacePlateGeometry } from "$lib/shared/3d/environments/scenes/ember/ember-surface-plate-geometry";
import {
  DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE,
  EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE,
  getViewerFrontStageFacingAngle,
  resolveViewerFormationFacingAngle,
} from "$lib/shared/3d/domain/viewer-formation-facing";
import {
  SCENE_ENVIRONMENTS,
  SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import { createFormationFromPreset } from "@austencloud/scene-3d";

interface EmberSliceGltf {
  extensionsRequired?: string[];
  extensionsUsed?: string[];
  materials?: Array<{ name?: string }>;
  images?: Array<{ name?: string; mimeType?: string }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    extras?: {
      tka_scene?: string;
      tka_revision?: string;
      tka_gate?: number;
      tka_role?: string;
      tka_element?: string;
      tka_authorship?: string;
      tka_joint_sides?: number;
      tka_cap_loss_max?: number;
    };
  }>;
}

const optimizedPath = resolve("static/models/ember/ember-production-slice.glb");
const integratedPath = resolve("static/models/ember/ember-integrated-room.glb");
const reportPath = resolve(
  "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-living-caldera-r10/ember-volcanic-world-production-slice-r10-report.json"
);
const volcanicWorldContractPath = resolve(
  "src/lib/shared/3d/environments/domain/models/scene-configs/ember-volcanic-world-r7.json"
);
const integratedReportPath = resolve(
  "docs/superpowers/specs/ember-spatial-directions/evidence/gate-5-r4/ember-integrated-room-r4-report.json"
);

function readOptimizedEmberAsset(path: string): EmberSliceGltf {
  const buffer = readFileSync(path);
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(
    buffer.subarray(20, 20 + jsonLength).toString("utf8")
  ) as EmberSliceGltf;
}

describe("Ember production-slice contracts", () => {
  const gltf = readOptimizedEmberAsset(optimizedPath);

  it("ships GPU-ready KTX2 textures and meshopt geometry under seven megabytes", () => {
    expect(gltf.extensionsRequired).toEqual(
      expect.arrayContaining([
        "EXT_meshopt_compression",
        "KHR_mesh_quantization",
        "KHR_texture_basisu",
      ])
    );
    expect(gltf.images).toHaveLength(12);
    expect(gltf.images?.every((image) => image.mimeType === "image/ktx2")).toBe(
      true
    );
    expect(statSync(optimizedPath).size).toBeLessThan(7_000_000);
  });

  it("retains the breached-caldera world and the four selected geology roles", () => {
    const roles = new Set(gltf.nodes?.map((node) => node.extras?.tka_role));
    expect(roles).toEqual(
      new Set([
        "playable-shelf",
        "shelf-stratum",
        "playable-surface",
        "cooled-fissure",
        "live-fissure",
        "caldera-bank",
        "perimeter-talus-cluster",
        "volcanic-basin",
        "lava-channel-levee",
        "meshy-hero-geology",
        "meshy-lava-bank",
        "meshy-fumarole-talus",
        "meshy-distant-caldera",
      ])
    );
    for (const role of [
      "meshy-hero-geology",
      "meshy-lava-bank",
      "meshy-fumarole-talus",
      "meshy-distant-caldera",
    ]) {
      expect(
        gltf.nodes?.filter((node) => node.extras?.tka_role === role)
      ).toHaveLength(1);
    }
    expect(
      gltf.nodes?.every(
        (node) =>
          !node.extras ||
          (node.extras.tka_scene === "ember" &&
            node.extras.tka_gate === 4 &&
            node.extras.tka_revision === "ember-living-caldera-gate4-r10")
      )
    ).toBe(true);
  });

  it("records the selected Meshy modules without repeating a source", () => {
    const imported =
      gltf.nodes?.filter(
        (node) => node.extras?.tka_authorship === "meshy-selected-multiview-r7"
      ) ?? [];
    expect(imported).toHaveLength(4);
    expect(new Set(imported.map((node) => node.extras?.tka_role))).toEqual(
      new Set([
        "meshy-hero-geology",
        "meshy-lava-bank",
        "meshy-fumarole-talus",
        "meshy-distant-caldera",
      ])
    );
  });

  it("ships only the approved Fresh Rift families and live-fissure source", () => {
    expect(new Set(gltf.materials?.map((material) => material.name))).toEqual(
      new Set([
        "Ember_R9_fresh-rift-synthesis_roped-pahoehoe",
        "Ember_R9_fresh-rift-synthesis_fractured-basalt",
        "Ember_R9_fresh-rift-synthesis_iron-contact-crust",
        "Ember_R9_fresh-rift-synthesis_windborne-ash",
        "Ember_R9_fresh-rift-synthesis_Blended_Terrain",
        "Ember_Live_Fissure",
      ])
    );
  });

  it("rejects runaway per-object subdivision before export", () => {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      geometry: {
        triangleCount: number;
        maximumMeshTriangleCount: number;
      };
    };
    expect(report.geometry.triangleCount).toBeLessThan(225_000);
    expect(report.geometry.maximumMeshTriangleCount).toBeLessThan(55_000);
  });

  it("records the four paid-source chains and rejects unrelated hero imports", () => {
    const report = readFileSync(reportPath, "utf8");
    expect(report).toContain('"sources": [');
    expect(report).toContain("remeshed through Meshy's topology service");
    expect(report).toContain("QRHbwRQLhM7Zn9LyYHOd");
    expect(report).toContain("gME4uHJawz9dtTlirRl8");
    expect(report).toContain("5otAzYdNg5Wp5E27mgfo");
    expect(report).toContain("nu73zqvPJRxio4T2sWz7");
    expect(report).toContain("ATURN84Ov2hmjWUndebl");
    expect(report).toContain("ZSnkB98pb0wz6PO17XKp");
    expect(report).toContain("s3cxnp6hOLBVQR5dDF42");
    expect(report).toContain("ahPuPwh34G3FeqvUEHsB");
    expect(report).toContain("01a045af-5015-7cb4-ac34-0d62f4269b67");
    expect(report).toContain("01a045b2-f26d-772f-a92e-9bf36e3fc318");
    expect(report).toContain("01a045b6-292c-7930-bdd7-ad8a5222989d");
    expect(report).toContain("01a045d9-7610-7858-bf2d-3caba206f23a");
    expect(report).toContain("01a045db-a666-78ec-99a2-3195f6a55319");
    expect(report).toContain("01a045e1-a103-7626-bff7-b62b29c74094");
    expect(report).not.toContain("generated/ember-rift-buttress");
    expect(report).not.toContain("static/models/ocean");
    expect(report).not.toContain("basalt_pinnacle");
    expect(report).toContain(
      "static/textures/ember-surface-r9/fresh-rift-family-mask.png"
    );
    expect(report).toContain(
      "src/lib/shared/3d/environments/primitives/masked-ground-detail-material.ts"
    );
  });

  it("uses one shared volcanic-world contract for the static channel and runtime river", () => {
    const world = JSON.parse(
      readFileSync(volcanicWorldContractPath, "utf8")
    ) as {
      lavaRiver: {
        pointsRuntimeXZHeight: [number, number, number][];
      };
      southVentCascade: {
        widthScale: number;
        pointsRuntimeXZHeight: [number, number, number][];
      };
      terrain: {
        runtimeXRange: [number, number];
        runtimeZRange: [number, number];
        actionFloorRadius: number;
        actionTerrainBaseHeight: number;
        direction: string;
      };
    };
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      contract: {
        lavaRiverControlPointsRuntimeXZHeight: [number, number, number][];
        southVentCascadeControlPointsRuntimeXZHeight: [
          number,
          number,
          number,
        ][];
        collapsedLavaBankCenterRuntimeXZ: [number, number];
        collapsedLavaBankRiverEdgeClearanceMeters: number;
        continuousOrbitDepthBands: string[];
        registeredReviewCameras: string[];
      };
      geometry: { volcanicBasinCount: number; lavaChannelLeveeCount: number };
    };
    const config = createDefaultEmberConfig();

    expect(config.lavaRivers?.channels[0]?.points).toEqual(
      world.lavaRiver.pointsRuntimeXZHeight
    );
    expect(config.lavaRivers?.channels[1]?.points).toEqual(
      world.southVentCascade.pointsRuntimeXZHeight
    );
    expect(config.lavaRivers?.channels[1]?.widthScale).toBe(
      world.southVentCascade.widthScale
    );
    expect(report.contract.lavaRiverControlPointsRuntimeXZHeight).toEqual(
      world.lavaRiver.pointsRuntimeXZHeight
    );
    expect(
      report.contract.southVentCascadeControlPointsRuntimeXZHeight
    ).toEqual(world.southVentCascade.pointsRuntimeXZHeight);
    expect(report.contract.collapsedLavaBankCenterRuntimeXZ).toEqual([30.5, 6]);
    expect(
      report.contract.collapsedLavaBankRiverEdgeClearanceMeters
    ).toBeGreaterThan(4);
    expect(report.geometry.volcanicBasinCount).toBe(1);
    expect(report.geometry.lavaChannelLeveeCount).toBe(2);
    expect(world.terrain.runtimeXRange).toEqual([-190, 190]);
    expect(world.terrain.runtimeZRange[0]).toBeLessThanOrEqual(-140);
    expect(world.terrain.runtimeZRange[1]).toBeGreaterThanOrEqual(180);
    expect(world.terrain.direction).toBe("living-caldera");
    expect(world.terrain.actionFloorRadius).toBe(10.8);
    expect(world.terrain.actionTerrainBaseHeight).toBeCloseTo(0.49);
    expect(world.terrain.actionTerrainBaseHeight).toBeLessThan(0.5);
    expect(getCanonicalPerformerStageBounds(8).radius).toBeLessThan(
      world.terrain.actionFloorRadius
    );
    expect(report.contract.continuousOrbitDepthBands).toEqual([
      "foreground",
      "midground",
      "north-rim",
      "south-rim",
    ]);
    expect(report.contract.registeredReviewCameras).toContain("audience");

    const frontContinuation = world.lavaRiver.pointsRuntimeXZHeight.at(-1)!;
    expect(frontContinuation[1]).toBeLessThanOrEqual(-120);
    const minimumRiverClearance = Math.min(
      ...world.lavaRiver.pointsRuntimeXZHeight.map(([x, z]) => Math.hypot(x, z))
    );
    expect(
      minimumRiverClearance - config.lavaRivers!.width / 2
    ).toBeGreaterThan(9);
  });

  it("keeps the old prop ring disabled", () => {
    const config = createDefaultEmberConfig();
    expect(config.obsidianPillars.enabled).toBe(false);
    expect(config.platform.enabled).toBe(false);
    expect(config.rockCount).toBe(0);

    const sceneSource = readFileSync(
      resolve("src/lib/shared/3d/environments/scenes/EmberScene.svelte"),
      "utf8"
    );
    expect(sceneSource).toContain(
      'import GltfAsset from "../primitives/GltfAsset.svelte"'
    );
    expect(sceneSource).not.toContain("rock_largeA.glb");
    expect(sceneSource).not.toContain("rock_largeB.glb");
    expect(sceneSource).toContain(
      'url="/models/ember/ember-production-slice.glb"'
    );
    expect(sceneSource).not.toContain("<GroundPlane");
    expect(sceneSource).not.toContain("<CraterGround");
  });
});

describe("Ember integrated-room contracts", () => {
  if (!existsSync(integratedPath)) {
    it.todo(
      "validates the historical integrated-room asset when it is present"
    );
    return;
  }

  const gltf = readOptimizedEmberAsset(integratedPath);

  it("ships the complete caldera under six megabytes with GPU compression", () => {
    expect(gltf.extensionsRequired).toEqual(
      expect.arrayContaining([
        "EXT_meshopt_compression",
        "KHR_mesh_quantization",
        "KHR_texture_basisu",
      ])
    );
    expect(gltf.images).toHaveLength(3);
    expect(gltf.materials).toHaveLength(7);
    expect(gltf.images?.every((image) => image.mimeType === "image/ktx2")).toBe(
      true
    );
    expect(statSync(integratedPath).size).toBeLessThan(6_000_000);
  });

  it("adds asymmetrical depth layers without rebuilding a prop ring", () => {
    const names = gltf.nodes?.map((node) => node.name) ?? [];
    expect(
      names.filter((name) => name?.startsWith("Ember_Caldera_Ridge_"))
    ).toHaveLength(14);
    expect(
      names.filter((name) => name?.startsWith("Ember_Basalt_Column_"))
    ).toHaveLength(68);
    expect(
      names.filter((name) => name?.startsWith("Ember_Gate_Talus_"))
    ).toHaveLength(34);
    expect(
      names.filter((name) => name?.startsWith("Ember_Obsidian_Shard_"))
    ).toHaveLength(5);
    expect(
      names.filter((name) => name?.startsWith("Ember_Gate_Backplate_"))
    ).toHaveLength(3);
    expect(names).not.toContain("Ember_Generated_Buttress_01");
  });

  it("records every new geological family as Gate 5 Ember geometry", () => {
    const gate5Nodes =
      gltf.nodes?.filter((node) => node.extras?.tka_gate === 5) ?? [];
    expect(new Set(gate5Nodes.map((node) => node.extras?.tka_role))).toEqual(
      new Set([
        "basalt-column",
        "caldera-ridge",
        "gate-backplate",
        "gate-talus",
        "glow-basin",
        "glow-basin-chasm",
        "obsidian-shard",
      ])
    );
    expect(
      gate5Nodes.every(
        (node) =>
          node.extras?.tka_scene === "ember" &&
          node.extras?.tka_revision === "ember-broken-rift-gate5-r4"
      )
    ).toBe(true);
  });

  it("keeps the invalidated integrated asset out of the runtime", () => {
    const sceneSource = readFileSync(
      resolve("src/lib/shared/3d/environments/scenes/EmberScene.svelte"),
      "utf8"
    );
    expect(sceneSource).not.toContain(
      'url="/models/ember/ember-integrated-room.glb"'
    );
    expect(sceneSource).toContain(
      'url="/models/ember/ember-production-slice.glb"'
    );
  });

  it("ties the build to the approved Gate 4 artifact and tracker decision", () => {
    const report = readFileSync(integratedReportPath, "utf8");
    expect(report).toContain("ember-broken-rift-gate5-r4");
    expect(report).toContain("MqaUVXWmMvvViGEOTCKX");
    expect(report).toContain("ember-production-slice-r2.blend");
    expect(report).toContain('"orbit-rear"');
    expect(report).toContain('"oldPropRingRestored": false');
    expect(report).toContain('"visuallyEnclosedPerimeter": true');
    expect(report).toContain('"generatedButtressRemoved": true');
  });

  it("keeps Ember's reversed heading scoped away from every other hero scene", () => {
    const workbenchSource = readFileSync(
      resolve("src/routes/test/viewer-3d/Viewer3DWorkbench.svelte"),
      "utf8"
    );
    expect(workbenchSource).toContain(
      "facingAngle: EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE"
    );
    expect(getViewerFrontStageFacingAngle(SceneEnvironmentId.EMBER)).toBe(
      EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE
    );
    expect(EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE).toBe(Math.PI);
    for (const environment of SCENE_ENVIRONMENTS) {
      if (environment.id === SceneEnvironmentId.EMBER) continue;
      expect(getViewerFrontStageFacingAngle(environment.id)).toBe(
        DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE
      );
    }

    const line = createFormationFromPreset("line", 4);
    for (const slot of line.slots) {
      expect(
        resolveViewerFormationFacingAngle(
          slot,
          line,
          Number.NaN,
          EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE
        )
      ).toBe(EMBER_VIEWER_FRONT_STAGE_FACING_ANGLE);
      expect(
        resolveViewerFormationFacingAngle(
          slot,
          line,
          Number.NaN,
          DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE
        )
      ).toBe(DEFAULT_VIEWER_FRONT_STAGE_FACING_ANGLE);
    }

    const backToBack = createFormationFromPreset("back-to-back", 2);
    expect(
      backToBack.slots.map((slot) =>
        resolveViewerFormationFacingAngle(slot, backToBack, Number.NaN)
      )
    ).toEqual([0, Math.PI]);

    const circle = createFormationFromPreset("circle", 4);
    expect(
      circle.slots.map((slot) =>
        resolveViewerFormationFacingAngle(slot, circle, Number.NaN)
      )
    ).toEqual(circle.slots.map((slot) => slot.facingAngle));
  });

  it("fills the shelf with deterministic geology without invading stage or lava", () => {
    const first = createEmberSurfaceEcology(5.2);
    const second = createEmberSurfaceEcology(5.2);
    expect(first).toEqual(second);
    expect(first.rubble).toHaveLength(150);
    expect(first.plates).toHaveLength(32);

    for (const placement of [...first.rubble, ...first.plates]) {
      const [x, , z] = placement.position;
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(7.4);
      expect(distanceToEmberLavaCorridor(x, z)).toBeGreaterThanOrEqual(4.3);
    }
  });

  it("uses one faceted volcanic plate mesh instead of instanced graybox slabs", () => {
    const geometry = createEmberSurfacePlateGeometry();
    const positions = geometry.getAttribute("position");
    expect(geometry.name).toBe("Ember_Jagged_Surface_Plate");
    expect(positions.count).toBe(132);
    expect(
      new Set(Array.from(positions.array).map((value) => value.toFixed(2))).size
    ).toBeGreaterThan(18);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0.9);
    geometry.dispose();

    const sceneSource = readFileSync(
      resolve(
        "src/lib/shared/3d/environments/scenes/ember/EmberSurfaceEcology.svelte"
      ),
      "utf8"
    );
    expect(sceneSource).not.toContain("<T.BoxGeometry");
    expect(sceneSource).toContain("createEmberSurfacePlateGeometry");
  });

  it("keeps the visibility revision above the darkness regression floor", () => {
    const config = createDefaultEmberConfig();
    expect(config.fog.density).toBeLessThanOrEqual(0.01);
    expect(config.hemisphereLight.intensity).toBeGreaterThanOrEqual(1);
    expect(config.skyLight?.intensity).toBeGreaterThanOrEqual(1.5);
  });
});
