import { z } from "zod";
import { StepDataSchema } from "$lib/shared/foundation/domain/schemas";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { CameraStateSnapshot } from "@austencloud/scene-3d";
import {
  normalizeSceneEnvironmentId,
  type SceneEnvironmentId,
} from "$lib/shared/3d/environments/domain/scene-environment";
import { normalizeLegacyScene3DSnapshot } from "$lib/shared/3d/state/legacy-viewer-3d-snapshots";

/**
 * A reproducible snapshot of the 3D viewer configuration. Aggregates the four
 * state owners (per-mount viewer-3d-state, global settingsService background,
 * scene-feature toggles, camera) into one flat blob. See
 * `docs/superpowers/specs/2026-07-10-save-a-3d-scene-collection-design.md`.
 */
/** The user-facing save groups shown in the packing-list modal. */
export const SCENE_3D_GROUPS = [
  "performance",
  "performers",
  "props",
  "efforts",
  "effects",
  "scene",
  "camera",
] as const;
export type Scene3DGroupId = (typeof SCENE_3D_GROUPS)[number];

export interface Scene3DSnapshot {
  /** 3 separates the 3D environment from the application background. */
  version: 1 | 2 | 3;
  scene: {
    environmentId?: SceneEnvironmentId | string;
    /** Versions 1 and 2 used the application-background domain here. */
    backgroundType?: string;
    oceanVariant: string;
  };
  camera: CameraStateSnapshot | null;
  performers: StoredPerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: string;
  propSizeLinked: boolean;
  defaultSettings: {
    prop: string;
    effortId: string;
    planeMode: string;
    customLeftPlane: string;
    customRightPlane: string;
  };
  visiblePlanes: string[];
  showGridLabels: boolean;
  navMode: "orbit" | "fly" | "walk";
  activePreset: string | null;
  activeCameraPreset: string;
  stageGroundOffset: number;
  effectToggles: Record<string, boolean>;
  sceneFeatures: Record<string, boolean>;
  props: { leftPropType?: string; rightPropType?: string };
  /** Playback tempo at save time. Absent when the playback seam was
   *  unavailable (v1 snapshots, or capture outside the viewer). */
  bpm?: number;
  /** Which packing-list groups the user chose to save. Absent (v1) = all. */
  groups?: Record<Scene3DGroupId, boolean>;
}

/** Per-performer cascade overrides; null = inherit the viewer default. */
export interface StoredPerformerSettings {
  prop: string | null;
  effortId: string | null;
  effect: string | null;
  staffLengthCm: number | null;
}

export interface StoredPerformerSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
  customLeftPlane: string;
  customRightPlane: string;
  name?: string | null;
  /** Absent = no overrides (v1 snapshots). */
  settings?: StoredPerformerSettings;
}

export interface Collected3DScene {
  id: string;
  name: string;
  poster: string; // ~200px WebP data URL
  createdAt: number;
  snapshot: Scene3DSnapshot;
  /** Present → opening reproduces the exact performance in the scene. Absent →
   *  the entry is a reusable "look" applied to whatever sequence is opened. */
  steps?: StepData[];
  /** Lineage stamp — the source sequence's simplified word (never a raw
   *  repeated word; see simplifyRepeatedWord) and, when known at save time,
   *  its library id. Optional: old entries simply lack them. */
  sourceWord?: string;
  sourceSequenceId?: string;
}

// External-enum fields (camera vectors, planes, formation, backgroundType) are
// kept loose — the same pragmatism the tunnel schema uses for `updatedAt` and
// nested StepData. Booleans / numbers / version are strict.
const StoredPerformerSettingsSchema = z.object({
  prop: z.string().nullable(),
  effortId: z.string().nullable(),
  effect: z.string().nullable(),
  staffLengthCm: z.number().nullable(),
});

const StoredPerformerSnapshotSchema = z.object({
  position: z.object({ x: z.number(), z: z.number() }),
  facingAngle: z.number(),
  customLeftPlane: z.string(),
  customRightPlane: z.string(),
  name: z.string().nullable().optional(),
  settings: StoredPerformerSettingsSchema.optional(),
});

const GroupsSchema = z.record(z.enum(SCENE_3D_GROUPS), z.boolean());

export const Scene3DSnapshotSchema = z.preprocess(
  normalizeLegacyScene3DSnapshot,
  z.object({
    version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    scene: z
      .object({
        environmentId: z.string().optional(),
        backgroundType: z.string().optional(),
        oceanVariant: z.string(),
      })
      .refine(
        (scene) => Boolean(scene.environmentId || scene.backgroundType),
        "A saved 3D scene needs an environment identity"
      ),
    camera: z.any().nullable(),
    performers: z.array(StoredPerformerSnapshotSchema),
    selectedPerformerIndex: z.number().nullable(),
    activeFormation: z.string(),
    propSizeLinked: z.boolean(),
    defaultSettings: z.object({
      prop: z.string(),
      effortId: z.string(),
      planeMode: z.string(),
      customLeftPlane: z.string(),
      customRightPlane: z.string(),
    }),
    visiblePlanes: z.array(z.string()),
    showGridLabels: z.boolean(),
    navMode: z.enum(["orbit", "fly", "walk"]),
    activePreset: z.string().nullable(),
    activeCameraPreset: z.string(),
    stageGroundOffset: z.number(),
    effectToggles: z.record(z.string(), z.boolean()),
    sceneFeatures: z.record(z.string(), z.boolean()),
    props: z.object({
      leftPropType: z.string().optional(),
      rightPropType: z.string().optional(),
    }),
    bpm: z.number().optional(),
    groups: GroupsSchema.optional(),
  })
);

/** Whether a group was saved. Absent mask (v1) = everything saved. */
export function isGroupSaved(
  snapshot: Scene3DSnapshot,
  group: Scene3DGroupId
): boolean {
  return snapshot.groups?.[group] ?? true;
}

export function getScene3DEnvironmentId(
  snapshot: Scene3DSnapshot
): SceneEnvironmentId {
  return normalizeSceneEnvironmentId(
    snapshot.scene.environmentId ?? snapshot.scene.backgroundType
  );
}

export const Collected3DSceneSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  poster: z.string(),
  // createdAt is the client's Date.now(); updatedAt is a server timestamp object
  // firestoreSet stamps on write (hence z.any).
  createdAt: z.number(),
  updatedAt: z.any().optional(),
  snapshot: Scene3DSnapshotSchema,
  steps: z.array(StepDataSchema).optional(),
  sourceWord: z.string().optional(),
  sourceSequenceId: z.string().optional(),
});

export const SCENE_3D_COLLECTION_STORAGE_KEY = "tka:scene-3d-collection";
export const SCENE_3D_COLLECTION_SCHEMA_VERSION = 1;

export type { StepData };
