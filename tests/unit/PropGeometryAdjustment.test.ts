/**
 * Prop Geometry Adjustment Tests
 *
 * Tests key generation, parsing, and cascading lookup for the
 * letter-free, prop-aware arrow adjustment tier.
 */

import { describe, it, expect } from "vitest";
import {
  generatePropGeometryKeyString,
  parsePropGeometryKeyString,
  generateCascadingKeys,
  type PropGeometryKey,
} from "../../src/lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-adjustment";

describe("PropGeometryAdjustment", () => {
  const sampleKey: PropGeometryKey = {
    placementFrame: "canonical",
    propType: "triad",
    otherPropType: "triad",
    positionType: "beta",
    endOrientation: "out",
    otherEndOrientation: "in",
    motionType: "pro",
    turns: "1",
    arrowColor: "blue",
  };

  describe("generatePropGeometryKeyString", () => {
    it("produces a 9-part pipe-separated key", () => {
      const result = generatePropGeometryKeyString(sampleKey);
      expect(result).toBe("canonical|triad|triad|beta|out|in|pro|1|blue");
    });

    it("handles wildcard values", () => {
      const wildcardKey: PropGeometryKey = {
        ...sampleKey,
        otherPropType: "*",
        arrowColor: "*",
      };
      const result = generatePropGeometryKeyString(wildcardKey);
      expect(result).toBe("canonical|triad|*|beta|out|in|pro|1|*");
    });
  });

  describe("parsePropGeometryKeyString", () => {
    it("round-trips through generate and parse", () => {
      const keyString = generatePropGeometryKeyString(sampleKey);
      const parsed = parsePropGeometryKeyString(keyString);
      expect(parsed).toEqual(sampleKey);
    });

    it("returns null for wrong number of parts", () => {
      expect(parsePropGeometryKeyString("a|b|c")).toBeNull();
      expect(parsePropGeometryKeyString("a|b|c|d|e|f|g|h|i|j")).toBeNull();
    });

    it("returns null for empty parts", () => {
      expect(parsePropGeometryKeyString("|||||||| ")).toBeNull();
    });
  });

  describe("generateCascadingKeys", () => {
    it("produces 4 keys from most to least specific", () => {
      const keys = generateCascadingKeys(sampleKey);
      expect(keys).toHaveLength(4);

      // Level 1: Full key
      expect(keys[0]).toBe("canonical|triad|triad|beta|out|in|pro|1|blue");
      // Level 2: Wildcard arrowColor
      expect(keys[1]).toBe("canonical|triad|triad|beta|out|in|pro|1|*");
      // Level 3: Wildcard otherPropType
      expect(keys[2]).toBe("canonical|triad|*|beta|out|in|pro|1|blue");
      // Level 4: Wildcard both
      expect(keys[3]).toBe("canonical|triad|*|beta|out|in|pro|1|*");
    });

    it("most specific key matches the original key string", () => {
      const keys = generateCascadingKeys(sampleKey);
      expect(keys[0]).toBe(generatePropGeometryKeyString(sampleKey));
    });
  });

  describe("cascading lookup scenarios", () => {
    // Simulate the cascading lookup that the state does
    function simulateLookup(
      stored: Map<string, { x: number; y: number }>,
      queryKey: PropGeometryKey
    ): { x: number; y: number } | null {
      const cascadingKeys = generateCascadingKeys(queryKey);
      for (const key of cascadingKeys) {
        const match = stored.get(key);
        if (match) return match;
      }
      return null;
    }

    it("finds exact match at full specificity", () => {
      const stored = new Map<string, { x: number; y: number }>();
      stored.set("canonical|triad|triad|beta|out|in|pro|1|blue", {
        x: 20,
        y: -50,
      });

      const result = simulateLookup(stored, sampleKey);
      expect(result).toEqual({ x: 20, y: -50 });
    });

    it("falls back to wildcard arrowColor when exact key missing", () => {
      const stored = new Map<string, { x: number; y: number }>();
      // Stored with wildcard arrowColor — applies to both blue and red
      stored.set("canonical|triad|triad|beta|out|in|pro|1|*", {
        x: 15,
        y: -30,
      });

      const result = simulateLookup(stored, sampleKey);
      expect(result).toEqual({ x: 15, y: -30 });
    });

    it("falls back to wildcard otherPropType", () => {
      const stored = new Map<string, { x: number; y: number }>();
      // Stored without caring about the other hand's prop type
      stored.set("canonical|triad|*|beta|out|in|pro|1|blue", {
        x: 10,
        y: -25,
      });

      const result = simulateLookup(stored, sampleKey);
      expect(result).toEqual({ x: 10, y: -25 });
    });

    it("falls back to wildcard both when nothing else matches", () => {
      const stored = new Map<string, { x: number; y: number }>();
      stored.set("canonical|triad|*|beta|out|in|pro|1|*", { x: 5, y: -10 });

      const result = simulateLookup(stored, sampleKey);
      expect(result).toEqual({ x: 5, y: -10 });
    });

    it("returns null when no match at any level", () => {
      const stored = new Map<string, { x: number; y: number }>();
      // Different prop type — shouldn't match
      stored.set("canonical|fan|fan|beta|out|in|pro|1|blue", {
        x: 20,
        y: -50,
      });

      const result = simulateLookup(stored, sampleKey);
      expect(result).toBeNull();
    });

    it("prefers more specific match over wildcard", () => {
      const stored = new Map<string, { x: number; y: number }>();
      // Both a specific and a wildcard match exist
      stored.set("canonical|triad|triad|beta|out|in|pro|1|blue", {
        x: 20,
        y: -50,
      });
      stored.set("canonical|triad|*|beta|out|in|pro|1|*", { x: 5, y: -10 });

      const result = simulateLookup(stored, sampleKey);
      // Should pick the exact match, not the wildcard
      expect(result).toEqual({ x: 20, y: -50 });
    });

    it("handles different orientation combos independently", () => {
      const stored = new Map<string, { x: number; y: number }>();
      stored.set("canonical|triad|triad|beta|out|in|pro|1|blue", {
        x: 20,
        y: -50,
      });
      stored.set("canonical|triad|triad|beta|out|out|pro|1|blue", {
        x: 30,
        y: -40,
      });

      // out|in scenario
      const result1 = simulateLookup(stored, sampleKey);
      expect(result1).toEqual({ x: 20, y: -50 });

      // out|out scenario — different adjustment
      const result2 = simulateLookup(stored, {
        ...sampleKey,
        otherEndOrientation: "out",
      });
      expect(result2).toEqual({ x: 30, y: -40 });
    });
  });
});
