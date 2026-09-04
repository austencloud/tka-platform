import { PropType } from "@austencloud/scene-3d";
import { Euler, Group, Quaternion } from "three";
import { describe, expect, it } from "vitest";
import {
  WORKER_PERFORMER_PROP_TYPES,
  type WorkerPerformerSnapshot,
  type WorkerPropSnapshot,
} from "$lib/shared/3d/worker-renderer/domain/worker-renderer-protocol";
import { supportsWorkerPerformer } from "$lib/shared/3d/worker-renderer/services/worker-performer-snapshot";
import { createWorkerPerformerProp } from "$lib/shared/3d/worker-renderer/worlds/worker-performer";

const STATE: WorkerPropSnapshot = {
  centerPathAngle: 0.25,
  staffRotationAngle: 0.5,
  plane: "wall",
  worldPosition: [1, 2, 3],
  worldRotation: [0, 0, 0, 1],
  gripType: "square",
};

function snapshot(
  propType: WorkerPerformerSnapshot["leftPropType"] = "staff"
): WorkerPerformerSnapshot {
  return {
    id: "prop-test",
    avatarId: "x-bot",
    position: [0, 0, 0],
    facingAngle: 0,
    avatarHeightCm: 190.5,
    groundY: -1.5,
    staffLength: 0.86,
    staffThickness: 0.0125,
    leftPropType: propType,
    rightPropType: propType,
    leftProp: STATE,
    rightProp: STATE,
    stanceYaw: 0,
    stanceSegments: null,
    spinePitchOffset: 0,
  };
}

describe("worker performer prop geometry", () => {
  it("enumerates the complete canonical worker-safe prop surface", () => {
    expect(WORKER_PERFORMER_PROP_TYPES).toEqual([
      PropType.STAFF,
      PropType.SIMPLESTAFF,
      PropType.STAFF2,
      PropType.BIGSTAFF,
      PropType.HAND,
    ]);

    for (const propType of WORKER_PERFORMER_PROP_TYPES) {
      expect(
        supportsWorkerPerformer({
          leftPropType: propType,
          rightPropType: propType,
        }),
        propType
      ).toBe(true);
    }
  });

  it("rejects every production prop without a worker-safe canonical factory", () => {
    const supported = new Set<string>(WORKER_PERFORMER_PROP_TYPES);
    const unsupported = Object.values(PropType).filter(
      (propType) => !supported.has(propType)
    );

    expect(unsupported.length).toBeGreaterThan(0);
    for (const propType of unsupported) {
      expect(
        supportsWorkerPerformer({
          leftPropType: propType,
          rightPropType: PropType.STAFF,
        }),
        `left ${propType}`
      ).toBe(false);
      expect(
        supportsWorkerPerformer({
          leftPropType: PropType.STAFF,
          rightPropType: propType,
        }),
        `right ${propType}`
      ).toBe(false);
    }
  });

  it.each(WORKER_PERFORMER_PROP_TYPES.filter((type) => type !== "hand"))(
    "routes %s through the canonical staff object",
    (propType) => {
      const prop = createWorkerPerformerProp("left", snapshot(propType));

      expect(prop.visual?.root.name).toBe("staff-blue");
      expect(
        prop.correction.getObjectByName("staff-rotated-body")
      ).toBeTruthy();
      expect(prop.correction.getObjectByName("staff-thumb-end")).toBeTruthy();
      expect(
        prop.correction.getObjectByName("staff-trail-indicator")
      ).toBeTruthy();
      expect(prop.anchor.position.toArray()).toEqual([1, 2, 3]);

      prop.dispose();
      expect(prop.anchor.children).toHaveLength(0);
    }
  );

  it("keeps bare hands in the IK path without mounting a prop mesh", () => {
    const prop = createWorkerPerformerProp("right", snapshot("hand"));

    expect(prop.visual).toBeNull();
    expect(prop.correction.children).toHaveLength(0);
    expect(prop.anchor.visible).toBe(true);
    expect(prop.anchor.position.toArray()).toEqual([1, 2, 3]);

    prop.setSnapshot(null);
    expect(prop.anchor.visible).toBe(false);
  });

  it("preserves the canonical rotation composition and red-hand palette", () => {
    const prop = createWorkerPerformerProp("right", snapshot());
    const rotation = new Quaternion().setFromEuler(new Euler(0.2, -0.3, 0.4));
    prop.setSnapshot({ ...STATE, worldRotation: rotation.toArray() });

    expect(prop.visual?.root.name).toBe("staff-red");
    const body = prop.correction.getObjectByName("staff-rotated-body");
    const expected = rotation
      .clone()
      .multiply(new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2)));
    expect(body?.quaternion.angleTo(expected)).toBeCloseTo(0, 8);
  });

  it("rejects an invalid snapshot at the renderer boundary", () => {
    const invalid = {
      ...snapshot(),
      leftPropType: PropType.FAN,
    } as unknown as WorkerPerformerSnapshot;

    expect(() => createWorkerPerformerProp("left", invalid)).toThrow(
      "does not yet own exact fan geometry"
    );
  });

  it("detaches the canonical prop graph during disposal", () => {
    const parent = new Group();
    const prop = createWorkerPerformerProp("left", snapshot());
    parent.add(prop.anchor);

    prop.dispose();

    expect(prop.anchor.parent).toBeNull();
    expect(parent.children).toHaveLength(0);
    expect(prop.anchor.children).toHaveLength(0);
  });
});
