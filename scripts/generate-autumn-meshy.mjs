#!/usr/bin/env node
/**
 * Generate autumn hero GLBs via Meshy text-to-3D (preview -> refine).
 * Driven by scripts/autumn-meshy-assets.json. Key in .env as MESHY_API_KEY.
 *
 * Usage:
 *   node scripts/generate-autumn-meshy.mjs              # all assets
 *   node scripts/generate-autumn-meshy.mjs --only hero-tree-a
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error("MESHY_API_KEY not set."); process.exit(1); }
const AUTH = { Authorization: `Bearer ${KEY}` };
const JSON_HDR = { ...AUTH, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const manifest = JSON.parse(await readFile(resolve("scripts/autumn-meshy-assets.json"), "utf8"));
const outDir = "static/models/autumn";

async function post(body) {
  const res = await fetch(BASE, { method: "POST", headers: JSON_HDR, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${res.status}: ${JSON.stringify(json)}`);
  return json.result;
}
async function waitTask(id, label, { interval = 5000, timeout = 900000 } = {}) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${BASE}/${id}`, { headers: AUTH });
    const json = await res.json();
    process.stdout.write(`  ${label}: ${json.status} ${json.progress ?? 0}%\r`);
    if (json.status === "SUCCEEDED") { console.log(`\n  ${label}: SUCCEEDED`); return json; }
    if (json.status === "FAILED" || json.status === "CANCELED")
      throw new Error(`${label} ${json.status}: ${JSON.stringify(json.task_error ?? json)}`);
    if (Date.now() - start > timeout) throw new Error(`${label} timed out.`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

const failed = [];
for (const a of manifest.assets) {
  if (only && a.id !== only) continue;
  try {
    console.log(`\n=== ${a.id} ===`);
    const prompt = `${manifest.stylePrefix} ${a.prompt}`;
    const previewId = await post({
      mode: "preview", prompt, ai_model: "meshy-6", art_style: "realistic",
      topology: "triangle", target_polycount: manifest.polycount, should_remesh: true,
    });
    console.log(`Preview: ${previewId}`);
    await waitTask(previewId, "preview");
    const refineId = await post({
      mode: "refine", preview_task_id: previewId, enable_pbr: true, texture_prompt: a.texturePrompt,
    });
    console.log(`Refine: ${refineId}`);
    const done = await waitTask(refineId, "refine");
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
console.log("\nNext: node scripts/optimize-autumn-meshy.mjs");
