#!/usr/bin/env node
/**
 * Generate the Flow Fest Sim parked-car lineup with Meshy Text to 3D.
 *
 * Paid task IDs are checkpointed under blender/ before polling, so a re-run
 * resumes those tasks instead of paying for duplicates.
 *
 * Usage:
 *   node scripts/generate-flow-fest-cars-meshy.mjs
 *   node scripts/generate-flow-fest-cars-meshy.mjs --only sedan-silver
 *   node scripts/generate-flow-fest-cars-meshy.mjs --dry-run
 */
import { runMeshyTextGeneration } from "./lib/meshy-text-generator.mjs";

await runMeshyTextGeneration({
  manifestPath: "scripts/flow-fest-cars-meshy-assets.json",
  statePath: "blender/flow-fest-cars-meshy-tasks.json",
  outputDirectory: "static/models/flow-fest/cars",
  doneMessage:
    "Flow Fest car assets are ready: node scripts/optimize-flow-fest-cars.mjs",
});
