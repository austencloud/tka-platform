export const CANDIDATE_IDS = [
  "current-raw",
  "current-optimized",
  "human-generator-trial",
  "human-generator-parity",
  "personal-metaperson",
  "intake-current",
  "avatar-sdk",
  "avaturn",
  "ready-player-me-archived",
] as const;

export const STRESS_POSE_IDS = [
  "neutral",
  "overhead",
  "cross-body",
  "depth",
  "low",
] as const;

export const LIGHTING_IDS = ["studio", "room"] as const;

export type FixedCandidateId = (typeof CANDIDATE_IDS)[number];
export type StagedCandidateId = `intake-${string}`;
export type CandidateId = FixedCandidateId | StagedCandidateId;
export type StressPoseId = (typeof STRESS_POSE_IDS)[number];
export type LightingId = (typeof LIGHTING_IDS)[number];

export interface BakeoffCandidate {
  id: CandidateId;
  label: string;
  source: string;
  modelUrl: string;
  bytes: number | null;
  continuity: "current" | "control" | "disqualified";
  note: string;
}

export const BAKEOFF_CANDIDATES: Record<FixedCandidateId, BakeoffCandidate> = {
  "current-raw": {
    id: "current-raw",
    label: "Current avatar · raw",
    source: "TKA ch01 source asset",
    modelUrl: "/models/avatars/bakeoff/current-raw-ch01.glb",
    bytes: 61_515_856,
    continuity: "control",
    note: "Control for separating source-model quality from the current optimizer.",
  },
  "current-optimized": {
    id: "current-optimized",
    label: "Current avatar · optimized",
    source: "TKA ch01 production optimization",
    modelUrl: "/models/avatars/bakeoff/current-optimized-ch01.glb",
    bytes: 2_431_624,
    continuity: "control",
    note: "The model class currently shipped by TKA.",
  },
  "human-generator-trial": {
    id: "human-generator-trial",
    label: "Human Generator · trial",
    source: "Locally generated Human Generator trial",
    modelUrl: "/models/avatars/bakeoff/human-generator-trial.glb",
    bytes: 19_853_800,
    continuity: "current",
    note: "Trial-watermarked LOD1 export with 1K baked textures and trial-compatible mesh hair.",
  },
  "human-generator-parity": {
    id: "human-generator-parity",
    label: "Human Generator · parity",
    source: "Full-fidelity Human Generator control export",
    modelUrl: "/models/avatars/bakeoff/human-generator-parity.glb",
    bytes: 238_315_964,
    continuity: "current",
    note: "Full meshes, 4K baked textures, transmissive corneas, and dense mesh hair. Deliberately unoptimized.",
  },
  "personal-metaperson": {
    id: "personal-metaperson",
    label: "Personal MetaPerson",
    source: "MetaPerson Creator photo export",
    modelUrl: "/models/avatars/bakeoff/personal-metaperson.glb",
    bytes: 12_150_852,
    continuity: "current",
    note: "Evaluation-only LOD1 GLB with the standard 73-joint MetaPerson skeleton and 1K PBR textures.",
  },
  "intake-current": {
    id: "intake-current",
    label: "Current intake slot",
    source: "Local character intake pipeline",
    modelUrl: "/models/avatars/bakeoff/intake-current.glb",
    bytes: null,
    continuity: "current",
    note: "The most recent locally staged intake. Every staged character also appears by name under Staged intakes.",
  },
  "avatar-sdk": {
    id: "avatar-sdk",
    label: "Avatar SDK MetaPerson",
    source: "Official BSD-3-Clause rendering sample",
    modelUrl: "/models/avatars/bakeoff/avatar-sdk-metaperson.glb",
    bytes: 14_360_216,
    continuity: "current",
    note: "Current vendor sample with 1K skin, clothing, eye, and normal textures.",
  },
  avaturn: {
    id: "avaturn",
    label: "Avaturn",
    source: "Official Mixamo compatibility sample",
    modelUrl: "/models/avatars/bakeoff/avaturn.glb",
    bytes: 650_932,
    continuity: "current",
    note: "Rig-compatibility sample only; the public FBX does not include textures.",
  },
  "ready-player-me-archived": {
    id: "ready-player-me-archived",
    label: "Ready Player Me · archived",
    source: "Archived official SDK sample",
    modelUrl: "/models/avatars/bakeoff/ready-player-me-archived.glb",
    bytes: 3_788_500,
    continuity: "disqualified",
    note: "Visual reference only. Ready Player Me services ended January 31, 2026.",
  },
};

export const LIGHTING_OPTIONS: Record<
  LightingId,
  { label: string; note: string }
> = {
  studio: {
    label: "Studio lights",
    note: "Hemisphere and three directional lights with no environment map. This is closest to the production viewer, which lights performers with an ambient and one key light.",
  },
  room: {
    label: "Room environment",
    note: "Adds a prefiltered neutral room as the scene environment so roughness and metalness have something to reflect. Compare the same pose under both to separate what the character brings from what the rig withholds.",
  },
};

/** Written by `pnpm run characters:intake -- --stage-bakeoff` into the ignored stage directory. */
export const INTAKE_MANIFEST_URL =
  "/models/avatars/bakeoff/intake-manifest.json";
const STAGE_DIRECTORY_URL = "/models/avatars/bakeoff";
const STAGED_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAGED_FILE_PATTERN = /^[A-Za-z0-9._-]+\.glb$/;

export interface StagedIntakeEntry {
  id: string;
  label: string;
  source: string;
  file: string;
  bytes: number | null;
  note: string;
  stagedAt: string;
}

function stringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Read the manifest defensively: it is a local file written by a script, and
 * a half-written or hand-edited record must not take the whole route down.
 * Entries that cannot name a valid file are dropped rather than repaired.
 */
export function parseIntakeManifest(value: unknown): StagedIntakeEntry[] {
  if (value === null || typeof value !== "object") return [];
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return [];
  const entries: StagedIntakeEntry[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    if (raw === null || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const id = stringField(record.id);
    const file = stringField(record.file);
    if (!STAGED_ID_PATTERN.test(id) || !STAGED_FILE_PATTERN.test(file))
      continue;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      label: stringField(record.label, id),
      source: stringField(record.source, "Local character intake pipeline"),
      file,
      bytes: typeof record.bytes === "number" ? record.bytes : null,
      note: stringField(record.note),
      stagedAt: stringField(record.stagedAt),
    });
  }
  return entries;
}

export function stagedCandidateId(entryId: string): StagedCandidateId {
  return `intake-${entryId}`;
}

export function stagedCandidate(entry: StagedIntakeEntry): BakeoffCandidate {
  return {
    id: stagedCandidateId(entry.id),
    label: entry.label,
    source: entry.source,
    modelUrl: `${STAGE_DIRECTORY_URL}/${entry.file}`,
    bytes: entry.bytes,
    continuity: "current",
    note:
      entry.note ||
      "Locally staged intake. Review every stress pose before catalog promotion.",
  };
}

export async function loadStagedIntakeCandidates(
  fetchImpl: typeof fetch = fetch
): Promise<BakeoffCandidate[]> {
  try {
    const response = await fetchImpl(INTAKE_MANIFEST_URL, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    return parseIntakeManifest(await response.json()).map(stagedCandidate);
  } catch {
    return [];
  }
}

function isFixedCandidateId(value: string): value is FixedCandidateId {
  return (CANDIDATE_IDS as readonly string[]).includes(value);
}

export function parseCandidateId(
  value: string | null,
  staged: readonly BakeoffCandidate[] = []
): CandidateId {
  if (value === null) return "current-optimized";
  if (isFixedCandidateId(value)) return value;
  if (staged.some((candidate) => candidate.id === value)) {
    return value as StagedCandidateId;
  }
  return "current-optimized";
}

export function resolveCandidate(
  id: CandidateId,
  staged: readonly BakeoffCandidate[] = []
): BakeoffCandidate {
  if (isFixedCandidateId(id)) return BAKEOFF_CANDIDATES[id];
  return (
    staged.find((candidate) => candidate.id === id) ??
    BAKEOFF_CANDIDATES["current-optimized"]
  );
}

export function parseStressPoseId(value: string | null): StressPoseId {
  return STRESS_POSE_IDS.includes(value as StressPoseId)
    ? (value as StressPoseId)
    : "cross-body";
}

export function parseLightingId(value: string | null): LightingId {
  return LIGHTING_IDS.includes(value as LightingId)
    ? (value as LightingId)
    : "studio";
}

export function formatMegabytes(bytes: number | null): string {
  if (bytes === null) return "local staged file";
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
