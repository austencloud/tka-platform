/**
 * Composition Builder State
 *
 * Orchestrator for the unified composition builder.
 * Delegates to focused managers for specific domains.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TrailSettings } from "$lib/features/compose/shared/domain/types/TrailTypes";
import type { Composition, GridLayout, CellType } from "../domain/types";
import {
  createEmptyCells,
  isCellConfigured,
  isCompositionComplete,
} from "../domain/types";
import { createCellsFromTemplate, getTemplateById } from "../domain/templates";

// Import types and helpers
import type { WorkflowPhase } from "./composition-types";
import { STORAGE_KEYS } from "./composition-types";
import {
  createDefaultComposition,
  loadFromStorage,
  saveToStorage,
} from "./composition-helpers";

// Import managers
import { createAudioStateManager } from "./managers/AudioStateManager.svelte";
import { createTempoRegionManager } from "./managers/TempoRegionManager.svelte";
import { createCellOperationsManager } from "./managers/CellOperationsManager.svelte";
import { createCompositionUIManager } from "./managers/CompositionUIManager.svelte";

// Re-export types for external consumers
export type {
  WorkflowPhase,
  BeatMarker,
  TempoRegion,
  AudioState,
} from "./composition-types";

// ============================================================================
// State Factory
// ============================================================================

export type CompositionState = ReturnType<typeof createCompositionState>;

export function createCompositionState() {
  // =========================================================================
  // Core State
  // =========================================================================

  let composition = $state<Composition>(createDefaultComposition());

  // Playback state
  let isPlaying = $state(false);
  let isPreviewing = $state(loadFromStorage(STORAGE_KEYS.PREVIEW_MODE, false));
  let bpm = $state<number>(loadFromStorage(STORAGE_KEYS.PLAYBACK_BPM, 60));
  let shouldLoop = $state(true);
  let currentBeat = $state(0);

  // Workflow phase state (persisted)
  let currentPhase = $state<WorkflowPhase>(
    loadFromStorage(STORAGE_KEYS.WORKFLOW_PHASE, "canvas")
  );

  // =========================================================================
  // Initialize Managers
  // =========================================================================

  const audioManager = createAudioStateManager();
  const tempoManager = createTempoRegionManager();
  const uiManager = createCompositionUIManager();
  const cellOps = createCellOperationsManager({
    get: () => composition,
    set: (comp) => {
      composition = comp;
    },
  });

  // =========================================================================
  // Derived State
  // =========================================================================

  const cellCount = $derived(composition.layout.rows * composition.layout.cols);
  const cellMap = $derived(new Map(composition.cells.map((c) => [c.id, c])));
  const hasEmptyCells = $derived(
    composition.cells.some((cell) => !isCellConfigured(cell))
  );
  const canPlay = $derived(
    composition.cells.some((cell) => isCellConfigured(cell))
  );
  const isComplete = $derived(isCompositionComplete(composition));
  const selectedCell = $derived(
    uiManager.selectedCellId
      ? (cellMap.get(uiManager.selectedCellId) ?? null)
      : null
  );

  // Effective BPM: manual override > detected > tempo region > default
  const effectiveBpm = $derived(
    audioManager.state.manualBpm ?? audioManager.state.detectedBpm ?? bpm
  );

  // =========================================================================
  // Layout Operations
  // =========================================================================

  function setLayout(newLayout: GridLayout) {
    const oldCells = composition.cells;
    const newCells = createEmptyCells(newLayout);
    const oldCellMap = new Map(oldCells.map((c) => [c.id, c]));

    // Preserve existing cell configurations where positions match
    for (const newCell of newCells) {
      const oldCell = oldCellMap.get(newCell.id);
      if (oldCell) {
        newCell.type = oldCell.type;
        newCell.sequences = oldCell.sequences;
        newCell.trailSettings = oldCell.trailSettings;
        newCell.rotationOffset = oldCell.rotationOffset;
        newCell.isMirrored = oldCell.isMirrored;
        newCell.mirrorSourceCellId = oldCell.mirrorSourceCellId;
      }
    }

    composition = {
      ...composition,
      layout: newLayout,
      cells: newCells,
      updatedAt: new Date(),
    };

    // Clear selection if selected cell no longer exists
    if (uiManager.selectedCellId) {
      const newCellIds = new Set(newCells.map((c) => c.id));
      if (!newCellIds.has(uiManager.selectedCellId)) {
        uiManager.clearSelection();
      }
    }
  }

  function applyTemplate(templateId: string) {
    const template = getTemplateById(templateId);
    if (!template) {
      console.warn(`Template not found: ${templateId}`);
      return;
    }

    composition = {
      ...composition,
      layout: template.layout,
      cells: createCellsFromTemplate(template),
      updatedAt: new Date(),
    };

    uiManager.clearSelection();
    uiManager.closeAllSheets();
  }

  // =========================================================================
  // Playback Operations
  // =========================================================================

  function play() {
    if (!canPlay) return;
    isPlaying = true;
  }

  function pause() {
    isPlaying = false;
  }

  function stop() {
    isPlaying = false;
    currentBeat = 0;
  }

  function togglePlayPause() {
    if (isPlaying) pause();
    else play();
  }

  function togglePreview() {
    isPreviewing = !isPreviewing;
    saveToStorage(STORAGE_KEYS.PREVIEW_MODE, isPreviewing);
  }

  function setBpm(newBpm: number) {
    bpm = Math.max(30, Math.min(180, newBpm));
    saveToStorage(STORAGE_KEYS.PLAYBACK_BPM, bpm);
  }

  function setLoop(loop: boolean) {
    shouldLoop = loop;
  }

  function setBeat(beat: number) {
    currentBeat = beat;
  }

  // =========================================================================
  // Workflow Phase Operations
  // =========================================================================

  function setCurrentPhase(phase: WorkflowPhase) {
    currentPhase = phase;
    saveToStorage(STORAGE_KEYS.WORKFLOW_PHASE, phase);
  }

  function goToCanvas() {
    setCurrentPhase("canvas");
  }

  function goToAudio() {
    setCurrentPhase("audio");
  }

  function goToExport() {
    setCurrentPhase("export");
  }

  // =========================================================================
  // Composition Management
  // =========================================================================

  function setName(name: string) {
    composition = { ...composition, name, updatedAt: new Date() };
  }

  function toggleFavorite() {
    composition = {
      ...composition,
      isFavorite: !composition.isFavorite,
      updatedAt: new Date(),
    };
  }

  function reset() {
    composition = createDefaultComposition();
    isPlaying = false;
    currentBeat = 0;
    currentPhase = "canvas";
    audioManager.reset();
    tempoManager.clear();
    uiManager.reset();
    saveToStorage(STORAGE_KEYS.WORKFLOW_PHASE, "canvas");
  }

  function loadComposition(comp: Composition) {
    composition = comp;
    isPlaying = false;
    currentBeat = 0;
    uiManager.reset();
  }

  // =========================================================================
  // BPM at Time (combines audio and tempo region managers)
  // =========================================================================

  function getBpmAtTime(time: number): number {
    // Check tempo regions first
    const regionBpm = tempoManager.getBpmAtTime(time);
    if (regionBpm !== null) return regionBpm;
    // Fallback to manual or detected BPM
    return (
      audioManager.state.manualBpm ?? audioManager.state.detectedBpm ?? 120
    );
  }

  // =========================================================================
  // Return State Object
  // =========================================================================

  return {
    // Core state getters
    get composition() {
      return composition;
    },
    get isPlaying() {
      return isPlaying;
    },
    get isPreviewing() {
      return isPreviewing;
    },
    get bpm() {
      return bpm;
    },
    get shouldLoop() {
      return shouldLoop;
    },
    get currentBeat() {
      return currentBeat;
    },
    get currentPhase() {
      return currentPhase;
    },

    // UI state getters (delegated)
    get selectedCellId() {
      return uiManager.selectedCellId;
    },
    get isTemplatesOpen() {
      return uiManager.isTemplatesOpen;
    },
    get isCellConfigOpen() {
      return uiManager.isCellConfigOpen;
    },
    get isSettingsOpen() {
      return uiManager.isSettingsOpen;
    },
    get isFullscreen() {
      return uiManager.isFullscreen;
    },

    // Audio state getter (delegated)
    get audioState() {
      return audioManager.state;
    },

    // Derived getters
    get cellCount() {
      return cellCount;
    },
    get hasEmptyCells() {
      return hasEmptyCells;
    },
    get canPlay() {
      return canPlay;
    },
    get isComplete() {
      return isComplete;
    },
    get selectedCell() {
      return selectedCell;
    },
    get effectiveBpm() {
      return effectiveBpm;
    },
    get hasAudio() {
      return audioManager.hasAudio;
    },

    // Layout mutations
    setLayout,
    applyTemplate,

    // Cell mutations (delegated)
    setCellType: (cellId: string, type: CellType) =>
      cellOps.setType(cellId, type),
    setCellMediaType: (
      cellId: string,
      mediaType: "animation" | "video" | "beatGrid" | "image"
    ) => cellOps.setMediaType(cellId, mediaType),
    setCellSequences: (cellId: string, sequences: SequenceData[]) =>
      cellOps.setSequences(cellId, sequences),
    addSequenceToCell: (cellId: string, sequence: SequenceData) =>
      cellOps.addSequence(cellId, sequence),
    removeSequenceFromCell: (cellId: string, sequenceIndex: number) =>
      cellOps.removeSequence(cellId, sequenceIndex),
    setCellTrailSettings: (cellId: string, settings: Partial<TrailSettings>) =>
      cellOps.setTrailSettings(cellId, settings),
    setCellRotation: (cellId: string, rotation: number) =>
      cellOps.setRotation(cellId, rotation),
    clearCell: (cellId: string) => cellOps.clear(cellId),

    // Playback mutations
    play,
    pause,
    stop,
    togglePlayPause,
    togglePreview,
    setBpm,
    setLoop,
    setBeat,

    // UI mutations (delegated)
    selectCell: uiManager.selectCell,
    openTemplates: uiManager.openTemplates,
    closeTemplates: uiManager.closeTemplates,
    openCellConfig: uiManager.openCellConfig,
    closeCellConfig: uiManager.closeCellConfig,
    openSettings: uiManager.openSettings,
    closeSettings: uiManager.closeSettings,
    closeAllSheets: uiManager.closeAllSheets,
    enterFullscreen: uiManager.enterFullscreen,
    exitFullscreen: uiManager.exitFullscreen,
    toggleFullscreen: uiManager.toggleFullscreen,

    // Workflow phase mutations
    setCurrentPhase,
    goToCanvas,
    goToAudio,
    goToExport,

    // Audio state mutations (delegated)
    loadAudioFile: audioManager.loadAudioFile,
    setAudioDuration: audioManager.setDuration,
    setDetectedBpm: audioManager.setDetectedBpm,
    setManualBpm: audioManager.setManualBpm,
    setAnalyzing: audioManager.setAnalyzing,
    addBeatMarker: audioManager.addBeatMarker,
    removeBeatMarker: audioManager.removeBeatMarker,
    updateBeatMarker: audioManager.updateBeatMarker,
    setBeatMarkers: audioManager.setBeatMarkers,
    clearAudio: audioManager.clearAudio,
    restoreAudioFromCache: audioManager.restoreFromCache,

    // Tempo region mutations (delegated)
    addTempoRegion: tempoManager.add,
    removeTempoRegion: tempoManager.remove,
    updateTempoRegion: tempoManager.update,
    setTempoRegions: tempoManager.setAll,
    clearTempoRegions: tempoManager.clear,
    getBpmAtTime,

    // Composition management
    setName,
    toggleFavorite,
    reset,
    loadComposition,
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let compositionStateInstance: CompositionState | null = null;

export function getCompositionState(): CompositionState {
  if (!compositionStateInstance) {
    compositionStateInstance = createCompositionState();
  }
  return compositionStateInstance;
}

export function resetCompositionState(): void {
  compositionStateInstance = null;
}
