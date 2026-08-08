#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/forest-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/forest",
  defaultOutputDirectory: "static/models/forest/trees",
  defaultStatePath: "blender/forest-meshy-image-tasks.json",
});
