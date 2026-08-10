#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/cloudbreak-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/celestial/cloudbreak",
  defaultOutputDirectory: "static/models/celestial/cloudbreak/source",
  defaultStatePath: "blender/cloudbreak-meshy-image-tasks.json",
});
