#!/usr/bin/env node

import { runMeshyRetextureGeneration } from "./lib/meshy-retexture-generator.mjs";

await runMeshyRetextureGeneration({
  manifestPath: "scripts/ember-meshy-retextures.json",
});
