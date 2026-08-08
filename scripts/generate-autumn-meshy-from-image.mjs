#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/autumn-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/autumn",
  defaultOutputDirectory: "static/models/autumn",
  defaultStatePath: "blender/autumn-meshy-image-tasks.json",
});
