#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const phaseArgument = process.argv.find((argument) => argument.startsWith("--phase="));
const phase = phaseArgument?.slice("--phase=".length) ?? "preflight";
invariant(new Set(["preflight", "proof"]).has(phase), "--phase must be preflight or proof");
const manifestPath = resolve("scripts/forest-plantcatalog-bridge.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const evidenceRoot = resolve(manifest.paths.evidenceRoot);
await mkdir(evidenceRoot, { recursive: true });

invariant(manifest.schemaVersion === 1, "Unsupported PlantCatalog bridge schema");
invariant(manifest.bridgeId === "forest-plantcatalog-r1", "Unexpected bridge ID");
invariant(manifest.museumTrackerItem === "YmJWyFZKDT6sCFn6Htrt", "Missing accepted museum decision");
invariant(manifest.source.commercialProjectEmbeddingAllowed === true, "Project embedding must be licensed");
invariant(manifest.source.standaloneAssetRedistributionAllowed === false, "Standalone asset resale must remain forbidden");

const executable = resolve(manifest.source.plantFactoryExecutable);
const apiPath = resolve(manifest.source.pythonApiPath);
const catalogRoot = resolve(manifest.source.plantCatalogRoot);
invariant(await exists(executable), `PlantFactory executable missing: ${executable}`);
invariant(await exists(apiPath), `PlantFactory Python API missing: ${apiPath}`);
const apiText = await readFile(apiPath, "utf8");
for (const signature of [
  "def LoadPlant(self, plantFilename, seed=0):",
  "def LoadPlantCatalogFile(self, plantCatalogSpecies, seed=0):",
  "def WaitForGeometry(self):",
  "def ExportObject(self, *args):",
  "def SetExportOption(self, *args):",
  "def SetExportPreset(self, val):",
  "def RunPythonFile(self, strPythonScriptPath):",
  "def GeneralParameterSetAge(age):",
  "def GeneralParameterSetHealth(health):",
  "def GeneralParameterSetSeed(seed):",
  "def GeneralParameterSetSeason(day):",
]) {
  invariant(apiText.includes(signature), `PlantFactory API signature missing: ${signature}`);
}
const versionCommand = `(Get-Item -LiteralPath '${executable.replaceAll("'", "''")}').VersionInfo.ProductVersion`;
const installedVersionRaw = execFileSync(
  "powershell.exe",
  ["-NoProfile", "-Command", versionCommand],
  { encoding: "utf8" }
).trim();
const installedVersion = installedVersionRaw.replace(/[\s,]+/g, ".");
invariant(
  installedVersion === manifest.source.plantFactoryProductVersion,
  `PlantFactory version changed: expected ${manifest.source.plantFactoryProductVersion}, got ${installedVersion}`
);

const jobsById = new Map(manifest.jobs.map((job) => [job.id, job]));
const activeIds = manifest.exportSets[manifest.activeExportSet];
invariant(Array.isArray(activeIds) && activeIds.length > 0, "Active export set is empty");
const sourceResults = [];
for (const jobId of activeIds) {
  const job = jobsById.get(jobId);
  invariant(job, `Active export set references unknown job: ${jobId}`);
  invariant(job.health >= 0 && job.health <= 1, `${jobId} has invalid health`);
  invariant(job.seasonDay >= 0 && job.seasonDay <= 365, `${jobId} has invalid season day`);
  invariant(job.targetHeightMetres > 0, `${jobId} has invalid target height`);
  invariant(
    typeof job.catalogSpeciesName === "string" && job.catalogSpeciesName.trim().length > 0,
    `${jobId} is missing its PlantCatalog species name`
  );
  // A PlantCatalog entry ending in "_~~" is a browse placeholder, not an installed plant.
  // The catalog ships every species' placeholder up front; installing a collection drops a
  // real sibling beside it with no suffix. Placeholders are all under 0.3 MB and carry no
  // geometry, so LoadPlantCatalogFile answers them with the missing-extra-package dialog —
  // which stalls an -immediate-python run instead of failing it. Existence, byte count, and
  // hash all match happily against a stub, so those checks cannot catch this on their own.
  invariant(
    !job.sourceRelativePath.replace(/\.tpf$/i, "").endsWith("_~~"),
    `${jobId} points at the PlantCatalog browse placeholder "${job.sourceRelativePath}". ` +
      `That species is not installed. Install the collection that ships it, then repoint ` +
      `sourceRelativePath at the real entry (same name without the "_~~" suffix) and ` +
      `refresh sourceBytes/sourceSha256.`
  );
  const sourcePath = resolve(catalogRoot, job.sourceRelativePath);
  const sourceBytes = await readFile(sourcePath);
  invariant(sourceBytes.length === job.sourceBytes, `${jobId} source byte count changed`);
  invariant(sha256(sourceBytes) === job.sourceSha256, `${jobId} source hash changed`);
  sourceResults.push({
    id: jobId,
    sourcePath: sourcePath.replaceAll("\\", "/"),
    bytes: sourceBytes.length,
    sha256: sha256(sourceBytes),
  });
}

const preflight = {
  schemaVersion: manifest.schemaVersion,
  bridgeId: manifest.bridgeId,
  phase: "preflight",
  installedPlantFactoryVersion: installedVersion,
  executable: executable.replaceAll("\\", "/"),
  pythonApi: apiPath.replaceAll("\\", "/"),
  activeExportSet: manifest.activeExportSet,
  activeJobs: activeIds,
  sourceResults,
  apiSignaturesVerified: true,
  plantFactoryProofComplete: await exists(resolve(manifest.paths.completionPath)),
};
const preflightPath = resolve(evidenceRoot, "plantcatalog-bridge-preflight.json");
await writeFile(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`);
if (phase === "preflight") {
  console.log(JSON.stringify(preflight, null, 2));
  process.exit(0);
}

const statePath = resolve(manifest.paths.statePath);
const completionPath = resolve(manifest.paths.completionPath);
invariant(await exists(statePath), `PlantFactory state missing: ${statePath}`);
invariant(await exists(completionPath), `PlantFactory completion marker missing: ${completionPath}`);
const state = JSON.parse(await readFile(statePath, "utf8"));
const completion = JSON.parse(await readFile(completionPath, "utf8"));
invariant(completion.bridgeId === manifest.bridgeId, "Completion marker belongs to another bridge");
invariant(completion.activeExportSet === manifest.activeExportSet, "Completion marker export set is stale");

const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [{ NodeIO, getBounds }, { ALL_EXTENSIONS }, { MeshoptDecoder }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
]);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const conditioning = JSON.parse(
  await readFile(resolve(evidenceRoot, "plantcatalog-conditioning-metrics.json"), "utf8")
);
const conditioningById = new Map(conditioning.map((entry) => [entry.id, entry]));
const candidates = [];
for (const jobId of activeIds) {
  const job = jobsById.get(jobId);
  const jobState = state.jobs[jobId];
  invariant(jobState?.status === "complete", `${jobId} PlantFactory export is incomplete`);
  invariant(jobState.sourceSha256 === job.sourceSha256, `${jobId} exported from a stale source`);
  invariant(jobState.outputFbxBytes > 0, `${jobId} FBX is empty`);
  invariant(jobState.mapFiles.length > 0, `${jobId} exported no texture maps`);
  const rawFbx = await readFile(jobState.outputFbx);
  const fbxHeader = rawFbx.subarray(0, 32).toString("latin1");
  invariant(
    fbxHeader.startsWith("Kaydara FBX Binary") || fbxHeader.startsWith("; FBX"),
    `${jobId} output is not an FBX`
  );
  const conditioned = conditioningById.get(jobId);
  invariant(conditioned, `${jobId} has no conditioning metrics`);
  const candidatePath = resolve(manifest.paths.candidateRoot, job.candidateFilename);
  const bytes = await readFile(candidatePath);
  invariant(bytes.subarray(0, 4).toString("ascii") === "glTF", `${jobId} candidate is not a GLB`);
  invariant(bytes.length <= manifest.conditioning.maximumRuntimeBytes, `${jobId} exceeds its byte cap`);
  const document = await io.read(candidatePath);
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  invariant(scene, `${jobId} candidate has no scene`);
  const bounds = getBounds(scene);
  const dimensions = bounds.max.map((value, axis) => value - bounds.min[axis]);
  let triangles = 0;
  let vertices = 0;
  let colorAttributePrimitives = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      const count = position?.getCount() ?? 0;
      vertices += count;
      triangles += (primitive.getIndices()?.getCount() ?? count) / 3;
      if (primitive.getAttribute("COLOR_0")) colorAttributePrimitives += 1;
    }
  }
  invariant(root.listMeshes().length === 1, `${jobId} must remain one instancing mesh`);
  invariant(triangles <= manifest.conditioning.maximumRuntimeTriangles, `${jobId} exceeds its triangle cap`);
  invariant(Math.abs(dimensions[1] - job.targetHeightMetres) <= 0.05, `${jobId} height is ${dimensions[1]} m`);
  const primitiveCount = root.listMeshes()[0].listPrimitives().length;
  invariant(colorAttributePrimitives === primitiveCount, `${jobId} lost its rooted-wind COLOR_0 mask`);
  const materials = root.listMaterials().map((material) => ({
    name: material.getName(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
    doubleSided: material.getDoubleSided(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    baseColorTexture: material.getBaseColorTexture()?.getName() ?? null,
    normalTexture: material.getNormalTexture()?.getName() ?? null,
    emissiveTexture: material.getEmissiveTexture()?.getName() ?? null,
    emissiveFactor: material.getEmissiveFactor(),
  }));
  const foliage = materials.filter((material) => material.name.includes("_Foliage_"));
  const wood = materials.filter((material) => material.name.includes("_Wood_"));
  invariant(foliage.length > 0, `${jobId} has no foliage material`);
  invariant(wood.length > 0, `${jobId} has no wood material`);
  invariant(materials.every((material) => material.baseColorTexture), `${jobId} has an untextured material`);
  invariant(
    foliage.every((material) => material.alphaMode === "MASK" && material.doubleSided),
    `${jobId} foliage is not two-sided alpha-masked`
  );
  invariant(
    wood.every((material) => material.alphaMode === "OPAQUE" && !material.doubleSided),
    `${jobId} wood is not opaque and single-sided`
  );
  invariant(
    materials.every(
      (material) =>
        material.metallicFactor === 0 &&
        material.roughnessFactor >= 0.88 &&
        !material.emissiveTexture &&
        material.emissiveFactor.every((value) => value === 0)
    ),
    `${jobId} retained glossy, metallic, or emissive response`
  );
  candidates.push({
    id: jobId,
    candidatePath: candidatePath.replaceAll("\\", "/"),
    sha256: sha256(bytes),
    bytes: statSync(candidatePath).size,
    vertices,
    triangles,
    meshes: root.listMeshes().length,
    primitives: primitiveCount,
    textures: root.listTextures().length,
    dimensionsMetres: dimensions,
    materials,
    plantFactoryMetrics: jobState.plantMetrics,
    conditioning: conditioned,
  });
}
for (const jobId of activeIds) {
  for (const view of ["front", "three-quarter", "silhouette", "human-height", "bark-close", "canopy"]) {
    invariant(
      await exists(resolve(evidenceRoot, `${jobId}-${view}.png`)),
      `${jobId} is missing its ${view} proof render`
    );
  }
}
invariant(
  await exists(resolve(evidenceRoot, "plantcatalog-bridge-contact-sheet.png")),
  "PlantCatalog contact sheet is missing"
);
const proof = {
  ...preflight,
  phase: "proof",
  plantFactoryProofComplete: true,
  completion,
  candidates,
  contactSheet: resolve(evidenceRoot, "plantcatalog-bridge-contact-sheet.png").replaceAll("\\", "/"),
};
const proofPath = resolve(evidenceRoot, "plantcatalog-bridge-proof-metrics.json");
await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify(proof, null, 2));
