#!/usr/bin/env node

import { runMeshyRetextureGeneration } from "./lib/meshy-retexture-generator.mjs";

await runMeshyRetextureGeneration({
  manifestPath: "scripts/forest-meshy-retextures.json",
});
