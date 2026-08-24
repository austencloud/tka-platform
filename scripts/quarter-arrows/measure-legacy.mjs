// Measure the legacy hand-authored arrow corpus to establish the visual
// contract quarter-turn arrows must match. Parses every non-quarter SVG under
// static/images/arrows, flattens the outline, and reports per asset:
//   - structure: viewBox, path count, fill vs stroke
//   - fitted arc: least-squares circle through outline points, angular sweep
//   - width profile along the sweep: per-angle-bucket (maxR - minR)
//   - taper: tail width vs shaft width vs head (barb) width
// Output: docs/research/quarter-arrows/legacy-corpus-measurements.json
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

function globSvgs(dir, prefix = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...globSvgs(join(dir, e.name), rel));
    else if (e.name.endsWith(".svg")) out.push(rel);
  }
  return out;
}

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ARROWS = join(ROOT, "static/images/arrows");
const OUT_DIR = join(ROOT, "docs/research/quarter-arrows");

// ---------------------------------------------------------------------------
// Minimal SVG path flattener (M m C c S s L l H h V v Z z — the full command
// set used by this corpus; verified by census 2026-08-23).
// ---------------------------------------------------------------------------
function tokenize(d) {
  const re = /([MmCcSsLlHhVvZz])|(-?\d*\.?\d+(?:e[+-]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = re.exec(d))) tokens.push(m[1] ?? Number(m[2]));
  return tokens;
}

function flattenCubic(p0, p1, p2, p3, out, segs = 24) {
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

/** Flatten one path `d` into an array of subpaths (arrays of [x, y]). */
function flattenPath(d) {
  const t = tokenize(d);
  const subpaths = [];
  let pts = null;
  let cur = [0, 0];
  let start = [0, 0];
  let prevCtrl = null; // last cubic control point, for S/s reflection
  let i = 0;
  let cmd = null;
  const read = (n) => {
    const vals = t.slice(i, i + n);
    i += n;
    return vals;
  };
  while (i < t.length) {
    if (typeof t[i] === "string") cmd = t[i++];
    // implicit command repetition: keep last cmd (M repeats as L per spec)
    switch (cmd) {
      case "M":
      case "m": {
        const [x, y] = read(2);
        cur = cmd === "M" ? [x, y] : [cur[0] + x, cur[1] + y];
        start = cur;
        pts = [cur];
        subpaths.push(pts);
        cmd = cmd === "M" ? "L" : "l";
        prevCtrl = null;
        break;
      }
      case "L":
      case "l": {
        const [x, y] = read(2);
        cur = cmd === "L" ? [x, y] : [cur[0] + x, cur[1] + y];
        pts.push(cur);
        prevCtrl = null;
        break;
      }
      case "H":
      case "h": {
        const [x] = read(1);
        cur = cmd === "H" ? [x, cur[1]] : [cur[0] + x, cur[1]];
        pts.push(cur);
        prevCtrl = null;
        break;
      }
      case "V":
      case "v": {
        const [y] = read(1);
        cur = cmd === "V" ? [cur[0], y] : [cur[0], cur[1] + y];
        pts.push(cur);
        prevCtrl = null;
        break;
      }
      case "C":
      case "c": {
        let [x1, y1, x2, y2, x, y] = read(6);
        if (cmd === "c") {
          x1 += cur[0]; y1 += cur[1]; x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1];
        }
        flattenCubic(cur, [x1, y1], [x2, y2], [x, y], pts);
        prevCtrl = [x2, y2];
        cur = [x, y];
        break;
      }
      case "S":
      case "s": {
        let [x2, y2, x, y] = read(4);
        if (cmd === "s") {
          x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1];
        }
        const x1 = prevCtrl ? 2 * cur[0] - prevCtrl[0] : cur[0];
        const y1 = prevCtrl ? 2 * cur[1] - prevCtrl[1] : cur[1];
        flattenCubic(cur, [x1, y1], [x2, y2], [x, y], pts);
        prevCtrl = [x2, y2];
        cur = [x, y];
        break;
      }
      case "Z":
      case "z":
        pts.push(start);
        cur = start;
        prevCtrl = null;
        break;
      default:
        throw new Error(`unsupported command ${cmd}`);
    }
  }
  return subpaths;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Kasa least-squares circle fit. Returns {cx, cy, r, rmse}. */
function fitCircle(points) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = points.length;
  for (const [x, y] of points) {
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    sxz += x * z; syz += y * z; sz += z;
  }
  // Solve [sxx sxy sx; sxy syy sy; sx sy n] * [a b c]' = [sxz syz sz]'
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const B = [sxz, syz, sz];
  // Gaussian elimination
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [B[col], B[piv]] = [B[piv], B[col]];
    if (Math.abs(A[col][col]) < 1e-12) return null;
    for (let r = col + 1; r < 3; r++) {
      const f = A[r][col] / A[col][col];
      for (let c = col; c < 3; c++) A[r][c] -= f * A[col][c];
      B[r] -= f * B[col];
    }
  }
  const sol = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let acc = B[r];
    for (let c = r + 1; c < 3; c++) acc -= A[r][c] * sol[c];
    sol[r] = acc / A[r][r];
  }
  const cx = sol[0] / 2, cy = sol[1] / 2;
  const r = Math.sqrt(sol[2] + cx * cx + cy * cy);
  let sse = 0;
  for (const [x, y] of points) {
    const d = Math.hypot(x - cx, y - cy) - r;
    sse += d * d;
  }
  return { cx, cy, r, rmse: Math.sqrt(sse / n) };
}

/**
 * Width profile along the fitted arc: bucket outline points by angle around
 * the fitted center; per bucket width = maxR - minR. Returns the ordered
 * buckets over the occupied angular range (unwrapped).
 */
function widthProfile(points, fit, bucketDeg = 3) {
  const buckets = new Map();
  for (const [x, y] of points) {
    const a = (Math.atan2(y - fit.cy, x - fit.cx) * 180) / Math.PI;
    const key = Math.round(a / bucketDeg) * bucketDeg;
    const r = Math.hypot(x - fit.cx, y - fit.cy);
    const b = buckets.get(key) ?? { min: Infinity, max: -Infinity, n: 0 };
    if (r < b.min) b.min = r;
    if (r > b.max) b.max = r;
    b.n++;
    buckets.set(key, b);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  // unwrap: find largest gap, start after it
  let gapAt = 0, gapSize = -1;
  for (let i = 0; i < keys.length; i++) {
    const next = keys[(i + 1) % keys.length];
    const gap = ((next - keys[i] + 360) % 360) || 360;
    if (gap > gapSize) { gapSize = gap; gapAt = (i + 1) % keys.length; }
  }
  const ordered = [...keys.slice(gapAt), ...keys.slice(0, gapAt)];
  const sweepDeg = ordered.length ? (ordered.length - 1) * bucketDeg : 0;
  const profile = ordered.map((k) => {
    const b = buckets.get(k);
    return { angle: k, width: +(b.max - b.min).toFixed(2), midR: +((b.max + b.min) / 2).toFixed(2) };
  });
  return { sweepDeg, profile };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = globSvgs(ARROWS)
  .filter((f) => !f.includes("_0.25"))
  .sort();

const results = [];
for (const rel of files) {
  const svg = readFileSync(join(ARROWS, rel), "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? null;
  const dAttrs = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  const hasFill = /style="[^"]*fill:\s*#/.test(svg) || /fill="#/.test(svg);
  const hasStroke = /stroke-width/.test(svg);
  const allPts = [];
  let flattenError = null;
  try {
    for (const d of dAttrs) for (const sp of flattenPath(d)) allPts.push(...sp);
  } catch (e) {
    flattenError = e.message;
  }
  const entry = {
    file: rel.replace(/\\/g, "/"),
    viewBox,
    pathCount: dAttrs.length,
    fillBased: hasFill,
    strokeBased: hasStroke,
  };
  if (!flattenError && allPts.length > 8) {
    const bb = bounds(allPts);
    entry.bounds = { w: +bb.w.toFixed(1), h: +bb.h.toFixed(1) };
    const fit = fitCircle(allPts);
    if (fit) {
      entry.circleFit = {
        r: +fit.r.toFixed(1),
        rmse: +fit.rmse.toFixed(1),
        rmseOverR: +(fit.rmse / fit.r).toFixed(3),
      };
      const wp = widthProfile(allPts, fit);
      entry.sweepDeg = wp.sweepDeg;
      const widths = wp.profile.map((p) => p.width);
      if (widths.length > 6) {
        // Identify head spike (max width) and where it sits along the sweep
        const maxW = Math.max(...widths);
        const maxIdx = widths.indexOf(maxW);
        // shaft sample: median of middle half excluding the head neighborhood
        const interior = widths.filter((_, i) => Math.abs(i - maxIdx) > widths.length * 0.15);
        interior.sort((a, b) => a - b);
        const shaftW = interior[Math.floor(interior.length / 2)] ?? null;
        const headAtStart = maxIdx < widths.length / 2;
        const tailW = headAtStart ? widths[widths.length - 1] : widths[0];
        entry.widths = {
          headBarbSpan: +maxW.toFixed(1),
          shaftMedian: shaftW != null ? +shaftW.toFixed(1) : null,
          tailTip: +tailW.toFixed(1),
          headOverShaft: shaftW ? +(maxW / shaftW).toFixed(2) : null,
          headPositionFrac: +(maxIdx / (widths.length - 1)).toFixed(2),
        };
        entry.widthProfile = wp.profile;
      }
    }
  } else if (flattenError) {
    entry.flattenError = flattenError;
  }
  results.push(entry);
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, "legacy-corpus-measurements.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));

// Console summary
const filled = results.filter((r) => r.fillBased && !r.strokeBased).length;
const stroked = results.filter((r) => r.strokeBased).length;
console.log(`Measured ${results.length} legacy assets -> ${relative(ROOT, outPath)}`);
console.log(`fill-based: ${filled}   stroke-based: ${stroked}`);
const errs = results.filter((r) => r.flattenError);
if (errs.length) console.log(`flatten errors: ${errs.map((e) => e.file).join(", ")}`);
for (const r of results) {
  if (!r.widths) continue;
  console.log(
    `${r.file.padEnd(48)} sweep=${String(r.sweepDeg).padStart(4)}deg ` +
      `shaft=${r.widths.shaftMedian} head=${r.widths.headBarbSpan} ` +
      `head/shaft=${r.widths.headOverShaft} tail=${r.widths.tailTip} ` +
      `fitErr=${r.circleFit.rmseOverR}`
  );
}
