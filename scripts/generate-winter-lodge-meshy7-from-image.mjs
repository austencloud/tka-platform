import { runMeshyImageGeneration } from "./lib/meshy-image-generator.mjs";

await runMeshyImageGeneration({
  manifestPath: "scripts/winter-lodge-meshy7-images.json",
  defaultImageRoot: "assets/meshy-refs/winter/lodge-v7",
  defaultOutputDirectory:
    "static/models/winter/settlement/meshy7-candidates",
  defaultStatePath: "blender/winter-lodge-meshy7-tasks.json",
});
