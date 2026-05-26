/**
 * Persists 3D scene UI state to localStorage.
 */

import { Plane } from "@austencloud/scene-3d";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MotionConfig3D } from "../domain/models/MotionData3D";
import type { GridMode } from "@austencloud/scene-3d";

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

/**
 * Structural interface matching the old class API consumed by AvatarCustomizer.
 * Satisfiable by passing `{ saveState: saveScene3DState, loadState: loadScene3DState }`.
 */
export interface Scene3DPersisterAPI {
  saveState(state: Partial<Scene3DPersistedState>): void;
  loadState(): Partial<Scene3DPersistedState>;
}

/** Save state to localStorage (merges with existing) */
export function saveScene3DState(state: Partial<Scene3DPersistedState>): void {
  try {
    const existing = loadScene3DState();
    const merged = { ...existing, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("Failed to save 3D scene state:", e);
  }
}

/** Load state from localStorage */
export function loadScene3DState(): Partial<Scene3DPersistedState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const state = JSON.parse(stored);

    // Migration: Clear legacy camera positions (pre-meter scale).
    if (state.cameraPosition) {
      const maxCoord = Math.max(...state.cameraPosition.map(Math.abs));
      if (maxCoord > 20) {
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

/** Clear all persisted state */
export function clearScene3DState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Convert plane strings back to Set<Plane> */
export function parsePlanes(planeStrings: string[] | undefined): Set<Plane> {
  if (!planeStrings) {
    return new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]);
  }
  return new Set(planeStrings.map((p) => p as Plane));
}
