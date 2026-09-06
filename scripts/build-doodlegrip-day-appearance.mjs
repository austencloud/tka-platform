import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  coverSvg,
  DISPLAY_PIVOT,
  DISPLAY_SCALE,
} from "./build-doodlegrip-fire-appearance.mjs";

/*
  2D artwork for the DoodleGrip practice ("Day") fan.

  The 3D build extrudes one HDPE cut sheet from the contours traced in
  doodlegrip-day-contours.json: one outside boundary and seventeen real
  cut-through openings, the last of which is the 44 mm finger ring whose
  centroid is the hand pivot. This script draws exactly those loops as one
  even-odd path, on the same pivot and physical display scale as the fire fan
  artwork, so the two DoodleGrip builds sit in the same place on the canvas.

  The practice fan is a little larger than the fire fan (510 x 350 mm against
  the fire fan's 483 x 330 mm envelope), so at the fire scale its tips and
  outer corners would fall a few pixels outside the shared 260 x 207 prop box
  and be clipped. DAY_FIT shrinks it uniformly by three percent instead.
*/

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTOURS = resolve(ROOT, "scripts/assets/doodlegrip-day-contours.json");
const FIRE_REFERENCE = resolve(
  ROOT,
  "scripts/assets/doodlegrip-fire-reference.json"
);
const OUTPUT_DIR = resolve(ROOT, "static/images/props/appearances");

const DAY_FIT = 0.97;
const VIEW_BOX = [260, 207];
const PLATE_COLOR = "#2E3192";
// The same two plate colors the 3D worker paints on TKA_Fan_Day_Frame.
const FRAME_TINTS = { black: "#11141a", white: "#f0f1f4" };
const EXPECTED_HOLES = 17;
const EXPECTED_WIDTH_M = 0.51;
const EXPECTED_HEIGHT_M = 0.35;
const EXPECTED_RING_M = 0.044;

function format(value) {
  return Number(value.toFixed(4)).toString();
}

function displayPoint([across, along]) {
  return [
    DISPLAY_PIVOT[0] + along * DISPLAY_SCALE.along * DAY_FIT,
    DISPLAY_PIVOT[1] + across * DISPLAY_SCALE.across * DAY_FIT,
  ];
}

function loopPath(points) {
  return `${points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${format(x)} ${format(y)}`)
    .join(" ")} Z`;
}

function centroid(points) {
  const sum = points.reduce(
    ([sx, sy], [x, y]) => [sx + x, sy + y],
    [0, 0]
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

function validate(trace) {
  if (trace.contour_count !== EXPECTED_HOLES + 1 || trace.holes.length !== EXPECTED_HOLES) {
    throw new Error("DoodleGrip trace must contain one outline and 17 holes");
  }
  if (trace.width_m !== EXPECTED_WIDTH_M || trace.height_m !== EXPECTED_HEIGHT_M) {
    throw new Error("DoodleGrip trace no longer matches the 510 x 350 mm build");
  }
  if (trace.ring_diameter_m !== EXPECTED_RING_M) {
    throw new Error("DoodleGrip trace no longer uses the 44 mm finger ring");
  }
  const ring = centroid(trace.holes.at(-1));
  if (Math.hypot(...ring) > 0.002) {
    throw new Error("DoodleGrip finger ring is no longer centred on the pivot");
  }
  const loops = [trace.outline, ...trace.holes];
  for (const loop of loops) {
    for (const point of loop) {
      const [x, y] = displayPoint(point);
      if (x < 0 || x > VIEW_BOX[0] || y < 0 || y > VIEW_BOX[1]) {
        throw new Error(
          `DoodleGrip plate leaves the prop box at ${format(x)} ${format(y)}`
        );
      }
    }
  }
}

function buildSvg(trace, reference, frameColor, covered) {
  const plate = [trace.outline, ...trace.holes]
    .map((loop) => loopPath(loop.map(displayPoint)))
    .join(" ");
  const tint = FRAME_TINTS[frameColor];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_BOX[0]} ${VIEW_BOX[1]}" data-generated-from="scripts/assets/doodlegrip-day-contours.json" data-fan-frame-color="${frameColor}" data-fan-cover-state="${covered ? "covered" : "bare"}">
  <title>DoodleGrip practice fan, ${frameColor} frame${covered ? " with fitted cover" : ""}</title>
  <desc>Traced from the same cut-sheet contours as the 3D fan model: one outside boundary and seventeen cut-through openings, drawn at ${DAY_FIT} of the fire fan's display scale so the larger plate stays inside the shared prop box.</desc>
  <g data-fan-frame="" fill="${PLATE_COLOR}" fill-rule="evenodd" stroke="none">
    <path data-day-plate="" d="${plate}"/>
  </g>
  <g data-fan-frame-tint="${frameColor}" fill="none" stroke="${tint}" stroke-width="1.5" stroke-linejoin="round" opacity="0.85">
    <path d="${plate}"/>
  </g>
${covered ? coverSvg(reference.geometry_m, DAY_FIT) : ""}
</svg>
`;
}

export async function buildDoodlegripDayAppearance() {
  const trace = JSON.parse(await readFile(CONTOURS, "utf8"));
  const reference = JSON.parse(await readFile(FIRE_REFERENCE, "utf8"));
  validate(trace);
  const outputs = [];
  for (const frameColor of Object.keys(FRAME_TINTS)) {
    for (const covered of [false, true]) {
      const file = resolve(
        OUTPUT_DIR,
        `fan-day-${frameColor}${covered ? "-covered" : ""}.svg`
      );
      await writeFile(file, buildSvg(trace, reference, frameColor, covered), "utf8");
      outputs.push(file);
    }
  }
  return outputs;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of await buildDoodlegripDayAppearance()) {
    console.log(`Generated ${file}`);
  }
}
