import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const builder = fs.readFileSync(
  path.join(process.cwd(), "scripts", "build-fan-model.py"),
  "utf8"
);
const reference = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts",
      "assets",
      "doodlegrip-fire-reference.json"
    ),
    "utf8"
  )
) as {
  isolated_upper_fan_bbox_px: Record<string, number>;
  lower_fan_excluded_below_px: number;
  pivot_px: [number, number];
  published_dimensions_m: [number, number];
  geometry_m: {
    handle_shell_top: [number, number];
    handle_shell_outermost: [number, number];
    handle_shell_bottom: [number, number];
    outer_wick_center: [number, number];
    diagonal_wick_center: [number, number];
    center_wick_center_y: number;
  };
};
const bareAppearance = fs.readFileSync(
  path.join(
    process.cwd(),
    "static",
    "images",
    "props",
    "appearances",
    "fan-fire.svg"
  ),
  "utf8"
);
const coveredAppearance = fs.readFileSync(
  path.join(
    process.cwd(),
    "static",
    "images",
    "props",
    "appearances",
    "fan-fire-covered.svg"
  ),
  "utf8"
);

describe("five-wick DoodleGrip Fire fan", () => {
  it("uses the published stock, wick, ring, and envelope measurements", () => {
    expect(builder).toContain("FIRE_WIDTH_M = 0.4826");
    expect(builder).toContain("FIRE_HEIGHT_M = 0.3302");
    expect(builder).toContain("FIRE_RING_DIAMETER_M = 0.0381");
    expect(builder).toContain("FIRE_WICK_LENGTH_M = 0.0381");
    expect(builder).toContain("FIRE_OUTER_SPINE_RADIUS_M = 0.00238125");
    expect(builder).toContain("FIRE_INNER_SPINE_RADIUS_M = 0.0015875");
  });

  it("builds one DoodleGrip shell and one curved spine per outside wick", () => {
    expect(builder).toContain('"Fan_Fire_GripShell"');
    expect(builder).toContain("shell_path = circle_arc(");
    expect(builder).toContain(
      'parent["tka_grip_shell_geometry"] = "constant-radius circle"'
    );
    expect(builder).not.toContain("add_weld_fillet");
    expect(builder).toContain('"Fan_Fire_LeftRail"');
    expect(builder).toContain('"Fan_Fire_RightRail"');
    expect(builder).not.toContain('"Fan_Fire_ControlLoop_');
    expect(builder).not.toContain('"Fan_Fire_Spine_1"');
    expect(builder).not.toContain('"Fan_Fire_Spine_5"');
  });

  it("allocates the 13-inch height and straight lattice like the product photo", () => {
    expect(builder).toContain("DOODLEGRIP_FIRE_REFERENCE");
    expect(reference.isolated_upper_fan_bbox_px).toEqual({
      left: 32,
      top: 26,
      right: 272,
      bottom: 181,
    });
    expect(reference.lower_fan_excluded_below_px).toBe(181);
    expect(reference.pivot_px).toEqual([152, 154]);
    expect(reference.published_dimensions_m).toEqual([0.4826, 0.3302]);
    expect(Math.abs(reference.geometry_m.handle_shell_bottom[1])).toBeLessThan(
      0.056
    );
    expect(
      Math.abs(reference.geometry_m.handle_shell_outermost[0]) -
        Math.abs(reference.geometry_m.handle_shell_top[0])
    ).toBeLessThanOrEqual(0.002011);
    expect(reference.geometry_m.outer_wick_center[0]).toBeCloseTo(0.2217705, 7);
    expect(reference.geometry_m.outer_wick_center[1]).toBeCloseTo(0.1065, 4);
    expect(reference.geometry_m.diagonal_wick_center[1]).toBeCloseTo(0.2088, 4);
    expect(reference.geometry_m.center_wick_center_y).toBeCloseTo(0.2536, 4);
    expect(builder).toContain("shell_path = circle_arc(");
    expect(builder).toContain("shell_to_wick = cubic_bezier_curve(");
    expect(builder).toContain('"WickHorizon"');
    expect(builder).toContain('"UpperLeftStar"');
    expect(builder).toContain('"UpperRightStar"');
    expect(builder).not.toContain('"LowerCourse"');
    expect(builder).not.toContain('"UpperCourse"');
    expect(builder).toContain(
      "cover_edge_x = outer_wick_x + FIRE_WICK_LENGTH_M / 2"
    );
    expect(builder).not.toContain("child.hide_render = True");
  });

  it("generates bare and covered 2D artwork from the same measured source", () => {
    for (const appearance of [bareAppearance, coveredAppearance]) {
      expect(appearance).toContain(
        'data-generated-from="scripts/assets/doodlegrip-fire-reference.json"'
      );
      expect(appearance).toContain(
        `data-source-version="${reference.version}"`
      );
      expect(appearance).toContain('data-fan-frame=""');
      expect(appearance).toContain('data-fire-grip-ring=""');
      expect(appearance).toContain('data-fire-grip-shell=""');
      expect(appearance.match(/data-fire-grip-bridge="\d"/g)).toHaveLength(3);
      expect(appearance.match(/data-fire-wick="\d"/g)).toHaveLength(5);
      expect(appearance.match(/data-fire-wick-wrap="\d-\d"/g)).toHaveLength(15);
      expect(appearance).toContain('data-fire-webbing="WickHorizon"');
      expect(appearance).toContain('data-fire-webbing="UpperLeftStar"');
      expect(appearance).toContain('data-fire-webbing="UpperRightStar"');
    }

    expect(bareAppearance).toContain('data-fan-cover-state="bare"');
    expect(bareAppearance).not.toContain('data-fan-cover=""');
    expect(coveredAppearance).toContain('data-fan-cover-state="covered"');
    expect(coveredAppearance).toContain('data-fan-cover=""');
    expect(coveredAppearance).toContain('data-fan-cover-face=""');
    expect(coveredAppearance).toContain('data-fan-cover-inner-seam=""');
  });
});
