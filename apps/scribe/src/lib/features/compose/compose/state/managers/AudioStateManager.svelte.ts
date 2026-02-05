/**
 * Audio State Manager
 *
 * Manages audio file loading, BPM detection, beat markers, and caching.
 * Extracted from composition-state.svelte.ts for single responsibility.
 */

import type { AudioState, BeatMarker } from "../composition-types";
import { createDefaultAudioState } from "../composition-helpers";
import {
  saveAudioToCache,
  loadAudioFromCache,
  clearAudioCache,
  updateAudioCacheMetadata,
} from "../../phases/audio/audio-persistence";

export type AudioStateManager = ReturnType<typeof createAudioStateManager>;

export function createAudioStateManager() {
  let audioState = $state<AudioState>(createDefaultAudioState());

  // =========================================================================
  // Derived State
  // =========================================================================

  const hasAudio = $derived(audioState.isLoaded && audioState.url !== null);

  // =========================================================================
  // File Loading
  // =========================================================================

  function loadAudioFile(file: File, skipCache = false) {
    // Revoke previous URL if exists
    if (audioState.url) {
      URL.revokeObjectURL(audioState.url);
    }

    const url = URL.createObjectURL(file);
    audioState = {
      ...audioState,
      file,
      url,
      fileName: file.name,
      isLoaded: true,
      isAnalyzing: false,
    };

    // Save to IndexedDB cache (for persistence across refreshes)
    if (!skipCache) {
      saveAudioToCache(
        file,
        audioState.duration,
        audioState.detectedBpm,
        audioState.manualBpm
      );
    }
  }

  function clearAudio() {
    // Revoke URL if exists
    if (audioState.url) {
      URL.revokeObjectURL(audioState.url);
    }
    audioState = createDefaultAudioState();
    clearAudioCache();
  }

  async function restoreFromCache(): Promise<boolean> {
    try {
      const cached = await loadAudioFromCache();
      if (cached) {
        // Load the file without re-caching it
        loadAudioFile(cached.file, true);

        // Restore metadata
        if (cached.duration > 0) {
          audioState = { ...audioState, duration: cached.duration };
        }
        if (cached.detectedBpm !== null) {
          audioState = { ...audioState, detectedBpm: cached.detectedBpm };
        }
        if (cached.manualBpm !== null) {
          audioState = { ...audioState, manualBpm: cached.manualBpm };
        }

        return true;
      }
    } catch (err) {
      console.warn("Failed to restore audio from cache:", err);
    }
    return false;
  }

  // =========================================================================
  // Duration & BPM
  // =========================================================================

  function setDuration(duration: number) {
    audioState = { ...audioState, duration };
    if (audioState.isLoaded) {
      updateAudioCacheMetadata(duration, undefined, undefined);
    }
  }

  function setDetectedBpm(bpm: number) {
    audioState = {
      ...audioState,
      detectedBpm: bpm,
      isAnalyzing: false,
    };
    if (audioState.isLoaded) {
      updateAudioCacheMetadata(undefined, bpm, undefined);
    }
  }

  function setManualBpm(bpm: number | null) {
    audioState = { ...audioState, manualBpm: bpm };
    if (audioState.isLoaded) {
      updateAudioCacheMetadata(undefined, undefined, bpm);
    }
  }

  function setAnalyzing(analyzing: boolean) {
    audioState = { ...audioState, isAnalyzing: analyzing };
  }

  // =========================================================================
  // Beat Markers
  // =========================================================================

  function addBeatMarker(marker: BeatMarker) {
    audioState = {
      ...audioState,
      globalBeatMarkers: [...audioState.globalBeatMarkers, marker],
    };
  }

  function removeBeatMarker(markerId: string) {
    audioState = {
      ...audioState,
      globalBeatMarkers: audioState.globalBeatMarkers.filter(
        (m) => m.id !== markerId
      ),
    };
  }

  function updateBeatMarker(markerId: string, updates: Partial<BeatMarker>) {
    audioState = {
      ...audioState,
      globalBeatMarkers: audioState.globalBeatMarkers.map((m) =>
        m.id === markerId ? { ...m, ...updates } : m
      ),
    };
  }

  function setBeatMarkers(markers: BeatMarker[]) {
    audioState = { ...audioState, globalBeatMarkers: markers };
  }

  // =========================================================================
  // Reset
  // =========================================================================

  function reset() {
    clearAudio();
  }

  // =========================================================================
  // Return API
  // =========================================================================

  return {
    // State getters
    get state() {
      return audioState;
    },
    get hasAudio() {
      return hasAudio;
    },

    // File operations
    loadAudioFile,
    clearAudio,
    restoreFromCache,

    // Duration & BPM
    setDuration,
    setDetectedBpm,
    setManualBpm,
    setAnalyzing,

    // Beat markers
    addBeatMarker,
    removeBeatMarker,
    updateBeatMarker,
    setBeatMarkers,

    // Reset
    reset,
  };
}
