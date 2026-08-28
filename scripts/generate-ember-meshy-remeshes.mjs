#!/usr/bin/env node

import { runMeshyRemeshGeneration } from "./lib/meshy-remesh-generator.mjs";

await runMeshyRemeshGeneration({
  manifestPath: "scripts/ember-meshy-remeshes.json",
});
