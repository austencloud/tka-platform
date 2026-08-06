import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFirstFireBlenderContract } from "../src/lib/features/museum/data/first-fire-blender-contract";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

export const FIRST_FIRE_BLENDER_MANIFEST_PATH = resolve(
  "docs/superpowers/specs/2026-08-06-first-fire-blender-plan.json"
);

export function createFirstFireBlenderManifest() {
  const contract = buildFirstFireBlenderContract();
  const canonicalContract = canonicalJSON(contract);
  return {
    hashAlgorithm: "sha256" as const,
    sourceDigest: createHash("sha256")
      .update(canonicalContract, "utf8")
      .digest("hex"),
    contract,
  };
}

export function exportFirstFireBlenderManifest(
  outputPath = FIRST_FIRE_BLENDER_MANIFEST_PATH
): void {
  const manifest = createFirstFireBlenderManifest();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${canonicalJSON(manifest)}\n`, "utf8");
  console.log(`First Fire Blender plan: ${outputPath}`);
  console.log(`Source digest: ${manifest.sourceDigest}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  exportFirstFireBlenderManifest();
}
