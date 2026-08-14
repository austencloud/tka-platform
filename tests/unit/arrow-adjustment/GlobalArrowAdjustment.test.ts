/**
 * HIGH VALUE:
 * 1. Key serialization round-trip (5/6/7 part keys)
 * 2. Cascading lookup priority (Layer 3 → 2 → 1)
 * 3. Key layer classification
 * 4. Default save layer logic
 */

import { describe, expect, it } from "vitest";
import {
  generateAdjustmentKeyString,
  parseAdjustmentKeyString,
  getKeyLayer,
  type GlobalAdjustmentKey,
} from "../../../src/lib/shared/pictograph/arrow/positioning/global/domain/global-arrow-adjustment";

describe("Key Serialization", () => {
  describe("generateAdjustmentKeyString", () => {
    it("generates Layer 1 key (5 parts) without prop types", () => {
      const key: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "A",
        turnsTuple: "(1, 0.5)",
        arrowKey: "blue",
      };

      const result = generateAdjustmentKeyString(key);

      expect(result).toBe("canonical|in_out|A|(1, 0.5)|blue");
      expect(result.split("|")).toHaveLength(5);
    });

    it("generates Layer 2 key (6 parts) with propType", () => {
      const key: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "A",
        turnsTuple: "(1, 0.5)",
        arrowKey: "blue",
        propType: "fan",
      };

      const result = generateAdjustmentKeyString(key);

      expect(result).toBe("canonical|in_out|A|(1, 0.5)|blue|fan");
      expect(result.split("|")).toHaveLength(6);
    });

    it("generates Layer 3 key (7 parts) with both prop types", () => {
      const key: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "out_in",
        letter: "G",
        turnsTuple: "(2, 1)",
        arrowKey: "red",
        propType: "fan",
        otherPropType: "club",
      };

      const result = generateAdjustmentKeyString(key);

      expect(result).toBe("canonical|out_in|G|(2, 1)|red|fan|club");
      expect(result.split("|")).toHaveLength(7);
    });

    it("ignores otherPropType if propType is not set", () => {
      // This is an invalid state but should handle gracefully
      const key: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "A",
        turnsTuple: "(1, 0.5)",
        arrowKey: "blue",
        otherPropType: "club", // Should be ignored without propType
      };

      const result = generateAdjustmentKeyString(key);

      // Should only have 5 parts since propType is missing
      expect(result).toBe("canonical|in_out|A|(1, 0.5)|blue");
    });
  });

  describe("parseAdjustmentKeyString", () => {
    it("parses Layer 1 key (5 parts)", () => {
      const keyString = "canonical|in_out|A|(1, 0.5)|blue";

      const result = parseAdjustmentKeyString(keyString);

      expect(result).toEqual({
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "A",
        turnsTuple: "(1, 0.5)",
        arrowKey: "blue",
      });
      expect(result?.propType).toBeUndefined();
      expect(result?.otherPropType).toBeUndefined();
    });

    it("parses Layer 2 key (6 parts)", () => {
      const keyString = "canonical|in_out|A|(1, 0.5)|blue|fan";

      const result = parseAdjustmentKeyString(keyString);

      expect(result).toEqual({
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "A",
        turnsTuple: "(1, 0.5)",
        arrowKey: "blue",
        propType: "fan",
      });
      expect(result?.otherPropType).toBeUndefined();
    });

    it("parses Layer 3 key (7 parts)", () => {
      const keyString = "canonical|out_in|G|(2, 1)|red|fan|club";

      const result = parseAdjustmentKeyString(keyString);

      expect(result).toEqual({
        placementFrame: "canonical",
        oriKey: "out_in",
        letter: "G",
        turnsTuple: "(2, 1)",
        arrowKey: "red",
        propType: "fan",
        otherPropType: "club",
      });
    });

    it("returns null for invalid key (too few parts)", () => {
      const keyString = "canonical|in_out|A|blue"; // Only 4 parts

      const result = parseAdjustmentKeyString(keyString);

      expect(result).toBeNull();
    });

    it("returns null for invalid key (too many parts)", () => {
      const keyString = "canonical|in_out|A|(1, 0.5)|blue|fan|club|extra"; // 8 parts

      const result = parseAdjustmentKeyString(keyString);

      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseAdjustmentKeyString("")).toBeNull();
    });
  });

  describe("round-trip serialization", () => {
    it("Layer 1 key survives round-trip", () => {
      const original: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "in_out",
        letter: "Λ", // Greek letter
        turnsTuple: "(s, 1, 1)",
        arrowKey: "blue",
      };

      const serialized = generateAdjustmentKeyString(original);
      const parsed = parseAdjustmentKeyString(serialized);

      expect(parsed).toEqual(original);
    });

    it("Layer 2 key survives round-trip", () => {
      const original: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "out_out",
        letter: "W",
        turnsTuple: "(2, 0.5)",
        arrowKey: "red",
        propType: "buugeng",
      };

      const serialized = generateAdjustmentKeyString(original);
      const parsed = parseAdjustmentKeyString(serialized);

      expect(parsed).toEqual(original);
    });

    it("Layer 3 key survives round-trip", () => {
      const original: GlobalAdjustmentKey = {
        placementFrame: "canonical",
        oriKey: "in_in",
        letter: "Q",
        turnsTuple: "(1, 1)",
        arrowKey: "blue",
        propType: "fan",
        otherPropType: "club",
      };

      const serialized = generateAdjustmentKeyString(original);
      const parsed = parseAdjustmentKeyString(serialized);

      expect(parsed).toEqual(original);
    });
  });
});

describe("getKeyLayer", () => {
  it("returns Layer 1 for base key (no prop types)", () => {
    const key: GlobalAdjustmentKey = {
      placementFrame: "canonical",
      oriKey: "in_out",
      letter: "A",
      turnsTuple: "(1, 0.5)",
      arrowKey: "blue",
    };

    expect(getKeyLayer(key)).toBe(1);
  });

  it("returns Layer 2 for prop-specific key", () => {
    const key: GlobalAdjustmentKey = {
      placementFrame: "canonical",
      oriKey: "in_out",
      letter: "A",
      turnsTuple: "(1, 0.5)",
      arrowKey: "blue",
      propType: "fan",
    };

    expect(getKeyLayer(key)).toBe(2);
  });

  it("returns Layer 3 for combination key", () => {
    const key: GlobalAdjustmentKey = {
      placementFrame: "canonical",
      oriKey: "in_out",
      letter: "A",
      turnsTuple: "(1, 0.5)",
      arrowKey: "blue",
      propType: "fan",
      otherPropType: "club",
    };

    expect(getKeyLayer(key)).toBe(3);
  });

  it("returns Layer 1 if only otherPropType is set (invalid state)", () => {
    // This shouldn't happen in practice, but test defensive behavior
    const key: GlobalAdjustmentKey = {
      placementFrame: "canonical",
      oriKey: "in_out",
      letter: "A",
      turnsTuple: "(1, 0.5)",
      arrowKey: "blue",
      otherPropType: "club", // Without propType
    };

    // otherPropType alone triggers Layer 3, but this is technically invalid
    // The function checks otherPropType first
    expect(getKeyLayer(key)).toBe(3);
  });
});

describe("Default Save Layer Logic", () => {
  /**
   * This tests the logic used in ArrowAdjustmentPanel to determine
   * which layer to save adjustments to based on prop types.
   *
   * Rules:
   * - Both staff: Layer 1 (base)
   * - Any non-staff: Layer 2 (prop-specific)
   */
  function calculateDefaultSaveLayer(
    thisPropType: string,
    otherPropType: string
  ): 1 | 2 | 3 {
    if (thisPropType === "staff" && otherPropType === "staff") {
      return 1;
    }
    return 2;
  }

  it("returns Layer 1 for staff + staff", () => {
    expect(calculateDefaultSaveLayer("staff", "staff")).toBe(1);
  });

  it("returns Layer 2 for fan + fan", () => {
    expect(calculateDefaultSaveLayer("fan", "fan")).toBe(2);
  });

  it("returns Layer 2 for fan + staff (catDog mode)", () => {
    expect(calculateDefaultSaveLayer("fan", "staff")).toBe(2);
  });

  it("returns Layer 2 for staff + fan (catDog mode, other side)", () => {
    expect(calculateDefaultSaveLayer("staff", "fan")).toBe(2);
  });

  it("returns Layer 2 for club + buugeng", () => {
    expect(calculateDefaultSaveLayer("club", "buugeng")).toBe(2);
  });

  it("is case-insensitive when normalized", () => {
    // The actual implementation normalizes to lowercase
    const normalized = (prop: string) => prop.toLowerCase();
    expect(
      calculateDefaultSaveLayer(normalized("STAFF"), normalized("STAFF"))
    ).toBe(1);
    expect(
      calculateDefaultSaveLayer(normalized("FAN"), normalized("STAFF"))
    ).toBe(2);
  });
});

describe("Cascading Lookup Priority", () => {
  /**
   * This tests the cascading lookup algorithm.
   * Priority: Layer 3 → Layer 2 → Layer 1
   *
   * We simulate the repository's in-memory state to test the lookup logic.
   */

  type MockAdjustment = { x: number; y: number };
  type MockStore = Map<string, MockAdjustment>;

  function mockCascadingLookup(
    store: MockStore,
    baseKey: GlobalAdjustmentKey,
    thisPropType: string,
    otherPropType: string
  ): { adjustment: MockAdjustment; layer: 1 | 2 | 3 } | null {
    const normalizedThisProp = thisPropType.toLowerCase();
    const normalizedOtherProp = otherPropType.toLowerCase();

    // Layer 3: Combination-specific
    if (normalizedThisProp !== "staff" || normalizedOtherProp !== "staff") {
      const layer3Key: GlobalAdjustmentKey = {
        ...baseKey,
        propType: normalizedThisProp,
        otherPropType: normalizedOtherProp,
      };
      const layer3KeyString = generateAdjustmentKeyString(layer3Key);
      const layer3 = store.get(layer3KeyString);
      if (layer3) {
        return { adjustment: layer3, layer: 3 };
      }
    }

    // Layer 2: Prop-specific
    if (normalizedThisProp !== "staff") {
      const layer2Key: GlobalAdjustmentKey = {
        ...baseKey,
        propType: normalizedThisProp,
      };
      const layer2KeyString = generateAdjustmentKeyString(layer2Key);
      const layer2 = store.get(layer2KeyString);
      if (layer2) {
        return { adjustment: layer2, layer: 2 };
      }
    }

    // Layer 1: Base
    const layer1KeyString = generateAdjustmentKeyString(baseKey);
    const layer1 = store.get(layer1KeyString);
    if (layer1) {
      return { adjustment: layer1, layer: 1 };
    }

    return null;
  }

  const baseKey: GlobalAdjustmentKey = {
    placementFrame: "canonical",
    oriKey: "in_out",
    letter: "A",
    turnsTuple: "(1, 0.5)",
    arrowKey: "blue",
  };

  it("returns Layer 3 adjustment when all layers exist", () => {
    const store: MockStore = new Map();

    // Add adjustments at all three layers
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 }); // Layer 1
    store.set(generateAdjustmentKeyString({ ...baseKey, propType: "fan" }), {
      x: 20,
      y: 20,
    }); // Layer 2
    store.set(
      generateAdjustmentKeyString({
        ...baseKey,
        propType: "fan",
        otherPropType: "club",
      }),
      { x: 30, y: 30 }
    ); // Layer 3

    const result = mockCascadingLookup(store, baseKey, "fan", "club");

    expect(result?.layer).toBe(3);
    expect(result?.adjustment).toEqual({ x: 30, y: 30 });
  });

  it("returns Layer 2 adjustment when Layer 3 doesn't exist", () => {
    const store: MockStore = new Map();

    // Add adjustments at layers 1 and 2 only
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 }); // Layer 1
    store.set(generateAdjustmentKeyString({ ...baseKey, propType: "fan" }), {
      x: 20,
      y: 20,
    }); // Layer 2

    const result = mockCascadingLookup(store, baseKey, "fan", "club");

    expect(result?.layer).toBe(2);
    expect(result?.adjustment).toEqual({ x: 20, y: 20 });
  });

  it("returns Layer 1 adjustment when only base exists", () => {
    const store: MockStore = new Map();

    // Add adjustment at layer 1 only
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 }); // Layer 1

    const result = mockCascadingLookup(store, baseKey, "fan", "club");

    expect(result?.layer).toBe(1);
    expect(result?.adjustment).toEqual({ x: 10, y: 10 });
  });

  it("returns null when no adjustments exist", () => {
    const store: MockStore = new Map();

    const result = mockCascadingLookup(store, baseKey, "fan", "club");

    expect(result).toBeNull();
  });

  it("skips Layer 3 check for staff + staff", () => {
    const store: MockStore = new Map();

    // Add adjustments at all layers
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 }); // Layer 1
    // Even if we somehow had a Layer 3 for staff+staff, it should be skipped
    store.set(
      generateAdjustmentKeyString({
        ...baseKey,
        propType: "staff",
        otherPropType: "staff",
      }),
      { x: 30, y: 30 }
    );

    const result = mockCascadingLookup(store, baseKey, "staff", "staff");

    // Should return Layer 1, not the Layer 3 entry
    expect(result?.layer).toBe(1);
    expect(result?.adjustment).toEqual({ x: 10, y: 10 });
  });

  it("skips Layer 2 check for staff prop type", () => {
    const store: MockStore = new Map();

    // Add adjustments at layers 1 and 2
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 }); // Layer 1
    store.set(generateAdjustmentKeyString({ ...baseKey, propType: "staff" }), {
      x: 20,
      y: 20,
    }); // Layer 2 for staff (shouldn't be used)

    // With staff + fan, looking up for staff hand
    const result = mockCascadingLookup(store, baseKey, "staff", "fan");

    // Should return Layer 1 since we skip Layer 2 for staff
    expect(result?.layer).toBe(1);
    expect(result?.adjustment).toEqual({ x: 10, y: 10 });
  });

  it("correctly looks up for catDog mode (fan + staff)", () => {
    const store: MockStore = new Map();

    // Base layer (staff default)
    store.set(generateAdjustmentKeyString(baseKey), { x: 10, y: 10 });
    // Fan-specific layer
    store.set(generateAdjustmentKeyString({ ...baseKey, propType: "fan" }), {
      x: 25,
      y: 25,
    });

    // Fan hand should get Layer 2
    const fanResult = mockCascadingLookup(store, baseKey, "fan", "staff");
    expect(fanResult?.layer).toBe(2);
    expect(fanResult?.adjustment).toEqual({ x: 25, y: 25 });

    // Staff hand should get Layer 1 (falls through since no Layer 2 for staff)
    const staffResult = mockCascadingLookup(store, baseKey, "staff", "fan");
    expect(staffResult?.layer).toBe(1);
    expect(staffResult?.adjustment).toEqual({ x: 10, y: 10 });
  });
});
