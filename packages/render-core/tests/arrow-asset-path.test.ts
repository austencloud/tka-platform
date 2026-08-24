import { describe, expect, it } from "vitest";
import { resolveFullArrowAssetPath } from "../src/calculations/arrow-asset-path.js";

const relativeAxes = [
  ["in", "from_radial"],
  ["out", "from_radial"],
  ["clock", "from_nonradial"],
  ["counter", "from_nonradial"],
  ["clockIn", "from_interradial_clock_in"],
  ["counterOut", "from_interradial_clock_in"],
  ["clockOut", "from_interradial_clock_out"],
  ["counterIn", "from_interradial_clock_out"],
] as const;

const centerAxes = [
  ["centerN", "from_center_n"],
  ["centerNE", "from_center_ne"],
  ["centerE", "from_center_e"],
  ["centerSE", "from_center_se"],
  ["centerS", "from_center_s"],
  ["centerSW", "from_center_sw"],
  ["centerW", "from_center_w"],
  ["centerNW", "from_center_nw"],
] as const;

describe("full arrow asset paths", () => {
  it.each(["pro", "anti", "static", "dash"] as const)(
    "selects every relative quarter-turn axis for %s",
    (motionType) => {
      for (const [startOrientation, folder] of relativeAxes) {
        expect(
          resolveFullArrowAssetPath({
            motionType,
            startOrientation,
            turns: 0.25,
          })
        ).toBe(`images/arrows/${motionType}/${folder}/${motionType}_0.25.svg`);
      }
    }
  );

  it.each(["static", "dash"] as const)(
    "selects every absolute center quarter-turn axis for %s",
    (motionType) => {
      for (const [startOrientation, folder] of centerAxes) {
        expect(
          resolveFullArrowAssetPath({
            motionType,
            startOrientation,
            turns: 0.25,
          })
        ).toBe(`images/arrows/${motionType}/${folder}/${motionType}_0.25.svg`);
      }
    }
  );

  it.each(["+", "-"] as const)(
    "uses the canonical quarter glyph for skew%s instead of requesting absent art",
    (skewDirection) => {
      expect(
        resolveFullArrowAssetPath({
          motionType: "pro",
          startOrientation: "clockIn",
          turns: 0.25,
          skewSteps: 1,
          skewDirection,
        })
      ).toBe("images/arrows/pro/from_interradial_clock_in/pro_0.25.svg");
    }
  );

  it.each([
    ["CLOCKIN", "from_interradial_clock_in"],
    ["counterout", "from_interradial_clock_in"],
    ["ClockOut", "from_interradial_clock_out"],
    ["COUNTERIN", "from_interradial_clock_out"],
    ["centerne", "from_center_ne"],
    ["CENTERNW", "from_center_nw"],
  ] as const)(
    "normalizes the MCP orientation token %s before selecting %s",
    (startOrientation, folder) => {
      expect(
        resolveFullArrowAssetPath({
          motionType: startOrientation.toLowerCase().startsWith("center")
            ? "static"
            : "pro",
          startOrientation: startOrientation as never,
          turns: 0.25,
        })
      ).toContain(`/${folder}/`);
    }
  );

  it("keeps established non-quarter skew filenames unchanged", () => {
    expect(
      resolveFullArrowAssetPath({
        motionType: "anti",
        startOrientation: "clockIn",
        turns: 1,
        skewSteps: 1,
        skewDirection: "+",
      })
    ).toBe("images/arrows/anti/from_nonradial/anti_1.0_skew+.svg");
  });

  it("keeps float on its turn-invariant asset", () => {
    expect(
      resolveFullArrowAssetPath({
        motionType: "float",
        startOrientation: "clockIn",
        turns: "fl",
      })
    ).toBe("images/arrows/float.svg");
  });
});
