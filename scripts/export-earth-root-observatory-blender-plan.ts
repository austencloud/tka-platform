import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEarthRootObservatoryBlenderContract } from "../src/lib/features/museum/data/earth-root-observatory-blender-contract";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

export const EARTH_ROOT_OBSERVATORY_BLENDER_MANIFEST_PATH = resolve(
  "docs/superpowers/specs/earth-root-observatory/earth-root-observatory-gate2-blender-plan.json"
);

const CATALOG_PATH = resolve("static/data/hero/tnd-base-words.json");
const CATALOG_IDS = [
  "tnd-tog-same-gggg",
  "tnd-tog-same-hhhh",
  "tnd-tog-same-iiii",
] as const;

interface CatalogEntry {
  id: string;
  word: string;
}

export function createEarthRootObservatoryBlenderManifest() {
  const contract = buildEarthRootObservatoryBlenderContract();
  const catalog = JSON.parse(
    readFileSync(CATALOG_PATH, "utf8")
  ) as CatalogEntry[];
  const sequenceFingerprints = CATALOG_IDS.map((catalogId) => {
    const entry = catalog.find((candidate) => candidate.id === catalogId);
    if (!entry) throw new Error(`Missing catalog sequence ${catalogId}`);
    return {
      catalogId,
      word: entry.word,
      sha256: createHash("sha256")
        .update(canonicalJSON(entry), "utf8")
        .digest("hex"),
    };
  });
  const digestSource = canonicalJSON({ contract, sequenceFingerprints });
  return {
    hashAlgorithm: "sha256" as const,
    sourceDigest: createHash("sha256")
      .update(digestSource, "utf8")
      .digest("hex"),
    sequenceFingerprints,
    contract,
  };
}

export function exportEarthRootObservatoryBlenderManifest(
  outputPath = EARTH_ROOT_OBSERVATORY_BLENDER_MANIFEST_PATH
): void {
  const manifest = createEarthRootObservatoryBlenderManifest();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${canonicalJSON(manifest)}\n`, "utf8");
  console.log(`Earth Root Observatory Blender plan: ${outputPath}`);
  console.log(`Source digest: ${manifest.sourceDigest}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  exportEarthRootObservatoryBlenderManifest();
}
