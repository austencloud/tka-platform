import { describe, expect, it } from "vitest";
import { buildScene3DPersistConfig } from "../../src/lib/features/scene-3d-collection/domain/scene-3d-look";
import type {
  Collected3DScene,
  Scene3DGroupId,
} from "../../src/lib/features/scene-3d-collection/domain/scene-3d-collection-types";

function makeScene(groups?: Partial<Record<Scene3DGroupId, boolean>>): Collected3DScene {
  return {
    id: "s1",
    name: "Test scene",
    poster: "",
    createdAt: Date.now(),
    snapshot: {
      version: 3,
      scene: { environmentId: "ocean", oceanVariant: "abyss" },
      camera: {
        position: { x: 0, y: 2, z: 6 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 50,
        target: { x: 0, y: 1, z: 0 },
        timestamp: 0,
      } as never,
      performers: [
        {
          position: { x: 0, z: 0 },
          facingAngle: 0,
          customLeftPlane: "wall",
          customRightPlane: "wall",
          name: null,
          settings: {
            prop: "buugeng",
            effortId: "linear",
            effect: "fire",
            staffLengthCm: null,
          },
        },
      ],
      selectedPerformerIndex: null,
      activeFormation: "circle",
      propSizeLinked: true,
      defaultSettings: {
        prop: "buugeng",
        effortId: "linear",
        planeMode: "wall",
        customLeftPlane: "wall",
        customRightPlane: "wall",
      },
      visiblePlanes: ["wall"],
      showGridLabels: false,
      navMode: "orbit",
      activePreset: null,
      activeCameraPreset: "main",
      stageGroundOffset: 0,
      effectToggles: { trails: true },
      sceneFeatures: {},
      props: { leftPropType: "buugeng", rightPropType: "buugeng" },
      ...(groups ? { groups: groups as Record<Scene3DGroupId, boolean> } : {}),
    },
  };
}

describe("buildScene3DPersistConfig", () => {
  it("maps every group when no groups mask is present (absent = all saved)", () => {
    const config = buildScene3DPersistConfig(makeScene());

    expect(config.performers).toHaveLength(1);
    expect(config.performers?.[0]?.settings?.prop).toBe("buugeng");
    // The plane fields cross an `as never` cast on the way in, and the live
    // apply feeds them straight to setHandPlane — pin the passthrough.
    expect(config.performers?.[0]?.customLeftPlane).toBe("wall");
    expect(config.performers?.[0]?.customRightPlane).toBe("wall");
    expect(config.selectedPerformerIndex).toBeNull();
    expect(config.activeFormation).toBe("circle");
    expect(config.defaultProp).toBe("buugeng");
    expect(config.effectToggles).toEqual({ trails: true });
    expect(config.environmentId).toBe("ocean");
    expect(config.oceanVariant).toBe("abyss");
    expect(config.camera).not.toBeNull();
    expect(config.navMode).toBe("orbit");
  });

  it("omits prop/effort/effect/scene/camera data when only performers is saved", () => {
    const config = buildScene3DPersistConfig(
      makeScene({
        performers: true,
        props: false,
        efforts: false,
        effects: false,
        scene: false,
        camera: false,
        performance: false,
      })
    );

    expect(config.performers).toHaveLength(1);
    // Performer position/facing still comes through — only the cascade
    // overrides (prop/effort/effect) are stripped.
    expect(config.performers?.[0]?.position).toEqual({ x: 0, z: 0 });
    expect(config.performers?.[0]?.settings?.prop).toBeNull();
    expect(config.performers?.[0]?.settings?.effortId).toBeNull();
    expect(config.performers?.[0]?.settings?.effect).toBeNull();

    expect(config.defaultProp).toBeUndefined();
    expect(config.effectToggles).toBeUndefined();
    expect(config.environmentId).toBeUndefined();
    expect(config.camera).toBeUndefined();
    expect(config.navMode).toBeUndefined();
  });

  it("omits performers entirely when the performers group is not saved", () => {
    const config = buildScene3DPersistConfig(
      makeScene({
        performers: false,
        props: true,
        efforts: true,
        effects: true,
        scene: true,
        camera: true,
        performance: true,
      })
    );

    expect(config.performers).toBeUndefined();
    expect(config.selectedPerformerIndex).toBeUndefined();
    expect(config.activeFormation).toBeUndefined();
    expect(config.defaultProp).toBe("buugeng");
    expect(config.effectToggles).toEqual({ trails: true });
    expect(config.environmentId).toBe("ocean");
    expect(config.camera).not.toBeNull();
  });
});
