#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";
const MANIFEST_PATH = resolve("scripts/forest-tree-regeneration.json");
const args = new Set(process.argv.slice(2));
const previewOnly = args.has("--preview-only");
const refineOnly = args.has("--refine-only");
const dryRun = args.has("--dry-run");

if (previewOnly && refineOnly) {
  throw new Error("Choose at most one of --preview-only and --refine-only.");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envFile = resolve(".env");
  if (!existsSync(envFile)) return null;
  const envText = await readFile(envFile, "utf8");
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(`${name}=`));
  if (!line) return null;
  return line.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
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
      console.warn(`Meshy retry ${attempt}/${attempts - 1} in ${delay / 1000}s`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

async function submitPaidTask(body, headers) {
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Meshy POST outcome is unknown; reconcile recent tasks before retrying. ${error.message}`
    );
  }
  const json = await response.json();
  if (!response.ok) throw new Error(`POST ${response.status}: ${JSON.stringify(json)}`);
  return json.result;
}

async function getTask(id, auth) {
  const response = await fetchWithRetry(`${API_URL}/${id}`, { headers: auth });
  const task = await response.json();
  if (!response.ok) throw new Error(`GET ${response.status}: ${JSON.stringify(task)}`);
  return task;
}

async function waitForTask(id, label, auth) {
  const startedAt = Date.now();
  for (;;) {
    const task = await getTask(id, auth);
    process.stdout.write(`  ${label}: ${task.status} ${task.progress ?? 0}%\r`);
    if (task.status === "SUCCEEDED") {
      console.log(`\n  ${label}: SUCCEEDED (${task.consumed_credits ?? "?"} credits)`);
      return task;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`${label} ${task.status}: ${JSON.stringify(task.task_error ?? task)}`);
    }
    if (Date.now() - startedAt > 900_000) throw new Error(`${label} timed out.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
}

async function balance(auth) {
  const response = await fetchWithRetry(BALANCE_URL, { headers: auth });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Balance check failed ${response.status}: ${JSON.stringify(json)}`);
  }
  return Number(json.balance);
}

function validateGlb(bytes, label) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`${label} is not a valid binary glTF (${bytes.length} bytes).`);
  }
}

async function downloadGlb(task, output) {
  const glbUrl = task.model_urls?.glb;
  if (!glbUrl) throw new Error(`No GLB URL: ${JSON.stringify(task.model_urls)}`);
  const response = await fetchWithRetry(glbUrl);
  if (!response.ok) throw new Error(`GLB download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  validateGlb(bytes, output);
  await mkdir(dirname(output), { recursive: true });
  const partial = `${output}.part`;
  await rm(partial, { force: true });
  await writeFile(partial, bytes);
  await rename(partial, output);
  return bytes.length;
}

const manifestBytes = await readFile(MANIFEST_PATH);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const candidate = manifest.candidate;
if (candidate.prompt.length > 600) throw new Error("Geometry prompt exceeds 600 characters.");
if (candidate.texturePrompt.length > 600) throw new Error("Texture prompt exceeds 600 characters.");

const key = await readEnvValue("MESHY_API_KEY");
if (!key) throw new Error("MESHY_API_KEY is not configured.");
const auth = { Authorization: `Bearer ${key}` };
const jsonHeaders = { ...auth, "Content-Type": "application/json" };
const statePath = resolve(manifest.statePath);
const outputDirectory = resolve(manifest.outputDirectory);
const previewOutput = resolve(outputDirectory, `${candidate.id}_preview.glb`);
const refinedOutput = resolve(outputDirectory, `${candidate.id}_raw.glb`);
const state = existsSync(statePath)
  ? JSON.parse(await readFile(statePath, "utf8"))
  : { contractVersion: manifest.version, candidateId: candidate.id };

async function saveState() {
  await mkdir(dirname(statePath), { recursive: true });
  const partial = `${statePath}.part`;
  await writeFile(partial, `${JSON.stringify(state, null, 2)}\n`);
  await rename(partial, statePath);
}

const previewRequest = {
  mode: "preview",
  prompt: candidate.prompt,
  ai_model: candidate.aiModel,
  model_type: "standard",
  topology: "triangle",
  should_remesh: true,
  target_polycount: candidate.polycount,
  auto_size: true,
  origin_at: "bottom",
  target_formats: ["glb"],
};
const refineRequest = {
  mode: "refine",
  preview_task_id: state.previewTaskId ?? "PENDING_PREVIEW_TASK",
  ai_model: candidate.aiModel,
  enable_pbr: true,
  texture_resolution: candidate.textureResolution,
  texture_prompt: candidate.texturePrompt,
  remove_lighting: candidate.aiModel === "meshy-6",
  auto_size: true,
  origin_at: "bottom",
  target_formats: ["glb"],
  alpha_thumbnail: true,
};
const previewSignature = sha256(JSON.stringify(previewRequest));

if (state.previewTaskId && state.previewInputSignature !== previewSignature) {
  throw new Error(
    `Preview inputs changed after paid task ${state.previewTaskId}; reconcile before retrying.`
  );
}

const runPreview = !refineOnly;
const runRefine = !previewOnly;
let newCredits = 0;
if (runPreview && !state.previewTaskId) newCredits += manifest.cost.previewCredits;
if (runRefine && !state.refineTaskId) newCredits += manifest.cost.refineCredits;
const priorDiagnosticCredits = Number(manifest.cost.priorDiagnosticCredits ?? 0);
const recordedCredits =
  priorDiagnosticCredits +
  Number(state.previewConsumedCredits ?? 0) +
  Number(state.refineConsumedCredits ?? 0);
if (recordedCredits + newCredits > manifest.cost.maximumCredits) {
  throw new Error(
    `Candidate would reach ${recordedCredits + newCredits} credits; cap is ${manifest.cost.maximumCredits}.`
  );
}

const startingBalance = await balance(auth);
if (newCredits > startingBalance) {
  throw new Error(`Run needs ${newCredits} credits; balance is ${startingBalance}.`);
}
console.log(
  `Meshy balance ${startingBalance}; ${newCredits} new credits authorized; ` +
    `${priorDiagnosticCredits} diagnostic credits already spent; hard cap ${manifest.cost.maximumCredits}.`
);

if (dryRun) {
  console.log(JSON.stringify({ previewRequest, refineRequest, state, outputs: { previewOutput, refinedOutput } }, null, 2));
  console.log("Dry run: nothing submitted, no credits spent.");
  process.exit(0);
}

state.contractVersion = manifest.version;
state.candidateId = candidate.id;
state.manifestPath = "scripts/forest-tree-regeneration.json";
state.manifestSha256 = sha256(manifestBytes);
state.balanceBeforeLatestRun = startingBalance;
await saveState();

if (runPreview) {
  if (!state.previewTaskId) {
    state.previewTaskId = await submitPaidTask(previewRequest, jsonHeaders);
    state.previewInputSignature = previewSignature;
    state.previewSubmittedAt = new Date().toISOString();
    await saveState();
    console.log(`Preview submitted: ${state.previewTaskId}`);
  } else {
    console.log(`Resuming preview: ${state.previewTaskId}`);
  }
  const previewTask = await waitForTask(state.previewTaskId, "preview", auth);
  state.previewStatus = previewTask.status;
  state.previewConsumedCredits = previewTask.consumed_credits ?? null;
  if (!existsSync(previewOutput)) {
    state.previewBytes = await downloadGlb(previewTask, previewOutput);
  }
  state.previewDownloadedAt = new Date().toISOString();
  await saveState();
}

if (runRefine) {
  if (!state.previewTaskId) throw new Error("Refine requires a completed preview task.");
  const previewTask = await getTask(state.previewTaskId, auth);
  if (previewTask.status !== "SUCCEEDED") {
    throw new Error(`Preview ${state.previewTaskId} is ${previewTask.status}, not SUCCEEDED.`);
  }
  const paidRefineRequest = { ...refineRequest, preview_task_id: state.previewTaskId };
  const refineSignature = sha256(JSON.stringify(paidRefineRequest));
  if (state.refineTaskId && state.refineInputSignature !== refineSignature) {
    throw new Error(
      `Refine inputs changed after paid task ${state.refineTaskId}; reconcile before retrying.`
    );
  }
  if (!state.refineTaskId) {
    state.refineTaskId = await submitPaidTask(paidRefineRequest, jsonHeaders);
    state.refineInputSignature = refineSignature;
    state.refineSubmittedAt = new Date().toISOString();
    await saveState();
    console.log(`Refine submitted: ${state.refineTaskId}`);
  } else {
    console.log(`Resuming refine: ${state.refineTaskId}`);
  }
  const refineTask = await waitForTask(state.refineTaskId, "refine", auth);
  state.refineStatus = refineTask.status;
  state.refineConsumedCredits = refineTask.consumed_credits ?? null;
  if (!existsSync(refinedOutput)) {
    state.refinedBytes = await downloadGlb(refineTask, refinedOutput);
  }
  state.refinedDownloadedAt = new Date().toISOString();
  state.thumbnailUrl = refineTask.thumbnail_url ?? null;
  state.alphaThumbnailUrl = refineTask.alpha_thumbnail_url ?? null;
  state.textureUrls = refineTask.texture_urls ?? [];
  await saveState();
}

state.balanceAfterLatestRun = await balance(auth);
state.totalConsumedCredits =
  Number(state.previewConsumedCredits ?? 0) + Number(state.refineConsumedCredits ?? 0);
state.priorDiagnosticCredits = priorDiagnosticCredits;
state.totalProjectCredits = state.totalConsumedCredits + priorDiagnosticCredits;
state.completedAt = runRefine ? new Date().toISOString() : state.completedAt ?? null;
await saveState();
console.log(
  `Meshy balance ${state.balanceAfterLatestRun}; Meshy 6 candidate consumed ` +
    `${state.totalConsumedCredits} credits; regeneration track total ${state.totalProjectCredits}.`
);
