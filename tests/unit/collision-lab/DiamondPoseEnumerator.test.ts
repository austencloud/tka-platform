import { describe, it, expect } from "vitest";
import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";
import type {
  DiamondPosition,
  HandOrientation,
} from "$lib/features/lab/tabs/collision-lab/domain/types";

describe("DiamondPoseEnumerator", () => {
  const enumerator = new DiamondPoseEnumerator();

  it("enumerates exactly 192 poses", () => {
    const poses = enumerator.enumerateDiamondInOut();
    expect(poses).toHaveLength(192);
  });

  it("generates unique ids for every pose", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const ids = new Set(poses.map((p) => p.id));
    expect(ids.size).toBe(192);
  });

  it("every combination of (plane, blue, red) appears exactly once", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const planes: Plane[] = [Plane.WALL, Plane.WHEEL, Plane.FLOOR];
    const positions: DiamondPosition[] = ["N", "E", "S", "W"];
    const orientations: HandOrientation[] = ["in", "out"];

    for (const plane of planes) {
      for (const bluePos of positions) {
        for (const blueOri of orientations) {
          for (const redPos of positions) {
            for (const redOri of orientations) {
              const match = poses.filter(
                (p) =>
                  p.plane === plane &&
                  p.blueHand.position === bluePos &&
                  p.blueHand.orientation === blueOri &&
                  p.redHand.position === redPos &&
                  p.redHand.orientation === redOri
              );
              expect(match).toHaveLength(1);
            }
          }
        }
      }
    }
  });

  it("produces the same order on repeated calls (deterministic)", () => {
    const a = enumerator.enumerateDiamondInOut();
    const b = enumerator.enumerateDiamondInOut();
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it("encodes ids as {plane}-{bluePos}{blueOriFirstLetter}-{redPos}{redOriFirstLetter}", () => {
    const poses = enumerator.enumerateDiamondInOut();
    const wallNiEo = poses.find((p) => p.id === "wall-Ni-Eo");
    expect(wallNiEo).toBeDefined();
    expect(wallNiEo!.plane).toBe(Plane.WALL);
    expect(wallNiEo!.blueHand).toEqual({ position: "N", orientation: "in" });
    expect(wallNiEo!.redHand).toEqual({ position: "E", orientation: "out" });
  });

  it("first pose is wall-Ni-Ni (plane outermost loop, innermost loops at first value)", () => {
    const poses = enumerator.enumerateDiamondInOut();
    expect(poses[0].id).toBe("wall-Ni-Ni");
  });
});
