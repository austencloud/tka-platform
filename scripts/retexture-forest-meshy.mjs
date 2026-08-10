#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const RETEXTURE_URL = "https://api.meshy.ai/openapi/v1/retexture";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";
const MANIFEST_PATH = resolve("scripts/forest-meshy-retextures.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(resolve(".env"))) return null;
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
    response = await fetch(RETEXTURE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Meshy POST outcome is unknown; reconcile recent retexture tasks before retrying. ${error.message}`
    );
  }
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${response.status}: ${JSON.stringify(json)}`);
  }
  return json.result;
}

async function waitForTask(id, auth) {
  const startedAt = Date.now();
  for (;;) {
    const response = await fetchWithRetry(`${RETEXTURE_URL}/${id}`, {
      headers: auth,
    });
    const task = await response.json();
    if (!response.ok) {
      throw new Error(`GET ${response.status}: ${JSON.stringify(task)}`);
    }
    process.stdout.write(`  ${task.status} ${task.progress ?? 0}%\r`);
    if (task.status === "SUCCEEDED") {
      console.log("  SUCCEEDED       ");
      return task;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(
        `Retexture ${task.status}: ${JSON.stringify(task.task_error ?? task)}`
      );
    }
    if (Date.now() - startedAt > 900_000) {
      throw new Error(`Retexture ${id} timed out.`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
}

function validateGlb(bytes, label) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`${label} is not a valid binary glTF (${bytes.length} bytes).`);
  }
}

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const dryRun = args.includes("--dry-run");
const manifestBytes = await readFile(MANIFEST_PATH);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const sourceState = JSON.parse(
  await readFile(resolve(manifest.sourceStatePath), "utf8")
);
const statePath = resolve(manifest.statePath);
const state = existsSync(statePath)
  ? JSON.parse(await readFile(statePath, "utf8"))
  : { contractVersion: manifest.version, assets: {} };
const selected = manifest.assets.filter((asset) => !only || asset.id === only);
if (selected.length === 0) throw new Error(`Unknown asset: ${only}`);

const key = await readEnvValue("MESHY_API_KEY");
if (!key) throw new Error("MESHY_API_KEY is not configured.");
const auth = { Authorization: `Bearer ${key}` };
const jsonHeaders = { ...auth, "Content-Type": "application/json" };

async function saveState() {
  await mkdir(dirname(statePath), { recursive: true });
  const partial = `${statePath}.part`;
  await writeFile(partial, `${JSON.stringify(state, null, 2)}\n`);
  await rename(partial, statePath);
}

const prepared = selected.map((asset) => {
  const source = sourceState.assets?.[asset.sourceAssetId];
  if (!source?.taskId || source.status !== "SUCCEEDED") {
    throw new Error(`Missing successful source task for ${asset.sourceAssetId}.`);
  }
  if (asset.textStylePrompt.length > 600) {
    throw new Error(`${asset.id} textStylePrompt exceeds Meshy's 600-character limit.`);
  }
  const request = {
    input_task_id: source.taskId,
    text_style_prompt: asset.textStylePrompt,
    ai_model: manifest.aiModel,
    enable_original_uv: true,
    enable_pbr: true,
    texture_resolution: manifest.textureResolution,
    remove_lighting: true,
    target_formats: ["glb"],
    alpha_thumbnail: true,
  };
  const signature = sha256(JSON.stringify(request));
  const output = resolve(manifest.outputDirectory, `${asset.id}_raw.glb`);
  const assetState = state.assets[asset.id];
  if (assetState?.taskId && assetState.inputSignature !== signature) {
    throw new Error(
      `${asset.id} inputs changed after paid task ${assetState.taskId}; reconcile the saved task before retrying.`
    );
  }
  return { asset, request, signature, output };
});

const unsubmitted = prepared.filter(
  ({ asset, output }) => !existsSync(output) && !state.assets[asset.id]?.taskId
);
const estimatedCredits =
  unsubmitted.length * (manifest.estimatedCreditsPerAsset ?? 10);
const balanceResponse = await fetchWithRetry(BALANCE_URL, { headers: auth });
const balanceJson = await balanceResponse.json();
if (!balanceResponse.ok) {
  throw new Error(
    `Balance check failed ${balanceResponse.status}: ${JSON.stringify(balanceJson)}`
  );
}
if (estimatedCredits > manifest.maxCredits) {
  throw new Error(
    `Batch estimate ${estimatedCredits} exceeds manifest cap ${manifest.maxCredits}.`
  );
}
if (estimatedCredits > Number(balanceJson.balance)) {
  throw new Error(
    `Batch needs ${estimatedCredits} credits; balance is ${balanceJson.balance}.`
  );
}

console.log(
  `Meshy balance ${balanceJson.balance}; ${estimatedCredits} new credits authorized for this run.`
);
if (dryRun) {
  for (const { asset, request, output } of prepared) {
    console.log(
      JSON.stringify(
        {
          asset: asset.id,
          output,
          request,
          alreadySubmitted: Boolean(state.assets[asset.id]?.taskId),
          alreadyDownloaded: existsSync(output),
        },
        null,
        2
      )
    );
  }
  process.exit(0);
}

state.contractVersion = manifest.version;
state.manifestPath = "scripts/forest-meshy-retextures.json";
state.manifestSha256 = sha256(manifestBytes);
await saveState();

for (const { asset, request, signature, output } of prepared) {
  if (existsSync(output)) {
    const bytes = await readFile(output);
    validateGlb(bytes, output);
    console.log(`${asset.id}: already downloaded and valid`);
    continue;
  }

  const assetState = state.assets[asset.id] ?? {
    sourceAssetId: asset.sourceAssetId,
    sourceTaskId: request.input_task_id,
    inputSignature: signature,
  };
  state.assets[asset.id] = assetState;
  if (!assetState.taskId) {
    assetState.taskId = await submitPaidTask(request, jsonHeaders);
    assetState.submittedAt = new Date().toISOString();
    await saveState();
    console.log(`${asset.id}: submitted ${assetState.taskId}`);
  } else {
    console.log(`${asset.id}: resuming ${assetState.taskId}`);
  }

  const complete = await waitForTask(assetState.taskId, auth);
  const glbUrl = complete.model_urls?.glb;
  if (!glbUrl) throw new Error(`No GLB URL: ${JSON.stringify(complete.model_urls)}`);
  const response = await fetchWithRetry(glbUrl);
  if (!response.ok) throw new Error(`GLB download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  validateGlb(bytes, asset.id);
  await mkdir(dirname(output), { recursive: true });
  const partial = `${output}.part`;
  await rm(partial, { force: true });
  await writeFile(partial, bytes);
  await rename(partial, output);
  Object.assign(assetState, {
    status: complete.status,
    consumedCredits: complete.consumed_credits ?? null,
    downloadedAt: new Date().toISOString(),
    bytes: bytes.length,
    thumbnailUrl: complete.thumbnail_url ?? null,
    alphaThumbnailUrl: complete.alpha_thumbnail_url ?? null,
  });
  await saveState();
  console.log(`${asset.id}: downloaded ${output} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
}

console.log("Forest Meshy retexture candidates are ready for optimization.");
