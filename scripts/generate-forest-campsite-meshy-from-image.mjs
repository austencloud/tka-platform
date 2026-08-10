#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/forest-campsite-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/forest/campsite",
  defaultOutputDirectory: "static/models/forest/campsite",
  defaultStatePath: "blender/forest-campsite-meshy-tasks.json",
});
