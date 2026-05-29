#!/usr/bin/env node
/**
 * Generate a 3D stage GLB with the Meshy text-to-3D API.
 *
 * Two-stage flow: preview (geometry) -> refine (PBR textures). Key in
 * gitignored .env as MESHY_API_KEY.
 *
 * Usage:
 *   node scripts/generate-stage-meshy.mjs \
 *     --prompt "ancient sunken stone dais ..." \
 *     --texture-prompt "weathered carved stone with glowing teal cracks ..." \
 *     --out static/models/ocean/stage_meshy_raw.glb
 *
 * Then optimize:  node scripts/optimize-stage-meshy.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) {
  console.error("MESHY_API_KEY not set. Add it to .env or pass inline.");
  process.exit(1);
}
const AUTH = { Authorization: `Bearer ${KEY}` };
const JSON_HDR = { ...AUTH, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const prompt = opt("prompt");
const texturePrompt = opt("texture-prompt", prompt);
const aiModel = opt("ai-model", "meshy-5");
const artStyle = opt("art-style", "realistic");
const polycount = Number(opt("polycount", "30000"));
const out = resolve(opt("out", "static/models/ocean/stage_meshy_raw.glb"));

if (!prompt) {
  console.error("Need --prompt.");
  process.exit(1);
}

async function post(body) {
  const res = await fetch(BASE, { method: "POST", headers: JSON_HDR, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST failed ${res.status}: ${JSON.stringify(json)}`);
  return json.result;
}

async function waitTask(id, label, { interval = 5000, timeout = 900000 } = {}) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${BASE}/${id}`, { headers: AUTH });
    const json = await res.json();
    process.stdout.write(`  ${label}: ${json.status} ${json.progress ?? 0}%\r`);
    if (json.status === "SUCCEEDED") {
      console.log(`\n  ${label}: SUCCEEDED`);
      return json;
    }
    if (json.status === "FAILED" || json.status === "CANCELED") {
      throw new Error(`${label} ${json.status}: ${JSON.stringify(json.task_error ?? json)}`);
    }
    if (Date.now() - start > timeout) throw new Error(`${label} timed out.`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

// 1. preview (geometry)
const previewId = await post({
  mode: "preview",
  prompt,
  ai_model: aiModel,
  art_style: artStyle,
  topology: "triangle",
  target_polycount: polycount,
  should_remesh: true,
});
console.log(`Preview submitted: ${previewId}`);
await waitTask(previewId, "preview");

// 2. refine (PBR textures)
const refineId = await post({
  mode: "refine",
  preview_task_id: previewId,
  enable_pbr: true,
  texture_prompt: texturePrompt,
});
console.log(`Refine submitted: ${refineId}`);
const done = await waitTask(refineId, "refine");

// 3. download GLB
const glbUrl = done.model_urls?.glb;
if (!glbUrl) throw new Error(`No GLB in result: ${JSON.stringify(done.model_urls)}`);
await mkdir(dirname(out), { recursive: true });
const bin = Buffer.from(await (await fetch(glbUrl)).arrayBuffer());
await writeFile(out, bin);
console.log(`\nDownloaded GLB -> ${out} (${(bin.length / 1024).toFixed(1)} KB)`);
console.log("Next: node scripts/optimize-stage-meshy.mjs");
