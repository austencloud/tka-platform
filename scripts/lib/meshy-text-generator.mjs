/**
 * Meshy Text-to-3D batch runner.
 *
 * Sibling of meshy-image-generator.mjs. Extracted from the winter conifer
 * script so a second scene does not mean a second copy of the paid-API
 * safety rails, which are the only interesting part of this file:
 *
 *   - Task IDs are checkpointed to disk BEFORE polling, so a re-run resumes a
 *     paid task instead of buying it twice.
 *   - POST is never retried automatically. Meshy has no idempotency key, so an
 *     ambiguous POST has to be reconciled by hand; retrying it may well be
 *     paying again for work already queued.
 *   - The batch is priced and checked against both a manifest cap and the live
 *     balance before anything is submitted.
 *   - Downloads land on a .part file and are renamed only after the glTF magic
 *     is verified, so an interrupted download can never masquerade as a
 *     finished asset on the next run.
 *
 * The caller supplies paths only; every generation parameter lives in the
 * manifest so a scene's look is reviewable as data.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";

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

export async function runMeshyTextGeneration({
  manifestPath,
  statePath,
  outputDirectory,
  doneMessage = "Meshy assets are ready for optimization.",
}) {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  const manifestFile = resolve(manifestPath);
  const stateFile = resolve(statePath);
  const outputDir = resolve(outputDirectory);

  const key = await readEnvValue("MESHY_API_KEY");
  if (!key) {
    console.error("MESHY_API_KEY is not configured.");
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${key}` };
  const jsonHeaders = { ...auth, "Content-Type": "application/json" };
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const selected = manifest.assets.filter((asset) => !only || asset.id === only);

  if (selected.length === 0) {
    console.error(`Unknown asset: ${only}`);
    process.exit(1);
  }

  const state = existsSync(stateFile)
    ? JSON.parse(await readFile(stateFile, "utf8"))
    : { assets: {} };

  async function saveState() {
    await mkdir(dirname(stateFile), { recursive: true });
    await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
  }

  async function post(body) {
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

  async function waitTask(id, label, { interval = 5000, timeout = 900_000 } = {}) {
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

  const pending = selected.filter(
    (asset) => force || !existsSync(resolve(outputDir, `${asset.id}_raw.glb`))
  );
  const unsubmitted = pending.filter((asset) => !state.assets[asset.id]?.previewId);
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

  if (dryRun) {
    for (const asset of pending) {
      console.log(`  would submit ${asset.id}`);
    }
    console.log("\nDry run: nothing submitted, no credits spent.");
    return;
  }

  const failed = [];
  for (const asset of selected) {
    const output = resolve(outputDir, `${asset.id}_raw.glb`);
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
      if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
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

  console.log(`\n${doneMessage}`);
}
