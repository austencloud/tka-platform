/**
 * Animation3DPersister Implementation
 *
 * Persists 3D animation UI state to localStorage.
 */

import { Plane } from "../../domain/enums/Plane";
import type {
  IAnimation3DPersister,
  Animation3DPersistedState,
} from "../contracts/IAnimation3DPersister";

const STORAGE_KEY = "tka-3d-animator-state";

export class Animation3DPersister implements IAnimation3DPersister {
  /**
   * Save state to localStorage (merges with existing)
   */
  saveState(state: Partial<Animation3DPersistedState>): void {
    try {
      const existing = this.loadState();
      const merged = { ...existing, ...state };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("Failed to save 3D animator state:", e);
    }
  }

  /**
   * Load state from localStorage
   */
  loadState(): Partial<Animation3DPersistedState> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to load 3D animator state:", e);
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
