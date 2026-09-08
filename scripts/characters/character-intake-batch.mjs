import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REQUIRED_BODY_BONES } from "./character-glb.mjs";
import {
  bakeoffReviewPath,
  intakeCharacter,
  parseTextureSize,
} from "./character-intake.mjs";

export const SOURCE_EXTENSIONS = [".fbx", ".glb"];
const PROVENANCE_SUFFIX = ".provenance.json";
const VALUE_ARGUMENTS = ["--downloads", "--output", "--texture-size"];
const FLAG_ARGUMENTS = [
  "--replace",
  "--skip-optimize",
  "--skip-thumbnail",
  "--no-stage",
];

/**
 * Match every downloaded model to the sidecar stamped beside it.
 *
 * `Malcolm.fbx` pairs with `Malcolm.provenance.json`. A model with no sidecar
 * is reported, not guessed at, because the sidecar is where the rights
 * assertion lives. Two models sharing one stem are ambiguous for the same
 * reason: one record cannot vouch for two files.
 */
export function pairBatchSources(fileNames) {
  const sources = new Map();
  const sidecars = new Map();
  for (const name of fileNames) {
    if (name.endsWith(PROVENANCE_SUFFIX)) {
      sidecars.set(name.slice(0, -PROVENANCE_SUFFIX.length), name);
      continue;
    }
    if (!SOURCE_EXTENSIONS.includes(extname(name).toLowerCase())) continue;
    const stem = basename(name, extname(name));
    sources.set(stem, [...(sources.get(stem) ?? []), name]);
  }

  const pairs = [];
  const ambiguous = [];
  const sourcesWithoutProvenance = [];
  for (const stem of [...sources.keys()].sort()) {
    const files = sources.get(stem);
    const sidecar = sidecars.get(stem);
    if (files.length > 1) {
      ambiguous.push({ stem, files });
      continue;
    }
    if (!sidecar) {
      sourcesWithoutProvenance.push(files[0]);
      continue;
    }
    pairs.push({ stem, source: files[0], provenance: sidecar });
  }
  const provenanceWithoutSource = [...sidecars]
    .filter(([stem]) => !sources.has(stem))
    .map(([, file]) => file)
    .sort();

  return {
    pairs,
    ambiguous,
    sourcesWithoutProvenance,
    provenanceWithoutSource,
  };
}

export function parseBatchArguments(args) {
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
  for (const required of ["--downloads", "--output"]) {
    if (!values[required]) throw new Error(`${required} is required`);
  }
  return {
    downloadsDirectory: values["--downloads"],
    outputDirectory: values["--output"],
    replace: flags.has("--replace"),
    skipOptimization: flags.has("--skip-optimize"),
    skipThumbnail: flags.has("--skip-thumbnail"),
    stageBakeoff: !flags.has("--no-stage"),
    textureSize: parseTextureSize(values["--texture-size"]),
  };
}

/** Reduce one intake result to the row the batch table prints. */
export function summarizeIntakeResult(stem, result) {
  const report = result.report ?? {};
  if (result.status !== "needs-visual-review") {
    return {
      stem,
      id: report.characterId ?? null,
      status: result.status,
      detail: report.reason ?? "",
    };
  }
  const optimized = report.optimized;
  const materials = optimized.materialSummary;
  const sourceMaterials = report.normalized?.materialSummary ?? null;
  const pixels = (side) =>
    side === null || side === undefined ? "?" : `${side}px`;
  return {
    stem,
    id: report.characterId,
    status: result.status,
    bodyBones: `${optimized.mappedBodyBoneCount}/${REQUIRED_BODY_BONES.length}`,
    fingers: optimized.fingerChains ? "30/30" : "incomplete",
    normalMaps: `${materials.withNormalTexture}/${materials.skinnedMaterialCount}`,
    roughnessTextures: `${materials.withMetallicRoughnessTexture}/${materials.skinnedMaterialCount}`,
    blendMaterials: materials.alphaModes.BLEND,
    sourceTexture: pixels(sourceMaterials?.maxTextureSide),
    deliveredTexture: pixels(materials.maxTextureSide),
    mebibytes: (optimized.bytes / 1024 / 1024).toFixed(2),
    review: bakeoffReviewPath(report.characterId, "overhead"),
    detail: "",
  };
}

const COLUMNS = [
  ["id", "Character"],
  ["status", "Status"],
  ["bodyBones", "Bones"],
  ["fingers", "Fingers"],
  ["normalMaps", "Normal maps"],
  ["roughnessTextures", "Roughness tex"],
  ["blendMaterials", "BLEND"],
  ["sourceTexture", "Source tex"],
  ["deliveredTexture", "Delivered tex"],
  ["mebibytes", "MiB"],
];

export function formatBatchTable(rows) {
  const cell = (row, key) => String(row[key] ?? "-");
  const widths = COLUMNS.map(([key, header]) =>
    Math.max(header.length, ...rows.map((row) => cell(row, key).length))
  );
  const line = (values) =>
    values.map((value, index) => value.padEnd(widths[index])).join("  ");
  const lines = [
    line(COLUMNS.map(([, header]) => header)),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map((row) => line(COLUMNS.map(([key]) => cell(row, key)))),
  ];
  for (const row of rows) {
    if (row.detail) lines.push(`${row.id ?? row.stem}: ${row.detail}`);
  }
  return lines.join("\n");
}

/**
 * Run the single-character intake over a folder of downloads, one after the
 * other because each FBX conversion owns a Blender process. A failure on one
 * character is recorded and the next one still runs.
 */
export async function intakeBatch(
  options,
  { intake = intakeCharacter, log = console.log } = {}
) {
  const downloads = resolve(options.downloadsDirectory);
  if (!existsSync(downloads) || !statSync(downloads).isDirectory()) {
    throw new Error(`Downloads directory not found: ${downloads}`);
  }
  const pairing = pairBatchSources(readdirSync(downloads));
  for (const file of pairing.sourcesWithoutProvenance) {
    log(`Skipping ${file}: no ${PROVENANCE_SUFFIX} sidecar beside it`);
  }
  for (const file of pairing.provenanceWithoutSource) {
    log(`Skipping ${file}: no FBX or GLB with the same name`);
  }
  for (const { stem, files } of pairing.ambiguous) {
    log(`Skipping ${stem}: ${files.join(" and ")} share one provenance record`);
  }

  const rows = [];
  for (const pair of pairing.pairs) {
    log(`\nIntake: ${pair.source}`);
    try {
      const result = await intake({
        source: resolve(downloads, pair.source),
        provenanceFile: resolve(downloads, pair.provenance),
        outputDirectory: options.outputDirectory,
        replace: options.replace,
        skipOptimization: options.skipOptimization,
        skipThumbnail: options.skipThumbnail,
        stageBakeoff: options.stageBakeoff,
        textureSize: options.textureSize,
      });
      rows.push(summarizeIntakeResult(pair.stem, result));
    } catch (error) {
      rows.push({
        stem: pair.stem,
        id: null,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { rows, pairing };
}

async function main() {
  try {
    const options = parseBatchArguments(process.argv.slice(2));
    const { rows } = await intakeBatch(options);
    console.log(`\n${formatBatchTable(rows)}`);
    const reviewable = rows.filter(
      (row) => row.status === "needs-visual-review"
    );
    if (reviewable.length > 0) {
      console.log(
        `\n${reviewable.length} character(s) staged. Open /test/avatar-bakeoff and review every pose before promotion.`
      );
    }
    if (rows.length === 0) {
      console.error("No FBX or GLB with a provenance sidecar was found");
      process.exitCode = 2;
    } else if (reviewable.length < rows.length) {
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
