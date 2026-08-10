#!/usr/bin/env node
/**
 * Generate the approved Winter Keeper's Hollow settlement asset.
 *
 * The shared runner owns balance checks, the 30-credit batch cap, paid-task
 * checkpointing, safe polling, and verified GLB downloads.
 *
 * Usage:
 *   node scripts/generate-winter-settlement-meshy.mjs --dry-run
 *   node scripts/generate-winter-settlement-meshy.mjs
 */
import { runMeshyTextGeneration } from "./lib/meshy-text-generator.mjs";

await runMeshyTextGeneration({
  manifestPath: "scripts/winter-settlement-meshy-assets.json",
  statePath: "blender/winter-settlement-meshy-tasks.json",
  outputDirectory: "static/models/winter/settlement",
  doneMessage:
    "Winter settlement lodge is ready for composition and optimization.",
});
