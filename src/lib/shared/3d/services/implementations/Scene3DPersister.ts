/**
 * Scene3DPersister Implementation
 *
 * Persists 3D scene UI state to localStorage.
 */

import { Plane } from "../../domain/enums/Plane";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import type { GridMode } from "../../domain/constants/grid-layout";

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

export interface Scene3DPersistedState {
  visiblePlanes: string[];
  showGrid: boolean;
  showLabels: boolean;
  gridMode: GridMode;
  cameraPreset: "front" | "top" | "side" | "perspective";
  cameraPosition: [number, number, number] | null;
  cameraTarget: [number, number, number] | null;
  activeTab: "blue" | "red";
  panelOpen: boolean;
  speed: number;
  avatarId: string;
  bodyType: "masculine" | "feminine" | "androgynous";
  skinTone: string;
  showFigure: boolean;
  avatarProportions: AvatarProportions;
  loop: boolean;
  showBlue: boolean;
  showRed: boolean;
  blueConfig: MotionConfig3D;
  redConfig: MotionConfig3D;
  loadedSequence: SequenceData | null;
  currentStepIndex: number;
}

const STORAGE_KEY = "tka-3d-animator-state";

export class Scene3DPersister {
  /**
   * Save state to localStorage (merges with existing)
   */
  saveState(state: Partial<Scene3DPersistedState>): void {
    try {
      const existing = this.loadState();
      const merged = { ...existing, ...state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("Failed to save 3D scene state:", e);
    }
  }

  /**
   * Load state from localStorage
   */
  loadState(): Partial<Scene3DPersistedState> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      const state = JSON.parse(stored);

      // Migration: Clear legacy camera positions (pre-meter scale).
      // Old positions were 200-800 units, new positions are 1-10 meters.
      if (state.cameraPosition) {
        const maxCoord = Math.max(...state.cameraPosition.map(Math.abs));
        if (maxCoord > 20) {
          console.log('[Scene3DPersister] Clearing legacy camera position:', state.cameraPosition);
          delete state.cameraPosition;
          delete state.cameraTarget;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
      }

      return state;
    } catch (e) {
      console.warn("Failed to load 3D scene state:", e);
      return {};
    }
  }

  /**
   * Clear all persisted state
   */
  clearState(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Convert plane strings back to Set<Plane>
   */
  parsePlanes(planeStrings: string[] | undefined): Set<Plane> {
    if (!planeStrings) {
      return new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]);
    }
    return new Set(planeStrings.map((p) => p as Plane));
  }
}
