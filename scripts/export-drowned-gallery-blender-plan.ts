/**
 * Export the Drowned Gallery Blender build manifest.
 *
 * The layout authority is buildDrownedGalleryLayout over the compiled Vulcan
 * Cave grid — the same call physics and the runtime graybox consume. This
 * script serialises every rect the room is made of, plus the vertical datums,
 * into a hash-stamped JSON contract for scripts/build-drowned-gallery-graybox.py.
 * Never hand-edit the JSON; regenerate it from here.
 *
 *   pnpm exec tsx scripts/export-drowned-gallery-blender-plan.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVulcanCaveFloorPlan } from "../src/lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildDrownedGalleryLayout,
  WATERLINE_Y,
  SHALLOWS_Y,
  GALLERY_FLOOR_Y,
  GALLERY_ROOF_Y,
  LANDING_Y,
  CAUSEWAY_Y,
  SHELF_Y,
  CHANNEL_BED_Y,
  POOL_BOTTOM_Y,
  DOME_APEX_Y,
  SHAFT_CEILING_Y,
  WALL_THICKNESS,
  BELL_FLOOR_Y,
  BELL_CEILING_Y,
} from "../src/lib/features/museum/data/drowned-gallery-terrain";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

export const DROWNED_GALLERY_BLENDER_MANIFEST_PATH = resolve(
  "docs/superpowers/specs/2026-08-09-drowned-gallery-blender-plan.json"
);

export function createDrownedGalleryBlenderManifest() {
  const plan = buildVulcanCaveFloorPlan();
  const layout = buildDrownedGalleryLayout(plan.grid);
  if (!layout) {
    throw new Error(
      "Drowned gallery layout did not build — water rooms missing from the compiled cave grid"
    );
  }

  // The GLB is authored around the water bay's centre so the review route can
  // mount it at the origin. Runtime consumers translate by this origin.
  const origin = {
    x: (layout.bayBounds.minX + layout.bayBounds.maxX) / 2,
    z: (layout.bayBounds.minZ + layout.bayBounds.maxZ) / 2,
  };

  const contract = {
    schemaVersion: 1,
    sceneName: "Drowned Gallery Graybox",
    sourceModule: "src/lib/features/museum/data/drowned-gallery-terrain.ts",
    coordinateSystem: {
      origin,
      authoring:
        "Blender X = world X - origin.x; Blender Y = origin.z - world Z; Blender Z = elevation",
      gltfRuntime: {
        mount: "review route mounts the GLB at the origin with no rotation",
        exporterTransform: "Blender glTF export maps (X, Y, Z) to (X, Z, -Y)",
      },
    },
    datums: {
      WATERLINE_Y,
      SHALLOWS_Y,
      GALLERY_FLOOR_Y,
      GALLERY_ROOF_Y,
      LANDING_Y,
      CAUSEWAY_Y,
      SHELF_Y,
      CHANNEL_BED_Y,
      POOL_BOTTOM_Y,
      DOME_APEX_Y,
      SHAFT_CEILING_Y,
      WALL_THICKNESS,
      BELL_FLOOR_Y,
      BELL_CEILING_Y,
    },
    performers: [
      { id: "cave-water-a", sequenceId: "cave-water-seq-a" },
      { id: "cave-water-b", sequenceId: "cave-water-seq-b" },
      { id: "cave-water-c", sequenceId: "cave-water-seq-c" },
    ],
    collections: [
      "SHELL",
      "FLOORS",
      "ROCK",
      "WATER",
      "DOME",
      "FEATURES",
      "REFERENCE",
      "LOCATORS",
      "QA_ONLY",
    ],
    layout,
  };

  const digestSource = canonicalJSON(contract);
  return {
    hashAlgorithm: "sha256" as const,
    sourceDigest: createHash("sha256").update(digestSource, "utf8").digest("hex"),
    contract,
  };
}

export function exportDrownedGalleryBlenderManifest(
  outputPath = DROWNED_GALLERY_BLENDER_MANIFEST_PATH
): void {
  const manifest = createDrownedGalleryBlenderManifest();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${canonicalJSON(manifest)}\n`, "utf8");
  console.log(`Drowned Gallery Blender plan: ${outputPath}`);
  console.log(`Source digest: ${manifest.sourceDigest}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  exportDrownedGalleryBlenderManifest();
}
