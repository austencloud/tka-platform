export const CANDIDATE_IDS = [
  "current-raw",
  "current-optimized",
  "human-generator-trial",
  "human-generator-parity",
  "personal-metaperson",
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

export type CandidateId = (typeof CANDIDATE_IDS)[number];
export type StressPoseId = (typeof STRESS_POSE_IDS)[number];

export interface BakeoffCandidate {
  id: CandidateId;
  label: string;
  source: string;
  modelUrl: string;
  bytes: number;
  continuity: "current" | "control" | "disqualified";
  note: string;
}

export const BAKEOFF_CANDIDATES: Record<CandidateId, BakeoffCandidate> = {
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

export function parseCandidateId(value: string | null): CandidateId {
  return CANDIDATE_IDS.includes(value as CandidateId)
    ? (value as CandidateId)
    : "current-optimized";
}

export function parseStressPoseId(value: string | null): StressPoseId {
  return STRESS_POSE_IDS.includes(value as StressPoseId)
    ? (value as StressPoseId)
    : "cross-body";
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
