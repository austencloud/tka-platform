#!/usr/bin/env node
/**
 * Generate the CAP exhibit's SVGs from @caps/domain.
 *
 * Run after building workspace packages:
 *   pnpm --filter @caps/domain build
 *   node scripts/generate-caps-trochoids.mjs
 *
 * The public set keeps dense, full-precision paths for direct asset URLs. The
 * source-owned atlas set uses shorter paths and inline CSS so Svelte can import
 * each file with Vite's ?raw query and control its one-time draw animation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAP_MATH_MODEL,
  recommendedTrochoidSampleCount,
  resolveCAPAssembly,
  sampleResolvedCAPAssembly,
  sampleTrochoid,
} from "@caps/domain";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const PUBLIC_DIR = path.join(ROOT, "static", "caps");
const ORIGINAL_PUBLIC_DIR = path.join(PUBLIC_DIR, "original");
const ATLAS_DIR = path.join(
  ROOT,
  "src",
  "routes",
  "(public)",
  "notation",
  "caps",
  "_generated"
);
const ARCHIVE_DIR = path.join(ROOT, "docs", "research", "caps-archive");

const CURVE_COLOR = "oklch(0.68 0.015 270)";
const ACCENT_COLOR = "oklch(0.7 0.13 275)";
const ATLAS_DURATION = "3.5s";
const PADDING_FRACTION = 0.1;
const BBOX_SANITY_CEILING = 100;
const FULL_SAMPLES_PER_TURN = 900;
const FULL_MIN_SAMPLES = 1500;
const ATLAS_SAMPLES_PER_TURN = 64;
const ATLAS_MIN_SAMPLES = 220;

const ATLAS_IDS = [
  "rosette-1-4",
  "rosette-1-neg6",
  "cycloid-1-4",
  "cycloid-1-neg3",
  "yuta-cap",
  "yuta-cap-three-quarter",
  "cap-1-3-composition",
];

const ORIGINAL_JPGS = [
  "model.jpg",
  "cap-yuta-halfcycle.jpg",
  "cap-yuta-3quarter.jpg",
  "cap-1-3-composition.jpg",
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatScalar(value) {
  if (Math.abs(value - Math.round(value)) < 1e-9)
    return String(Math.round(value));
  for (const denominator of [2, 3, 4, 5, 8]) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) < 1e-9) {
      return `${numerator}/${denominator}`;
    }
  }
  return String(Number(value.toFixed(3)));
}

function notationForSegment(segment) {
  return `${formatScalar(segment.theta1)} ${formatScalar(segment.theta2)} ; ${formatScalar(segment.rho1)} ${formatScalar(segment.rho2)} ; ${formatScalar(segment.d)}`;
}

function frequencyForSegment(segment) {
  return Math.max(
    Math.abs(segment.theta1),
    Math.abs(segment.theta1 + segment.theta2),
    1
  );
}

function sampleCount(segment, mode) {
  if (mode === "atlas") {
    return Math.max(
      ATLAS_MIN_SAMPLES,
      Math.ceil(
        frequencyForSegment(segment) * segment.d * ATLAS_SAMPLES_PER_TURN
      )
    );
  }
  return Math.max(
    FULL_MIN_SAMPLES,
    recommendedTrochoidSampleCount(segment),
    Math.ceil(frequencyForSegment(segment) * segment.d * FULL_SAMPLES_PER_TURN)
  );
}

function buildCurve(definition, mode) {
  if (definition.kind === "elementary") {
    return {
      points: sampleTrochoid(
        definition.pattern,
        sampleCount(definition.pattern, mode)
      ),
      resolved: null,
    };
  }

  const resolved = resolveCAPAssembly(definition.assembly.segments);
  const sampled = sampleResolvedCAPAssembly(
    resolved,
    resolved.segments.map((segment) => sampleCount(segment, mode))
  );
  return { points: sampled.points, resolved };
}

function computeBBox(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new Error(`Non-finite point (${point.x}, ${point.y})`);
    }
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function assertSaneBBox(name, bbox) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (![bbox.minX, bbox.maxX, bbox.minY, bbox.maxY].every(Number.isFinite)) {
    throw new Error(`${name}: non-finite bounding box`);
  }
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`${name}: degenerate bounding box`);
  }
  if (width > BBOX_SANITY_CEILING || height > BBOX_SANITY_CEILING) {
    throw new Error(`${name}: implausibly large bounding box`);
  }
}

function computeViewBox(bbox) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const size = Math.max(width, height);
  const paddedSize = size * (1 + PADDING_FRACTION * 2);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  return {
    minX: centerX - paddedSize / 2,
    minY: centerY - paddedSize / 2,
    size: paddedSize,
  };
}

function buildPathData(points, precision) {
  const format = (value) => {
    const rounded = Number(value.toFixed(precision));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  };
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${format(point.x)} ${format(point.y)}`
    )
    .join(" ");
}

function viewBoxString(points, precision) {
  const bbox = computeBBox(points);
  const viewBox = computeViewBox(bbox);
  return {
    bbox,
    viewBox,
    value: `${viewBox.minX.toFixed(precision)} ${viewBox.minY.toFixed(precision)} ${viewBox.size.toFixed(precision)} ${viewBox.size.toFixed(precision)}`,
  };
}

function buildPublicSvg(definition, points) {
  const { viewBox, value } = viewBoxString(points, 4);
  const pathData = buildPathData(points, 4);
  const strokeWidth = viewBox.size * 0.012;
  const label = escapeXml(definition.label);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${value}" width="100%" height="100%" role="img" aria-label="${label}">
  <style>
    .cap-underlay { fill: none; stroke: ${CURVE_COLOR}; stroke-width: ${strokeWidth.toFixed(4)}; stroke-linecap: round; stroke-linejoin: round; opacity: .25; }
    .cap-draw { fill: none; stroke: ${ACCENT_COLOR}; stroke-width: ${strokeWidth.toFixed(4)}; stroke-linecap: round; stroke-linejoin: round; path-length: 1; stroke-dasharray: 1; stroke-dashoffset: 1; animation: cap-public-draw 12s linear infinite; }
    @keyframes cap-public-draw { to { stroke-dashoffset: 0; } }
    @media (prefers-reduced-motion: reduce) { .cap-draw { animation: none; stroke-dashoffset: 0; } }
  </style>
  <path class="cap-underlay" d="${pathData}" />
  <path class="cap-draw" d="${pathData}" pathLength="1" />
</svg>
`;
}

function buildAtlasSvg(definition, points) {
  const { viewBox, value } = viewBoxString(points, 2);
  const pathData = buildPathData(points, 2);
  const strokeWidth = viewBox.size * 0.016;
  const pathId = `cap-atlas-path-${definition.id}`;
  return `<!-- GENERATED by scripts/generate-caps-trochoids.mjs. Do not edit. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${value}" width="100%" height="100%" aria-hidden="true" focusable="false">
  <style>
    .cap-atlas-underlay { fill: none; stroke: ${CURVE_COLOR}; stroke-width: ${strokeWidth.toFixed(3)}; stroke-linecap: round; stroke-linejoin: round; opacity: .2; }
    .cap-atlas-draw { fill: none; stroke: ${ACCENT_COLOR}; stroke-width: ${strokeWidth.toFixed(3)}; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 0; }
    .pre-draw .cap-atlas-draw { animation: none; stroke-dashoffset: 1; }
    .drawing .cap-atlas-draw { animation: cap-atlas-draw ${ATLAS_DURATION} linear 1 forwards; }
    @keyframes cap-atlas-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
    @media (prefers-reduced-motion: reduce) { .cap-atlas-draw { animation: none !important; stroke-dashoffset: 0 !important; } }
  </style>
  <defs><path id="${pathId}" d="${pathData}" pathLength="1" /></defs>
  <use class="cap-atlas-underlay" href="#${pathId}" />
  <use class="cap-atlas-draw" href="#${pathId}" />
</svg>
`;
}

function definitions() {
  const elementary = CAP_MATH_MODEL.elementaryPatterns.map((pattern) => ({
    id: pattern.id,
    label: `${pattern.name}: ${notationForSegment(pattern)}`,
    kind: "elementary",
    pattern,
  }));
  const assemblies = CAP_MATH_MODEL.assemblies.map((assembly) => ({
    id: assembly.id,
    label: `${assembly.name}: ${assembly.notation}`,
    kind: "assembly",
    assembly,
  }));
  return [...elementary, ...assemblies];
}

function copyOriginals() {
  fs.mkdirSync(ORIGINAL_PUBLIC_DIR, { recursive: true });
  for (const fileName of ORIGINAL_JPGS) {
    fs.copyFileSync(
      path.join(ARCHIVE_DIR, fileName),
      path.join(ORIGINAL_PUBLIC_DIR, fileName)
    );
  }
}

function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(ATLAS_DIR, { recursive: true });

  const allDefinitions = definitions();
  if (allDefinitions.length !== 10) {
    throw new Error(
      `Expected 10 registry curves, found ${allDefinitions.length}`
    );
  }

  console.log("=== CAP exhibit SVG report ===");
  for (const definition of allDefinitions) {
    const full = buildCurve(definition, "full");
    const bbox = computeBBox(full.points);
    assertSaneBBox(definition.id, bbox);
    fs.writeFileSync(
      path.join(PUBLIC_DIR, `${definition.id}.svg`),
      buildPublicSvg(definition, full.points),
      "utf8"
    );

    if (ATLAS_IDS.includes(definition.id)) {
      const atlas = buildCurve(definition, "atlas");
      const atlasSvg = buildAtlasSvg(definition, atlas.points);
      const atlasPath = path.join(ATLAS_DIR, `${definition.id}.svg`);
      fs.writeFileSync(atlasPath, atlasSvg, "utf8");
      const bytes = Buffer.byteLength(atlasSvg);
      if (bytes > 15 * 1024) {
        throw new Error(
          `${definition.id}: atlas SVG is ${bytes} bytes, over 15KB`
        );
      }
      console.log(
        `${definition.id}: public ${full.points.length} points, atlas ${atlas.points.length} points, ${bytes} bytes`
      );
    } else {
      console.log(`${definition.id}: public ${full.points.length} points`);
    }

    if (full.resolved) {
      for (const junction of full.resolved.junctions) {
        if (junction.handGap >= 1e-9 || junction.tipGap >= 1e-9) {
          throw new Error(`${definition.id}: junction continuity failed`);
        }
      }
      if (
        full.resolved.closure.handGap >= 1e-9 ||
        full.resolved.closure.tipGap >= 1e-9
      ) {
        throw new Error(`${definition.id}: cycle closure failed`);
      }
      console.log(
        `  continuity M=${Math.max(...full.resolved.junctions.map((j) => j.handGap)).toExponential(2)} E=${Math.max(...full.resolved.junctions.map((j) => j.tipGap)).toExponential(2)} closure M=${full.resolved.closure.handGap.toExponential(2)} E=${full.resolved.closure.tipGap.toExponential(2)}`
      );
    }
  }

  const atlasFiles = fs
    .readdirSync(ATLAS_DIR)
    .filter((fileName) => fileName.endsWith(".svg"));
  const unexpected = atlasFiles.filter(
    (fileName) => !ATLAS_IDS.includes(fileName.replace(/\.svg$/, ""))
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected generated atlas files: ${unexpected.join(", ")}`
    );
  }
  const totalAtlasBytes = atlasFiles.reduce(
    (total, fileName) =>
      total + fs.statSync(path.join(ATLAS_DIR, fileName)).size,
    0
  );
  if (totalAtlasBytes > 120 * 1024) {
    throw new Error(`Atlas SVG total is ${totalAtlasBytes} bytes, over 120KB`);
  }

  copyOriginals();
  console.log(
    `Generated 10 public SVGs and 7 atlas modules (${totalAtlasBytes} bytes).`
  );
}

main();
