/**
 * Generate the controlled body-proportion sweep the staff-grip lab selects from.
 *
 * Every body is the same licensed base rig with exactly one dimension moved, so
 * a fit failure in the lab names its own cause instead of being attributable to
 * any of stature, arm length or shoulder span at once.
 *
 * The stages reuse the owners the character pipeline already has: the Blender
 * rescale is the only new step, optimization is `optimizeCharacterGlb` (the
 * skinning-safe sequence, deliberately without weld/simplify/Draco/meshopt),
 * the rig contract check is `inspectCharacterGlb`, and the measurements come
 * from the runtime `performer-reach-measurements` owner.
 *
 * Usage:
 *   pnpm run characters:proportion-sweep
 *   pnpm run characters:proportion-sweep -- --only sweep-shoulders-broad
 *   pnpm run characters:proportion-sweep -- --base <path-to-base.glb>
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { inspectCharacterGlb } from "./character-glb.mjs";
import {
  formatReachTable,
  measureCharacterReach,
  reachTableRow,
} from "./character-reach-measure.mjs";
import {
  SWEEP_BASE,
  SWEEP_BODIES,
  SWEEP_OUTPUT_DIRECTORY,
  activeParameters,
} from "./proportion-sweep-spec.mjs";
import { PROJECT_ROOT, resolveBlenderBinary } from "./character-tools.mjs";
import { optimizeCharacterGlb } from "../lib/optimize-character-glb.mjs";

const RESCALE_SCRIPT = resolve(
  PROJECT_ROOT,
  "scripts/characters/blender-proportion-rescale.py"
);

function rescaleWithBlender({
  blenderBinary,
  basePath,
  outputPath,
  params,
  temporaryDirectory,
}) {
  const paramsFile = resolve(temporaryDirectory, "params.json");
  writeFileSync(paramsFile, JSON.stringify(params), "utf8");
  execFileSync(
    blenderBinary,
    [
      "--background",
      "--factory-startup",
      "--python",
      RESCALE_SCRIPT,
      "--",
      "--input",
      basePath,
      "--output",
      outputPath,
      "--params-file",
      paramsFile,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
}

/**
 * Build one body: rescale, optimize, then prove the result still satisfies the
 * rig contract and measures the way the spec intended.
 */
function buildBody({ body, blenderBinary, basePath, outputDirectory, work }) {
  const rawPath = resolve(work, `${body.id}.raw.glb`);
  const optimizedPath = resolve(outputDirectory, `${body.id}.glb`);

  rescaleWithBlender({
    blenderBinary,
    basePath,
    outputPath: rawPath,
    params: body.params,
    temporaryDirectory: work,
  });
  optimizeCharacterGlb({
    input: rawPath,
    output: optimizedPath,
    temporaryDirectory: resolve(work, `${body.id}-optimize`),
  });

  const inspection = inspectCharacterGlb(optimizedPath);
  const measured = measureCharacterReach(optimizedPath);
  return { body, optimizedPath, inspection, measured };
}

/**
 * Which measured dimensions each axis is permitted to move.
 *
 * This is the fixture contract, and it runs in both directions: the named
 * dimensions must actually change, and every other dimension must not. The
 * second half is the one that matters — the first draft of the torso-girth
 * stage silently carried the arm-chain roots outward, producing a "build"
 * body that was really a shoulder-width body, and only a both-directions
 * check catches that.
 *
 * `armSegmentRatio` deliberately excludes `reachCm`: redistributing length
 * between the upper arm and the forearm must leave the total untouched, which
 * is what makes that body a probe of what the solve ignores.
 */
const AXIS_ALLOWED_TO_CHANGE = {
  none: [],
  stature: [
    "statureCm",
    "upperArmCm",
    "forearmCm",
    "reachCm",
    "shoulderWidthCm",
    "footSeparationCm",
  ],
  shoulderWidth: ["shoulderWidthCm"],
  armLength: ["upperArmCm", "forearmCm", "reachCm"],
  armSegmentRatio: ["upperArmCm", "forearmCm"],
  torsoGirth: [],
};

/** Per-dimension tolerance in cm. Stature uses the coarse skeleton proxy. */
const DIMENSION_TOLERANCE_CM = {
  statureCm: 0.5,
  upperArmCm: 0.05,
  forearmCm: 0.05,
  reachCm: 0.05,
  shoulderWidthCm: 0.05,
  footSeparationCm: 0.05,
};

/**
 * A body whose axis did not move, or that moved a dimension it had no business
 * touching, is a broken fixture rather than a finding. The sweep refuses to
 * report one as usable.
 */
function verifyAxisMoved(result, medianRow) {
  const row = result.row;
  const problems = [];
  if (result.inspection.errors.length > 0) {
    problems.push(...result.inspection.errors);
  }
  if (!result.inspection.fingerChains) {
    problems.push("Runtime finger chains did not resolve");
  }
  if (row.upperArmCm === null) {
    problems.push("Arm chains did not resolve; nothing could be measured");
    return problems;
  }
  if (!medianRow || result.body.axis === "none") return problems;

  const allowed = AXIS_ALLOWED_TO_CHANGE[result.body.axis];
  if (!allowed) {
    problems.push(`Unknown axis ${result.body.axis}`);
    return problems;
  }
  let movedSomething = false;
  for (const [dimension, tolerance] of Object.entries(
    DIMENSION_TOLERANCE_CM
  )) {
    const delta = Math.abs(row[dimension] - medianRow[dimension]);
    if (allowed.includes(dimension)) {
      if (delta > tolerance) movedSomething = true;
      continue;
    }
    if (delta > tolerance) {
      problems.push(
        `${dimension} drifted ${delta.toFixed(2)} cm but axis ${result.body.axis} must not change it`
      );
    }
  }
  // A girth body is expected to leave every solve input alone; its evidence is
  // the mesh, so "nothing moved" is the pass condition rather than a failure.
  if (!movedSomething && allowed.length > 0) {
    problems.push(
      `Axis ${result.body.axis} produced no measurable change from the median`
    );
  }
  return problems;
}

export async function generateProportionSweep({
  baseModel,
  outputDirectory,
  only = null,
} = {}) {
  const blenderBinary = resolveBlenderBinary();
  if (!blenderBinary) {
    throw new Error("Blender is required (set BLENDER_BIN to its executable)");
  }
  const basePath = resolve(baseModel ?? resolve(PROJECT_ROOT, SWEEP_BASE.modelPath));
  if (!existsSync(basePath)) {
    throw new Error(
      `Sweep base rig not found: ${basePath}\n` +
        "The catalog sources are gitignored; copy the base GLB in or pass --base."
    );
  }
  const outputRoot = resolve(
    outputDirectory ?? resolve(PROJECT_ROOT, SWEEP_OUTPUT_DIRECTORY)
  );
  const work = resolve(outputRoot, ".work");
  mkdirSync(outputRoot, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  const selected = only
    ? SWEEP_BODIES.filter((body) => only.includes(body.id))
    : SWEEP_BODIES;
  if (selected.length === 0) {
    throw new Error(`No sweep body matched: ${only?.join(", ")}`);
  }

  const results = [];
  let medianRow = null;
  for (const body of selected) {
    process.stdout.write(`  ${body.id} ... `);
    const result = buildBody({
      body,
      blenderBinary,
      basePath,
      outputDirectory: outputRoot,
      work,
    });
    const row = reachTableRow(body.id, result.measured);
    if (body.axis === "none") medianRow = row;
    results.push({ ...result, row });
    process.stdout.write(
      `${(result.inspection.bytes / 1024 / 1024).toFixed(2)} MiB\n`
    );
  }

  const rows = results.map((result) => result.row);
  const problems = results.flatMap((result) =>
    verifyAxisMoved(result, medianRow).map(
      (problem) => `${result.body.id}: ${problem}`
    )
  );

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: problems.length === 0 ? "usable" : "defective",
    distribution: "local-evaluation-only",
    base: {
      characterId: SWEEP_BASE.characterId,
      file: basename(basePath),
      sha256: inspectCharacterGlb(basePath).sha256,
    },
    bodies: results.map((result) => ({
      id: result.body.id,
      name: result.body.name,
      axis: result.body.axis,
      rationale: result.body.rationale,
      parameters: activeParameters(result.body),
      modelPath: `/models/avatars/proportion-sweep/${result.body.id}.glb`,
      bytes: result.inspection.bytes,
      sha256: result.inspection.sha256,
      triangleCount: result.inspection.triangleCount,
      mappedBodyBoneCount: result.inspection.mappedBodyBoneCount,
      fingerChains: result.inspection.fingerChains,
      measured: result.row,
    })),
    problems,
  };
  writeFileSync(
    resolve(outputRoot, "proportion-sweep-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  rmSync(work, { recursive: true, force: true });
  return { manifest, rows, problems, outputRoot };
}

export function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!["--base", "--output", "--only"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument] = value;
    index += 1;
  }
  return {
    baseModel: values["--base"],
    outputDirectory: values["--output"],
    only: values["--only"] ? values["--only"].split(",") : null,
  };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    console.log("Generating the character proportion sweep:");
    const { manifest, rows, problems, outputRoot } =
      await generateProportionSweep(options);
    console.log(`\nMeasured proportions (cm), base ${manifest.base.file}:\n`);
    console.log(formatReachTable(rows));
    console.log(`\nOutput: ${outputRoot}`);
    console.log(`Status: ${manifest.status} (local evaluation fixtures only)`);
    if (problems.length > 0) {
      console.error(`\nDefective fixtures:\n- ${problems.join("\n- ")}`);
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
