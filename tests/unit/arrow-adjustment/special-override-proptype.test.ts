import { describe, it, expect, vi } from "vitest";

// Mock firebase/auth before importing anything that touches the firestore chain.
// SpecialArrowPlacementSchema uses firestoreDate which imports from $lib/shared/auth
// which pulls in firebase/auth → protobufjs at module-load time.
vi.mock("$lib/shared/auth/state/authState.svelte", () => ({
  authState: { effectiveUserId: null },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
}));

import {
  generateSpecialOverrideKey,
  parseSpecialOverrideKey,
  SpecialArrowPlacementSchema,
} from "$lib/shared/pictograph/arrow/positioning/special-override/domain/SpecialArrowPlacement";

describe("special override key — propType dimension", () => {
  it("includes propType as the 7th segment", () => {
    const key = generateSpecialOverrideKey({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "fan",
    });
    expect(key).toBe("box|from_layer2|P|(0, 0)|pro|red|fan");
  });

  it("parses a 7-part key back to fields", () => {
    expect(parseSpecialOverrideKey("box|from_layer2|P|(0, 0)|pro|red|fan")).toEqual({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "fan",
    });
  });

  it("parses a legacy 6-part key with propType defaulted to staff", () => {
    expect(parseSpecialOverrideKey("box|from_layer2|P|(0, 0)|pro|red")).toEqual({
      gridMode: "box", oriFolder: "from_layer2", letter: "P",
      turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red", propType: "staff",
    });
  });

  it("schema defaults a missing propType to staff", () => {
    const parsed = SpecialArrowPlacementSchema.parse({
      key: "box|from_layer2|P|(0, 0)|pro|red", gridMode: "box", oriFolder: "from_layer2",
      letter: "P", turnsTuple: "(0, 0)", motionType: "pro", attributeKey: "red",
      adjustmentX: 1, adjustmentY: 2, originalX: 0, originalY: 0,
      updatedAt: new Date().toISOString(), updatedBy: "x",
    });
    expect(parsed.propType).toBe("staff");
  });
});
