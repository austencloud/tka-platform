#!/usr/bin/env node
/**
 * Generate the Cinder Court coal-room prop set with Meshy Text to 3D.
 *
 * Paid task IDs are checkpointed under blender/ before polling, so re-running
 * resumes those tasks instead of paying for duplicates.
 *
 * Usage:
 *   node scripts/generate-first-fire-meshy.mjs --dry-run
 *   node scripts/generate-first-fire-meshy.mjs
 *   node scripts/generate-first-fire-meshy.mjs --only cinder-lamp
 */
import { runMeshyTextGeneration } from "./lib/meshy-text-generator.mjs";

await runMeshyTextGeneration({
  manifestPath: "scripts/first-fire-meshy-assets.json",
  statePath: "blender/first-fire-meshy-tasks.json",
  outputDirectory: "static/models/first-fire/props",
  doneMessage: "First Fire coal-room props are ready for optimization.",
});
