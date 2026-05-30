import { describe, it, expect } from "vitest";
import { generateDefaultDocId, parseDefaultDocId } from "$lib/shared/pictograph/arrow/positioning/default-override/domain/DefaultArrowPlacement";

describe("default doc id (prop-aware)", () => {
  it("encodes gridMode_propType_motionType", () => {
    expect(generateDefaultDocId("diamond", "fan", "pro")).toBe("diamond_fan_pro");
  });

  it("round-trips a 3-part id", () => {
    expect(parseDefaultDocId("diamond_fan_pro")).toEqual({
      gridMode: "diamond", propType: "fan", motionType: "pro",
    });
  });

  it("decodes a legacy 2-part id as staff", () => {
    expect(parseDefaultDocId("diamond_pro")).toEqual({
      gridMode: "diamond", propType: "staff", motionType: "pro",
    });
  });

  it("rejects malformed ids", () => {
    expect(parseDefaultDocId("diamond")).toBeNull();
  });
});
