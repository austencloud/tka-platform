import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cliModule = require.resolve("@gltf-transform/cli");
const cliEntry = resolve(dirname(cliModule), "../bin/cli.js");
// Resolved from this module's own directory rather than through
// `new URL("./...", import.meta.url)`. That literal pattern is Vite's
// asset-URL syntax, so under the Vitest transform it rewrites to an http URL
// that `fileURLToPath` rejects, which made every importer of this module fail
// to load in tests. Node resolves the same absolute path either way.
const alphaModeStep = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "character-alpha-modes.mjs"
);

export function buildCharacterOptimizationSteps(
  input,
  output,
  temporaryDirectory
) {
  const source = resolve(input);
  const destination = resolve(output);
  const temporary = resolve(temporaryDirectory);
  const resized = resolve(temporary, "01-resized.glb");
  const webp = resolve(temporary, "02-webp.glb");
  const resampled = resolve(temporary, "03-resampled.glb");
  const pruned = resolve(temporary, "04-pruned.glb");

  return [
    ["resize", source, resized, "--width", "1024", "--height", "1024"],
    ["webp", resized, webp, "--quality", "85"],
    ["resample", webp, resampled],
    ["prune", resampled, pruned],
    ["dedup", pruned, destination],
  ];
}

/**
 * Run the character-safe optimization sequence used by the deployed catalog.
 *
 * Weld, simplify, join, Draco, and meshopt are intentionally absent. The first
 * three can alter a skinned character and the latter two need decoders that the
 * character loader does not install.
 *
 * A final pass corrects materials the source export mislabelled as blends. It
 * runs last, after dedup has settled which texture each material samples, and
 * in its own process so this function stays synchronous.
 */
export function optimizeCharacterGlb({
  input,
  output,
  temporaryDirectory,
  onStep = () => {},
}) {
  const source = resolve(input);
  const destination = resolve(output);
  const temporary = resolve(temporaryDirectory);

  if (!existsSync(source)) {
    throw new Error(`Character source GLB does not exist: ${source}`);
  }
  if (source === destination) {
    throw new Error(
      "Character optimizer input and output must be different files"
    );
  }

  mkdirSync(dirname(destination), { recursive: true });
  rmSync(temporary, { recursive: true, force: true });
  mkdirSync(temporary, { recursive: true });

  const steps = buildCharacterOptimizationSteps(source, destination, temporary);

  try {
    for (const args of steps) {
      onStep(args[0]);
      execFileSync(process.execPath, [cliEntry, ...args], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }

  onStep("alpha-modes");
  execFileSync(process.execPath, [alphaModeStep, destination], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  return destination;
}
