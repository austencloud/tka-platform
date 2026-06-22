#!/usr/bin/env node
/**
 * Generate autumn GLBs via Meshy image-to-3D (single-task, no preview/refine).
 * Driven by scripts/autumn-meshy-images.json. Key in .env as MESHY_API_KEY.
 *
 * Drop 1-4 tuned reference images of each subject into
 *   <imageRoot>/<id>/   (e.g. assets/meshy-refs/autumn/hero-tree-a/)
 * 1 image  -> image-to-3d (model_type: "standard")
 * 2-4      -> multi-image-to-3d (same subject, multiple views)
 *
 * Usage:
 *   node scripts/generate-autumn-meshy-from-image.mjs              # all assets
 *   node scripts/generate-autumn-meshy-from-image.mjs --only hero-tree-a
 */
import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, extname, join } from "node:path";

const SINGLE = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MULTI = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error("MESHY_API_KEY not set."); process.exit(1); }
const AUTH = { Authorization: `Bearer ${KEY}` };
const JSON_HDR = { ...AUTH, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const manifest = JSON.parse(await readFile(resolve("scripts/autumn-meshy-images.json"), "utf8"));
const imageRoot = manifest.imageRoot || "assets/meshy-refs/autumn";
const outDir = "static/models/autumn";

const IMG_EXT = new Set([".png", ".jpg", ".jpeg"]);
const mimeFor = (ext) => (ext === ".png" ? "image/png" : "image/jpeg");

async function post(base, body) {
  const res = await fetch(base, { method: "POST", headers: JSON_HDR, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${res.status}: ${JSON.stringify(json)}`);
  return json.result;
}
async function waitTask(base, id, label, { interval = 5000, timeout = 900000 } = {}) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${base}/${id}`, { headers: AUTH });
    const json = await res.json();
    process.stdout.write(`  ${label}: ${json.status} ${json.progress ?? 0}%\r`);
    if (json.status === "SUCCEEDED") { console.log(`\n  ${label}: SUCCEEDED`); return json; }
    if (json.status === "FAILED" || json.status === "CANCELED")
      throw new Error(`${label} ${json.status}: ${JSON.stringify(json.task_error ?? json)}`);
    if (Date.now() - start > timeout) throw new Error(`${label} timed out.`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

async function loadDataUris(dir) {
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir))
    .filter((n) => IMG_EXT.has(extname(n).toLowerCase()))
    .sort();
  const uris = [];
  for (const name of names) {
    const ext = extname(name).toLowerCase();
    const bin = await readFile(join(dir, name));
    uris.push(`data:${mimeFor(ext)};base64,${bin.toString("base64")}`);
  }
  return uris;
}

const failed = [];
for (const a of manifest.assets) {
  if (only && a.id !== only) continue;
  try {
    console.log(`\n=== ${a.id} ===`);
    const dir = resolve(`${imageRoot}/${a.id}`);
    let uris = await loadDataUris(dir);
    if (uris.length === 0) {
      console.log(`  skip ${a.id}: no images in ${dir} — drop 1-4 reference images there`);
      continue;
    }
    if (uris.length > 4) {
      console.warn(`  ${a.id}: ${uris.length} images found, using the first 4`);
      uris = uris.slice(0, 4);
    }

    let base, taskId;
    if (uris.length === 1) {
      base = SINGLE;
      taskId = await post(base, {
        image_url: uris[0],
        ai_model: "meshy-6",
        model_type: "standard",
        enable_pbr: true,
        should_remesh: true,
        target_polycount: manifest.polycount,
        texture_prompt: a.texturePrompt,
        target_formats: ["glb"],
      });
      console.log(`Single-image task: ${taskId}`);
    } else {
      base = MULTI;
      taskId = await post(base, {
        image_urls: uris,
        ai_model: "meshy-6",
        enable_pbr: true,
        should_remesh: true,
        target_polycount: manifest.polycount,
        texture_prompt: a.texturePrompt,
        target_formats: ["glb"],
      });
      console.log(`Multi-image task (${uris.length} views): ${taskId}`);
    }

    const done = await waitTask(base, taskId, a.id);
    const glbUrl = done.model_urls?.glb;
    if (!glbUrl) throw new Error(`No GLB for ${a.id}: ${JSON.stringify(done.model_urls)}`);
    const out = resolve(`${outDir}/${a.id}_raw.glb`);
    await mkdir(dirname(out), { recursive: true });
    const bin = Buffer.from(await (await fetch(glbUrl)).arrayBuffer());
    await writeFile(out, bin);
    console.log(`-> ${out} (${(bin.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`\n!! ${a.id} FAILED: ${err.message}`);
    failed.push(a.id);
  }
}
if (failed.length) {
  console.error(`\nFailed assets: ${failed.join(", ")}. Re-run with --only <id>.`);
  process.exit(1);
}
console.log("\nNext: node scripts/optimize-autumn-meshy.mjs --manifest scripts/autumn-meshy-images.json");
