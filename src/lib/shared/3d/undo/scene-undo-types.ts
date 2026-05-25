import type { EffectsConfig } from "$lib/shared/effects/domain/EffectsConfig";
import type { Scene3DRenderConfig } from "../scene-features/state/scene-3d-render-state.svelte";
import type { FormationPreset } from "@austencloud/scene-3d";
import type { Plane } from "@austencloud/scene-3d";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { EffectId } from "../state/performer-settings-types";
import type { BackgroundType } from "@austencloud/backgrounds";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SceneId } from "$lib/features/lab/tabs/scene-lab/domain/scene-lab-types";
import type { CosmicVariant } from "$lib/features/lab/tabs/scene-lab/services/scene-lab-persistence";
import type { PlaneMode } from "@austencloud/scene-3d";

// ============================================
// Operation Types
// ============================================

export type SceneUndoOperationType =
  // Performer
  | "spawn-performer"
  | "remove-performer"
  | "apply-formation"
  | "spatial-edit"
  | "change-prop"
  | "change-staff-length"
  | "change-effort"
  // Effects
  | "toggle-effect"
  | "update-effect-config"
  | "apply-effect-preset"
  | "set-active-effect"
  | "toggle-motion"
  // Scene
  | "change-environment"
  | "change-grid-mode"
  // Planes
  | "toggle-plane-visibility"
  | "set-hand-plane"
  | "set-beat-plane-override"
  | "toggle-grid-labels"
  // Visibility
  | "toggle-ui-visibility"
  // Defaults cascade
  | "change-default-prop"
  | "change-default-effort"
  | "change-default-effects"
  | "change-default-planes"
  | "reset-all-overrides"
  // Scene Lab
  | "change-scene-lab-scene"
  | "update-scene-lab-config"
  | "change-cosmic-variant";

// ============================================
// Snapshot Domains
// ============================================

export interface ViewerDomainSnapshot {
  performers: PerformerPositionSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
}

export interface PerformerPositionSnapshot {
  id: string;
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

export interface PerformerDomainSnapshot {
  index: number;
  selectedPerformerIndex: number | null;
  settings: {
    prop: PropType | null;
    effortId: EffortId | null;
    effects: Set<EffectId> | null;
    staffLengthCm: number | null;
  };
  planes: {
    customBluePlane: Plane | null;
    customRedPlane: Plane | null;
    planeMode: PlaneMode | null;
    beatPlaneOverrides: Map<number, { blue?: Plane; red?: Plane }>;
  };
}

export interface SceneDomainSnapshot {
  backgroundType: BackgroundType;
  gridMode: GridMode;
}

export interface VisibilityDomainSnapshot {
  visiblePlanes: Set<Plane>;
  showGridLabels: boolean;
}

export interface DefaultsDomainSnapshot {
  prop: PropType;
  effects: Set<EffectId>;
  effortId: EffortId;
  planeMode: PlaneMode;
  customBluePlane: Plane;
  customRedPlane: Plane;
}

export interface SceneLabDomainSnapshot {
  sceneId: SceneId;
  cosmicVariant: CosmicVariant;
  configs: Record<string, unknown>;
}

// ============================================
// Composite Snapshot
// ============================================

export interface SceneUndoSnapshot {
  viewer?: ViewerDomainSnapshot;
  performer?: PerformerDomainSnapshot;
  effects?: EffectsConfig;
  motion?: Scene3DRenderConfig;
  scene?: SceneDomainSnapshot;
  visibility?: VisibilityDomainSnapshot;
  defaults?: DefaultsDomainSnapshot;
  sceneLab?: SceneLabDomainSnapshot;
}

// ============================================
// Undo Entry
// ============================================

export interface SceneUndoEntry {
  id: string;
  type: SceneUndoOperationType;
  timestamp: number;
  description: string;
  beforeState: SceneUndoSnapshot;
  afterState?: SceneUndoSnapshot;
  coalescingKey?: string;
  customRestore?: {
    undo: () => void;
    redo: () => void;
  };
}
