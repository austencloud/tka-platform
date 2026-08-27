import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createDefaultEmberConfig } from "$lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config";
import {
  resolveViewerFormationFacingAngle,
  VIEWER_FRONT_STAGE_FACING_ANGLE,
} from "$lib/shared/3d/domain/viewer-formation-facing";
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
  "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-volcanic-r5/ember-volcanic-world-production-slice-r5-report.json"
);
const volcanicWorldContractPath = resolve(
  "src/lib/shared/3d/environments/domain/models/scene-configs/ember-volcanic-world-r5.json"
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

  it("ships GPU-ready KTX2 textures and meshopt geometry under five megabytes", () => {
    expect(gltf.extensionsRequired).toEqual(
      expect.arrayContaining([
        "EXT_meshopt_compression",
        "KHR_mesh_quantization",
        "KHR_texture_basisu",
      ])
    );
    expect(gltf.extensionsUsed).toContain("KHR_materials_emissive_strength");
    expect(gltf.images).toHaveLength(9);
    expect(gltf.images?.every((image) => image.mimeType === "image/ktx2")).toBe(
      true
    );
    expect(statSync(optimizedPath).size).toBeLessThan(5_000_000);
  });

  it("retains the authored shelf, furnace, fissure, and complete-orbit roles", () => {
    const roles = new Set(gltf.nodes?.map((node) => node.extras?.tka_role));
    expect(roles).toEqual(
      new Set([
        "playable-shelf",
        "shelf-stratum",
        "playable-surface",
        "cooled-fissure",
        "live-fissure",
        "columnar-joint",
        "buried-column-talus",
        "fallen-column",
        "collapsed-entablature",
        "caldera-bank",
        "fractured-gate-fragment",
        "perimeter-talus-cluster",
        "secondary-columnar-outcrop",
        "volcanic-basin",
        "distant-volcanic-vent",
        "lava-channel-levee",
      ])
    );
    expect(
      gltf.nodes?.filter((node) => node.extras?.tka_role === "columnar-joint")
    ).toHaveLength(31);
    expect(
      gltf.nodes?.filter(
        (node) => node.extras?.tka_role === "secondary-columnar-outcrop"
      )
    ).toHaveLength(33);
    expect(
      gltf.nodes?.every(
        (node) =>
          !node.extras ||
          (node.extras.tka_scene === "ember" &&
            node.extras.tka_gate === 4 &&
            node.extras.tka_revision === "ember-broken-rift-gate4-volcanic-r5")
      )
    ).toBe(true);
  });

  it("breaks the organ-pipe read with mixed facets, damaged caps, and missing joints", () => {
    const columns =
      gltf.nodes?.filter(
        (node) => node.extras?.tka_role === "columnar-joint"
      ) ?? [];
    expect(
      new Set(columns.map((node) => node.extras?.tka_joint_sides))
    ).toEqual(new Set([5, 6, 7]));
    expect(
      Math.max(...columns.map((node) => node.extras?.tka_cap_loss_max ?? 0))
    ).toBeGreaterThan(0.8);
    expect(
      columns.every(
        (node) => node.extras?.tka_authorship === "scene-authored-deterministic"
      )
    ).toBe(true);
  });

  it("keeps the furnace hierarchy and three distance-graded basin materials", () => {
    expect(gltf.materials?.map((material) => material.name)).toEqual([
      "Ember_Ash_Deposit",
      "Ember_Columnar_Basalt_PBR",
      "Ember_Ground_Blackglass_PBR",
      "Ember_Mineral_Ochre",
      "Ember_Fissure_Chasm",
      "Ember_Columnar_Cap_PBR",
      "Ember_Live_Fissure",
      "Ember_Near_Caldera_PBR",
      "Ember_Middle_Caldera_PBR",
      "Ember_Far_Caldera_PBR",
    ]);
  });

  it("rejects runaway per-object subdivision before export", () => {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      geometry: {
        triangleCount: number;
        maximumMeshTriangleCount: number;
      };
    };
    expect(report.geometry.triangleCount).toBeLessThan(100_000);
    expect(report.geometry.maximumMeshTriangleCount).toBeLessThan(10_000);
  });

  it("records direct scene authorship and rejects imported hero sources", () => {
    const report = readFileSync(reportPath, "utf8");
    expect(report).toContain('"sources": []');
    expect(report).toContain("scene-authored deterministic geometry");
    expect(report).toContain("QRHbwRQLhM7Zn9LyYHOd");
    expect(report).toContain("gME4uHJawz9dtTlirRl8");
    expect(report).toContain("5otAzYdNg5Wp5E27mgfo");
    expect(report).toContain("nu73zqvPJRxio4T2sWz7");
    expect(report).not.toContain("Meshy");
    expect(report).not.toContain("generated/ember-rift-buttress");
    expect(report).not.toContain("static/models/ocean");
    expect(report).not.toContain("basalt_pinnacle");
  });

  it("uses one shared volcanic-world contract for the static channel and runtime river", () => {
    const world = JSON.parse(
      readFileSync(volcanicWorldContractPath, "utf8")
    ) as {
      lavaRiver: {
        pointsRuntimeXZHeight: [number, number, number][];
      };
      terrain: { runtimeZRange: [number, number] };
    };
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      contract: {
        lavaRiverControlPointsRuntimeXZHeight: [number, number, number][];
      };
      geometry: { volcanicBasinCount: number; lavaChannelLeveeCount: number };
    };
    const config = createDefaultEmberConfig();

    expect(config.lavaRivers?.channels[0]?.points).toEqual(
      world.lavaRiver.pointsRuntimeXZHeight
    );
    expect(report.contract.lavaRiverControlPointsRuntimeXZHeight).toEqual(
      world.lavaRiver.pointsRuntimeXZHeight
    );
    expect(report.geometry.volcanicBasinCount).toBe(1);
    expect(report.geometry.lavaChannelLeveeCount).toBe(2);
    expect(world.terrain.runtimeZRange[1]).toBeGreaterThanOrEqual(130);

    const mouth = world.lavaRiver.pointsRuntimeXZHeight.at(-1)!;
    expect(
      Math.hypot(mouth[0], mouth[1]) - config.lavaRivers!.width / 2
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
  });
});

describe("Ember integrated-room contracts", () => {
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

  it("keeps the Ember review performer front-stage toward the audience camera", () => {
    const workbenchSource = readFileSync(
      resolve("src/routes/test/viewer-3d/Viewer3DWorkbench.svelte"),
      "utf8"
    );
    expect(workbenchSource).toContain(
      "facingAngle: VIEWER_FRONT_STAGE_FACING_ANGLE"
    );

    const line = createFormationFromPreset("line", 4);
    for (const slot of line.slots) {
      expect(resolveViewerFormationFacingAngle(slot, line, Number.NaN)).toBe(
        VIEWER_FRONT_STAGE_FACING_ANGLE
      );
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

  it("keeps the visibility revision above the darkness regression floor", () => {
    const config = createDefaultEmberConfig();
    expect(config.fog.density).toBeLessThanOrEqual(0.007);
    expect(config.hemisphereLight.intensity).toBeGreaterThanOrEqual(1);
    expect(config.skyLight?.intensity).toBeGreaterThanOrEqual(1.5);
  });
});
