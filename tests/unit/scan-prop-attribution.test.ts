import { describe, expect, it } from "vitest";
import { scanPropProperties } from "$lib/shared/analytics/scan-prop-attribution";

describe("scan prop attribution", () => {
  it("keeps mixed left and right props explicit", () => {
    expect(scanPropProperties("fan", "hoop")).toEqual({
      blue_prop: "fan",
      red_prop: "hoop",
      mixed_props: true,
    });
  });

  it("marks a matched pair without collapsing it to one field", () => {
    expect(scanPropProperties("staff", "staff")).toEqual({
      blue_prop: "staff",
      red_prop: "staff",
      mixed_props: false,
    });
  });
});
