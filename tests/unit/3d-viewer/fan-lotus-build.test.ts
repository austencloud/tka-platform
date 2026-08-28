import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const builder = fs.readFileSync(
  path.join(root, "scripts", "build-fan-model.py"),
  "utf8"
);
const picker = fs.readFileSync(
  path.join(
    root,
    "src",
    "lib",
    "shared",
    "3d",
    "components",
    "controls",
    "ScenePropPicker.svelte"
  ),
  "utf8"
);
const reference = JSON.parse(
  fs.readFileSync(
    path.join(root, "scripts", "assets", "lotus-fire-reference.json"),
    "utf8"
  )
) as {
  source_image_px: [number, number];
  fan_bbox_px: { left: number; top: number; right: number; bottom: number };
  pivot_px: [number, number];
  published_dimensions_m: [number, number];
  pixel_scale_m: [number, number];
  published_construction: {
    spinning_ring_inside_diameter_m: number;
    wick_length_m: number;
    frame_stock_diameter_m: number;
    grip_stock_diameter_m: number;
  };
  geometry_m: {
    finger_ring_inside_diameter_m: number;
    finger_ring_center_y: number;
    cradle_bottom_y: number;
    wick_roll_length_m: number;
    wick_tine_half_spacing_m: number;
    wick_tine_straight_length_m: number;
    wick_tine_blend_length_m: number;
    wick_tine_insertion_depth_m: number;
    outer_wick_center: [number, number];
    outer_wick_direction: [number, number];
    diagonal_wick_center: [number, number];
    center_wick_center_y: number;
    left_frame_paths: Record<string, [number, number][]>;
  };
  calibration: {
    symmetry: string;
    wick_diameter_m: number;
    wick_mount: string;
  };
};

describe("Medium Lotus five-wick fire fan", () => {
  it("keeps the published physical envelope, stock, grip, and wicks", () => {
    expect(reference.published_dimensions_m).toEqual([0.48, 0.35]);
    expect(reference.published_construction).toMatchObject({
      spinning_ring_inside_diameter_m: 0.092075,
      wick_length_m: 0.05,
      frame_stock_diameter_m: 0.004,
      grip_stock_diameter_m: 0.007,
    });
    expect(reference.geometry_m.finger_ring_inside_diameter_m).toBe(0.0155);
    expect(reference.geometry_m.wick_roll_length_m).toBe(0.05);
    expect(reference.calibration.wick_diameter_m).toBe(0.028);
    expect(builder).toContain("LOTUS_WIDTH_M = 0.48");
    expect(builder).toContain("LOTUS_HEIGHT_M = 0.35");
    expect(builder).toContain("LOTUS_RING_DIAMETER_M = 0.092075");
  });

  it("calibrates the clean product photograph to the published dimensions", () => {
    expect(reference.source_image_px).toEqual([1800, 1800]);
    expect(reference.fan_bbox_px).toEqual({
      left: 45,
      top: 310,
      right: 1769,
      bottom: 1503,
    });
    expect(reference.pivot_px).toEqual([900, 1230]);
    expect(reference.pixel_scale_m[0]).toBeCloseTo(0.48 / (1769 - 45), 12);
    expect(reference.pixel_scale_m[1]).toBeCloseTo(0.35 / (1503 - 310), 12);
  });

  it("builds five complete petals by mirroring five traced left-side paths", () => {
    expect(Object.keys(reference.geometry_m.left_frame_paths)).toEqual([
      "center_petal",
      "upper_outer_petal",
      "upper_inner_petal",
      "lower_outer_petal",
      "lower_inner_petal",
    ]);
    for (const pathPoints of Object.values(
      reference.geometry_m.left_frame_paths
    )) {
      expect(pathPoints.length).toBeGreaterThanOrEqual(5);
    }
    expect(reference.calibration.symmetry).toContain("right side mirrored");
    expect(builder).toContain('add_empty("Fan_Lotus", root)');
    expect(builder).toContain('parent["tka_frame_path_count"] = 10');
    expect(builder).toContain('f"Fan_Lotus_{readable_name}_Left"');
    expect(builder).toContain('f"Fan_Lotus_{readable_name}_Right"');
  });

  it("preserves the Russian grip, finger ring, lower cradle, and woven Kevlar", () => {
    expect(reference.geometry_m.finger_ring_center_y).toBeCloseTo(0.0675, 7);
    expect(reference.geometry_m.cradle_bottom_y).toBeCloseTo(-0.076, 7);
    expect(builder).toContain('"Fan_Lotus_GripRing"');
    expect(builder).toContain('"Fan_Lotus_FingerRing"');
    expect(builder).toContain('"Fan_Lotus_LowerCradle"');
    expect(builder).toContain('"constant-radius circle"');
    expect(builder).toContain("add_woven_cylinder_between(");
    expect(builder).toContain("write_rgba_png(");
    expect(builder).toContain('nodes.new("ShaderNodeNormalMap")');
    expect(builder).toContain('f"Fan_Lotus_Wick_{index}"');
  });

  it("seats ten parallel wire tines through the five inward-facing wick caps", () => {
    expect(reference.geometry_m).toMatchObject({
      wick_tine_half_spacing_m: 0.004,
      wick_tine_straight_length_m: 0.009,
      wick_tine_blend_length_m: 0.022,
      wick_tine_insertion_depth_m: 0.01,
    });
    expect(reference.calibration.wick_mount).toContain(
      "enter through the inward-facing end cap"
    );
    expect(builder).toContain(
      'parent["tka_wick_mount"] = "paired axial tines through inward-facing end caps"'
    );
    expect(builder).toContain('left_rod["tka_wick_tine_neck_m"]');
    expect(builder).toContain('left_rod["tka_wick_tine_entry_m"]');
    expect(builder).toContain("neck.lerp(entry, step / 8)");
  });

  it("joins the centre lotus petal to the photographed finger-ring shoulders", () => {
    const [startX, startY] =
      reference.geometry_m.left_frame_paths.center_petal[0];
    const offsetFromFingerRing = Math.hypot(
      startX,
      startY - reference.geometry_m.finger_ring_center_y
    );
    const fingerRingInnerRadius =
      reference.geometry_m.finger_ring_inside_diameter_m / 2;
    const fingerRingOuterRadius =
      fingerRingInnerRadius +
      reference.published_construction.frame_stock_diameter_m;

    expect(offsetFromFingerRing).toBeGreaterThan(fingerRingInnerRadius);
    expect(offsetFromFingerRing).toBeLessThanOrEqual(
      fingerRingOuterRadius + 0.0005
    );
  });

  it("keeps all five measured wick centres inside the published envelope", () => {
    const [outerX, outerY] = reference.geometry_m.outer_wick_center;
    const [diagonalX, diagonalY] = reference.geometry_m.diagonal_wick_center;
    expect([outerX, outerY]).toEqual([0.215, 0.098]);
    expect([diagonalX, diagonalY]).toEqual([0.168, 0.227]);
    expect(reference.geometry_m.center_wick_center_y).toBe(0.246);
    expect(
      outerX + reference.published_construction.wick_length_m / 2
    ).toBeLessThan(reference.published_dimensions_m[0] / 2 + 0.002);
  });

  it("keeps four build tiles balanced in wide and narrow picker containers", () => {
    expect(picker).toContain("--build-option-count: 4");
    expect(picker).toContain("@container (max-width: 499px)");
    expect(picker).toContain("--build-option-count: 2");
  });
});
