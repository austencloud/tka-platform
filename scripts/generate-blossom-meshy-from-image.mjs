#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/blossom-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/blossom",
  defaultOutputDirectory: "static/models/blossom/assets",
  defaultStatePath: "blender/blossom-meshy-image-tasks.json",
});
