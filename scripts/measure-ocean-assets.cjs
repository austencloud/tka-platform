#!/usr/bin/env node
//
// Build the mechanical half of scripts/ocean-asset-facts.json.
//
// Measured here:  upAxis-relative baseOffset, footprintRadius, size, signature.
// Authored there: species, sizeMetres, facing, silhouette, upAxis.
//
// This never overwrites an authored field. A new GLB appears as a row with the
// authored fields null, which is the signal that the row needs a human.
//
// Run: node scripts/measure-ocean-assets.cjs
//
// Design: docs/superpowers/specs/active/2026-08-09-ocean-composition-matrix-design.md

const fs = require("fs");
const path = require("path");
const { measureGlb } = require("./ocean-glb-metrics.cjs");

const ROOT = path.join(__dirname, "..");
const MODELS = path.join(ROOT, "static/models/ocean");
const FACTS = path.join(__dirname, "ocean-asset-facts.json");

// Directories that hold placeable scenery. `pack/` is excluded: 50 fish are a
// pelagic family with their own motion problem, out of scope for this index.
const ASSET_DIRS = [".", "meshy", "structures", "polyhaven", "kelp"];

// Stage geometry and pipeline artifacts living alongside the scenery. These are
// not things the generator may place.
const NOT_SCENERY = new Set([
  "dais",
  "stage",
  "stage_meshy",
  "ocean-environment",
  "ocean_flora_scene",
  "dais_raw",
  "ocean_scene_raw",
  "ocean_seabed_raw",
  "stage_meshy_raw",
]);

const AUTHORED_FIELDS = ["species", "sizeMetres", "facing", "silhouette", "upAxis"];
const AXIS_INDEX = { x: 0, y: 1, z: 2 };

function listAssets() {
  const out = [];
  for (const dir of ASSET_DIRS) {
    const abs = path.join(MODELS, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs)) {
      if (!file.endsWith(".glb")) continue;
      const stem = file.slice(0, -4);
      if (dir === "." && NOT_SCENERY.has(stem)) continue;
      const rel = dir === "." ? file : `${dir}/${file}`;
      out.push({ id: rel.slice(0, -4), path: rel, abs: path.join(abs, file) });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function loadFacts() {
  if (!fs.existsSync(FACTS)) return {};
  return JSON.parse(fs.readFileSync(FACTS, "utf-8"));
}

const facts = loadFacts();
const assets = listAssets();
let measured = 0;
const needsAuthoring = [];

for (const asset of assets) {
  const existing = facts[asset.id] || {};
  const m = measureGlb(asset.abs);

  const upAxis = existing.upAxis || "y";
  const up = AXIS_INDEX[upAxis];
  if (up === undefined) throw new Error(`${asset.id}: bad upAxis "${upAxis}"`);
  const horizontal = [0, 1, 2].filter((a) => a !== up);

  const row = { path: asset.path, source: asset.path.includes("/") ? asset.path.split("/")[0] : "root" };
  for (const field of AUTHORED_FIELDS) {
    row[field] = existing[field] ?? (field === "upAxis" ? "y" : null);
  }

  // Normalized against maxExtent, because the runtime scales every model to
  // 1-unit max extent at import. Multiplying these by a chosen metre size then
  // gives metres directly.
  row.baseOffset = Number((m.min[up] / m.maxExtent).toFixed(4));
  row.footprintRadius = Number(
    ((0.5 * Math.max(m.size[horizontal[0]], m.size[horizontal[1]])) / m.maxExtent).toFixed(4)
  );
  row.size = m.size.map((s) => Number(s.toFixed(4)));
  row.maxExtent = Number(m.maxExtent.toFixed(4));
  row.signature = { vertices: m.vertices, ratio: m.ratio };

  facts[asset.id] = row;
  measured += 1;
  if (AUTHORED_FIELDS.some((f) => row[f] === null)) needsAuthoring.push(asset.id);
}

// An asset whose geometry sits far from its own origin cannot be seated on the
// terrain: baseOffset is applied as a multiple of the chosen metre size, so
// -39 means "bury this 39 sizes deep". kelp/leafy_kelp exports this way.
// Flagged rather than auto-corrected -- the fix belongs in the GLB.
const BASE_OFFSET_SANE = 1.5;
const brokenOrigin = Object.entries(facts)
  .filter(([, r]) => Math.abs(r.baseOffset) > BASE_OFFSET_SANE)
  .map(([id, r]) => `${id} (baseOffset ${r.baseOffset})`);

// Duplicate detection. `structures/` and the numbered `rock_*` files turned out
// to be re-exports of meshy assets -- byte-identical vertex counts and bounds.
// The generator must treat an alias as the asset it copies, or a zone that asks
// for three different rocks silently places the same rock three times.
//
// Canonical winner is the most descriptive id. `rock_0` and
// `meshy/basalt_pinnacle` are the same mesh, and the generator should carry the
// name that says what the thing is -- the whole point of the index is that the
// pipeline stops being blind to what it places.
const GENERIC_ID = /^rock_\d+$/;
function descriptiveness(id) {
  return GENERIC_ID.test(id) ? 1 : 0;
}
const bySignature = new Map();
for (const id of Object.keys(facts).sort()) {
  // Keyed on bounds, not vertex count. The re-exports were decimated slightly
  // differently (12642 vs 12452 verts for the same rock), so vertex count
  // separates copies that are plainly the same object. Bounds agreeing to four
  // decimals across two independent assets does not happen by chance.
  const key = facts[id].size.join(",");
  if (!bySignature.has(key)) bySignature.set(key, []);
  bySignature.get(key).push(id);
}
let aliases = 0;
for (const group of bySignature.values()) {
  const canonical = [...group].sort(
    (a, b) => descriptiveness(a) - descriptiveness(b) || a.length - b.length || a.localeCompare(b)
  )[0];
  for (const id of group) {
    if (id === canonical) {
      delete facts[id].aliasOf;
    } else {
      facts[id].aliasOf = canonical;
      aliases += 1;
    }
  }
}

// Rows for GLBs that no longer exist are dropped rather than left to rot: a
// facts row pointing at a missing file would place an invisible object.
const live = new Set(assets.map((a) => a.id));
const dropped = Object.keys(facts).filter((id) => !live.has(id));
for (const id of dropped) delete facts[id];

const ordered = {};
for (const id of Object.keys(facts).sort()) ordered[id] = facts[id];
fs.writeFileSync(FACTS, `${JSON.stringify(ordered, null, 2)}\n`);

console.log(`Measured ${measured} assets -> ${path.relative(ROOT, FACTS)}`);
console.log(`${aliases} duplicate re-exports aliased; ${measured - aliases} distinct.`);
if (dropped.length) console.log(`Dropped ${dropped.length} stale rows: ${dropped.join(", ")}`);
// An alias inherits its canonical row's authored fields, so it never needs a
// human of its own.
if (brokenOrigin.length) {
  console.log(`\nBroken origins -- these cannot be seated on terrain until fixed in the GLB:`);
  for (const line of brokenOrigin) console.log(`  ${line}`);
}

const pending = needsAuthoring.filter((id) => facts[id] && !facts[id].aliasOf);
if (pending.length) {
  console.log(`\n${pending.length} rows need authored fields:`);
  for (const id of pending) console.log(`  ${id}`);
}
