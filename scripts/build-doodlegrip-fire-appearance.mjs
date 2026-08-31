import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCE = resolve(
  ROOT,
  "scripts/assets/doodlegrip-fire-reference.json"
);
const BARE_OUTPUT = resolve(
  ROOT,
  "static/images/props/appearances/fan-fire.svg"
);
const COVERED_OUTPUT = resolve(
  ROOT,
  "static/images/props/appearances/fan-fire-covered.svg"
);

const DISPLAY_PIVOT = [130, 103.5];
const DISPLAY_SCALE = { across: 417.3, along: 469.4 };
const WICK_LENGTH = 0.0381;
const WICK_RADIUS = 0.0135;
const FRAME_COLOR = "#2E3192";
const WICK_COLOR = "#f5e6b8";
const WICK_BAND_COLOR = "#6d4b2a";
const COVER_COLOR = "#df255f";
const COVER_SEAM_COLOR = "#760f30";

function format(value) {
  return Number(value.toFixed(4)).toString();
}

function add([ax, ay], [bx, by]) {
  return [ax + bx, ay + by];
}

function subtract([ax, ay], [bx, by]) {
  return [ax - bx, ay - by];
}

function multiply([x, y], scalar) {
  return [x * scalar, y * scalar];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return length === 0 ? [0, 1] : multiply(vector, 1 / length);
}

function displayPoint([across, along]) {
  return [
    DISPLAY_PIVOT[0] + along * DISPLAY_SCALE.along,
    DISPLAY_PIVOT[1] + across * DISPLAY_SCALE.across,
  ];
}

function point([x, y]) {
  return `${format(x)} ${format(y)}`;
}

function physicalPath(points) {
  return points.map(displayPoint);
}

function polylinePath(points) {
  return points
    .map((value, index) => `${index === 0 ? "M" : "L"} ${point(value)}`)
    .join(" ");
}

function cubicPath(start, controlA, controlB, end) {
  return `M ${point(displayPoint(start))} C ${point(
    displayPoint(controlA)
  )} ${point(displayPoint(controlB))} ${point(displayPoint(end))}`;
}

function circleArc(radius, centerAlong, startAngle, endAngle, segments = 72) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = startAngle + ((endAngle - startAngle) * index) / segments;
    return [Math.cos(angle) * radius, centerAlong + Math.sin(angle) * radius];
  });
}

function ellipseArc(radiusAcross, radiusAlong, centerAlong, segments = 48) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (Math.PI * index) / segments;
    return [
      Math.cos(angle) * radiusAcross,
      centerAlong + Math.sin(angle) * radiusAlong,
    ];
  });
}

function catmullRom(points, segmentsPerSpan = 8) {
  const output = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step < segmentsPerSpan; step += 1) {
      const t = step / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      output.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  output.push(points.at(-1));
  return output;
}

function wickSvg(center, direction, index) {
  const normalized = normalize(direction);
  const screenDirection = normalize([
    normalized[1] * DISPLAY_SCALE.along,
    normalized[0] * DISPLAY_SCALE.across,
  ]);
  const screenNormal = [-screenDirection[1], screenDirection[0]];
  const screenCenter = displayPoint(center);
  const length =
    WICK_LENGTH *
    Math.hypot(
      normalized[1] * DISPLAY_SCALE.along,
      normalized[0] * DISPLAY_SCALE.across
    );
  const diameter =
    WICK_RADIUS *
    2 *
    Math.hypot(
      normalized[0] * DISPLAY_SCALE.along,
      normalized[1] * DISPLAY_SCALE.across
    );
  const rotation =
    (Math.atan2(screenDirection[1], screenDirection[0]) * 180) / Math.PI;
  const bands = [-0.012, 0, 0.012]
    .map((offset, bandIndex) => {
      const bandCenter = add(
        screenCenter,
        multiply(screenDirection, (offset / WICK_LENGTH) * length)
      );
      const half = multiply(screenNormal, diameter * 0.5);
      return `    <path data-fire-wick-wrap="${index}-${bandIndex + 1}" d="M ${point(
        subtract(bandCenter, half)
      )} L ${point(add(bandCenter, half))}"/>`;
    })
    .join("\n");
  return `  <g data-fire-wick="${index}" fill="${WICK_COLOR}" stroke="${WICK_BAND_COLOR}" stroke-width="1.2" stroke-linecap="round">
    <rect x="${format(-length / 2)}" y="${format(
      -diameter / 2
    )}" width="${format(length)}" height="${format(
      diameter
    )}" rx="${format(diameter / 2)}" transform="translate(${point(
      screenCenter
    )}) rotate(${format(rotation)})"/>
${bands}
  </g>`;
}

function coverSvg(geometry) {
  const [outerWickAcross, outerWickAlong] = geometry.outer_wick_center;
  const [diagonalWickAcross, diagonalWickAlong] = geometry.diagonal_wick_center;
  const centerWickTop = geometry.center_wick_center_y + WICK_LENGTH / 2;
  const coverEdgeAcross = outerWickAcross + WICK_LENGTH / 2;
  const outer = ellipseArc(
    coverEdgeAcross + 0.0022,
    centerWickTop - outerWickAlong,
    outerWickAlong
  );
  const seamClearance = 0.0022;
  const wickClearance = 0.0138 + seamClearance;
  const innerEdgeAlong = outerWickAlong - wickClearance;
  const inner = catmullRom([
    [coverEdgeAcross + seamClearance, innerEdgeAlong],
    [outerWickAcross, innerEdgeAlong],
    [diagonalWickAcross, diagonalWickAlong - wickClearance],
    [0, geometry.center_wick_center_y - WICK_LENGTH / 2 - seamClearance],
    [-diagonalWickAcross, diagonalWickAlong - wickClearance],
    [-outerWickAcross, innerEdgeAlong],
    [-coverEdgeAcross - seamClearance, innerEdgeAlong],
  ]);
  const outerDisplay = physicalPath(outer);
  const innerDisplay = physicalPath(inner);
  const face = polylinePath([...outerDisplay, ...innerDisplay.toReversed()]);
  return `  <g data-fan-cover="" fill="${COVER_COLOR}" stroke="${COVER_SEAM_COLOR}" stroke-linecap="round" stroke-linejoin="round">
    <path data-fan-cover-face="" d="${face} Z" stroke-width="1.2"/>
    <path data-fan-cover-outer-seam="" d="${polylinePath(
      outerDisplay
    )}" fill="none" stroke-width="2"/>
    <path data-fan-cover-inner-seam="" d="${polylinePath(
      innerDisplay
    )}" fill="none" stroke-width="2"/>
  </g>`;
}

function frameGeometry(geometry) {
  const shellTop = geometry.handle_shell_top;
  const shellLower = geometry.handle_shell_lower;
  const shellBottom = geometry.handle_shell_bottom;
  const shellVerticalSpan = shellTop[1] - shellBottom[1];
  const shellCenterAlong =
    (shellTop[0] ** 2 + shellTop[1] ** 2 - shellBottom[1] ** 2) /
    (2 * shellVerticalSpan);
  const shellRadius = shellCenterAlong - shellBottom[1];
  const shellLeftAngle = Math.atan2(
    shellTop[1] - shellCenterAlong,
    shellTop[0]
  );
  const shellRightAngle = Math.atan2(
    shellTop[1] - shellCenterAlong,
    -shellTop[0]
  );

  const [outerAcross, outerAlong] = geometry.outer_wick_center;
  const [diagonalAcross, diagonalAlong] = geometry.diagonal_wick_center;
  const tips = [
    [-outerAcross, outerAlong],
    [-diagonalAcross, diagonalAlong],
    [0, geometry.center_wick_center_y],
    [diagonalAcross, diagonalAlong],
    [outerAcross, outerAlong],
  ];
  const roots = [
    [-0.021, 0.01],
    [-0.011, 0.02],
    [0, 0.0214],
    [0.011, 0.02],
    [0.021, 0.01],
  ];
  const firstControlA = [-0.033, 0.016];
  const firstControlB = [-0.047, 0.027];
  const secondControlA = [
    shellTop[0] + (shellTop[0] - firstControlB[0]),
    shellTop[1] + (shellTop[1] - firstControlB[1]),
  ];
  const secondControlB = [-0.165, outerAlong];
  const outerDirection = normalize(subtract(tips[0], secondControlB));
  const directions = [
    outerDirection,
    normalize(subtract(tips[1], roots[1])),
    normalize(subtract(tips[2], roots[2])),
    normalize(subtract(tips[3], roots[3])),
    [-outerDirection[0], outerDirection[1]],
  ];

  const leftOuterPath = `${cubicPath(
    roots[0],
    firstControlA,
    firstControlB,
    shellTop
  )} C ${point(displayPoint(secondControlA))} ${point(
    displayPoint(secondControlB)
  )} ${point(displayPoint(add(tips[0], multiply(outerDirection, 0.008))))}`;
  const mirror = ([x, y]) => [-x, y];
  const rightOuterPath = `${cubicPath(
    roots[4],
    mirror(firstControlA),
    mirror(firstControlB),
    mirror(shellTop)
  )} C ${point(displayPoint(mirror(secondControlA)))} ${point(
    displayPoint(mirror(secondControlB))
  )} ${point(displayPoint(add(tips[4], multiply(directions[4], 0.008))))}`;

  const bridgeAcross = Math.sqrt(
    Math.max(0, shellRadius ** 2 - (shellLower[1] - shellCenterAlong) ** 2)
  );
  const bridges = [
    [
      [-0.0155, -0.014],
      [-bridgeAcross, shellLower[1]],
    ],
    [[0, -0.0214], shellBottom],
    [
      [0.0155, -0.014],
      [bridgeAcross, shellLower[1]],
    ],
  ];
  const diagonalCrossAcross = 0.0676;
  const webbing = [
    [tips[0], tips[4]],
    [tips[2], [-diagonalCrossAcross, outerAlong], tips[1], [0, outerAlong]],
    [tips[2], [diagonalCrossAcross, outerAlong], tips[3], [0, outerAlong]],
  ];

  return {
    tips,
    directions,
    shellPath: circleArc(
      shellRadius,
      shellCenterAlong,
      shellLeftAngle,
      Math.PI * 2 + shellRightAngle
    ),
    bridges,
    leftOuterPath,
    rightOuterPath,
    innerSpines: [1, 2, 3].map((index) => [
      roots[index],
      add(tips[index], multiply(directions[index], 0.008)),
    ]),
    webbing,
  };
}

function buildSvg(reference, covered) {
  const geometry = reference.geometry_m;
  const frame = frameGeometry(geometry);
  const wicks = frame.tips
    .map((center, index) => wickSvg(center, frame.directions[index], index + 1))
    .join("\n");
  const bridges = frame.bridges
    .map(
      (points, index) =>
        `    <path data-fire-grip-bridge="${index + 1}" d="${polylinePath(
          physicalPath(points)
        )}"/>`
    )
    .join("\n");
  const spines = frame.innerSpines
    .map(
      (points, index) =>
        `    <path data-fire-spine="${index + 2}" d="${polylinePath(
          physicalPath(points)
        )}"/>`
    )
    .join("\n");
  const webbingNames = ["WickHorizon", "UpperLeftStar", "UpperRightStar"];
  const webbing = frame.webbing
    .map(
      (points, index) =>
        `    <path data-fire-webbing="${webbingNames[index]}" d="${polylinePath(
          physicalPath(points)
        )}"/>`
    )
    .join("\n");
  const ringRadiusX =
    (reference.calibration.ring_inside_diameter_m / 2) * DISPLAY_SCALE.along;
  const ringRadiusY =
    (reference.calibration.ring_inside_diameter_m / 2) * DISPLAY_SCALE.across;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 207" data-generated-from="scripts/assets/doodlegrip-fire-reference.json" data-source-version="${reference.version}" data-fan-cover-state="${covered ? "covered" : "bare"}">
  <title>DoodleGrip five-wick fire fan${covered ? " with fitted cover" : ""}</title>
  <desc>Generated from the same measured physical geometry as the 3D fan model.</desc>
  <g data-fan-frame="" fill="none" stroke="${FRAME_COLOR}" stroke-linecap="round" stroke-linejoin="round">
    <ellipse data-fire-grip-ring="" cx="${DISPLAY_PIVOT[0]}" cy="${DISPLAY_PIVOT[1]}" rx="${format(ringRadiusX)}" ry="${format(ringRadiusY)}" stroke-width="3"/>
    <path data-fire-grip-shell="" d="${polylinePath(
      physicalPath(frame.shellPath)
    )}" stroke-width="2.6"/>
${bridges}
    <path data-fire-rail="left" d="${frame.leftOuterPath}" stroke-width="2.6"/>
${spines}
    <path data-fire-rail="right" d="${frame.rightOuterPath}" stroke-width="2.6"/>
${webbing}
  </g>
${wicks}
${covered ? coverSvg(geometry) : ""}
</svg>
`;
}

export async function buildDoodlegripFireAppearance() {
  const reference = JSON.parse(await readFile(REFERENCE, "utf8"));
  if (
    reference.published_dimensions_m[0] !== 0.4826 ||
    reference.published_dimensions_m[1] !== 0.3302
  ) {
    throw new Error("DoodleGrip reference no longer matches 19 × 13 inches");
  }
  const bare = buildSvg(reference, false);
  const covered = buildSvg(reference, true);
  await Promise.all([
    writeFile(BARE_OUTPUT, bare, "utf8"),
    writeFile(COVERED_OUTPUT, covered, "utf8"),
  ]);
  return { bare, covered };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildDoodlegripFireAppearance();
  console.log(`Generated ${BARE_OUTPUT}`);
  console.log(`Generated ${COVERED_OUTPUT}`);
}
