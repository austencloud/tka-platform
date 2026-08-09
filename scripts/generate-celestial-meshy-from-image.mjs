#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/celestial-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/celestial",
  defaultOutputDirectory: "static/models/celestial/source",
  defaultStatePath: "blender/celestial-meshy-image-tasks.json",
});
