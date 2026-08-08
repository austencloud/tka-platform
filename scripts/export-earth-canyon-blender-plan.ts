import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEarthCanyonBlenderContract } from "../src/lib/features/museum/data/earth-canyon-blender-contract";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

export const EARTH_CANYON_BLENDER_MANIFEST_PATH = resolve(
  "docs/superpowers/specs/2026-08-08-earth-root-chasm-blender-plan.json"
);

export function createEarthCanyonBlenderManifest() {
  const contract = buildEarthCanyonBlenderContract();
  const canonicalContract = canonicalJSON(contract);
  return {
    hashAlgorithm: "sha256" as const,
    sourceDigest: createHash("sha256")
      .update(canonicalContract, "utf8")
      .digest("hex"),
    contract,
  };
}

export function exportEarthCanyonBlenderManifest(
  outputPath = EARTH_CANYON_BLENDER_MANIFEST_PATH
): void {
  const manifest = createEarthCanyonBlenderManifest();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${canonicalJSON(manifest)}\n`, "utf8");
  console.log(`Earth Root Chasm Blender plan: ${outputPath}`);
  console.log(`Source digest: ${manifest.sourceDigest}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  exportEarthCanyonBlenderManifest();
}
