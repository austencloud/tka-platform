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

  describe("side-by-side", () => {
    it("produces N slots for N=2..8", () => {
      for (let n = 2; n <= 8; n++) {
        const slots = getSlotsForPreset("side-by-side", n);
        expect(slots.length).toBe(n);
      }
    });
  });

  describe("circle facing center", () => {
    it("uses angle + PI/2 formula (facing center) for counts 3-8", () => {
      for (let n = 3; n <= 8; n++) {
        const slots = getSlotsForPreset("circle", n);
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]!;
          const expectedAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const expectedFacing = expectedAngle + Math.PI / 2;
          expect(slot.facingAngle).toBeDefined();
          expect(slot.facingAngle).toBeCloseTo(expectedFacing, 6);
        }
      }
    });

    it("count=2 faces inward (left faces right, right faces left)", () => {
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
      "side-by-side",
    ];

    for (const preset of newPresets) {
      for (const count of PRESET_VALID_COUNTS[preset]) {
        it(`${preset} @ count=${count}: positions finite and within [-10, 10]`, () => {
          const slots = getSlotsForPreset(preset, count);

          // Variable-count presets should return exactly `count` slots; fixed-
          // cardinality presets (back-to-back, facing-each-other, stage-lr) always
          // return 2. solo always returns 1.
          const fixedTwo = new Set(["back-to-back", "facing-each-other", "stage-lr"]);
          const expectedLength = preset === "solo" ? 1
            : fixedTwo.has(preset) ? 2
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
        "side-by-side",
      ];
      for (const p of allPresets) {
        expect(PRESET_VALID_COUNTS[p]).toBeDefined();
        expect(PRESET_VALID_COUNTS[p].length).toBeGreaterThan(0);
      }
    });
  });

  describe("FORMATION_PRESET_INFO", () => {
    it("includes entries for new presets", () => {
      const ids = FORMATION_PRESET_INFO.map((e) => e.id);
      expect(ids).toContain("solo");
      expect(ids).toContain("tunnel-stack");
      expect(ids).toContain("back-to-back");
      expect(ids).toContain("facing-each-other");
      expect(ids).toContain("stage-lr");
      expect(ids).toContain("side-by-side");
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
