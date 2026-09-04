import { beforeEach, describe, expect, it, vi } from "vitest";
import { Plane, userProportionsState } from "@austencloud/scene-3d";
import { Quaternion, Vector3 } from "three";
import type { CharacterInstanceState } from "$lib/shared/3d/state/character-instance-state.svelte";
import {
  createWorkerPerformerSnapshot,
  supportsWorkerPerformer,
} from "$lib/shared/3d/worker-renderer/services/worker-performer-snapshot";
import { CANONICAL_PERFORMER_ANCHOR_Y } from "$lib/shared/3d/environments/domain/stage-coordinate-frame";

vi.mock("$lib/shared/3d/domain/performer-upper-body-stance", () => ({
  resolvePerformerUpperBodyStance: () => ({
    yawRad: 0.25,
    pitchRad: -0.1,
    segments: { spine1Rad: 0.1, spine2Rad: 0.2, headLagRad: 0.3 },
  }),
}));

function performer(): CharacterInstanceState {
  const prop = {
    centerPathAngle: 1,
    staffRotationAngle: 2,
    plane: Plane.WALL,
    worldPosition: new Vector3(3, 4, 5),
    worldRotation: new Quaternion(0, 0, 0, 1),
    gripType: "square",
  };
  return {
    id: "p1",
    characterId: "x-bot",
    position: { x: 6, y: 99, z: 7 },
    facingAngle: 0.4,
    settings: { staffLengthCm: null },
    showLeft: true,
    showRight: false,
    leftPropState: prop,
    rightPropState: prop,
  } as unknown as CharacterInstanceState;
}

describe("worker performer snapshots", () => {
  beforeEach(() => {
    userProportionsState.reset();
  });

  it("allows only prop geometry the worker owns exactly", () => {
    expect(
      supportsWorkerPerformer({ leftPropType: "staff", rightPropType: "staff" })
    ).toBe(true);
    expect(
      supportsWorkerPerformer({ leftPropType: "fan", rightPropType: "staff" })
    ).toBe(false);
  });

  it("serializes resolved Choreo transforms without moving their ownership", () => {
    const snapshot = createWorkerPerformerSnapshot(performer(), {
      leftPropType: "staff",
      rightPropType: "staff",
      badge: {
        index: 2,
        selected: false,
        allMode: true,
        visible: true,
      },
    });

    expect(snapshot.position).toEqual([6, CANONICAL_PERFORMER_ANCHOR_Y, 7]);
    expect(snapshot.groundY).toBe(userProportionsState.groundY);
    expect(snapshot.staffLength).toBe(userProportionsState.staffLength);
    expect(snapshot.staffThickness).toBe(
      userProportionsState.dimensions.staffRadius
    );
    expect(snapshot.leftProp?.worldPosition).toEqual([3, 4, 5]);
    expect(snapshot.rightProp).toBeNull();
    expect(snapshot.stanceYaw).toBe(0.25);
    expect(snapshot.spinePitchOffset).toBe(-0.1);
    expect(snapshot.badge).toEqual({
      index: 2,
      color: expect.any(String),
      opacity: 0.6,
      selected: false,
    });
  });

  it("omits the badge when scene markers are hidden", () => {
    const snapshot = createWorkerPerformerSnapshot(performer(), {
      leftPropType: "staff",
      rightPropType: "staff",
      badge: { index: 0, selected: true, allMode: false, visible: false },
    });

    expect(snapshot.badge).toBeNull();
  });
});
