/**
 * Scene3DPersister Implementation
 *
 * Persists 3D scene UI state to localStorage.
 */

import { Plane } from "../../domain/enums/Plane";
import type {
  IScene3DPersister,
  Scene3DPersistedState,
} from "../contracts/IScene3DPersister";

const STORAGE_KEY = "tka-3d-animator-state";

export class Scene3DPersister implements IScene3DPersister {
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
