import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const SINGLE_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MULTI_URL = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
const BALANCE_URL = "https://api.meshy.ai/openapi/v1/balance";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
      console.warn(
        `Meshy retry ${attempt}/${attempts - 1} in ${delay / 1000}s`
      );
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw lastError;
}

async function submitPaidTask(url, body, headers) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
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

async function waitForTask(url, id, label, auth, options = {}) {
  const interval = options.interval ?? 5000;
  const timeout = options.timeout ?? 900_000;
  const start = Date.now();
  for (;;) {
    const response = await fetchWithRetry(`${url}/${id}`, { headers: auth });
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

function mimeFor(extension) {
  return extension === ".png" ? "image/png" : "image/jpeg";
}

export function sortMeshyImageNames(names, preferredOrder = []) {
  if (preferredOrder.length === 0) return [...names].sort();
  const rank = new Map(
    preferredOrder.map((name, index) => [name.toLowerCase(), index])
  );
  return [...names].sort((left, right) => {
    const leftRank = rank.get(left.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.localeCompare(right);
  });
}

export async function loadMeshyInputImages(directory, preferredOrder) {
  if (!existsSync(directory)) return [];
  const names = sortMeshyImageNames(
    (await readdir(directory)).filter((name) =>
      IMAGE_EXTENSIONS.has(extname(name).toLowerCase())
    ),
    preferredOrder
  );
  if (names.length > 4) {
    throw new Error(
      `${directory} contains ${names.length} images; Meshy accepts 1-4.`
    );
  }
  return Promise.all(
    names.map(async (name) => {
      const path = join(directory, name);
      const bytes = await readFile(path);
      const extension = extname(name).toLowerCase();
      return {
        name,
        sha256: sha256(bytes),
        dataUri: `data:${mimeFor(extension)};base64,${bytes.toString("base64")}`,
      };
    })
  );
}

export function createMeshyImageTaskBody(manifest, asset, images) {
  const aiModel = asset.aiModel ?? manifest.aiModel ?? "meshy-6";
  const shouldTexture = asset.shouldTexture ?? manifest.shouldTexture ?? true;
  const shouldRemesh = asset.shouldRemesh ?? manifest.shouldRemesh ?? true;
  const body = {
    ai_model: aiModel,
    should_texture: shouldTexture,
    should_remesh: shouldRemesh,
    target_formats: ["glb"],
    auto_size: true,
    origin_at: "bottom",
    multi_view_thumbnails: true,
    alpha_thumbnail: true,
    moderation: true,
  };

  if (shouldTexture) {
    body.enable_pbr = asset.enablePbr ?? manifest.enablePbr ?? true;
    body.texture_resolution =
      asset.textureResolution ?? manifest.textureResolution ?? "2k";
    if (asset.texturePrompt) body.texture_prompt = asset.texturePrompt;

    // Meshy 7 no longer accepts this control. Neutral references and a later
    // material pass keep its captured illumination out of the shipped scene.
    if (aiModel === "meshy-6") {
      body.remove_lighting =
        asset.removeLighting ?? manifest.removeLighting ?? true;
    }
  }

  if (shouldRemesh) {
    body.topology = asset.topology ?? manifest.topology ?? "triangle";
    body.target_polycount = asset.polycount ?? manifest.polycount ?? 30_000;
  }

  if (images.length === 1) {
    return {
      url: SINGLE_URL,
      body: {
        ...body,
        model_type: asset.modelType ?? manifest.modelType ?? "standard",
        image_url: images[0].dataUri,
      },
    };
  }
  return {
    url: MULTI_URL,
    body: { ...body, image_urls: images.map((image) => image.dataUri) },
  };
}

function inputSignature(manifest, asset, images) {
  return sha256(
    JSON.stringify({
      aiModel: manifest.aiModel ?? "meshy-6",
      asset,
      images: images.map(({ name, sha256: imageSha256 }) => ({
        name,
        sha256: imageSha256,
      })),
    })
  );
}

function validateGlb(bytes, label) {
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(
      `${label} is not a valid binary glTF (${bytes.length} bytes).`
    );
  }
}

export async function runMeshyImageGeneration({
  manifestPath,
  defaultImageRoot,
  defaultOutputDirectory,
  defaultStatePath,
}) {
  const resolvedManifestPath = resolve(manifestPath);
  const manifestBytes = await readFile(resolvedManifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const imageRoot = resolve(manifest.imageRoot ?? defaultImageRoot);
  const outputDirectory = resolve(
    manifest.outputDirectory ?? defaultOutputDirectory
  );
  const statePath = resolve(manifest.statePath ?? defaultStatePath);
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
  const dryRun = args.includes("--dry-run");
  const selected = manifest.assets.filter(
    (asset) => !only || asset.id === only
  );
  if (selected.length === 0) throw new Error(`Unknown asset: ${only}`);

  const key = await readEnvValue("MESHY_API_KEY");
  if (!key) throw new Error("MESHY_API_KEY is not configured.");
  const auth = { Authorization: `Bearer ${key}` };
  const jsonHeaders = { ...auth, "Content-Type": "application/json" };
  const state = existsSync(statePath)
    ? JSON.parse(await readFile(statePath, "utf8"))
    : { contractVersion: 1, assets: {} };
  state.contractVersion = 1;
  state.manifestPath = manifestPath.replaceAll("\\", "/");
  state.manifestSha256 = sha256(manifestBytes);

  async function saveState() {
    await mkdir(dirname(statePath), { recursive: true });
    const partial = `${statePath}.part`;
    await writeFile(partial, `${JSON.stringify(state, null, 2)}\n`);
    await rename(partial, statePath);
  }

  const prepared = [];
  for (const asset of selected) {
    const imageDirectory = resolve(imageRoot, asset.imageFolder ?? asset.id);
    const images = await loadMeshyInputImages(
      imageDirectory,
      asset.imageOrder ?? manifest.imageOrder
    );
    if (images.length === 0) {
      console.warn(
        `skip ${asset.id}: no reference images in ${imageDirectory}`
      );
      continue;
    }
    const signature = inputSignature(manifest, asset, images);
    const assetState = state.assets[asset.id];
    if (assetState?.taskId && assetState.inputSignature !== signature) {
      throw new Error(
        `${asset.id} inputs changed after paid task ${assetState.taskId}; reconcile or remove that task state explicitly.`
      );
    }
    prepared.push({
      asset,
      images,
      signature,
      output: resolve(outputDirectory, `${asset.id}_raw.glb`),
    });
  }

  const pending = prepared.filter(({ output }) => !existsSync(output));
  const unsubmitted = pending.filter(
    ({ asset }) => !state.assets[asset.id]?.taskId
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
      `Batch estimate ${estimatedCredits} exceeds manifest cap ${manifest.maxCredits ?? 150}.`
    );
  }
  if (estimatedCredits > Number(balanceJson.balance)) {
    throw new Error(
      `Batch needs about ${estimatedCredits} credits; balance is ${balanceJson.balance}.`
    );
  }
  console.log(
    `Meshy balance ${balanceJson.balance}; up to ${estimatedCredits} new credits for ${unsubmitted.length} unsubmitted assets.`
  );

  if (dryRun) {
    for (const { asset, images, output } of prepared) {
      const { url, body } = createMeshyImageTaskBody(manifest, asset, images);
      console.log(
        JSON.stringify(
          {
            asset: asset.id,
            endpoint: url === SINGLE_URL ? "image-to-3d" : "multi-image-to-3d",
            output,
            imageNames: images.map(({ name }) => name),
            request: {
              ...body,
              image_url: body.image_url ? "<data-uri>" : undefined,
              image_urls: body.image_urls?.map(() => "<data-uri>"),
            },
            alreadySubmitted: Boolean(state.assets[asset.id]?.taskId),
            alreadyDownloaded: existsSync(output),
          },
          null,
          2
        )
      );
    }
    console.log("\nDry run: nothing submitted and no credits spent.");
    return;
  }

  const failed = [];
  for (const item of prepared) {
    const { asset, images, signature, output } = item;
    if (existsSync(output)) {
      const bytes = await readFile(output);
      validateGlb(bytes, output);
      console.log(`\n=== ${asset.id}: already downloaded and valid ===`);
      continue;
    }
    try {
      console.log(`\n=== ${asset.id} ===`);
      const assetState = state.assets[asset.id] ?? {
        inputSignature: signature,
        imageSha256: Object.fromEntries(
          images.map((image) => [image.name, image.sha256])
        ),
      };
      state.assets[asset.id] = assetState;
      const { url, body } = createMeshyImageTaskBody(manifest, asset, images);
      if (!assetState.taskId) {
        assetState.endpoint =
          images.length === 1 ? "image-to-3d" : "multi-image-to-3d";
        assetState.taskId = await submitPaidTask(url, body, jsonHeaders);
        assetState.submittedAt = new Date().toISOString();
        await saveState();
        console.log(`Submitted ${assetState.endpoint}: ${assetState.taskId}`);
      } else {
        console.log(`Resuming ${assetState.endpoint}: ${assetState.taskId}`);
      }
      const complete = await waitForTask(
        url,
        assetState.taskId,
        asset.id,
        auth
      );
      const glbUrl = complete.model_urls?.glb;
      if (!glbUrl)
        throw new Error(`No GLB URL: ${JSON.stringify(complete.model_urls)}`);
      const response = await fetchWithRetry(glbUrl);
      if (!response.ok)
        throw new Error(`GLB download failed: ${response.status}`);
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
        thumbnailUrls: complete.thumbnail_urls ?? null,
        downloadedAt: new Date().toISOString(),
        bytes: bytes.length,
      });
      await saveState();
      console.log(
        `Downloaded ${output} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`
      );
    } catch (error) {
      console.error(`\n${asset.id} FAILED: ${error.message}`);
      failed.push(asset.id);
    }
  }
  if (failed.length > 0) throw new Error(`Failed assets: ${failed.join(", ")}`);
  console.log("\nMeshy image-to-3D source assets are ready for optimization.");
}
