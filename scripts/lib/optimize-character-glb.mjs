import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cliModule = require.resolve("@gltf-transform/cli");
const cliEntry = resolve(dirname(cliModule), "../bin/cli.js");
const alphaModeStep = fileURLToPath(
  new URL("./character-alpha-modes.mjs", import.meta.url)
);
const glossWorkflowStep = fileURLToPath(
  new URL("./character-gloss-workflow.mjs", import.meta.url)
);

/**
 * Texture ceilings the catalog can carry. 1024 is the deployed default: every
 * shipped character was measured at the TKA camera and did not lose anything
 * visible there. 2048 keeps a source's detail when the camera moves in, at
 * roughly four times the texture bytes and GPU memory per character, so it is
 * a per-character decision made from the bake-off, not a new default.
 */
export const CHARACTER_TEXTURE_SIZES = [512, 1024, 2048, 4096];
export const DEFAULT_CHARACTER_TEXTURE_SIZE = 1024;

export function assertCharacterTextureSize(value) {
  if (!CHARACTER_TEXTURE_SIZES.includes(value)) {
    throw new Error(
      `Character texture size must be one of ${CHARACTER_TEXTURE_SIZES.join(", ")}`
    );
  }
  return value;
}

export function buildCharacterOptimizationSteps(
  input,
  output,
  temporaryDirectory,
  { textureSize = DEFAULT_CHARACTER_TEXTURE_SIZE } = {}
) {
  const size = String(assertCharacterTextureSize(textureSize));
  const source = resolve(input);
  const destination = resolve(output);
  const temporary = resolve(temporaryDirectory);
  const resized = resolve(temporary, "01-resized.glb");
  const webp = resolve(temporary, "02-webp.glb");
  const resampled = resolve(temporary, "03-resampled.glb");
  const pruned = resolve(temporary, "04-pruned.glb");

  return [
    ["resize", source, resized, "--width", size, "--height", size],
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
 * Two final passes correct what the source export got wrong: materials
 * mislabelled as blends, and specular/glossiness sheets Blender handed over as
 * metallic-roughness. They run last, after dedup has settled which texture
 * each material samples, and in their own process so this function stays
 * synchronous.
 */
export function optimizeCharacterGlb({
  input,
  output,
  temporaryDirectory,
  textureSize = DEFAULT_CHARACTER_TEXTURE_SIZE,
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

  const steps = buildCharacterOptimizationSteps(
    source,
    destination,
    temporary,
    {
      textureSize,
    }
  );

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
  onStep("gloss-workflow");
  execFileSync(process.execPath, [glossWorkflowStep, destination], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  return destination;
}
