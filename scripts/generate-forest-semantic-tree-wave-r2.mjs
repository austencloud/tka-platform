#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";
const MANIFEST_PATH = resolve("scripts/forest-semantic-tree-wave-r2.json");
const cli = process.argv.slice(2);
const stage = cli.find((argument) => argument.startsWith("--stage="))?.split("=")[1] ?? "preview";
const speciesArgument = cli.find((argument) => argument.startsWith("--species="))?.split("=")[1];
const dryRun = cli.includes("--dry-run");

if (!new Set(["preview", "refine"]).has(stage)) throw new Error("--stage must be preview or refine.");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envFile = resolve(".env");
  if (!existsSync(envFile)) return null;
  const envText = await readFile(envFile, "utf8");
  const line = envText.split(/\r?\n/).find((candidate) => candidate.trimStart().startsWith(`${name}=`));
  return line ? line.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g, "") : null;
}

async function fetchWithRetry(url, options = {}, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
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

async function getBalance(auth) {
  const response = await fetchWithRetry(BALANCE_URL, { headers: auth });
  const body = await response.json();
  if (!response.ok) throw new Error(`Balance check failed ${response.status}: ${JSON.stringify(body)}`);
  return Number(body.balance);
}

async function submitPaidTask(body, headers) {
  let response;
  try {
    response = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (error) {
    throw new Error(`Meshy POST outcome is unknown; reconcile recent tasks before retrying. ${error.message}`);
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
    if (Date.now() - startedAt > 1_200_000) throw new Error(`${label} timed out.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 6000));
  }
}

function validateGlb(bytes, label) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`${label} is not a valid binary glTF (${bytes.length} bytes).`);
  }
}

async function downloadGlb(task, output) {
  const url = task.model_urls?.glb;
  if (!url) throw new Error(`No GLB URL returned for ${task.id}.`);
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`GLB download failed ${response.status} for ${task.id}.`);
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
const requestedSpecies = speciesArgument ? new Set(speciesArgument.split(",").filter(Boolean)) : null;
const candidates = manifest.candidates.filter(
  (candidate) => !requestedSpecies || requestedSpecies.has(candidate.species) || requestedSpecies.has(candidate.id)
);
if (candidates.length === 0) throw new Error("No candidate matched --species.");
if (requestedSpecies && candidates.length !== requestedSpecies.size) {
  throw new Error(`Some requested species were not found: ${speciesArgument}`);
}
for (const candidate of candidates) {
  if (candidate.prompt.length > 600) throw new Error(`${candidate.id} geometry prompt exceeds 600 characters.`);
  if (candidate.texturePrompt.length > 600) throw new Error(`${candidate.id} texture prompt exceeds 600 characters.`);
}

const key = await readEnvValue("MESHY_API_KEY");
if (!key) throw new Error("MESHY_API_KEY is not configured.");
const auth = { Authorization: `Bearer ${key}` };
const jsonHeaders = { ...auth, "Content-Type": "application/json" };
const statePath = resolve(manifest.statePath);
const state = existsSync(statePath)
  ? JSON.parse(await readFile(statePath, "utf8"))
  : { contractVersion: manifest.version, familyId: manifest.familyId, candidates: {} };

let saveQueue = Promise.resolve();
function saveState() {
  saveQueue = saveQueue.then(async () => {
    await mkdir(dirname(statePath), { recursive: true });
    const partial = `${statePath}.part.${process.pid}`;
    await writeFile(partial, `${JSON.stringify(state, null, 2)}\n`);
    await rename(partial, statePath);
  });
  return saveQueue;
}

function previewRequest(candidate) {
  return {
    mode: "preview",
    prompt: candidate.prompt,
    ai_model: manifest.generation.aiModel,
    model_type: "standard",
    topology: "triangle",
    should_remesh: true,
    target_polycount: manifest.generation.targetPolycount,
    auto_size: true,
    origin_at: "bottom",
    target_formats: ["glb"],
  };
}

function refineRequest(candidate, previewTaskId) {
  return {
    mode: "refine",
    preview_task_id: previewTaskId,
    ai_model: manifest.generation.aiModel,
    enable_pbr: true,
    texture_resolution: manifest.generation.textureResolution,
    texture_prompt: candidate.texturePrompt,
    remove_lighting: true,
    auto_size: true,
    origin_at: "bottom",
    target_formats: ["glb"],
    alpha_thumbnail: true,
  };
}

let newCredits = 0;
for (const candidate of candidates) {
  const candidateState = state.candidates[candidate.id] ?? {};
  if (stage === "preview" && !candidateState.previewTaskId) newCredits += manifest.budget.previewCreditsPerCandidate;
  if (stage === "refine" && !candidateState.refineTaskId) {
    if (!candidateState.previewTaskId) throw new Error(`${candidate.id} has no preview task to refine.`);
    newCredits += manifest.budget.refineCreditsPerCandidate;
  }
}
const recordedCredits = Object.values(state.candidates).reduce(
  (sum, candidate) => sum + Number(candidate.previewConsumedCredits ?? 0) + Number(candidate.refineConsumedCredits ?? 0),
  0
);
if (recordedCredits + newCredits > manifest.budget.maximumCredits) {
  throw new Error(`Wave would reach ${recordedCredits + newCredits} credits; cap is ${manifest.budget.maximumCredits}.`);
}
const balanceBefore = await getBalance(auth);
if (balanceBefore < newCredits) throw new Error(`Run needs ${newCredits} credits; balance is ${balanceBefore}.`);
console.log(`Meshy balance ${balanceBefore}; ${newCredits} new credits authorized for ${stage}; wave cap ${manifest.budget.maximumCredits}.`);

const requests = candidates.map((candidate) => {
  const candidateState = state.candidates[candidate.id] ?? {};
  return stage === "preview" ? previewRequest(candidate) : refineRequest(candidate, candidateState.previewTaskId);
});
if (dryRun) {
  console.log(JSON.stringify({ stage, candidates: candidates.map((candidate) => candidate.id), requests }, null, 2));
  console.log("Dry run: no task submitted and no state written.");
  process.exit(0);
}

state.contractVersion = manifest.version;
state.familyId = manifest.familyId;
state.manifestPath = "scripts/forest-semantic-tree-wave-r2.json";
state.manifestSha256 = sha256(manifestBytes);
state.balanceBeforeLatestRun = balanceBefore;
await saveState();

for (let index = 0; index < candidates.length; index += 1) {
  const candidate = candidates[index];
  const request = requests[index];
  const requestSignature = sha256(JSON.stringify(request));
  const candidateState = state.candidates[candidate.id] ?? { id: candidate.id, species: candidate.species };
  const taskKey = stage === "preview" ? "previewTaskId" : "refineTaskId";
  const signatureKey = stage === "preview" ? "previewInputSignature" : "refineInputSignature";
  if (candidateState[taskKey] && candidateState[signatureKey] !== requestSignature) {
    throw new Error(`${candidate.id} ${stage} inputs changed after paid task ${candidateState[taskKey]}; reconcile before retrying.`);
  }
  if (!candidateState[taskKey]) {
    candidateState[taskKey] = await submitPaidTask(request, jsonHeaders);
    candidateState[signatureKey] = requestSignature;
    candidateState[`${stage}SubmittedAt`] = new Date().toISOString();
    state.candidates[candidate.id] = candidateState;
    await saveState();
    console.log(`${candidate.id} ${stage} submitted: ${candidateState[taskKey]}`);
  } else {
    console.log(`${candidate.id} ${stage} resuming: ${candidateState[taskKey]}`);
  }
}

await Promise.all(
  candidates.map(async (candidate) => {
    const candidateState = state.candidates[candidate.id];
    const taskId = candidateState[stage === "preview" ? "previewTaskId" : "refineTaskId"];
    const task = await waitForTask(taskId, `${candidate.species} ${stage}`, auth);
    candidateState[`${stage}Status`] = task.status;
    candidateState[`${stage}ConsumedCredits`] = task.consumed_credits ?? null;
    candidateState[`${stage}FinishedAt`] = new Date().toISOString();
    const suffix = stage === "preview" ? "preview" : "refined_raw";
    const output = resolve(manifest.outputDirectory, `${candidate.id}_${suffix}.glb`);
    if (!existsSync(output)) candidateState[`${stage}Bytes`] = await downloadGlb(task, output);
    if (stage === "refine") {
      candidateState.thumbnailUrl = task.thumbnail_url ?? null;
      candidateState.alphaThumbnailUrl = task.alpha_thumbnail_url ?? null;
      candidateState.textureUrls = task.texture_urls ?? [];
    }
    await saveState();
  })
);

state.balanceAfterLatestRun = await getBalance(auth);
state.totalConsumedCredits = Object.values(state.candidates).reduce(
  (sum, candidate) => sum + Number(candidate.previewConsumedCredits ?? 0) + Number(candidate.refineConsumedCredits ?? 0),
  0
);
state.latestRunCompletedAt = new Date().toISOString();
await saveState();
console.log(`Meshy balance ${state.balanceAfterLatestRun}; R2 wave has consumed ${state.totalConsumedCredits} credits.`);
