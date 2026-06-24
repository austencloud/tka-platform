import { describe, it, expect } from "vitest";
import { generateDefaultDocId, parseDefaultDocId } from "$lib/shared/pictograph/arrow/positioning/default-override/domain/default-arrow-placement";

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

  it("round-trips a multi-token prop (underscore in propType)", () => {
    expect(generateDefaultDocId("diamond", "simple_staff", "pro")).toBe("diamond_simple_staff_pro");
    expect(parseDefaultDocId("diamond_simple_staff_pro")).toEqual({
      gridMode: "diamond", propType: "simple_staff", motionType: "pro",
    });
    expect(parseDefaultDocId("box_staff_v2_dash")).toEqual({
      gridMode: "box", propType: "staff_v2", motionType: "dash",
    });
  });

  it("rejects malformed ids", () => {
    expect(parseDefaultDocId("diamond")).toBeNull();
  });
});
