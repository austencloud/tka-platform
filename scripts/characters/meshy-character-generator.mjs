/**
 * Meshy performer generator: text-to-3D preview -> PBR refine -> auto-rig.
 *
 * Reuses the paid-API rails from scripts/lib/meshy-text-generator.mjs (task ids
 * are checkpointed before polling, a POST is never retried, the batch is priced
 * against the manifest cap and the live balance, downloads land on a .part
 * file) and adds the rigging step so the output is a rigged GLB that
 * characters:intake-batch accepts as-is. Every asset also gets its provenance
 * sidecar written beside the GLB, so the downloads folder is intake-ready.
 *
 *   MESHY_API_KEY=... node --import tsx scripts/characters/meshy-character-generator.mjs \
 *     --manifest scripts/characters/meshy-performers.json \
 *     --output D:/Downloads/meshy-performers [--only juniper,rosa] [--dry-run] [--force]
 *
 * Assets run concurrently: each one is an independent chain of paid tasks, and
 * waiting on them one after another would cost an hour of wall clock for
 * nothing. State lives in <output>/.meshy-state.json.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createMeshyPreviewBody,
  createMeshyRefineBody,
} from "../lib/meshy-text-generator.mjs";
import { prepareMeshyRig } from "./meshy-rig-prepare.mjs";

const TEXT_TO_3D_URL = "https://api.meshy.ai/openapi/v2/text-to-3d";
const RIGGING_URL = "https://api.meshy.ai/openapi/v1/rigging";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";

export const MESHY_TERMS_URL = "https://www.meshy.ai/terms-of-use";
export const MESHY_OWNERSHIP_ARTICLE_URL =
  "https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models";

const VALUE_ARGUMENTS = ["--manifest", "--output", "--only"];
const FLAG_ARGUMENTS = ["--dry-run", "--force"];

export function parseGeneratorArguments(args) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    // pnpm run forwards a bare "--" to the script; it separates nothing here.
    if (argument === "--") continue;
    if (FLAG_ARGUMENTS.includes(argument)) {
      flags.add(argument);
      continue;
    }
    if (!VALUE_ARGUMENTS.includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument] = value;
    index += 1;
  }
  for (const required of ["--manifest", "--output"]) {
    if (!values[required]) throw new Error(`${required} is required`);
  }
  return {
    manifestPath: values["--manifest"],
    outputDirectory: values["--output"],
    only: values["--only"] ?? null,
    dryRun: flags.has("--dry-run"),
    force: flags.has("--force"),
  };
}

export function createMeshyRiggingBody(asset, refineTaskId) {
  return {
    input_task_id: refineTaskId,
    height_meters: asset.heightMeters ?? 1.7,
  };
}

/**
 * Provenance for a Meshy-generated performer on a paid plan: Meshy's ownership
 * article says paid-plan output is owned outright by the account holder as
 * long as it is never published to the Meshy Community, so the two rights the
 * intake gate checks are both allowed and the community restriction is the
 * one thing worth recording.
 */
export function buildMeshyProvenance({
  asset,
  taskIds,
  retrievedAt,
  acquiredAt,
}) {
  return {
    schemaVersion: 1,
    id: asset.id,
    displayName: asset.displayName ?? asset.id,
    description: asset.description ?? "",
    source: {
      provider: "Meshy",
      assetName: `${asset.displayName ?? asset.id} (text-to-3D + auto-rig)`,
      assetId: `preview ${taskIds.previewId}; refine ${taskIds.refineId}; rig ${taskIds.rigId}`,
      creator: "Flow Arts Composer (generated with Meshy on a paid plan)",
      url: "https://www.meshy.ai/",
    },
    license: {
      name: "Meshy Terms of Use, paid plan ownership",
      url: MESHY_TERMS_URL,
    },
    rights: {
      commercialUse: "allowed",
      applicationRuntimeDistribution: "allowed",
      rawSourceRedistribution: "allowed",
      attributionRequired: false,
      restrictions: [
        "Never publish this model to the Meshy Community; doing so releases it under CC0 and forfeits private ownership.",
      ],
    },
    evidence: [
      {
        url: MESHY_OWNERSHIP_ARTICLE_URL,
        retrievedAt,
        note: "Meshy help center, read the day of generation: paid-plan users retain full private ownership of generated assets unless published to the Meshy Community; free-plan output is CC BY 4.0 instead. Generated through the API on the account that holds the MESHY_API_KEY in .env.",
      },
    ],
    acquiredAt,
  };
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
    .replace(/^["']|["']$/g, "");
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
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

async function downloadVerifiedGlb(url, output) {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`GLB download failed: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
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
  return bytes.length;
}

export async function runMeshyCharacterGeneration(options) {
  const manifestFile = resolve(options.manifestPath);
  const outputDir = resolve(options.outputDirectory);
  const rawDir = resolve(outputDir, "raw");
  const stateFile = resolve(outputDir, ".meshy-state.json");

  const key = await readEnvValue("MESHY_API_KEY");
  if (!key) throw new Error("MESHY_API_KEY is not configured.");
  const auth = { Authorization: `Bearer ${key}` };
  const jsonHeaders = { ...auth, "Content-Type": "application/json" };

  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const onlyIds = options.only ? options.only.split(",") : null;
  const selected = manifest.assets.filter(
    (asset) => !onlyIds || onlyIds.includes(asset.id)
  );
  if (selected.length === 0) throw new Error(`Unknown asset: ${options.only}`);

  const state = existsSync(stateFile)
    ? JSON.parse(await readFile(stateFile, "utf8"))
    : { assets: {} };
  let saving = Promise.resolve();
  function saveState() {
    saving = saving.then(async () => {
      await mkdir(dirname(stateFile), { recursive: true });
      await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
    });
    return saving;
  }

  async function post(url, body) {
    let response;
    try {
      response = await fetch(url, {
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
    url,
    label,
    { interval = 8000, timeout = 1_800_000 } = {}
  ) {
    const start = Date.now();
    let lastLine = "";
    for (;;) {
      const response = await fetchWithRetry(url, { headers: auth });
      const task = await response.json();
      if (!response.ok) {
        throw new Error(`GET ${response.status}: ${JSON.stringify(task)}`);
      }
      const line = `${label}: ${task.status} ${task.progress ?? 0}%`;
      if (line !== lastLine) {
        console.log(`  ${line}`);
        lastLine = line;
      }
      if (task.status === "SUCCEEDED") return task;
      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(
          `${label} ${task.status}: ${JSON.stringify(task.task_error ?? task)}`
        );
      }
      if (Date.now() - start > timeout) throw new Error(`${label} timed out.`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, interval));
    }
  }

  const riggedPath = (asset) => resolve(outputDir, `${asset.id}.glb`);
  const pending = selected.filter(
    (asset) => options.force || !existsSync(riggedPath(asset))
  );
  const unsubmitted = pending.filter(
    (asset) => options.force || !state.assets[asset.id]?.previewId
  );
  const estimatedCredits =
    unsubmitted.length * (manifest.estimatedCreditsPerAsset ?? 50);

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
    `Meshy balance ${balanceJson.balance}; up to ${estimatedCredits} new credits for ${unsubmitted.length} unsubmitted performer(s).`
  );
  if (options.dryRun) {
    for (const asset of pending) console.log(`  would submit ${asset.id}`);
    console.log("\nDry run: nothing submitted, no credits spent.");
    return { failed: [], completed: [] };
  }

  async function generate(asset) {
    const assetState = options.force ? {} : (state.assets[asset.id] ?? {});
    state.assets[asset.id] = assetState;
    const tag = `[${asset.id}]`;

    if (!assetState.previewId) {
      assetState.previewId = await post(
        TEXT_TO_3D_URL,
        createMeshyPreviewBody(manifest, asset)
      );
      await saveState();
      console.log(`${tag} preview submitted: ${assetState.previewId}`);
    } else {
      console.log(`${tag} resuming preview: ${assetState.previewId}`);
    }
    const preview = await waitTask(
      `${TEXT_TO_3D_URL}/${assetState.previewId}`,
      `${tag} preview`
    );
    assetState.previewThumbnail = preview.thumbnail_url ?? null;
    await saveState();

    if (!assetState.refineId) {
      assetState.refineId = await post(
        TEXT_TO_3D_URL,
        createMeshyRefineBody(manifest, asset, assetState.previewId)
      );
      await saveState();
      console.log(`${tag} refine submitted: ${assetState.refineId}`);
    } else {
      console.log(`${tag} resuming refine: ${assetState.refineId}`);
    }
    const refined = await waitTask(
      `${TEXT_TO_3D_URL}/${assetState.refineId}`,
      `${tag} refine`
    );
    assetState.refineThumbnail = refined.thumbnail_url ?? null;
    if (refined.model_urls?.glb) {
      const staticOutput = resolve(rawDir, `${asset.id}-unrigged.glb`);
      if (options.force || !existsSync(staticOutput)) {
        await downloadVerifiedGlb(refined.model_urls.glb, staticOutput);
        console.log(`${tag} unrigged refine saved: ${basename(staticOutput)}`);
      }
    }
    await saveState();

    if (!assetState.rigId) {
      assetState.rigId = await post(
        RIGGING_URL,
        createMeshyRiggingBody(asset, assetState.refineId)
      );
      await saveState();
      console.log(`${tag} rig submitted: ${assetState.rigId}`);
    } else {
      console.log(`${tag} resuming rig: ${assetState.rigId}`);
    }
    const rigged = await waitTask(
      `${RIGGING_URL}/${assetState.rigId}`,
      `${tag} rig`
    );
    const riggedUrl = rigged.result?.rigged_character_glb_url;
    if (!riggedUrl) {
      throw new Error(
        `${tag} rig succeeded without a GLB: ${JSON.stringify(rigged.result)}`
      );
    }
    assetState.riggedFbxUrl = rigged.result.rigged_character_fbx_url ?? null;
    const output = riggedPath(asset);
    const riggedOriginal = resolve(rawDir, `${asset.id}-rigged-original.glb`);
    await downloadVerifiedGlb(riggedUrl, riggedOriginal);
    const prepared = prepareMeshyRig({
      riggedPath: riggedOriginal,
      unriggedPath: resolve(rawDir, `${asset.id}-unrigged.glb`),
      outputPath: output,
    });
    console.log(
      `${tag} rig prepared: ${prepared.jointChanges.length} joints renamed, ${prepared.emissiveRemoved} emissive removed`
    );
    const bytes = (await stat(output)).size;
    const acquiredAt = new Date().toISOString();
    assetState.downloadedAt = acquiredAt;
    assetState.bytes = bytes;
    assetState.consumedCredits = {
      preview: preview.consumed_credits ?? null,
      refine: refined.consumed_credits ?? null,
      rig: rigged.consumed_credits ?? null,
    };
    await saveState();

    const provenance = buildMeshyProvenance({
      asset,
      taskIds: assetState,
      retrievedAt: acquiredAt.slice(0, 10),
      acquiredAt,
    });
    await writeFile(
      resolve(outputDir, `${asset.id}.provenance.json`),
      `${JSON.stringify(provenance, null, 2)}\n`
    );
    console.log(
      `${tag} rigged GLB saved (${(bytes / 1024 / 1024).toFixed(1)} MB) with provenance sidecar`
    );
    return asset.id;
  }

  const outcomes = await Promise.allSettled(
    selected.map(async (asset) => {
      if (!options.force && existsSync(riggedPath(asset))) {
        console.log(`[${asset.id}] already downloaded`);
        return asset.id;
      }
      return generate(asset);
    })
  );
  const failed = [];
  const completed = [];
  outcomes.forEach((outcome, index) => {
    const id = selected[index].id;
    if (outcome.status === "fulfilled") completed.push(id);
    else {
      failed.push(id);
      console.error(
        `\n${id} FAILED: ${outcome.reason?.message ?? outcome.reason}`
      );
    }
  });
  await saving;
  return { failed, completed };
}

async function main() {
  try {
    const options = parseGeneratorArguments(process.argv.slice(2));
    const { failed, completed } = await runMeshyCharacterGeneration(options);
    if (completed.length > 0) {
      console.log(`\nReady for intake: ${completed.join(", ")}`);
    }
    if (failed.length > 0) {
      console.error(`Failed performers: ${failed.join(", ")}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
