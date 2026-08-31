import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  REQUIRED_BODY_BONES,
  inspectCharacterGlb,
  normalizeRuntimeJointNames,
  sha256File,
} from "./character-glb.mjs";
import { validateCharacterProvenance } from "./character-provenance.mjs";
import {
  PROJECT_ROOT,
  normalizeCharacterSource,
  renderCharacterThumbnail,
  resolveBlenderBinary,
} from "./character-tools.mjs";
import { optimizeCharacterGlb } from "../lib/optimize-character-glb.mjs";

export const STRESS_POSE_IDS = [
  "neutral",
  "overhead",
  "cross-body",
  "depth",
  "low",
];

function pathInside(parent, child) {
  const relation = relative(resolve(parent), resolve(child));
  return (
    relation !== "" && !relation.startsWith(`..${sep}`) && relation !== ".."
  );
}

function sameOrInside(parent, child) {
  return resolve(parent) === resolve(child) || pathInside(parent, child);
}

export function buildPromotionPacket({
  provenance,
  normalizedInspection,
  optimizedInspection,
  thumbnailFile,
  stagedForBakeoff,
  generatedAt,
}) {
  return {
    schemaVersion: 1,
    status: "needs-visual-review",
    generatedAt,
    character: {
      id: provenance.id,
      name: provenance.displayName,
      description: provenance.description,
      optimizedModel: `optimized/${provenance.id}.glb`,
      thumbnail: thumbnailFile,
    },
    provenance: {
      provider: provenance.source.provider,
      assetName: provenance.source.assetName,
      license: provenance.license.name,
      record: "provenance.json",
    },
    staticGates: {
      normalized: normalizedInspection.errors.length === 0 ? "pass" : "fail",
      optimized: optimizedInspection.errors.length === 0 ? "pass" : "fail",
      runtimeBodyBones: `${optimizedInspection.mappedBodyBoneCount}/${REQUIRED_BODY_BONES.length}`,
      fingerChains: optimizedInspection.fingerChains ? "pass" : "warning",
    },
    review: {
      harness: "/test/avatar-bakeoff",
      stagedForBakeoff,
      poses: STRESS_POSE_IDS.map((pose) => ({
        pose,
        status: "pending",
        path: `/test/avatar-bakeoff?candidate=intake-current&pose=${pose}`,
      })),
      dynamicCollisionAudit: "pending",
    },
    promotionEligible: false,
  };
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rejectionReport({ provenance, source, inspection, generatedAt }) {
  return {
    schemaVersion: 1,
    status: "rejected",
    generatedAt,
    characterId: provenance.id,
    sourceFile: basename(source),
    normalized: inspection,
    reason: "Static character gates failed; optimization did not run",
  };
}

function assertIntakeInputs({ sourcePath, provenancePath, extension }) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source model not found: ${sourcePath}`);
  }
  if (!existsSync(provenancePath)) {
    throw new Error(`Provenance record not found: ${provenancePath}`);
  }
  if (![".fbx", ".glb"].includes(extension)) {
    throw new Error("Character source must be an FBX or GLB file");
  }
}

function createIntakeDirectories(targetDirectory) {
  const paths = {
    normalized: resolve(targetDirectory, "normalized"),
    optimized: resolve(targetDirectory, "optimized"),
    thumbnails: resolve(targetDirectory, "thumbnails"),
    temporary: resolve(targetDirectory, ".work"),
  };
  for (const directory of Object.values(paths)) {
    mkdirSync(directory, { recursive: true });
  }
  return paths;
}

export async function intakeCharacter({
  source,
  provenanceFile,
  outputDirectory,
  replace = false,
  skipOptimization = false,
  skipThumbnail = false,
  stageBakeoff = false,
  now = () => new Date().toISOString(),
}) {
  const sourcePath = resolve(source);
  const provenancePath = resolve(provenanceFile);
  const outputRoot = resolve(outputDirectory);
  const extension = extname(sourcePath).toLowerCase();
  assertIntakeInputs({ sourcePath, provenancePath, extension });

  const parsedProvenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  const validation = validateCharacterProvenance(parsedProvenance);
  if (!validation.ok) {
    throw new Error(
      `Provenance gate failed:\n- ${validation.errors.join("\n- ")}`
    );
  }

  const provenance = validation.value;
  const targetDirectory = resolve(outputRoot, provenance.id);
  if (!pathInside(outputRoot, targetDirectory)) {
    throw new Error(
      "Character id resolves outside the requested output directory"
    );
  }
  if (
    sameOrInside(targetDirectory, sourcePath) ||
    sameOrInside(targetDirectory, provenancePath)
  ) {
    throw new Error(
      "Source model and provenance record must stay outside the generated intake directory"
    );
  }
  if (existsSync(targetDirectory) && !replace) {
    throw new Error(
      `Intake output already exists: ${targetDirectory} (use --replace to rebuild it)`
    );
  }

  const blenderBinary =
    extension === ".fbx" || !skipThumbnail ? resolveBlenderBinary() : null;
  if ((extension === ".fbx" || !skipThumbnail) && !blenderBinary) {
    throw new Error("Blender is required (set BLENDER_BIN to its executable)");
  }

  if (replace) rmSync(targetDirectory, { recursive: true, force: true });
  const directories = createIntakeDirectories(targetDirectory);
  const normalizedPath = resolve(
    directories.normalized,
    `${provenance.id}.glb`
  );
  const optimizedPath = resolve(directories.optimized, `${provenance.id}.glb`);
  const thumbnailPath = resolve(
    directories.thumbnails,
    `${provenance.id}.webp`
  );
  const generatedAt = now();

  writeJson(resolve(targetDirectory, "provenance.json"), provenance);
  normalizeCharacterSource({
    source: sourcePath,
    destination: normalizedPath,
    blenderBinary,
  });
  const jointNameChanges = normalizeRuntimeJointNames(normalizedPath);
  const normalizedInspection = inspectCharacterGlb(normalizedPath);
  if (normalizedInspection.errors.length > 0) {
    const report = rejectionReport({
      provenance,
      source: sourcePath,
      inspection: normalizedInspection,
      generatedAt,
    });
    report.normalization = { jointNameChanges };
    writeJson(resolve(targetDirectory, "character-intake-report.json"), report);
    rmSync(directories.temporary, { recursive: true, force: true });
    return { status: "rejected", targetDirectory, report };
  }

  if (skipOptimization) {
    copyFileSync(normalizedPath, optimizedPath);
  } else {
    optimizeCharacterGlb({
      input: normalizedPath,
      output: optimizedPath,
      temporaryDirectory: resolve(directories.temporary, "optimization"),
    });
  }
  const optimizedInspection = inspectCharacterGlb(optimizedPath);
  if (optimizedInspection.errors.length > 0) {
    const report = {
      schemaVersion: 1,
      status: "rejected",
      generatedAt,
      characterId: provenance.id,
      sourceFile: basename(sourcePath),
      normalized: normalizedInspection,
      optimized: optimizedInspection,
      reason:
        "The optimized character no longer satisfies the runtime rig contract",
    };
    writeJson(resolve(targetDirectory, "character-intake-report.json"), report);
    rmSync(directories.temporary, { recursive: true, force: true });
    return { status: "rejected", targetDirectory, report };
  }

  let thumbnailFile = null;
  if (!skipThumbnail) {
    await renderCharacterThumbnail({
      id: provenance.id,
      optimizedPath,
      thumbnailPath,
      temporaryDirectory: directories.temporary,
      blenderBinary,
    });
    thumbnailFile = `thumbnails/${provenance.id}.webp`;
  }

  let stagedForBakeoff = false;
  if (stageBakeoff) {
    const stagePath = resolve(
      PROJECT_ROOT,
      "static/models/avatars/bakeoff/intake-current.glb"
    );
    mkdirSync(dirname(stagePath), { recursive: true });
    copyFileSync(optimizedPath, stagePath);
    stagedForBakeoff = true;
  }

  const packet = buildPromotionPacket({
    provenance,
    normalizedInspection,
    optimizedInspection,
    thumbnailFile,
    stagedForBakeoff,
    generatedAt,
  });
  const report = {
    schemaVersion: 1,
    status: "needs-visual-review",
    generatedAt,
    characterId: provenance.id,
    sourceFile: basename(sourcePath),
    sourceSha256: sha256File(sourcePath),
    normalized: normalizedInspection,
    optimized: optimizedInspection,
    optimization: {
      skipped: skipOptimization,
      byteReduction: normalizedInspection.bytes - optimizedInspection.bytes,
      ratio: Number(
        (optimizedInspection.bytes / normalizedInspection.bytes).toFixed(4)
      ),
    },
    normalization: { jointNameChanges },
    thumbnail: thumbnailFile
      ? {
          file: thumbnailFile,
          bytes: statSync(thumbnailPath).size,
          sha256: sha256File(thumbnailPath),
        }
      : { skipped: true },
    bakeoff: packet.review,
    warnings: [
      ...new Set([
        ...normalizedInspection.warnings,
        ...optimizedInspection.warnings,
        ...(skipOptimization
          ? ["Web optimization was explicitly skipped"]
          : []),
        ...(skipThumbnail
          ? ["Portrait generation was explicitly skipped"]
          : []),
      ]),
    ],
  };

  writeJson(resolve(targetDirectory, "catalog-candidate.json"), packet);
  writeJson(resolve(targetDirectory, "character-intake-report.json"), report);
  rmSync(directories.temporary, { recursive: true, force: true });
  return {
    status: "needs-visual-review",
    targetDirectory,
    report,
    packet,
  };
}

export function parseArguments(args) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (
      [
        "--replace",
        "--skip-optimize",
        "--skip-thumbnail",
        "--stage-bakeoff",
      ].includes(argument)
    ) {
      flags.add(argument);
      continue;
    }
    if (!["--source", "--provenance", "--output"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument] = value;
    index += 1;
  }
  for (const required of ["--source", "--provenance", "--output"]) {
    if (!values[required]) throw new Error(`${required} is required`);
  }
  return {
    source: values["--source"],
    provenanceFile: values["--provenance"],
    outputDirectory: values["--output"],
    replace: flags.has("--replace"),
    skipOptimization: flags.has("--skip-optimize"),
    skipThumbnail: flags.has("--skip-thumbnail"),
    stageBakeoff: flags.has("--stage-bakeoff"),
  };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await intakeCharacter(options);
    console.log(`\nCharacter intake: ${result.status}`);
    console.log(`Output: ${result.targetDirectory}`);
    if (result.status === "needs-visual-review") {
      console.log(
        `Rig: ${result.report.optimized.mappedBodyBoneCount}/${REQUIRED_BODY_BONES.length} body bones`
      );
      console.log(
        `Fingers: ${result.report.optimized.fingerChains ? "complete 30-bone chains" : "warning — incomplete runtime finger chains"}`
      );
      console.log(
        `Size: ${(result.report.normalized.bytes / 1024 / 1024).toFixed(2)} MiB -> ${(result.report.optimized.bytes / 1024 / 1024).toFixed(2)} MiB`
      );
      console.log(
        "Next gate: review all five bake-off poses and the collision audit"
      );
    } else {
      console.error(result.report.reason);
      process.exitCode = 2;
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
