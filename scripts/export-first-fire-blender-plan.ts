import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompiledFirstFireBlenderContract } from "../src/lib/features/museum/data/first-fire-blender-contract";
import { MUSEUM_EXHIBIT_SEQUENCES } from "../src/lib/features/museum/data/museum-exhibit-sequences";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

export const FIRST_FIRE_BLENDER_MANIFEST_PATH = resolve(
  "docs/superpowers/specs/first-fire-cinder-court/first-fire-cinder-court-blender-plan.json"
);

const CATALOG_PATH = resolve("static/data/hero/tnd-base-words.json");
const LIVE_SEQUENCE_PATH = resolve(
  "src/lib/features/museum/data/museum-exhibit-sequences.ts"
);

interface CatalogEntry {
  id: string;
  word: string;
  sequenceLength: number;
  [key: string]: unknown;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createFirstFireBlenderManifest() {
  const contract = buildCompiledFirstFireBlenderContract();
  const catalogSource = readFileSync(CATALOG_PATH, "utf8");
  const liveSequenceSource = readFileSync(LIVE_SEQUENCE_PATH, "utf8");
  const catalog = JSON.parse(catalogSource) as CatalogEntry[];

  const sequenceFingerprints = contract.shrines.map((shrine) => {
    const catalogEntry = catalog.find(
      (candidate) => candidate.id === shrine.catalogId
    );
    if (!catalogEntry) {
      throw new Error(`First Fire manifest: missing ${shrine.catalogId}`);
    }
    const liveEntry = MUSEUM_EXHIBIT_SEQUENCES[shrine.sequenceId];
    if (!liveEntry) {
      throw new Error(`First Fire manifest: missing ${shrine.sequenceId}`);
    }
    const liveActionWord = liveEntry.steps
      .filter((step) => step.stepNumber > 0)
      .map((step) => step.letter)
      .join("");
    if (
      shrine.word !== catalogEntry.word ||
      shrine.word !== liveEntry.word ||
      shrine.word !== liveActionWord ||
      catalogEntry.sequenceLength !== liveEntry.steps.length
    ) {
      throw new Error(
        `First Fire manifest: ${shrine.id} live/catalog parity failed`
      );
    }
    return {
      shrineId: shrine.id,
      performerId: shrine.performerId,
      sequenceId: shrine.sequenceId,
      catalogId: shrine.catalogId,
      word: shrine.word,
      catalogFingerprintSha256: sha256(canonicalJSON(catalogEntry)),
      liveFingerprintSha256: sha256(canonicalJSON(liveEntry)),
      parity: {
        liveWordMatchesCatalog: true,
        liveStepLettersMatchCatalogWord: true,
        liveActionStepCountMatchesCatalog: true,
      },
    };
  });

  const sequenceSources = {
    catalog: {
      path: "static/data/hero/tnd-base-words.json",
      sha256: sha256(catalogSource),
    },
    liveMuseum: {
      path: "src/lib/features/museum/data/museum-exhibit-sequences.ts",
      sha256: sha256(liveSequenceSource),
    },
  };
  const digestPayloadCanonical = canonicalJSON({
    contract,
    sequenceSources,
    sequenceFingerprints,
  });
  return {
    hashAlgorithm: "sha256" as const,
    sourceDigest: sha256(digestPayloadCanonical),
    digestPayloadCanonical,
    sequenceSources,
    sequenceFingerprints,
    contract,
  };
}

export function exportFirstFireBlenderManifest(
  outputPath = FIRST_FIRE_BLENDER_MANIFEST_PATH
): void {
  const manifest = createFirstFireBlenderManifest();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${canonicalJSON(manifest)}\n`, "utf8");
  console.log(`First Fire Cinder Court Blender plan: ${outputPath}`);
  console.log(`Source digest: ${manifest.sourceDigest}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  exportFirstFireBlenderManifest();
}
