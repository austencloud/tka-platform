import { z } from "zod";
import { StepDataSchema } from "$lib/shared/foundation/domain/schemas";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { CameraStateSnapshot } from "@austencloud/scene-3d";

/**
 * A reproducible snapshot of the 3D viewer configuration. Aggregates the four
 * state owners (per-mount viewer-3d-state, global settingsService background,
 * scene-feature toggles, camera) into one flat blob. See
 * `docs/superpowers/specs/2026-07-10-save-a-3d-scene-collection-design.md`.
 */
export interface Scene3DSnapshot {
  version: 1;
  scene: { backgroundType: string; oceanVariant: string };
  camera: CameraStateSnapshot | null;
  performers: StoredPerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: string;
  propSizeLinked: boolean;
  defaultSettings: {
    prop: string;
    effortId: string;
    planeMode: string;
    customBluePlane: string;
    customRedPlane: string;
  };
  visiblePlanes: string[];
  showGridLabels: boolean;
  navMode: "orbit" | "fly" | "walk";
  activePreset: string | null;
  activeCameraPreset: string;
  stageGroundOffset: number;
  /** Captured + shown, but NOT auto-restored on open — the app never persists
   *  the 3D effect toggles, so reproducing them is a separate capability. */
  effectToggles: Record<string, boolean>;
  sceneFeatures: Record<string, boolean>;
  props: { bluePropType?: string; redPropType?: string };
}

export interface StoredPerformerSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: string;
  customRedPlane: string;
  name?: string | null;
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
}

// External-enum fields (camera vectors, planes, formation, backgroundType) are
// kept loose — the same pragmatism the tunnel schema uses for `updatedAt` and
// nested StepData. Booleans / numbers / version are strict.
const StoredPerformerSnapshotSchema = z.object({
  position: z.object({ x: z.number(), z: z.number() }),
  facingAngle: z.number(),
  customBluePlane: z.string(),
  customRedPlane: z.string(),
  name: z.string().nullable().optional(),
});

export const Scene3DSnapshotSchema = z.object({
  version: z.literal(1),
  scene: z.object({ backgroundType: z.string(), oceanVariant: z.string() }),
  camera: z.any().nullable(),
  performers: z.array(StoredPerformerSnapshotSchema),
  selectedPerformerIndex: z.number().nullable(),
  activeFormation: z.string(),
  propSizeLinked: z.boolean(),
  defaultSettings: z.object({
    prop: z.string(),
    effortId: z.string(),
    planeMode: z.string(),
    customBluePlane: z.string(),
    customRedPlane: z.string(),
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
    bluePropType: z.string().optional(),
    redPropType: z.string().optional(),
  }),
});

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
});

export const SCENE_3D_COLLECTION_STORAGE_KEY = "tka:scene-3d-collection";
export const SCENE_3D_COLLECTION_SCHEMA_VERSION = 1;

export type { StepData };
