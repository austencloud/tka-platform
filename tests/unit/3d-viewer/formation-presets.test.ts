import { describe, it, expect } from "vitest";
import {
  getSlotsForPreset,
  PRESET_VALID_COUNTS,
  FORMATION_PRESET_INFO,
} from "$lib/shared/3d/config/formation-presets";
import { FORMATION_WALL_OFFSET } from "$lib/shared/3d/domain/formation";
import type { FormationPreset } from "$lib/shared/3d/domain/formation";

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

    it("evenly spaces consecutive slots at least 1.5m apart on X", () => {
      const slots = getSlotsForPreset("side-by-side", 4);
      for (let i = 1; i < slots.length; i++) {
        const dx = Math.abs(slots[i]!.position.x - slots[i - 1]!.position.x);
        expect(dx).toBeGreaterThanOrEqual(1.5);
      }
    });

    it("centers the row around x=0", () => {
      const slots = getSlotsForPreset("side-by-side", 4);
      const avgX = slots.reduce((sum, s) => sum + s.position.x, 0) / slots.length;
      expect(avgX).toBeCloseTo(0, 6);
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
          const expectedLength = preset === "solo" ? 1 : fixedTwo.has(preset) ? 2 : count;
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
    it("includes entries for all six new presets", () => {
      const ids = FORMATION_PRESET_INFO.map((e) => e.id);
      expect(ids).toContain("solo");
      expect(ids).toContain("tunnel-stack");
      expect(ids).toContain("back-to-back");
      expect(ids).toContain("facing-each-other");
      expect(ids).toContain("stage-lr");
      expect(ids).toContain("side-by-side");
    });
  });
});
