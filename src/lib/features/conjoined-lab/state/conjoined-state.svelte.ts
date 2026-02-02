/**
 * Conjoined Lab State - Manages playback and layout state
 *
 * Uses Svelte 5 runes for reactive state management.
 */

import type { ConjoinedLayout, GridArrangement } from "../domain/types";
import { DEFAULT_CONJOINED_LAYOUT } from "../domain/types";
import { getDefaultEdgeForArrangement } from "../domain/layout-presets";

// ============================================================================
// Playback State
// ============================================================================

let isPlaying = $state(false);
let currentBeat = $state(0);
let playbackSpeed = $state(1); // 1 = normal, 0.5 = half speed, 2 = double

export function getIsPlaying(): boolean {
  return isPlaying;
}

export function setIsPlaying(value: boolean): void {
  isPlaying = value;
}

export function togglePlayback(): void {
  isPlaying = !isPlaying;
}

export function getCurrentBeat(): number {
  return currentBeat;
}

export function setCurrentBeat(beat: number): void {
  currentBeat = beat;
}

export function incrementBeat(maxBeats: number): void {
  currentBeat = (currentBeat + 1) % maxBeats;
}

export function getPlaybackSpeed(): number {
  return playbackSpeed;
}

export function setPlaybackSpeed(speed: number): void {
  playbackSpeed = speed;
}

// ============================================================================
// Layout State
// ============================================================================

let layout = $state<ConjoinedLayout>({ ...DEFAULT_CONJOINED_LAYOUT });

export function getLayout(): ConjoinedLayout {
  return layout;
}

export function setLayout(newLayout: ConjoinedLayout): void {
  layout = newLayout;
}

export function setArrangement(arrangement: GridArrangement): void {
  layout = {
    ...layout,
    arrangement,
    conjoinedEdge: getDefaultEdgeForArrangement(arrangement),
  };
}

export function setSpacing(spacing: number): void {
  layout = {
    ...layout,
    spacing: Math.max(0, Math.min(200, spacing)),
  };
}

export function toggleConjoinedPointVisibility(): void {
  layout = {
    ...layout,
    showConjoinedPoint: !layout.showConjoinedPoint,
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetState(): void {
  isPlaying = false;
  currentBeat = 0;
  playbackSpeed = 1;
  layout = { ...DEFAULT_CONJOINED_LAYOUT };
}
