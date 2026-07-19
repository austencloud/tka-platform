#!/usr/bin/env node
/**
 * Generates animated SVG trochoid curves for the /notation/caps destination.
 *
 * Curve model — Zaltymbunk's (Damien of Angers, posting as Zaltymbunk / French_Saltimbanque),
 * from the "What are CAP's?" Home of Poi thread (docs/research/caps-archive/thread-transcript.md):
 *
 *   pattern θ1 θ2 ; ρ1 ρ2 ; d
 *
 *   P(t) = ρ1·(cos 2πθ1t, sin 2πθ1t) + ρ2·(cos 2π(θ1+θ2)t, sin 2π(θ1+θ2)t),  t ∈ [0, d]
 *
 * θ1 = arm turns (frequency of the shoulder→hand vector). θ2 = prop rotation RELATIVE TO
 * THE ARM (negative θ2 = antispin). The ground-frame (audience-relative) tip frequency is
 * θ1+θ2 — that's the frequency baked into the second harmonic term above. ρ1/ρ2 are the arm
 * and prop radii (ρ=1 is a fully stretched/unwrapped member).
 *
 * Composite curves (the Yuta CAP) assemble two elementary patterns end to end. Each
 * additional segment gets two phase offsets (φ1 on the arm term, φ2 on the prop term) solved
 * so the segment's t=0 point exactly matches the previous segment's t=d point — a two-circle
 * intersection problem (both harmonics are vectors of fixed length ρ1/ρ2 that must sum to the
 * target point), solved via the law of cosines. See solveJoinPhases().
 *
 * Reference: docs/superpowers/specs/2026-07-19-notation-caps-destination-design.md
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "static", "caps");
const ORIGINAL_OUT_DIR = path.join(OUT_DIR, "original");
const ARCHIVE_DIR = path.join(ROOT, "docs", "research", "caps-archive");

// ── Colors ──────────────────────────────────────────────────────────────
// Pulled from src/lib/shared/landing/styles/public-editorial.css, the stylesheet
// governing /notation/* destination pages (the page these SVGs ship on).
//   - ACCENT_COLOR matches --accent's default (oklch(0.7 0.13 275)), used throughout that
//     sheet for .section-kicker, .bullet-list markers, .resource-chip, .cta-card border.
//   - CURVE_COLOR matches the muted lavender-grey used for secondary text
//     (.page-subtitle / .back-link land around oklch(0.62-0.68 0.01-0.02 270)) — visible
//     but recessive against the page's dark cosmic background.
const CURVE_COLOR = "oklch(0.68 0.015 270)";
const ACCENT_COLOR = "oklch(0.7 0.13 275)";

const SAMPLES_PER_UNIT = 900; // sample density; scaled per-curve by max angular frequency
const MIN_SAMPLES = 1500;
const ANIMATION_DURATION = "12s";
const PADDING_FRACTION = 0.1;
const BBOX_SANITY_CEILING = 100; // units — real curves here max out around |ρ1|+|ρ2| ≈ 2

// ── Curve model ─────────────────────────────────────────────────────────

/** P(t) for one elementary pattern, with optional join-phase offsets. */
function evalPoint({ theta1, theta2, rho1, rho2, phi1 = 0, phi2 = 0 }, t) {
  const a1 = 2 * Math.PI * theta1 * t + phi1;
  const a2 = 2 * Math.PI * (theta1 + theta2) * t + phi2;
  return {
    x: rho1 * Math.cos(a1) + rho2 * Math.cos(a2),
    y: rho1 * Math.sin(a1) + rho2 * Math.sin(a2),
  };
}

/** Dense sample of one segment over t ∈ [0, d], density scaled to its angular frequency. */
function sampleSegment(params, d) {
  const freq1 = Math.abs(params.theta1);
  const freq2 = Math.abs(params.theta1 + params.theta2);
  const maxFreq = Math.max(freq1, freq2, 1);
  const n = Math.max(MIN_SAMPLES, Math.ceil(SAMPLES_PER_UNIT * maxFreq * d));
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * d;
    pts[i] = evalPoint(params, t);
  }
  return pts;
}

/**
 * Solve φ1, φ2 such that ρ1·e^{iφ1} + ρ2·e^{iφ2} = target.
 *
 * This is the classic two-circle-intersection problem: the tip of the ρ1 vector lies on the
 * intersection of a circle of radius ρ1 centered at the origin and a circle of radius ρ2
 * centered at `target`. Solved via the law of cosines in the triangle (origin, ρ1-vector tip,
 * target). Returns the "+" branch (φ1 = ψ + angleA); the "-" branch is the other valid join.
 */
function solveJoinPhases(rho1, rho2, target) {
  const tMag = Math.hypot(target.x, target.y);
  const psi = Math.atan2(target.y, target.x);

  const lo = Math.abs(rho1 - rho2);
  const hi = rho1 + rho2;
  if (tMag < lo - 1e-9 || tMag > hi + 1e-9) {
    throw new Error(
      `solveJoinPhases: infeasible join — |target|=${tMag} outside [${lo}, ${hi}] for rho1=${rho1}, rho2=${rho2}`
    );
  }

  let cosA = (rho1 ** 2 + tMag ** 2 - rho2 ** 2) / (2 * rho1 * tMag);
  cosA = Math.min(1, Math.max(-1, cosA)); // clamp floating-point drift at the boundary
  const angleA = Math.acos(cosA);

  const phi1 = psi + angleA;
  const v1 = { x: rho1 * Math.cos(phi1), y: rho1 * Math.sin(phi1) };
  const v2 = { x: target.x - v1.x, y: target.y - v1.y };
  const phi2 = Math.atan2(v2.y, v2.x);

  return { phi1, phi2 };
}

/**
 * Builds a (possibly composite) curve from an ordered list of segment defs
 * ({theta1, theta2, rho1, rho2, d}). Segment 0 starts unphased (φ1=φ2=0); every later
 * segment's phases are solved so its start point exactly matches the previous segment's end
 * point. Throws if any join's numeric gap exceeds 1e-6.
 */
function buildCurve(segmentDefs) {
  const points = [];
  const resolvedSegments = [];
  let prevEnd = null;

  segmentDefs.forEach((def, i) => {
    let phi1 = 0;
    let phi2 = 0;
    if (i > 0) {
      ({ phi1, phi2 } = solveJoinPhases(def.rho1, def.rho2, prevEnd));
    }
    const params = { ...def, phi1, phi2 };
    const pts = sampleSegment(params, def.d);

    if (i > 0) {
      const gap = Math.hypot(pts[0].x - prevEnd.x, pts[0].y - prevEnd.y);
      if (gap > 1e-6) {
        throw new Error(
          `buildCurve: join continuity failed at segment ${i} — gap=${gap.toExponential(4)}`
        );
      }
      points.push(...pts.slice(1)); // drop duplicate join point
    } else {
      points.push(...pts);
    }

    prevEnd = pts[pts.length - 1];
    resolvedSegments.push(params);
  });

  return { points, segments: resolvedSegments };
}

// ── Geometry / SVG helpers ──────────────────────────────────────────────

function computeBBox(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error(`computeBBox: non-finite point encountered (${p.x}, ${p.y})`);
    }
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function assertSaneBBox(name, bbox) {
  const finite = [bbox.minX, bbox.maxX, bbox.minY, bbox.maxY].every(Number.isFinite);
  if (!finite) throw new Error(`${name}: non-finite bbox`);
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  if (!(w > 0) || !(h > 0)) {
    throw new Error(`${name}: degenerate bbox (w=${w}, h=${h})`);
  }
  if (w > BBOX_SANITY_CEILING || h > BBOX_SANITY_CEILING) {
    throw new Error(`${name}: implausibly large bbox (w=${w}, h=${h})`);
  }
}

/** Square viewBox = bbox's larger dimension + 10% padding on each side, centered on the bbox. */
function computeViewBox(bbox) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const size = Math.max(width, height);
  const pad = size * PADDING_FRACTION;
  const viewBoxSize = size + pad * 2;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return {
    minX: cx - viewBoxSize / 2,
    minY: cy - viewBoxSize / 2,
    size: viewBoxSize,
  };
}

function buildPathData(points, precision = 4) {
  const fmt = (n) => (Object.is(n, -0) ? "0" : n.toFixed(precision));
  const parts = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${fmt(points[i].x)} ${fmt(points[i].y)}`);
  }
  return parts.join(" ");
}

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function buildSvg({ points, ariaLabel }) {
  const bbox = computeBBox(points);
  const d = buildPathData(points);
  const len = pathLength(points);
  const viewBox = computeViewBox(bbox);
  const strokeWidth = viewBox.size * 0.012;
  const vb = `${viewBox.minX.toFixed(4)} ${viewBox.minY.toFixed(4)} ${viewBox.size.toFixed(4)} ${viewBox.size.toFixed(4)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" role="img" aria-label="${ariaLabel}">
  <style>
    .cap-underlay {
      fill: none;
      stroke: ${CURVE_COLOR};
      stroke-width: ${strokeWidth.toFixed(4)};
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.25;
    }
    .cap-draw {
      fill: none;
      stroke: ${ACCENT_COLOR};
      stroke-width: ${strokeWidth.toFixed(4)};
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: ${len.toFixed(3)};
      stroke-dashoffset: ${len.toFixed(3)};
      animation: cap-draw-anim ${ANIMATION_DURATION} linear infinite;
    }
    @keyframes cap-draw-anim {
      0% { stroke-dashoffset: ${len.toFixed(3)}; }
      100% { stroke-dashoffset: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cap-draw {
        animation: none;
        stroke-dashoffset: 0;
      }
    }
  </style>
  <path class="cap-underlay" d="${d}" />
  <path class="cap-draw" d="${d}" />
</svg>
`;

  return { svg, bbox, viewBox, pathLength: len, pointCount: points.length };
}

// ── Curve definitions ───────────────────────────────────────────────────
// θ1 θ2 ; ρ1 ρ2 ; d, straight from Zaltymbunk's framework post (thread-transcript.md).

const CURVES = [
  {
    name: "rosette-1-4",
    label: "Rosette pattern 1 4, radii 1 1 — five-petal inspin rosette",
    segments: [{ theta1: 1, theta2: 4, rho1: 1, rho2: 1, d: 1 }],
  },
  {
    name: "rosette-1-neg6",
    label: "Rosette pattern 1 -6, radii 1 1 — five-petal antispin rosette",
    segments: [{ theta1: 1, theta2: -6, rho1: 1, rho2: 1, d: 1 }],
  },
  {
    name: "cycloid-1-4",
    label: "Cycloid case of pattern 1 4, radii 1 1/5",
    segments: [{ theta1: 1, theta2: 4, rho1: 1, rho2: 1 / 5, d: 1 }],
  },
  {
    name: "antispin-1-neg3",
    label: "Antispin rosette pattern 1 -3, radii 1 1 — three-foil",
    segments: [{ theta1: 1, theta2: -3, rho1: 1, rho2: 1, d: 1 }],
  },
  {
    name: "cycloid-1-neg3",
    label: "Cycloid case of antispin pattern 1 -3, radii 1 1/2 — three-foil",
    segments: [{ theta1: 1, theta2: -3, rho1: 1, rho2: 1 / 2, d: 1 }],
  },
  {
    name: "pattern-2-neg5",
    label: "Multi-arm-turn pattern 2 -5, radii 1 1",
    segments: [{ theta1: 2, theta2: -5, rho1: 1, rho2: 1, d: 1 }],
  },
  {
    name: "pattern-3-2",
    label: "Multi-arm-turn pattern 3 2, radii 1 1",
    segments: [{ theta1: 3, theta2: 2, rho1: 1, rho2: 1, d: 1 }],
  },
  {
    name: "yuta-cap",
    label:
      "The Yuta CAP — extension arc (1 0, radii 1 3/4, half cycle) joined continuously to an antispin petal (-1 4, radii 1 3/4, half cycle), the kidney-bean C-CAP",
    segments: [
      { theta1: 1, theta2: 0, rho1: 1, rho2: 3 / 4, d: 1 / 2 },
      { theta1: -1, theta2: 4, rho1: 1, rho2: 3 / 4, d: 1 / 2 },
    ],
  },
];

const ORIGINAL_JPGS = [
  "model.jpg",
  "cap-yuta-halfcycle.jpg",
  "cap-yuta-3quarter.jpg",
  "cap-1-3-composition.jpg",
];

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(ORIGINAL_OUT_DIR, { recursive: true });

  console.log("=== CAP Trochoid SVG Generation Report ===\n");

  const results = [];
  for (const curveDef of CURVES) {
    const { points, segments } = buildCurve(curveDef.segments);
    assertSaneBBox(curveDef.name, computeBBox(points));

    const { svg, bbox, viewBox, pathLength: len, pointCount } = buildSvg({
      points,
      ariaLabel: curveDef.label,
    });

    const outPath = path.join(OUT_DIR, `${curveDef.name}.svg`);
    fs.writeFileSync(outPath, svg, "utf8");

    results.push({ name: curveDef.name, bbox, viewBox, pathLength: len, pointCount, segments });

    console.log(`${curveDef.name}.svg`);
    console.log(`  points: ${pointCount}`);
    console.log(
      `  bbox: x[${bbox.minX.toFixed(4)}, ${bbox.maxX.toFixed(4)}]  y[${bbox.minY.toFixed(4)}, ${bbox.maxY.toFixed(4)}]`
    );
    console.log(
      `  viewBox: ${viewBox.minX.toFixed(4)} ${viewBox.minY.toFixed(4)} ${viewBox.size.toFixed(4)} ${viewBox.size.toFixed(4)}`
    );
    console.log(`  path length: ${len.toFixed(4)}`);
    console.log(`  finite + sane bbox: PASS`);
    console.log("");
  }

  // ── Yuta CAP junction continuity — explicit, analytic re-check ──
  const yuta = results.find((r) => r.name === "yuta-cap");
  const [segA, segB] = yuta.segments;
  const aEnd = evalPoint(segA, segA.d);
  const bStart = evalPoint(segB, 0);
  const gap = Math.hypot(bStart.x - aEnd.x, bStart.y - aEnd.y);

  console.log("--- Yuta CAP junction continuity ---");
  console.log(`  Segment A: theta1=${segA.theta1} theta2=${segA.theta2} rho1=${segA.rho1} rho2=${segA.rho2} d=${segA.d}`);
  console.log(`  Segment B: theta1=${segB.theta1} theta2=${segB.theta2} rho1=${segB.rho1} rho2=${segB.rho2} d=${segB.d}`);
  console.log(`  Solved join phases: phi1=${segB.phi1.toFixed(6)} rad, phi2=${segB.phi2.toFixed(6)} rad`);
  console.log(`  A(d) = (${aEnd.x.toFixed(8)}, ${aEnd.y.toFixed(8)})`);
  console.log(`  B(0) = (${bStart.x.toFixed(8)}, ${bStart.y.toFixed(8)})`);
  console.log(`  |B(0) - A(d)| = ${gap.toExponential(4)}`);
  const continuityPass = gap < 1e-6;
  console.log(`  Continuity check (< 1e-6): ${continuityPass ? "PASS" : "FAIL"}`);
  if (!continuityPass) {
    throw new Error("Yuta CAP junction continuity check FAILED");
  }

  // ── Copy archived originals ──
  console.log("\n--- Original JPGs copied to static/caps/original/ ---");
  for (const f of ORIGINAL_JPGS) {
    const src = path.join(ARCHIVE_DIR, f);
    const dest = path.join(ORIGINAL_OUT_DIR, f);
    fs.copyFileSync(src, dest);
    const stat = fs.statSync(dest);
    console.log(`  ${f}  (${stat.size} bytes)`);
  }

  console.log(`\n${results.length} SVGs written to static/caps/. All checks PASS.`);
}

main();
