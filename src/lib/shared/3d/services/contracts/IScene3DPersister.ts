/**
 * IScene3DPersister Contract
 *
 * Service for persisting 3D scene UI state to localStorage.
 * Note: Environment/background type is not persisted here - it uses
 * the shared settingsService which handles its own persistence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import type { GridMode } from "../../domain/constants/grid-layout";
import type { Plane } from "../../domain/enums/Plane";

/**
 * Body proportions for avatar (all in centimeters)
 */
export interface AvatarProportions {
  height: number;
  headHeight: number;
  neckLength: number;
  shoulderWidth: number;
  torsoLength: number;
  hipWidth: number;
  upperArmLength: number;
  forearmLength: number;
  handLength: number;
  inseam: number;
  thighLength: number;
  shinLength: number;
}

/**
 * State structure for persistence
 */
export interface Scene3DPersistedState {
  // Scene settings
  visiblePlanes: string[];
  showGrid: boolean;
  showLabels: boolean;
  gridMode: GridMode;
  cameraPreset: "front" | "top" | "side" | "perspective";

  // Custom camera position
  cameraPosition: [number, number, number] | null;
  cameraTarget: [number, number, number] | null;

  // UI state
  activeTab: "blue" | "red";
  panelOpen: boolean;
  speed: number;

  // Avatar customization
  avatarId: string;
  bodyType: "masculine" | "feminine" | "androgynous";
  skinTone: string;
  showFigure: boolean;
  avatarProportions: AvatarProportions;

  // Playback
  loop: boolean;

  // Prop visibility
  showBlue: boolean;
  showRed: boolean;

  // Manual configs
  blueConfig: MotionConfig3D;
  redConfig: MotionConfig3D;

  // Sequence state
  loadedSequence: SequenceData | null;
  currentStepIndex: number;
}

export interface IScene3DPersister {
  /**
   * Save state to localStorage (merges with existing)
   */
  saveState(state: Partial<Scene3DPersistedState>): void;

  /**
   * Load state from localStorage
   */
  loadState(): Partial<Scene3DPersistedState>;

  /**
   * Clear all persisted state
   */
  clearState(): void;

  /**
   * Convert plane strings back to Set<Plane>
   */
  parsePlanes(planeStrings: string[] | undefined): Set<Plane>;
}
