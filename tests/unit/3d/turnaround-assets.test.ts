import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TurnaroundMetadata {
  clipName: string;
  frameRate: number;
  frameCount: number;
  rootYaw: number[];
  rootX: number[];
  rootZ: number[];
  leftFoot: number[];
  rightFoot: number[];
}

const TURNS = resolve(process.cwd(), "static/animations/turns");

function metadata(name: string): TurnaroundMetadata {
  return JSON.parse(
    readFileSync(resolve(TURNS, `${name}.contact.json`), "utf8")
  ) as TurnaroundMetadata;
}

describe("authored turnaround assets", () => {
  for (const [name, direction] of [
    ["turn-left-180", 1],
    ["turn-right-180", -1],
  ] as const) {
    it(`${name} carries complete yaw, root, and alternating contact tracks`, () => {
      const turn = metadata(name);
      const glb = readFileSync(resolve(TURNS, `${name}.glb`));
      const tracks = [
        turn.rootYaw,
        turn.rootX,
        turn.rootZ,
        turn.leftFoot,
        turn.rightFoot,
      ];

      expect(glb.subarray(0, 4).toString("ascii")).toBe("glTF");
      expect(turn.clipName).toBe(name);
      expect(turn.frameRate).toBe(30);
      expect(turn.frameCount).toBe(50);
      for (const track of tracks) expect(track).toHaveLength(turn.frameCount);

      expect(Math.sign(turn.rootYaw.at(-1) ?? 0)).toBe(direction);
      expect(Math.abs(turn.rootYaw.at(-1) ?? 0)).toBeGreaterThan(2.75);
      expect(turn.rootX[0]).toBeCloseTo(0, 5);
      expect(turn.rootX.at(-1)).toBeCloseTo(0, 5);
      expect(turn.rootZ[0]).toBeCloseTo(0, 5);
      expect(turn.rootZ.at(-1)).toBeCloseTo(0, 5);

      const leftOnly = turn.leftFoot.some(
        (contact, index) => contact > 0.5 && turn.rightFoot[index]! < 0.5
      );
      const rightOnly = turn.rightFoot.some(
        (contact, index) => contact > 0.5 && turn.leftFoot[index]! < 0.5
      );
      expect(leftOnly).toBe(true);
      expect(rightOnly).toBe(true);
    });
  }
});
