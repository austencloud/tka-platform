#!/usr/bin/env node
/** Bake the Forest floor's repeating detail and macro ecology into one map. */

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const SOURCE = resolve("static/textures/forest-floor/diffuse.jpg");
const OUTPUT = resolve("static/textures/forest-floor/forest-floor-zoned.jpg");
const PATH_LAYOUT_PATH = resolve("scripts/forest-path-layout.json");
const PATH_PLAN_OUTPUT = resolve(
  process.env.TEMP ?? ".",
  "tka-forest-evidence/forest_environment_path_plan.png"
);
const pathLayout = JSON.parse(await readFile(PATH_LAYOUT_PATH, "utf8"));
const SIZE = 4096;
const MACRO_SIZE = 512;
const WORLD_EXTENT = 200;
const DETAIL_METRES = 5.2;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function zoneNoise(x, y) {
  return (
    0.54 * Math.sin(x * 0.057 + y * 0.031) +
    0.31 * Math.cos(x * 0.029 - y * 0.063) +
    0.15 * Math.sin((x + y) * 0.101)
  );
}

function shadePattern(x, y) {
  return (
    0.62 * Math.sin(x * 0.043 - y * 0.026) +
    0.38 * Math.cos(x * 0.024 + y * 0.052)
  );
}

function ellipseMetric(x, y, [centerX, centerY, radiusX, radiusY, rotation]) {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const localX = (x - centerX) * cosine + (y - centerY) * sine;
  const localY = -(x - centerX) * sine + (y - centerY) * cosine;
  return Math.hypot(localX / radiusX, localY / radiusY);
}

function harmonicRadius(angle, definition) {
  return definition.harmonics.reduce((radius, harmonic) => {
    const phase = angle * harmonic.frequency + harmonic.phase;
    const wave =
      harmonic.function === "cos" ? Math.cos(phase) : Math.sin(phase);
    return radius + harmonic.amplitude * wave;
  }, definition.baseRadius);
}

function pointSegmentDistance(x, y, first, second) {
  const segmentX = second[0] - first[0];
  const segmentY = second[1] - first[1];
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) return Math.hypot(x - first[0], y - first[1]);
  const amount = clamp(
    ((x - first[0]) * segmentX + (y - first[1]) * segmentY) / lengthSquared
  );
  return Math.hypot(
    x - (first[0] + segmentX * amount),
    y - (first[1] + segmentY * amount)
  );
}

function distanceToPath(x, y, path) {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < path.points.length - 1; index += 1) {
    distance = Math.min(
      distance,
      pointSegmentDistance(x, y, path.points[index], path.points[index + 1])
    );
  }
  return distance;
}

function pathInfluence(x, y) {
  return Math.max(
    ...pathLayout.paths.map((path) => {
      const distance = distanceToPath(x, y, path);
      return (
        1 -
        smoothstep(
          path.halfWidth,
          path.halfWidth + path.shoulderWidth,
          distance
        )
      );
    })
  );
}

function pathCoreInfluence(x, y) {
  return Math.max(
    ...pathLayout.paths.map((path) => {
      const distance = distanceToPath(x, y, path);
      return 1 - smoothstep(path.halfWidth * 0.42, path.halfWidth, distance);
    })
  );
}

const DAMP_HOLLOWS = [
  [-58, 34, 23, 14, -0.28],
  [56, 47, 27, 16, 0.42],
  [73, -43, 24, 15, -0.62],
  [-66, -58, 31, 17, 0.24],
];

function mixColor(first, second, weight) {
  const amount = clamp(weight);
  return first.map(
    (channel, index) => channel + (second[index] - channel) * amount
  );
}

function macroTint(x, y) {
  const radius = Math.hypot(x, y);
  const noise = zoneNoise(x, y);
  const leaf = [1.02, 1.01, 0.93];
  const moss = [0.82, 1.08, 0.76];
  const damp = [0.77, 0.88, 0.88];
  const distant = [0.82, 0.91, 0.81];
  const pathShoulder = [1.09, 0.86, 0.61];
  const pathCore = [1.28, 1.05, 0.76];
  const packed = [1.08, 0.91, 0.76];
  const shadeWeight = smoothstep(0.04, 0.76, shadePattern(x, y) + noise * 0.24);
  const dampWeight = Math.max(
    ...DAMP_HOLLOWS.map(
      (hollow) => 1 - smoothstep(0.72, 1.36, ellipseMetric(x, y, hollow))
    )
  );
  const distantWeight = smoothstep(106 + noise * 7, 142 + noise * 9, radius);
  const pathWeight = pathInfluence(x, y);
  const pathCoreWeight = pathCoreInfluence(x, y);
  const edgeRadius = harmonicRadius(Math.atan2(y, x), pathLayout.clearingEdge);
  const packedWeight = 1 - smoothstep(edgeRadius - 2, edgeRadius + 2, radius);

  let color = mixColor(leaf, moss, shadeWeight * 0.72);
  color = mixColor(color, damp, dampWeight * 0.82);
  color = mixColor(color, distant, distantWeight * 0.78);
  color = mixColor(color, packed, packedWeight);
  color = mixColor(color, pathShoulder, pathWeight * 0.92);
  color = mixColor(color, pathCore, pathCoreWeight * 0.78);
  const brightness = 0.99 + 0.035 * Math.sin(x * 0.083 + y * 0.047);
  return color.map((channel) => channel * brightness);
}

function fract(value) {
  return value - Math.floor(value);
}

const tileSize = Math.max(
  32,
  Math.round((SIZE * DETAIL_METRES) / (WORLD_EXTENT * 2))
);
const { data: tile, info } = await sharp(SOURCE)
  .resize(tileSize, tileSize, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const output = Buffer.allocUnsafe(SIZE * SIZE * 3);

for (let pixelY = 0; pixelY < SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < SIZE; pixelX += 1) {
    const worldX = -WORLD_EXTENT + (pixelX / (SIZE - 1)) * WORLD_EXTENT * 2;
    const warpedX =
      worldX +
      0.78 * Math.sin(worldY * 0.031) +
      0.32 * Math.cos((worldX + worldY) * 0.057);
    const warpedY =
      worldY +
      0.71 * Math.cos(worldX * 0.029) -
      0.29 * Math.sin((worldX - worldY) * 0.061);
    const sourceX = Math.min(
      info.width - 1,
      Math.floor(fract(warpedX / DETAIL_METRES) * info.width)
    );
    const sourceY = Math.min(
      info.height - 1,
      Math.floor((1 - fract(warpedY / DETAIL_METRES)) * info.height)
    );
    const sourceIndex = (sourceY * info.width + sourceX) * info.channels;
    const outputIndex = (pixelY * SIZE + pixelX) * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      output[outputIndex + channel] = tile[sourceIndex + channel];
    }
  }
}

const macro = Buffer.allocUnsafe(MACRO_SIZE * MACRO_SIZE * 3);
for (let pixelY = 0; pixelY < MACRO_SIZE; pixelY += 1) {
  const worldY = WORLD_EXTENT - (pixelY / (MACRO_SIZE - 1)) * WORLD_EXTENT * 2;
  for (let pixelX = 0; pixelX < MACRO_SIZE; pixelX += 1) {
    const worldX =
      -WORLD_EXTENT + (pixelX / (MACRO_SIZE - 1)) * WORLD_EXTENT * 2;
    const tint = macroTint(worldX, worldY);
    const index = (pixelY * MACRO_SIZE + pixelX) * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      macro[index + channel] = Math.round(clamp(tint[channel]) * 255);
    }
  }
}

const macroLayer = await sharp(macro, {
  raw: { width: MACRO_SIZE, height: MACRO_SIZE, channels: 3 },
})
  .resize(SIZE, SIZE, { kernel: sharp.kernel.cubic })
  .png()
  .toBuffer();

await mkdir(dirname(OUTPUT), { recursive: true });
await sharp(output, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .composite([{ input: macroLayer, blend: "multiply" }])
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(OUTPUT);

function planPoint([x, y]) {
  const scale = 2.05;
  return [520 + x * scale, 400 - y * scale];
}

function polyline(points) {
  return points
    .map((point) =>
      planPoint(point)
        .map((value) => value.toFixed(1))
        .join(",")
    )
    .join(" ");
}

const boundaryPoints = Array.from({ length: 193 }, (_, index) => {
  const angle = (index / 192) * Math.PI * 2;
  const radius = harmonicRadius(angle, pathLayout.worldBoundary);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
});
const pathMarkup = pathLayout.paths
  .map((path) => {
    const points = polyline(path.points);
    const shoulderWidth = (path.halfWidth + path.shoulderWidth) * 4.1;
    const coreWidth = path.halfWidth * 4.1;
    return `<polyline points="${points}" fill="none" stroke="#725a3f" stroke-opacity="0.45" stroke-width="${shoulderWidth}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="#d2ad78" stroke-width="${coreWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  })
  .join("");
const crossingMarkup = pathLayout.rootCrossings
  .map((crossing) => {
    const tangentLength = Math.hypot(...crossing.tangent);
    const normal = [
      -crossing.tangent[1] / tangentLength,
      crossing.tangent[0] / tangentLength,
    ];
    const first = planPoint([
      crossing.center[0] - normal[0] * crossing.halfLength,
      crossing.center[1] - normal[1] * crossing.halfLength,
    ]);
    const second = planPoint([
      crossing.center[0] + normal[0] * crossing.halfLength,
      crossing.center[1] + normal[1] * crossing.halfLength,
    ]);
    return `<line x1="${first[0]}" y1="${first[1]}" x2="${second[0]}" y2="${second[1]}" stroke="#493324" stroke-width="5" stroke-linecap="round"/>`;
  })
  .join("");
const labelMarkup = pathLayout.paths
  .map((path, index) => {
    const [x, y] = planPoint(path.labelAt);
    const anchor = path.labelAt[0] < 0 ? "end" : "start";
    const offset = anchor === "end" ? -10 : 10;
    return `<circle cx="${x}" cy="${y}" r="11" fill="#13251c" stroke="#d2ad78" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="#f5e8cf" font-size="12" font-weight="700">${index + 1}</text><text x="${x + offset}" y="${y + 27}" text-anchor="${anchor}" fill="#f5e8cf" font-size="15">${path.name}</text>`;
  })
  .join("");
const [campX, campY] = planPoint([5.5, -3.5]);
const [tentX, tentY] = planPoint([-5, -4]);
const clearingRadius = pathLayout.clearingRadius * 2.05;
const pathPlanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  <rect width="1280" height="800" fill="#07140f"/>
  <text x="50" y="52" fill="#f5e8cf" font-family="system-ui, sans-serif" font-size="28" font-weight="700">Forest Gate 3 path contract</text>
  <text x="50" y="80" fill="#9fb9aa" font-family="system-ui, sans-serif" font-size="16">Top view, metres. Generated from scripts/forest-path-layout.json</text>
  <polygon points="${polyline(boundaryPoints)}" fill="#183b27" stroke="#5d846b" stroke-width="3"/>
  <circle cx="520" cy="400" r="${clearingRadius}" fill="#756344" fill-opacity="0.72" stroke="#d7bd88" stroke-width="2" stroke-dasharray="7 7"/>
  ${pathMarkup}
  ${crossingMarkup}
  <rect x="${520 - 6.15}" y="${400 - 6.15}" width="12.3" height="12.3" fill="#d8dbe0" stroke="#ffffff" stroke-width="2"/>
  <circle cx="${campX}" cy="${campY}" r="7" fill="#ff7a24" stroke="#ffd2a0" stroke-width="2"/>
  <path d="M ${tentX - 8} ${tentY + 7} L ${tentX} ${tentY - 8} L ${tentX + 8} ${tentY + 7} Z" fill="#b9a478" stroke="#f1e4c7" stroke-width="2"/>
  ${labelMarkup}
  <g font-family="system-ui, sans-serif" transform="translate(970 140)">
    <text x="0" y="0" fill="#f5e8cf" font-size="19" font-weight="700">Site anchors</text>
    <rect x="0" y="24" width="16" height="16" fill="#d8dbe0"/><text x="28" y="38" fill="#c8d6ce" font-size="15">6 m stage</text>
    <circle cx="8" cy="67" r="7" fill="#ff7a24"/><text x="28" y="72" fill="#c8d6ce" font-size="15">Campfire</text>
    <path d="M 0 104 L 8 90 L 16 104 Z" fill="#b9a478"/><text x="28" y="103" fill="#c8d6ce" font-size="15">Tent</text>
    <line x1="0" y1="132" x2="22" y2="132" stroke="#493324" stroke-width="5"/><text x="32" y="137" fill="#c8d6ce" font-size="15">Root grade crossing</text>
    <text x="0" y="190" fill="#f5e8cf" font-size="19" font-weight="700">Read</text>
    <text x="0" y="220" fill="#c8d6ce" font-size="15">1  Stage to camp</text>
    <text x="0" y="248" fill="#c8d6ce" font-size="15">2  Southeast exit</text>
    <text x="0" y="276" fill="#c8d6ce" font-size="15">3  Northwest exit</text>
    <text x="0" y="304" fill="#c8d6ce" font-size="15">4  Woodland loop</text>
  </g>
  <g transform="translate(900 690)" font-family="system-ui, sans-serif">
    <line x1="0" y1="45" x2="0" y2="0" stroke="#f5e8cf" stroke-width="3"/>
    <path d="M -7 10 L 0 0 L 7 10" fill="none" stroke="#f5e8cf" stroke-width="3"/>
    <text x="0" y="68" text-anchor="middle" fill="#f5e8cf" font-size="16" font-weight="700">N</text>
  </g>
</svg>`;
await mkdir(dirname(PATH_PLAN_OUTPUT), { recursive: true });
await sharp(Buffer.from(pathPlanSvg)).png().toFile(PATH_PLAN_OUTPUT);

console.log(
  JSON.stringify(
    {
      output: OUTPUT,
      pathPlan: PATH_PLAN_OUTPUT,
      size: SIZE,
      macroSize: MACRO_SIZE,
      detailTilePixels: tileSize,
      worldExtent: WORLD_EXTENT,
    },
    null,
    2
  )
);
