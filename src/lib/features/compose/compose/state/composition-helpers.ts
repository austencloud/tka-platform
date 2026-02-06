/**
 * Composition State Helpers
 *
 * Pure utility functions for composition state management.
 */

import type { Composition } from "../domain/types";
import type { AudioState } from "./composition-types";
import { createEmptyCells } from "../domain/types";

// ============================================================================
// Default Audio State
// ============================================================================

export function createDefaultAudioState(): AudioState {
  return {
    file: null,
    url: null,
    fileName: null,
    duration: 0,
    detectedBpm: null,
    manualBpm: null,
    globalBeatMarkers: [],
    tempoRegions: [],
    isAnalyzing: false,
    isLoaded: false,
  };
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateCompositionId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Local Storage Utilities
// ============================================================================

export function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (err) {
    console.warn(`Failed to load ${key} from localStorage:`, err);
  }
  return defaultValue;
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`Failed to save ${key} to localStorage:`, err);
  }
}

// ============================================================================
// Default Composition
// ============================================================================

export function createDefaultComposition(): Composition {
  return {
    id: generateCompositionId(),
    name: "Untitled Composition",
    layout: { rows: 1, cols: 1 },
    cells: createEmptyCells({ rows: 1, cols: 1 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: "You",
    isFavorite: false,
  };
}
