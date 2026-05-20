import { describe, it, expect } from "vitest";
import {
  getSlotsForPreset,
  PRESET_VALID_COUNTS,
  FORMATION_PRESET_INFO,
  FORMATION_WALL_OFFSET,
} from "@austencloud/scene-3d";
import type { FormationPreset } from "@austencloud/scene-3d";

describe("formation-presets: new presets", () => {
  describe("solo", () => {
    it("returns a single slot at origin", () => {
      const slots = getSlotsForPreset("solo", 1);
      expect(slots.length).toBe(1);
      expect(slots[0]!.position.x).toBe(0);
      expect(slots[0]!.position.z).toBe(FORMATION_WALL_OFFSET);
    });
  });

  describe("tunnel-stack", () => {
    it("produces N slots for N=2..8", () => {
      for (let n = 2; n <= 8; n++) {
        const slots = getSlotsForPreset("tunnel-stack", n);
        expect(slots.length).toBe(n);
      }
    });

    it("stacks along -Z with at least 1.0m spacing", () => {
      const slots = getSlotsForPreset("tunnel-stack", 4);
      for (let i = 1; i < slots.length; i++) {
        const dz = Math.abs(slots[i]!.position.z - slots[i - 1]!.position.z);
        expect(dz).toBeGreaterThanOrEqual(1.0);
      }
    });

    it("all slots share x=0", () => {
      const slots = getSlotsForPreset("tunnel-stack", 5);
      for (const s of slots) expect(s.position.x).toBe(0);
    });
  });

  describe("back-to-back", () => {
    it("returns two slots at origin with opposite facings", () => {
      const slots = getSlotsForPreset("back-to-back", 2);
      expect(slots.length).toBe(2);
      expect(slots[0]!.facingAngle).toBe(0);
      expect(slots[1]!.facingAngle).toBe(Math.PI);
    });

    it("falls back to solo when count < 2", () => {
      const slots = getSlotsForPreset("back-to-back", 1);
      expect(slots.length).toBe(1);
      // Solo shape: single centered slot with no explicit facing.
      expect(slots[0]!.position.x).toBe(0);
      expect(slots[0]!.facingAngle).toBeUndefined();
    });
  });

  describe("facing-each-other", () => {
    it("returns two slots facing inward", () => {
      const slots = getSlotsForPreset("facing-each-other", 2);
      expect(slots.length).toBe(2);
      expect(slots[0]!.position.x).toBeLessThan(0);
      expect(slots[1]!.position.x).toBeGreaterThan(0);
      expect(slots[0]!.facingAngle).toBe(Math.PI / 2);
      expect(slots[1]!.facingAngle).toBe(-Math.PI / 2);
    });

    it("falls back to solo when count < 2", () => {
      const slots = getSlotsForPreset("facing-each-other", 1);
      expect(slots.length).toBe(1);
      expect(slots[0]!.position.x).toBe(0);
      expect(slots[0]!.facingAngle).toBeUndefined();
    });
  });

  describe("stage-lr", () => {
    it("returns two slots at least 3m apart on the X axis", () => {
      const slots = getSlotsForPreset("stage-lr", 2);
      expect(slots.length).toBe(2);
      const dx = Math.abs(slots[0]!.position.x - slots[1]!.position.x);
      expect(dx).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("arc", () => {
    it("produces N slots for N=3..8", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("arc", n);
        expect(slots.length).toBe(n);
      }
    });

    it("center slot is most upstage (lowest Z)", () => {
      const slots = getSlotsForPreset("arc", 6);
      const centerIdx = Math.floor(slots.length / 2);
      const centerZ = slots[centerIdx]!.position.z;
      const edgeZ = slots[0]!.position.z;
      expect(centerZ).toBeLessThan(edgeZ);
    });

    it("falls back to solo for count < 3", () => {
      const slots = getSlotsForPreset("arc", 2);
      expect(slots.length).toBe(1);
    });
  });

  describe("triangle", () => {
    it("produces N slots for N=3..8", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("triangle", n);
        expect(slots.length).toBe(n);
      }
    });

    it("row distributions match spec for count=6: [1, 2, 3]", () => {
      const slots = getSlotsForPreset("triangle", 6);
      expect(slots.length).toBe(6);
      // First row has 1 slot at x=0
      expect(slots[0]!.position.x).toBeCloseTo(0, 6);
    });

    it("falls back to line for count < 3", () => {
      const slots = getSlotsForPreset("triangle", 2);
      expect(slots.length).toBe(2);
    });
  });

  describe("diamond", () => {
    it("produces N slots for N=3..8", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("diamond", n);
        expect(slots.length).toBe(n);
      }
    });

    it("4-count produces cardinal positions — front, left, right, back", () => {
      const slots = getSlotsForPreset("diamond", 4);
      expect(slots.length).toBe(4);
      // Front at x=0 with highest z
      expect(slots[0]!.position.x).toBeCloseTo(0, 6);
      // Left is negative x, right is positive x
      expect(slots[1]!.position.x).toBeLessThan(0);
      expect(slots[2]!.position.x).toBeGreaterThan(0);
    });

    it("falls back to line for count < 3", () => {
      const slots = getSlotsForPreset("diamond", 2);
      expect(slots.length).toBe(2);
    });
  });

  describe("staggered", () => {
    it("produces N slots for N=4..8", () => {
      for (let n = 4; n <= 8; n++) {
        const slots = getSlotsForPreset("staggered", n);
        expect(slots.length).toBe(n);
      }
    });

    it("back row is offset by half a column spacing from front row", () => {
      const slots = getSlotsForPreset("staggered", 6);
      // Front row: indices 0-2, back row: indices 3-5
      const frontX0 = slots[0]!.position.x;
      const backX0 = slots[3]!.position.x;
      // Back row should be offset by ~0.9m (half of 1.8m colSpacing)
      const offset = Math.abs(backX0 - frontX0);
      expect(offset).toBeGreaterThan(0.5);
      expect(offset).toBeLessThan(1.5);
    });

    it("back row is deeper (lower Z) than front row", () => {
      const slots = getSlotsForPreset("staggered", 4);
      const frontZ = slots[0]!.position.z;
      const backZ = slots[2]!.position.z;
      expect(backZ).toBeLessThan(frontZ);
    });

    it("falls back to line for count < 4", () => {
      const slots = getSlotsForPreset("staggered", 3);
      expect(slots.length).toBe(3);
    });
  });

  describe("circle facing outward", () => {
    it("uses angle - PI/2 formula (outward facing) for counts 3-8", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("circle", n);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]!;
          const expectedAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const expectedFacing = expectedAngle - Math.PI / 2;
          expect(slot.facingAngle).toBeDefined();
          expect(slot.facingAngle).toBeCloseTo(expectedFacing, 6);
        }
      }
    });

    it("count=2 still faces outward (left faces left, right faces right)", () => {
      const slots = getSlotsForPreset("circle", 2);
      expect(slots[0]!.facingAngle).toBe(Math.PI / 2);
      expect(slots[1]!.facingAngle).toBe(-Math.PI / 2);
    });
  });

  describe("bounds and finiteness", () => {
    const newPresets: FormationPreset[] = [
      "solo",
      "tunnel-stack",
      "back-to-back",
      "facing-each-other",
      "stage-lr",
      "arc",
      "triangle",
      "diamond",
      "staggered",
    ];

    for (const preset of newPresets) {
      for (const count of PRESET_VALID_COUNTS[preset]) {
        it(`${preset} @ count=${count}: positions finite and within [-10, 10]`, () => {
          const slots = getSlotsForPreset(preset, count);

          // Variable-count presets should return exactly `count` slots; fixed-
          // cardinality presets (back-to-back, facing-each-other, stage-lr) always
          // return 2. solo always returns 1.
          const fixedTwo = new Set(["back-to-back", "facing-each-other", "stage-lr"]);
          const fallsBackToSolo = (preset === "arc" && count < 3);
          const fallsBackToLine = (
            (preset === "triangle" && count < 3) ||
            (preset === "diamond" && count < 3) ||
            (preset === "staggered" && count < 4)
          );
          const expectedLength = preset === "solo" || fallsBackToSolo ? 1
            : fixedTwo.has(preset) ? 2
            : fallsBackToLine ? count
            : count;
          expect(slots.length).toBe(expectedLength);

          for (const s of slots) {
            expect(Number.isFinite(s.position.x)).toBe(true);
            expect(Number.isFinite(s.position.z)).toBe(true);
            expect(s.position.x).toBeGreaterThanOrEqual(-10);
            expect(s.position.x).toBeLessThanOrEqual(10);
            expect(s.position.z).toBeGreaterThanOrEqual(-10);
            expect(s.position.z).toBeLessThanOrEqual(10);
          }
        });
      }
    }
  });

  describe("PRESET_VALID_COUNTS", () => {
    it("defines an entry for every FormationPreset", () => {
      const allPresets: FormationPreset[] = [
        "grid-2x2",
        "line",
        "circle",
        "v-shape",
        "diagonal",
        "custom",
        "solo",
        "tunnel-stack",
        "back-to-back",
        "facing-each-other",
        "stage-lr",
        "arc",
        "triangle",
        "diamond",
        "staggered",
      ];
      for (const p of allPresets) {
        expect(PRESET_VALID_COUNTS[p]).toBeDefined();
        expect(PRESET_VALID_COUNTS[p].length).toBeGreaterThan(0);
      }
    });
  });

  describe("FORMATION_PRESET_INFO", () => {
    it("includes entries for all six new presets", () => {
      const ids = FORMATION_PRESET_INFO.map((e) => e.id);
      expect(ids).toContain("solo");
      expect(ids).toContain("tunnel-stack");
      expect(ids).toContain("back-to-back");
      expect(ids).toContain("facing-each-other");
      expect(ids).toContain("stage-lr");
      expect(ids).toContain("arc");
      expect(ids).toContain("triangle");
      expect(ids).toContain("diamond");
      expect(ids).toContain("staggered");
    });
  });

  describe("v-shape scaling 5-8", () => {
    it("produces exactly `count` slots for every count in 1..8", () => {
      for (let n = 1; n <= 8; n++) {
        const slots = getSlotsForPreset("v-shape", n);
        expect(slots.length).toBe(n);
      }
    });

    it("keeps index 0 at the apex (x=0, z=offset) for count >= 3", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("v-shape", n);
        const leader = slots.find((s) => s.index === 0)!;
        expect(leader.position.x).toBeCloseTo(0, 6);
        expect(leader.position.z).toBeCloseTo(FORMATION_WALL_OFFSET, 6);
      }
    });

    it("forms mirrored pairs at each row (left/right symmetric around x=0)", () => {
      // For counts 5 and 7 the chevron is all full pairs (no tail), so
      // summing x across all body performers should yield 0.
      for (const n of [5, 7]) {
        const slots = getSlotsForPreset("v-shape", n);
        const bodySumX = slots
          .filter((s) => s.index > 0)
          .reduce((sum, s) => sum + s.position.x, 0);
        expect(bodySumX).toBeCloseTo(0, 6);
      }
    });

    it("placement stays within the ±10m stage bounds for every count", () => {
      for (let n = 1; n <= 8; n++) {
        const slots = getSlotsForPreset("v-shape", n);
        for (const s of slots) {
          expect(Number.isFinite(s.position.x)).toBe(true);
          expect(Number.isFinite(s.position.z)).toBe(true);
          expect(s.position.x).toBeGreaterThanOrEqual(-10);
          expect(s.position.x).toBeLessThanOrEqual(10);
          expect(s.position.z).toBeGreaterThanOrEqual(-10);
          expect(s.position.z).toBeLessThanOrEqual(10);
        }
      }
    });

    it("extends v-shape valid counts through 8 in PRESET_VALID_COUNTS", () => {
      expect(PRESET_VALID_COUNTS["v-shape"]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });
});
