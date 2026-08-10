#!/usr/bin/env node
/** Generate the approved reusable Winter hearth chair within one paid batch. */
import { runMeshyTextGeneration } from "./lib/meshy-text-generator.mjs";

await runMeshyTextGeneration({
  manifestPath: "scripts/winter-hearth-meshy-assets.json",
  statePath: "blender/winter-hearth-meshy-tasks.json",
  outputDirectory: "static/models/winter/settlement",
  doneMessage: "Winter hearth chair is ready for composition and optimization.",
});
