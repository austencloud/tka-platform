import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const builder = fs.readFileSync(
  path.join(root, "scripts", "build-fan-model.py"),
  "utf8"
);
const vectorReference = fs.readFileSync(
  path.join(root, "scripts", "assets", "lotus-fire-reference.svg"),
  "utf8"
);
const appearance = fs.readFileSync(
  path.join(root, "static", "images", "props", "appearances", "fan-lotus.svg"),
  "utf8"
);
const previewProvenance = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "static",
      "images",
      "props",
      "build-previews",
      "fan-lotus-bare-complete.provenance.json"
    ),
    "utf8"
  )
) as {
  referenceVersion: number;
  output: { path: string; width: number; height: number };
  sourceSha256: Record<string, string>;
};
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
  version: number;
  source_image_px: [number, number];
  fan_bbox_px: { left: number; top: number; right: number; bottom: number };
  pivot_px: [number, number];
  published_dimensions_m: [number, number];
  pixel_scale_m: [number, number];
  vector_reference: string;
  published_construction: {
    spinning_ring_inside_diameter_m: number;
    wick_length_m: number;
    frame_stock_diameter_m: number;
    grip_stock_diameter_m: number;
  };
  geometry_m: {
    finger_ring_inside_diameter_m: number;
    finger_ring_center_x: number;
    finger_ring_center_y: number;
    grip_ring_center_x: number;
    grip_ring_center_y: number;
    cradle_bottom_y: number;
    side_weld_bosses: {
      name: "Left" | "Right";
      center: [number, number, number];
      half_extents: [number, number, number];
      phase: number;
    }[];
    finger_ring_bottom_weld: {
      center: [number, number, number];
      radius: number;
    };
    wick_roll_length_m: number;
    wick_roll_lengths_m: number[];
    wick_diameters_m: number[];
    wick_tine_insertion_depth_m: number;
    wick_centers_m: [number, number][];
    wick_directions: [number, number][];
  };
  calibration: {
    method: string;
    symmetry: string;
    lower_cradle: string;
    wick_roll: string;
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
    expect(reference.geometry_m.finger_ring_inside_diameter_m).toBe(0.022);
    expect(reference.geometry_m.finger_ring_center_x).toBe(0);
    expect(reference.geometry_m.finger_ring_center_y).toBe(0.06);
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

  it("builds five complete petals from mirrored SVG paths", () => {
    const expectedPathIds = [
      "center-petal-left",
      "center-petal-right",
      "upper-outer-petal-left",
      "upper-outer-petal-right",
      "upper-inner-petal-left",
      "upper-inner-petal-right",
      "lower-outer-petal-left",
      "lower-outer-petal-right",
      "lower-inner-petal-left",
      "lower-inner-petal-right",
    ];
    const paths = new Map(
      [...vectorReference.matchAll(/<path id="([^"]+)" d="([^"]+)"\/>/g)].map(
        (match) => [match[1], match[2]]
      )
    );
    expect([...paths.keys()]).toEqual(expectedPathIds);
    expect(reference.vector_reference).toBe(
      "scripts/assets/lotus-fire-reference.svg"
    );
    expect(reference.calibration.symmetry).toContain("cubic Beziers");
    expect(reference.calibration.symmetry).toContain("reflected exactly");
    expect(reference.calibration.method).toContain(
      "Austen-authored Illustrator"
    );

    for (const leftId of expectedPathIds.filter((id) => id.endsWith("-left"))) {
      const rightId = leftId.replace(/-left$/, "-right");
      const leftNumbers = paths
        .get(leftId)
        ?.match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number);
      const rightNumbers = paths
        .get(rightId)
        ?.match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number);
      expect(rightNumbers).toHaveLength(leftNumbers?.length ?? 0);
      for (let index = 0; index < (leftNumbers?.length ?? 0); index += 2) {
        expect(rightNumbers?.[index]).toBeCloseTo(480 - leftNumbers![index], 4);
        expect(rightNumbers?.[index + 1]).toBeCloseTo(
          leftNumbers![index + 1],
          4
        );
      }
    }

    expect(builder).toContain('add_empty("Fan_Lotus", root)');
    expect(builder).toContain('parent["tka_frame_path_count"] = 10');
    expect(builder).toContain("bpy.ops.import_curve.svg");
    expect(builder).toContain("interpolate_bezier(");
    expect(builder).not.toContain("mirrored_anchor_pair(");
    expect(builder).toContain('f"Fan_Lotus_{readable_name}_Left"');
    expect(builder).toContain('f"Fan_Lotus_{readable_name}_Right"');
  });

  it("derives the 2D Lotus artwork from the same traced paths as the 3D model", () => {
    const paths = [
      ...vectorReference.matchAll(/<path id="([^"]+)" d="([^"]+)"\/>/g),
    ];
    expect(appearance).toContain(
      'data-generated-from="scripts/assets/lotus-fire-reference.svg"'
    );
    expect(appearance).toContain(`data-source-version="${reference.version}"`);
    expect(paths).toHaveLength(10);
    for (const [, id, pathData] of paths) {
      expect(appearance).toContain(`data-lotus-rail="${id}" d="${pathData}"`);
    }
    expect(appearance.match(/data-lotus-wick="\d"/g)).toHaveLength(5);
    expect(appearance).toContain('data-lotus-grip-ring=""');
    expect(appearance).toContain('data-lotus-finger-ring=""');
    expect(appearance).toContain('data-lotus-lower-cradle=""');
  });

  it("invalidates the picker preview when its measured model sources change", () => {
    expect(previewProvenance.referenceVersion).toBe(reference.version);
    expect(previewProvenance.output).toEqual({
      path: "static/images/props/build-previews/fan-lotus-bare-complete.webp",
      width: 640,
      height: 240,
    });
    for (const [source, expectedHash] of Object.entries(
      previewProvenance.sourceSha256
    )) {
      const actualHash = createHash("sha256")
        .update(fs.readFileSync(path.join(root, source)))
        .digest("hex");
      expect(actualHash, `${source} changed without recapturing Lotus`).toBe(
        expectedHash
      );
    }
  });

  it("preserves the Russian grip, finger ring, lower cradle, and woven Kevlar", () => {
    expect(reference.geometry_m.finger_ring_center_y).toBeCloseTo(0.06, 7);
    expect(reference.geometry_m.grip_ring_center_x).toBe(0);
    expect(reference.geometry_m.grip_ring_center_y).toBeCloseTo(-0.007628, 9);
    expect(reference.geometry_m.cradle_bottom_y).toBeCloseTo(-0.077796, 7);
    expect(reference.calibration.lower_cradle).toContain("lower U-shaped rail");
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
      wick_tine_insertion_depth_m: 0.01,
    });
    expect(reference.calibration.wick_mount).toContain(
      "complete Illustrator rail remains unchanged"
    );
    expect(builder).toContain(
      '"intact Illustrator SVG terminals through inward-facing end caps"'
    );
    expect(builder).toContain('rod["tka_wick_tine_neck_m"]');
    expect(builder).toContain('rod["tka_wick_tine_entry_m"]');
    expect(builder).toContain("path = list(traced_path)");
    expect(builder).toContain(
      'raise ValueError(f"{name} no longer reaches its Illustrator endpoint")'
    );
    expect(builder).toContain(
      "centerlines[left_id] = [(-x, y, z) for x, y, z in centerlines[right_id]]"
    );
    expect(builder).not.toContain("traced_path[: cut_index + 1]");
    expect(builder).toContain("neck.lerp(entry, step / 8)");
  });

  it("seats the traced rail roots on the grip and finger-ring circles", () => {
    const gripCenterlineRadius =
      reference.published_construction.spinning_ring_inside_diameter_m / 2 +
      reference.published_construction.grip_stock_diameter_m / 2;
    const fingerRingCenterlineRadius =
      reference.geometry_m.finger_ring_inside_diameter_m / 2 +
      reference.published_construction.frame_stock_diameter_m / 2;

    const rootDistance = (pathId: string, centerX: number, centerY: number) => {
      const pathData = vectorReference.match(
        new RegExp(`<path id="${pathId}" d="M ([^ ]+) ([^ ]+)`)
      );
      expect(pathData).not.toBeNull();
      const startX = (Number(pathData?.[1]) - 240) / 1000;
      const startY = (270 - Number(pathData?.[2])) / 1000;
      return Math.hypot(startX - centerX, startY - centerY);
    };

    for (const pathId of ["center-petal-left", "center-petal-right"]) {
      expect(
        rootDistance(
          pathId,
          reference.geometry_m.grip_ring_center_x,
          reference.geometry_m.grip_ring_center_y
        )
      ).toBeCloseTo(gripCenterlineRadius, 2);
    }

    for (const pathId of [
      "upper-inner-petal-left",
      "upper-inner-petal-right",
    ]) {
      expect(
        rootDistance(
          pathId,
          reference.geometry_m.finger_ring_center_x,
          reference.geometry_m.finger_ring_center_y
        )
      ).toBeCloseTo(fingerRingCenterlineRadius, 2);
    }

    expect(builder).toContain('parent["tka_rail_root_weld_count"] = 10');
    expect(builder).toContain('parent["tka_finger_ring_weld_count"] = 3');
  });

  it("keeps every wick dimension perfectly mirrored inside the photographed soft envelope", () => {
    expect(reference.geometry_m.wick_centers_m).toEqual([
      [-0.21376616, 0.085081206],
      [-0.16561295, 0.2209646],
      [0, 0.2426761],
      [0.16561295, 0.2209646],
      [0.21376616, 0.085081206],
    ]);
    expect(reference.geometry_m.wick_roll_lengths_m).toEqual([
      0.054937, 0.050414, 0.050441, 0.050414, 0.054937,
    ]);
    expect(reference.geometry_m.wick_diameters_m).toEqual([
      0.03479, 0.034468, 0.028984, 0.034468, 0.03479,
    ]);
    expect(reference.calibration.symmetry).toContain("reflected exactly");
    expect(reference.calibration.symmetry).toContain(
      "center wick locked to the symmetry axis"
    );
    expect(reference.calibration.wick_roll).toContain("reflected exactly");

    for (const [leftIndex, rightIndex] of [
      [0, 4],
      [1, 3],
    ]) {
      const [leftX, leftY] = reference.geometry_m.wick_centers_m[leftIndex];
      const [rightX, rightY] = reference.geometry_m.wick_centers_m[rightIndex];
      const [leftDirectionX, leftDirectionY] =
        reference.geometry_m.wick_directions[leftIndex];
      const [rightDirectionX, rightDirectionY] =
        reference.geometry_m.wick_directions[rightIndex];
      expect(leftX).toBe(-rightX);
      expect(leftY).toBe(rightY);
      expect(leftDirectionX + rightDirectionX).toBeCloseTo(0, 9);
      expect(leftDirectionY).toBe(rightDirectionY);
      expect(reference.geometry_m.wick_roll_lengths_m[leftIndex]).toBe(
        reference.geometry_m.wick_roll_lengths_m[rightIndex]
      );
      expect(reference.geometry_m.wick_diameters_m[leftIndex]).toBe(
        reference.geometry_m.wick_diameters_m[rightIndex]
      );
    }
    expect(reference.geometry_m.wick_centers_m[2][0]).toBe(0);
    expect(reference.geometry_m.wick_directions[2]).toEqual([0, 1]);

    const svgPaths = new Map(
      [...vectorReference.matchAll(/<path id="([^"]+)" d="([^"]+)"\/>/g)].map(
        (match) => [match[1], match[2]]
      )
    );
    const terminalPoint = (pathId: string) => {
      const numbers = svgPaths
        .get(pathId)
        ?.match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number);
      expect(numbers).toBeDefined();
      return [
        (numbers?.at(-2) ?? 240) / 1000 - 0.24,
        0.27 - (numbers?.at(-1) ?? 270) / 1000,
      ] as const;
    };
    const terminalPathPairs = [
      ["lower-outer-petal-left", "lower-inner-petal-left"],
      ["upper-outer-petal-left", "upper-inner-petal-left"],
      ["center-petal-left", "center-petal-right"],
      ["upper-inner-petal-right", "upper-outer-petal-right"],
      ["lower-inner-petal-right", "lower-outer-petal-right"],
    ] as const;
    terminalPathPairs.forEach((pathPair, index) => {
      const terminals = pathPair.map(terminalPoint);
      const [directionX, directionY] =
        reference.geometry_m.wick_directions[index];
      const wickHalf = reference.geometry_m.wick_roll_lengths_m[index] / 2;
      const [centerX, centerY] = reference.geometry_m.wick_centers_m[index];
      const baseX = centerX - directionX * wickHalf;
      const baseY = centerY - directionY * wickHalf;
      expect((terminals[0][0] + terminals[1][0]) / 2).toBeCloseTo(baseX, 7);
      expect((terminals[0][1] + terminals[1][1]) / 2).toBeCloseTo(baseY, 7);
      for (const [terminalX, terminalY] of terminals) {
        const axialOffset =
          (terminalX - baseX) * directionX + (terminalY - baseY) * directionY;
        expect(axialOffset).toBeCloseTo(0, 7);
      }
    });

    const topY =
      (reference.pivot_px[1] - reference.fan_bbox_px.top) *
      reference.pixel_scale_m[1];
    const bottomY =
      (reference.pivot_px[1] - reference.fan_bbox_px.bottom) *
      reference.pixel_scale_m[1];
    reference.geometry_m.wick_centers_m.forEach(([x, y], index) => {
      const [directionX, directionY] =
        reference.geometry_m.wick_directions[index];
      const wickHalf = reference.geometry_m.wick_roll_lengths_m[index] / 2;
      const wickRadius = reference.geometry_m.wick_diameters_m[index] / 2;
      expect(Math.hypot(directionX, directionY)).toBeCloseTo(1, 5);
      const horizontalExtent =
        Math.abs(directionX) * wickHalf + Math.abs(directionY) * wickRadius;
      const verticalExtent =
        Math.abs(directionY) * wickHalf + Math.abs(directionX) * wickRadius;
      expect(Math.abs(x) + horizontalExtent).toBeLessThan(
        reference.published_dimensions_m[0] / 2 + 0.005
      );
      expect(y + verticalExtent).toBeLessThan(topY + 0.002);
      expect(y - verticalExtent).toBeGreaterThan(bottomY - 0.002);
    });
  });

  it("builds symmetrical side welds as bosses instead of pin-head beads", () => {
    expect(reference.geometry_m.side_weld_bosses).toHaveLength(2);
    expect(
      reference.geometry_m.side_weld_bosses.map(({ name }) => name)
    ).toEqual(["Left", "Right"]);
    for (const boss of reference.geometry_m.side_weld_bosses) {
      expect(boss.half_extents[0]).toBeGreaterThan(
        reference.published_construction.grip_stock_diameter_m / 2
      );
      expect(boss.half_extents[1]).toBeGreaterThan(
        reference.published_construction.grip_stock_diameter_m / 2
      );
      expect(boss.half_extents[2]).toBeGreaterThan(
        reference.published_construction.frame_stock_diameter_m / 2
      );
    }
    expect(reference.geometry_m.side_weld_bosses[0].half_extents).toEqual(
      reference.geometry_m.side_weld_bosses[1].half_extents
    );
    expect(reference.geometry_m.side_weld_bosses[0].center[1]).toBe(
      reference.geometry_m.side_weld_bosses[1].center[1]
    );
    expect(reference.geometry_m.side_weld_bosses[0].center[0]).toBe(
      -reference.geometry_m.side_weld_bosses[1].center[0]
    );
    expect(reference.geometry_m.side_weld_bosses[0].phase).toBe(
      reference.geometry_m.side_weld_bosses[1].phase
    );
    expect(builder).toContain("add_weld_boss(");
    expect(builder).toContain("Fan_Lotus_SideWeld_");
  });

  it("keeps the finger-ring junction clear of fake crossing braces", () => {
    expect(reference.geometry_m.finger_ring_bottom_weld.radius).toBe(0.0018);
    expect(vectorReference).not.toContain("finger-triangle-brace");
    expect(builder).not.toContain("Fan_Lotus_FingerBrace_");
    expect(builder).toContain('"Fan_Lotus_FingerWeld_Lower"');
    expect(builder).not.toContain("finger_ring_weld_bosses");
  });

  it("keeps traced rail geometry owned by the vector reference", () => {
    expect(reference.geometry_m).not.toHaveProperty("left_frame_paths");
    expect(reference.geometry_m).not.toHaveProperty("right_frame_paths");
    expect(reference.geometry_m).not.toHaveProperty("center_petal_root");
  });

  it("keeps four build tiles balanced in wide and narrow picker containers", () => {
    expect(picker).toContain("--build-option-count: 4");
    expect(picker).toContain("@container (max-width: 499px)");
    expect(picker).toContain("--build-option-count: 2");
  });
});
