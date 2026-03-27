import { describe, it, expect } from "vitest";
import { JunctionOverlapDetector } from "../../../src/lib/features/conjoined-grid/services/implementations/JunctionOverlapDetector";
import { TOPOLOGY_PRESETS } from "../../../src/lib/shared/multi-grid/domain/constants/TopologyPresets";
import type { PropPlacement } from "../../../src/lib/features/conjoined-grid/domain/types";

function buildTopology(presetId: string) {
  const preset = TOPOLOGY_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Preset "${presetId}" not found`);
  return preset.build();
}

describe("JunctionOverlapDetector", () => {
  const detector = new JunctionOverlapDetector();

  describe("2-grid diamond topology", () => {
    const topology = buildTopology("2-row-diamond");

    it("detects overlap when both props occupy the same junction", () => {
      // In 2-row-diamond, grid A's east is conjoined with grid B's center.
      // The junction refs are { gridId: "a", location: "e" } and { gridId: "b", location: "c" }.
      // Blue on A's east, red on B's center = both at the junction.
      const placement: PropPlacement = {
        blue: { gridId: "a", location: "e" },
        red: { gridId: "b", location: "c" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].distance).toBe(0);
      expect(overlaps[0].blueRef).toEqual(placement.blue);
      expect(overlaps[0].redRef).toEqual(placement.red);
    });

    it("detects overlap when refs are reversed (red on A, blue on B)", () => {
      const placement: PropPlacement = {
        blue: { gridId: "b", location: "c" },
        red: { gridId: "a", location: "e" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].distance).toBe(0);
    });

    it("returns empty when props are not at junction points", () => {
      const placement: PropPlacement = {
        blue: { gridId: "a", location: "n" },
        red: { gridId: "b", location: "s" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(0);
    });

    it("returns empty when only one prop is at the junction", () => {
      const placement: PropPlacement = {
        blue: { gridId: "a", location: "e" },
        red: { gridId: "b", location: "s" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(0);
    });
  });

  describe("3-grid diamond chain topology", () => {
    const topology = buildTopology("3-row-diamond");

    it("has multiple junctions in a 3-grid chain", () => {
      // A 3-grid diamond chain produces junctions wherever grid points overlap.
      // The exact count depends on geometry, but there must be at least 2
      // (one at each A-B and B-C boundary).
      expect(topology.junctions.length).toBeGreaterThanOrEqual(2);
    });

    it("detects overlap at the first junction (A-B boundary)", () => {
      // In a 3-chain, g0's east conjoins with g1's center (first junction).
      const placement: PropPlacement = {
        blue: { gridId: "g0", location: "e" },
        red: { gridId: "g1", location: "c" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(1);
    });

    it("detects overlap at the second junction (B-C boundary)", () => {
      // g1's east conjoins with g2's center (second junction).
      const placement: PropPlacement = {
        blue: { gridId: "g1", location: "e" },
        red: { gridId: "g2", location: "c" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(1);
    });

    it("returns empty when props are at different junctions", () => {
      // Blue at first junction, red at second — no single junction has both.
      const placement: PropPlacement = {
        blue: { gridId: "g0", location: "e" },
        red: { gridId: "g2", location: "c" },
      };

      const overlaps = detector.detectOverlaps(topology, placement);

      expect(overlaps).toHaveLength(0);
    });
  });
});
