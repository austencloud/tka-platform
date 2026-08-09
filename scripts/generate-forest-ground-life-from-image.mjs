#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/forest-ground-life-images.json",
  defaultImageRoot: "assets/meshy-refs/forest/ground-life",
  defaultOutputDirectory: "static/models/forest/ground-life",
  defaultStatePath: "blender/forest-ground-life-meshy-tasks.json",
});
