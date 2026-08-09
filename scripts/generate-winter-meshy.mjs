#!/usr/bin/env node
/**
 * Generate Winter conifer lineup with Meshy Text to 3D.
 *
 * Paid task IDs are checkpointed under blender/ before polling. Re-running the
 * script resumes those tasks instead of paying for duplicates.
 *
 * Usage:
 *   node scripts/generate-winter-meshy.mjs
 *   node scripts/generate-winter-meshy.mjs --only mature-snow-spruce
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";
const MANIFEST_PATH = resolve("scripts/winter-meshy-assets.json");
const STATE_PATH = resolve("blender/winter-meshy-tasks.json");
const OUTPUT_DIRECTORY = resolve("static/models/winter/trees");

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const force = args.includes("--force");

async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envText = await readFile(resolve(".env"), "utf8");
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(`${name}=`));
  if (!line) return null;
  return line
    .split("=")
    .slice(1)
    .join("=")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

const key = await readEnvValue("MESHY_API_KEY");
if (!key) {
  console.error("MESHY_API_KEY is not configured.");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${key}` };
const jsonHeaders = { ...auth, "Content-Type": "application/json" };
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const selected = manifest.assets.filter((asset) => !only || asset.id === only);

if (selected.length === 0) {
  console.error(`Unknown asset: ${only}`);
  process.exit(1);
}

async function readState() {
  if (!existsSync(STATE_PATH)) return { assets: {} };
  return JSON.parse(await readFile(STATE_PATH, "utf8"));
}

const state = await readState();

async function saveState() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

async function fetchWithRetry(url, options, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      const delay = Math.min(10_000, 1000 * 2 ** (attempt - 1));
      console.warn(
        `Meshy retry ${attempt}/${attempts - 1} in ${delay / 1000}s`
      );
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

async function post(body) {
  // Meshy has no idempotency key. An ambiguous paid POST must be reconciled
  // manually, never retried automatically.
  let response;
  try {
    response = await fetch(BASE, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Meshy POST outcome is unknown; stop and reconcile recent tasks before retrying. ${error.message}`
    );
  }
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${response.status}: ${JSON.stringify(json)}`);
  }
  return json.result;
}

async function waitTask(
  id,
  label,
  { interval = 5000, timeout = 900_000 } = {}
) {
  const start = Date.now();
  for (;;) {
    const response = await fetchWithRetry(`${BASE}/${id}`, { headers: auth });
    const task = await response.json();
    if (!response.ok) {
      throw new Error(`GET ${response.status}: ${JSON.stringify(task)}`);
    }
    process.stdout.write(`  ${label}: ${task.status} ${task.progress ?? 0}%\r`);
    if (task.status === "SUCCEEDED") {
      console.log(`\n  ${label}: SUCCEEDED`);
      return task;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(
        `${label} ${task.status}: ${JSON.stringify(task.task_error ?? task)}`
      );
    }
    if (Date.now() - start > timeout) {
      throw new Error(`${label} timed out.`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, interval));
  }
}

const pending = selected.filter((asset) => {
  const output = resolve(OUTPUT_DIRECTORY, `${asset.id}_raw.glb`);
  return force || !existsSync(output);
});
const unsubmitted = pending.filter(
  (asset) => !state.assets[asset.id]?.previewId
);
const estimatedCredits =
  unsubmitted.length * (manifest.estimatedCreditsPerAsset ?? 30);

const balanceResponse = await fetchWithRetry(BALANCE_URL, { headers: auth });
const balanceJson = await balanceResponse.json();
if (!balanceResponse.ok) {
  throw new Error(
    `Balance check failed ${balanceResponse.status}: ${JSON.stringify(balanceJson)}`
  );
}
if (estimatedCredits > (manifest.maxCredits ?? 150)) {
  throw new Error(
    `Batch estimate ${estimatedCredits} exceeds manifest cap ${manifest.maxCredits}.`
  );
}
if (estimatedCredits > balanceJson.balance) {
  throw new Error(
    `Batch needs about ${estimatedCredits} credits; balance is ${balanceJson.balance}.`
  );
}

console.log(
  `Meshy balance ${balanceJson.balance}; up to ${estimatedCredits} new credits for ${unsubmitted.length} unsubmitted assets.`
);

const failed = [];
for (const asset of selected) {
  const output = resolve(OUTPUT_DIRECTORY, `${asset.id}_raw.glb`);
  if (!force && existsSync(output)) {
    console.log(`\n=== ${asset.id}: already downloaded ===`);
    continue;
  }

  try {
    console.log(`\n=== ${asset.id} ===`);
    const assetState = state.assets[asset.id] ?? {};
    state.assets[asset.id] = assetState;

    if (!assetState.previewId) {
      assetState.previewId = await post({
        mode: "preview",
        prompt: `${asset.stylePrefix ?? manifest.stylePrefix} ${asset.prompt}`,
        ai_model: "meshy-6",
        model_type: "standard",
        topology: "triangle",
        target_polycount: asset.polycount ?? manifest.polycount ?? 30_000,
        should_remesh: true,
        target_formats: ["glb"],
      });
      await saveState();
      console.log(`Preview submitted: ${assetState.previewId}`);
    } else {
      console.log(`Resuming preview: ${assetState.previewId}`);
    }
    await waitTask(assetState.previewId, "preview");

    if (!assetState.refineId) {
      assetState.refineId = await post({
        mode: "refine",
        preview_task_id: assetState.previewId,
        ai_model: "meshy-6",
        enable_pbr: true,
        texture_resolution: asset.textureSize >= 4096 ? "4k" : "2k",
        texture_prompt: asset.texturePrompt,
        target_formats: ["glb"],
      });
      await saveState();
      console.log(`Refine submitted: ${assetState.refineId}`);
    } else {
      console.log(`Resuming refine: ${assetState.refineId}`);
    }
    const complete = await waitTask(assetState.refineId, "refine");
    const glbUrl = complete.model_urls?.glb;
    if (!glbUrl) {
      throw new Error(`No GLB URL: ${JSON.stringify(complete.model_urls)}`);
    }

    const modelResponse = await fetchWithRetry(glbUrl);
    if (!modelResponse.ok) {
      throw new Error(`GLB download failed: ${modelResponse.status}`);
    }
    const bytes = Buffer.from(await modelResponse.arrayBuffer());
    if (
      bytes.length < 12 ||
      bytes.subarray(0, 4).toString("ascii") !== "glTF"
    ) {
      throw new Error(
        `Downloaded payload is not a valid binary glTF (${bytes.length} bytes).`
      );
    }
    await mkdir(dirname(output), { recursive: true });
    const partial = `${output}.part`;
    await rm(partial, { force: true });
    await writeFile(partial, bytes);
    await rename(partial, output);
    assetState.downloadedAt = new Date().toISOString();
    assetState.bytes = bytes.length;
    await saveState();
    console.log(
      `Downloaded ${output} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`
    );
  } catch (error) {
    console.error(`\n${asset.id} FAILED: ${error.message}`);
    failed.push(asset.id);
  }
}

if (failed.length > 0) {
  console.error(`\nFailed assets: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("\nWinter Meshy conifer assets are ready for optimization.");
