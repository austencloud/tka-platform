#!/usr/bin/env node

import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/ember-meshy-images.json",
  defaultImageRoot: "assets/meshy-refs/ember",
  defaultOutputDirectory: "static/models/ember/meshy-candidates",
  defaultStatePath: "blender/ember-meshy-image-tasks-r7.json",
});
