// Run:      npx tsx scripts/ingest-half-arrows.mjs
// Selftest: npx tsx scripts/ingest-half-arrows.mjs --selftest
//
// Turns Illustrator-authored half-arrow templates into pipeline-ready runtime
// assets. For each template in assets/half-arrow-templates/{mt}_half_{turns}.svg:
//
//   1. COLLECT — every drawable element (path/rect/circle/ellipse/polygon/
//      polyline/line) that is NOT inside a group whose id starts with
//      "REFERENCE". Those groups hold the locked pictograph render the arrow
//      was drawn against; everything outside them is the drawn arrow art.
//      Ancestor `transform` attributes are honored (Illustrator loves to wrap
//      art in transformed groups).
//   2. NORMALIZE — the exact inverse of the pipeline's segment transform for
//      the template's seed motion (scripts/half-arrow-seeds.mjs): subtract the
//      anchor hand point H, rotate by -R, invert the staff-axis mirror
//      (flip local y) when the seed motion renders mirrored. Scale is 1.0 —
//      templates are the real 950-box pictograph, so art is drawn at final
//      visual weight (WYSIWYG).
//   3. EMIT — static/images/arrows/{mt}_half/from_radial/{mt}_half_{turns}.svg
//      with the same shape as extract-half-glyphs.mjs output: filled paths +
//      an `id="centerPoint"` circle at the anchor.
//   4. MANIFEST — regenerate half-asset-manifest.ts from the files now on
//      disk, so the resolver serves the new art and the /test/half-movements
//      matrix flips the family green. Nothing else to wire by hand.
//
// A template with no drawn art (only REFERENCE content) is skipped silently —
// so the whole directory can be ingested at any point; only finished drawings
// land.
//
// --selftest proves the normalization is the true inverse of the pipeline
// transform without needing any drawn art: it forward-transforms two existing
// assets (one unmirrored seed, one mirrored) into template space, ingests
// them back, and compares geometry.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { JSDOM } from "jsdom";
import svgPath from "svg-path-commander";
import { allFamilySeeds } from "./half-arrow-seeds.mjs";

const { pathToCurve, pathToString, roundPath, getPathBBox, getTotalLength, shapeToPathArray } =
  svgPath;

const BLUE = "#2e3192";
const PAD = 8;
const TEMPLATE_DIR = "assets/half-arrow-templates";
const ASSET_DIR = (mt) => `static/images/arrows/${mt}_half/from_radial`;
const MANIFEST_PATH =
  "src/lib/shared/pictograph/arrow/rendering/services/half-asset-manifest.ts";

// ── affine helpers (2x3 row form: [a c e; b d f], SVG y-down) ───────────────
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const translate = (tx, ty) => [1, 0, 0, 1, tx, ty];
const rotate = (deg) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};
const scale = (sx, sy) => [sx, 0, 0, sy, 0, 0];

/** Parse an SVG `transform` attribute (matrix/translate/rotate/scale, the
 *  forms Illustrator emits) into a single affine matrix. */
function parseTransformAttr(str) {
  let m = I;
  const re = /(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)/g;
  for (const [, fn, argStr] of str.matchAll(re)) {
    const a = argStr.split(/[\s,]+/).filter(Boolean).map(Number);
    let t = I;
    if (fn === "matrix") t = a;
    else if (fn === "translate") t = translate(a[0] ?? 0, a[1] ?? 0);
    else if (fn === "scale") t = scale(a[0] ?? 1, a[1] ?? a[0] ?? 1);
    else if (fn === "rotate") {
      t =
        a.length > 1
          ? mul(mul(translate(a[1], a[2]), rotate(a[0])), translate(-a[1], -a[2]))
          : rotate(a[0]);
    } else if (fn === "skewX") t = [1, 0, Math.tan((a[0] * Math.PI) / 180), 1, 0, 0];
    else if (fn === "skewY") t = [1, Math.tan((a[0] * Math.PI) / 180), 0, 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}

// ── template parsing ─────────────────────────────────────────────────────────
const DRAWABLE = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);

const isReference = (el) => {
  for (let n = el; n; n = n.parentElement) {
    if (n.id && n.id.toUpperCase().startsWith("REFERENCE")) return true;
  }
  return false;
};

const ancestorTransform = (el, stopAt) => {
  let m = I;
  const chain = [];
  for (let n = el; n && n !== stopAt; n = n.parentElement) chain.unshift(n);
  for (const n of chain) {
    const t = n.getAttribute?.("transform");
    if (t) m = mul(m, parseTransformAttr(t));
  }
  return m;
};

const attr = (el, name, dflt = 0) => {
  const v = el.getAttribute(name);
  return v === null || v === "" ? dflt : Number(v);
};

/** Element -> absolute cubic path array in the template's root coordinates. */
function elementToCurve(el, svgRoot) {
  let d;
  const tag = el.tagName.toLowerCase();
  if (tag === "path") {
    d = el.getAttribute("d");
  } else if (tag === "polygon" || tag === "polyline") {
    const pts = (el.getAttribute("points") ?? "").trim();
    if (!pts) return null;
    d = `M${pts}${tag === "polygon" ? "Z" : ""}`;
  } else if (tag === "line") {
    d = `M${attr(el, "x1")} ${attr(el, "y1")} L${attr(el, "x2")} ${attr(el, "y2")}`;
  } else {
    const shape =
      tag === "rect"
        ? { type: "rect", x: attr(el, "x"), y: attr(el, "y"), width: attr(el, "width"), height: attr(el, "height"), rx: attr(el, "rx"), ry: attr(el, "ry") }
        : tag === "circle"
          ? { type: "circle", cx: attr(el, "cx"), cy: attr(el, "cy"), r: attr(el, "r") }
          : { type: "ellipse", cx: attr(el, "cx"), cy: attr(el, "cy"), rx: attr(el, "rx"), ry: attr(el, "ry") };
    d = pathToString(shapeToPathArray(shape));
  }
  if (!d) return null;
  const m = ancestorTransform(el, svgRoot.parentElement);
  const curve = pathToCurve(d);
  return curve.map(([cmd, ...nums]) => {
    const out = [cmd];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push(...apply(m, nums[i], nums[i + 1]));
    return out;
  });
}

/** Drawn (non-REFERENCE) art in a template document, as curve arrays. */
function collectDrawnCurves(doc) {
  const svgRoot = doc.querySelector("svg");
  const curves = [];
  for (const el of svgRoot.querySelectorAll([...DRAWABLE].join(","))) {
    if (isReference(el)) continue;
    if (el.id === "centerPoint") continue;
    const curve = elementToCurve(el, svgRoot);
    if (curve && curve.length > 1) curves.push(curve);
  }
  return curves;
}

// ── normalization + emit (mirrors extract-half-glyphs.mjs) ───────────────────
/** Template-space -> glyph-local: T(-H), rotate(-R), unmirror (flip local y). */
const normalizeMatrix = (seed) =>
  mul(mul(scale(1, seed.mirrored ? -1 : 1), rotate(-seed.R)), translate(-seed.H.x, -seed.H.y));

/** Glyph-local -> template-space: the pipeline's forward transform. */
const forwardMatrix = (seed) =>
  mul(mul(translate(seed.H.x, seed.H.y), rotate(seed.R)), scale(1, seed.mirrored ? -1 : 1));

function emitAsset(seed, curves) {
  const mapped = curves.map((curve) => {
    const m = normalizeMatrix(seed);
    return curve.map(([cmd, ...nums]) => {
      const out = [cmd];
      for (let i = 0; i + 1 < nums.length; i += 2) out.push(...apply(m, nums[i], nums[i + 1]));
      return out;
    });
  });

  // viewBox over all glyph points plus the anchor (0,0), padded.
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const curve of mapped) {
    for (const [, ...nums] of curve) {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        if (nums[i] < minX) minX = nums[i];
        if (nums[i] > maxX) maxX = nums[i];
        if (nums[i + 1] < minY) minY = nums[i + 1];
        if (nums[i + 1] > maxY) maxY = nums[i + 1];
      }
    }
  }
  const w = (maxX - minX + PAD * 2).toFixed(2);
  const h = (maxY - minY + PAD * 2).toFixed(2);
  const dx = PAD - minX;
  const dy = PAD - minY;

  const pathEls = mapped
    .map((curve) => {
      const shifted = curve.map(([cmd, ...nums]) => {
        const out = [cmd];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(nums[i] + dx, nums[i + 1] + dy);
        return out;
      });
      return `<path d="${pathToString(roundPath(shifted, 2))}" style="fill:${BLUE}"/>`;
    })
    .join("");

  const svg =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" xml:space="preserve">` +
    pathEls +
    `<circle id="centerPoint" cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="2" fill="none"/></svg>`;

  const out = resolve(process.cwd(), `${ASSET_DIR(seed.mt)}/${seed.asset}.svg`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, "utf8");
  return out;
}

// ── manifest regeneration ────────────────────────────────────────────────────
function regenerateManifest() {
  const MTS = ["pro", "anti", "dash", "static"];
  const lines = [];
  const coverage = {};
  for (const mt of MTS) {
    const dir = resolve(process.cwd(), ASSET_DIR(mt));
    const turns = [];
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        const m = f.match(new RegExp(`^${mt}_half_(fl|\\d\\.\\d)\\.svg$`));
        if (m) turns.push(m[1] === "fl" ? '"fl"' : String(Number(m[1])));
      }
    }
    turns.sort((a, b) => (a === '"fl"' ? 1 : b === '"fl"' ? -1 : Number(a) - Number(b)));
    coverage[mt] = turns.length;
    lines.push(`  ${mt}: new Set<number | "fl">([${turns.join(", ")}]),`);
  }
  const content = `/**
 * AUTO-GENERATED by scripts/ingest-half-arrows.mjs — do not edit by hand.
 * Regenerate with: npx tsx scripts/ingest-half-arrows.mjs
 *
 * Per-motion-type turns values that have a dedicated halved-motion glyph
 * (\`static/images/arrows/{mt}_half/from_radial/{mt}_half_{turns}.svg\`).
 * Anything absent falls back to the bare \`{mt}_half.svg\`.
 *
 * This is the single source of truth for half-glyph coverage: the arrow path
 * resolver reads it to pick asset files, and /test/half-movements reads it to
 * paint the coverage matrix.
 */
export const HALF_ASSET_TURNS: Readonly<
  Record<string, ReadonlySet<number | "fl">>
> = {
${lines.join("\n")}
};
`;
  writeFileSync(resolve(process.cwd(), MANIFEST_PATH), content, "utf8");
  return coverage;
}

// ── selftest: roundtrip an existing asset through template space ─────────────
function selftest(seeds) {
  let failures = 0;
  for (const key of ["pro_t1", "dash_t2"]) {
    const seed = seeds.find((s) => s.key === key);
    const assetPath = resolve(process.cwd(), `${ASSET_DIR(seed.mt)}/${seed.asset}.svg`);
    const src = readFileSync(assetPath, "utf8");
    const doc = new JSDOM(src, { contentType: "image/svg+xml" }).window.document;
    const c = doc.querySelector("#centerPoint");
    const cx = Number(c.getAttribute("cx"));
    const cy = Number(c.getAttribute("cy"));

    // Asset-local coords (relative to centerPoint) -> template space via the
    // pipeline's forward transform.
    const fwd = mul(forwardMatrix(seed), translate(-cx, -cy));
    const drawn = [];
    for (const p of doc.querySelectorAll("path")) {
      const curve = pathToCurve(p.getAttribute("d")).map(([cmd, ...nums]) => {
        const out = [cmd];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(...apply(fwd, nums[i], nums[i + 1]));
        return out;
      });
      drawn.push(curve);
    }

    // Ingest-normalize the synthetic "drawn art" and compare geometry to the
    // original asset (both re-based on their anchors).
    const norm = normalizeMatrix(seed);
    const roundtripped = drawn.map((curve) =>
      curve.map(([cmd, ...nums]) => {
        const out = [cmd];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(...apply(norm, nums[i], nums[i + 1]));
        return out;
      })
    );
    const originalLocal = [...doc.querySelectorAll("path")].map((p) =>
      pathToCurve(p.getAttribute("d")).map(([cmd, ...nums]) => {
        const out = [cmd];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(nums[i] - cx, nums[i + 1] - cy);
        return out;
      })
    );

    for (let i = 0; i < originalLocal.length; i++) {
      const a = getPathBBox(originalLocal[i]);
      const b = getPathBBox(roundtripped[i]);
      const la = getTotalLength(pathToString(originalLocal[i]));
      const lb = getTotalLength(pathToString(roundtripped[i]));
      const drift = Math.max(
        Math.abs(a.x - b.x), Math.abs(a.y - b.y),
        Math.abs(a.x2 - b.x2), Math.abs(a.y2 - b.y2),
        Math.abs(la - lb)
      );
      const ok = drift < 0.01;
      if (!ok) failures++;
      console.log(
        `${ok ? "PASS" : "FAIL"} ${key} path[${i}]  bbox drift ${drift.toFixed(4)}  ` +
          `(${seed.mirrored ? "mirrored" : "unmirrored"} seed, R=${seed.R})`
      );
    }
  }
  if (failures) {
    console.error(`selftest FAILED: ${failures} path(s) drifted`);
    process.exit(1);
  }
  console.log("selftest passed — normalization is the exact inverse of the pipeline transform.");
}

// ── main ─────────────────────────────────────────────────────────────────────
const seeds = allFamilySeeds();

if (process.argv.includes("--selftest")) {
  selftest(seeds);
  process.exit(0);
}

const templateDir = resolve(process.cwd(), TEMPLATE_DIR);
if (!existsSync(templateDir)) {
  console.error(`No template dir at ${TEMPLATE_DIR}. Run: npx tsx scripts/build-half-arrow-templates.mjs`);
  process.exit(1);
}

const ingested = [];
const skipped = [];
for (const file of readdirSync(templateDir).filter((f) => f.endsWith(".svg"))) {
  const name = basename(file, ".svg"); // {mt}_half_{turnsKey}
  const seed = seeds.find((s) => s.asset === name);
  if (!seed) {
    console.warn(`?? ${file}: doesn't match any known family — skipped`);
    continue;
  }
  const src = readFileSync(resolve(templateDir, file), "utf8");
  const doc = new JSDOM(src, { contentType: "image/svg+xml" }).window.document;
  const curves = collectDrawnCurves(doc);
  if (curves.length === 0) {
    skipped.push(name);
    continue;
  }
  const out = emitAsset(seed, curves);
  ingested.push(name);
  console.log(`ingested ${name} (${curves.length} path(s)) -> ${out}`);
}

const coverage = regenerateManifest();
const total = seeds.length;
const covered = Object.values(coverage).reduce((a, b) => a + b, 0);
console.log(
  `\n${ingested.length} ingested, ${skipped.length} template(s) still empty.` +
    `\nCoverage: ${covered}/${total} families (${Math.round((covered / total) * 100)}%) — ` +
    Object.entries(coverage).map(([mt, n]) => `${mt} ${n}`).join(", ") +
    `\nManifest regenerated: ${MANIFEST_PATH}` +
    `\nCheck the matrix: /test/half-movements (green = done), then WASD-tune placement there.`
);
