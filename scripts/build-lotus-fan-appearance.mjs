import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VECTOR_REFERENCE = resolve(
  ROOT,
  "scripts/assets/lotus-fire-reference.svg"
);
const MEASURED_REFERENCE = resolve(
  ROOT,
  "scripts/assets/lotus-fire-reference.json"
);
const OUTPUT = resolve(ROOT, "static/images/props/appearances/fan-lotus.svg");

const SOURCE_PIVOT = { x: 240, y: 270 };
const DISPLAY_PIVOT = { x: 130, y: 103.5 };
const DISPLAY_SCALE = { x: 0.4, y: 0.47 };

function format(value) {
  return Number(value.toFixed(4)).toString();
}

function svgPoint([x, y]) {
  return {
    x: SOURCE_PIVOT.x + x * 1000,
    y: SOURCE_PIVOT.y - y * 1000,
  };
}

function wickRect(center, direction, length, diameter, index) {
  const point = svgPoint(center);
  const rotation = (Math.atan2(-direction[0], -direction[1]) * 180) / Math.PI;
  return `    <rect data-lotus-wick="${index + 1}" x="${format(
    (-diameter * 1000) / 2
  )}" y="${format((-length * 1000) / 2)}" width="${format(
    diameter * 1000
  )}" height="${format(length * 1000)}" rx="6" transform="translate(${format(
    point.x
  )} ${format(point.y)}) rotate(${format(rotation)})"/>`;
}

function cradlePath(geometry) {
  const left = svgPoint(geometry.cradle_join);
  const right = svgPoint([-geometry.cradle_join[0], geometry.cradle_join[1]]);
  const joinX = Math.abs(geometry.cradle_join[0]);
  const joinY = geometry.cradle_join[1];
  const bottomY = geometry.cradle_bottom_y;
  const centerY =
    (joinX ** 2 + joinY ** 2 - bottomY ** 2) / (2 * (joinY - bottomY));
  const radius = (centerY - bottomY) * 1000;
  return `M ${format(left.x)} ${format(left.y)} A ${format(radius)} ${format(
    radius
  )} 0 1 0 ${format(right.x)} ${format(right.y)}`;
}

export async function buildLotusFanAppearance() {
  const [vectorSvg, referenceText] = await Promise.all([
    readFile(VECTOR_REFERENCE, "utf8"),
    readFile(MEASURED_REFERENCE, "utf8"),
  ]);
  const reference = JSON.parse(referenceText);
  const paths = [...vectorSvg.matchAll(/<path id="([^"]+)" d="([^"]+)"\/>/g)];
  if (paths.length !== 10) {
    throw new Error(`Expected 10 Lotus frame paths, found ${paths.length}`);
  }

  const geometry = reference.geometry_m;
  const gripRing = svgPoint([
    geometry.grip_ring_center_x,
    geometry.grip_ring_center_y,
  ]);
  const fingerRing = svgPoint([
    geometry.finger_ring_center_x,
    geometry.finger_ring_center_y,
  ]);
  const rails = paths
    .map(([, id, path]) => `    <path data-lotus-rail="${id}" d="${path}"/>`)
    .join("\n");
  const wicks = geometry.wick_centers_m
    .map((center, index) =>
      wickRect(
        center,
        geometry.wick_directions[index],
        geometry.wick_roll_lengths_m[index],
        geometry.wick_diameters_m[index],
        index
      )
    )
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 207" data-generated-from="scripts/assets/lotus-fire-reference.svg" data-source-version="${reference.version}">
  <title>Home of Poi Medium Lotus fire fan</title>
  <desc>Generated from the measured, hand-traced Lotus geometry used by the 3D fan model.</desc>
  <g data-fan-frame="" transform="translate(${DISPLAY_PIVOT.x} ${DISPLAY_PIVOT.y}) rotate(90) scale(${DISPLAY_SCALE.x} ${DISPLAY_SCALE.y}) translate(-${SOURCE_PIVOT.x} -${SOURCE_PIVOT.y})" fill="none" stroke="#2E3192" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
${rails}
    <circle data-lotus-grip-ring="" cx="${format(gripRing.x)}" cy="${format(
      gripRing.y
    )}" r="${format(reference.published_construction.spinning_ring_inside_diameter_m * 500)}" stroke-width="7"/>
    <circle data-lotus-finger-ring="" cx="${format(
      fingerRing.x
    )}" cy="${format(fingerRing.y)}" r="${format(
      geometry.finger_ring_inside_diameter_m * 500
    )}"/>
    <path data-lotus-lower-cradle="" d="${cradlePath(geometry)}"/>
  </g>
  <g data-fan-wicks="" transform="translate(${DISPLAY_PIVOT.x} ${DISPLAY_PIVOT.y}) rotate(90) scale(${DISPLAY_SCALE.x} ${DISPLAY_SCALE.y}) translate(-${SOURCE_PIVOT.x} -${SOURCE_PIVOT.y})" fill="#f5e6b8">
${wicks}
  </g>
</svg>
`;

  await writeFile(OUTPUT, svg, "utf8");
  return svg;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildLotusFanAppearance();
  console.log(`Generated ${OUTPUT}`);
}
