import { describe, it, expect } from "vitest";
import {
  Collected3DSceneSchema,
  Scene3DSnapshotSchema,
  type Scene3DSnapshot,
} from "../scene-3d-collection-types";

const snapshot: Scene3DSnapshot = {
  version: 1,
  scene: { backgroundType: "forest", oceanVariant: "abyss" },
  camera: { position: { x: 0, y: 1, z: 5 }, target: { x: 0, y: 0, z: 0 } } as never,
  performers: [
    { position: { x: 0, z: 0 }, facingAngle: 0, customBluePlane: "wall", customRedPlane: "wall", name: null },
  ],
  selectedPerformerIndex: null,
  activeFormation: "manual",
  propSizeLinked: true,
  defaultSettings: {
    prop: "staff",
    effortId: "linear",
    planeMode: "wall",
    customBluePlane: "wall",
    customRedPlane: "wall",
  },
  visiblePlanes: ["wall"],
  showGridLabels: false,
  navMode: "orbit",
  activePreset: "behind",
  activeCameraPreset: "main",
  stageGroundOffset: 0,
  effectToggles: { fire: false, trails: true },
  sceneFeatures: { stage: true, campfire: false },
  props: { bluePropType: "staff", redPropType: "staff" },
};

describe("Scene3DSnapshotSchema", () => {
  it("accepts a well-formed snapshot", () => {
    expect(Scene3DSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("rejects a bad nav mode", () => {
    const bad = { ...snapshot, navMode: "teleport" };
    expect(Scene3DSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a wrong version", () => {
    const bad = { ...snapshot, version: 2 };
    expect(Scene3DSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe("Collected3DSceneSchema", () => {
  it("round-trips an entry with steps optional", () => {
    const entry = {
      id: "abc",
      name: "Forest stage",
      poster: "data:image/webp;base64,xxx",
      createdAt: 1234,
      snapshot,
    };
    expect(Collected3DSceneSchema.safeParse(entry).success).toBe(true);
    expect(Collected3DSceneSchema.safeParse({ ...entry, steps: [] }).success).toBe(true);
  });

  it("rejects an entry with no id", () => {
    const entry = { id: "", name: "x", poster: "", createdAt: 0, snapshot };
    expect(Collected3DSceneSchema.safeParse(entry).success).toBe(false);
  });
});
