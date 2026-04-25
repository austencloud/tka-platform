/**
 * LOOP Labeler State
 *
 * Pure data container with reactive state using Svelte 5 runes.
 * All behavior lives in LOOPLabelerController.
 *
 * NOTE: This file should NOT import LOOPLabelerController to avoid circular deps.
 * The controller is instantiated in the module component that uses both.
 */

import type { SequenceEntry } from "../domain/models/sequence-models";
import type {
  LabeledSequence,
  FilterMode,
} from "../domain/models/label-models";
import type { LOOPDetectionResult } from "../services/contracts/ILOOPDetector";
import { LOOPLabelerServiceLocator } from "./LOOPLabelerServiceLocator";
import type { LabelingMode, SyncStatus } from "../domain/types/labeler-types";

// Re-export for backwards compatibility
export type { LabelingMode, SyncStatus } from "../domain/types/labeler-types";

// Service locator instance for accessing DI services
const loopLabelerServices = new LOOPLabelerServiceLocator();

interface LOOPLabelerStateData {
  sequences: SequenceEntry[];
  labels: Map<string, LabeledSequence>;
  currentIndex: number;
  loading: boolean;
  filterMode: FilterMode;
  notes: string;
  syncStatus: SyncStatus;
  labelingMode: LabelingMode;
  showExport: boolean;
  showStartPosition: boolean;
  manualColumnCount: number | null;
  unsubscribe: (() => void) | null;
  popstateHandler: ((event: PopStateEvent) => void) | null;
}

export class LOOPLabelerState {
  private data = $state<LOOPLabelerStateData>(this.getInitialState());
  private detectionCache = new Map<string, LOOPDetectionResult>();
  private wasRestoredFromHMR = false;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private getInitialState(): LOOPLabelerStateData {
    if (import.meta.hot?.data.LOOPLabelerState) {
      this.wasRestoredFromHMR = true;
      return import.meta.hot.data.LOOPLabelerState;
    }

    return {
      sequences: [],
      labels: new Map(),
      currentIndex: 0,
      loading: true,
      filterMode: "all",
      notes: "",
      syncStatus: "idle",
      labelingMode: "whole",
      showExport: false,
      showStartPosition: true,
      manualColumnCount: null,
      unsubscribe: null,
      popstateHandler: null,
    };
  }

  // ============================================================
  // GETTERS (simple property access)
  // ============================================================

  get sequences() {
    return this.data.sequences;
  }
  get labels() {
    return this.data.labels;
  }
  get currentIndex() {
    return this.data.currentIndex;
  }
  get loading() {
    return this.data.loading;
  }
  get filterMode() {
    return this.data.filterMode;
  }
  get notes() {
    return this.data.notes;
  }
  get syncStatus() {
    return this.data.syncStatus;
  }
  get labelingMode() {
    return this.data.labelingMode;
  }
  get showExport() {
    return this.data.showExport;
  }
  get showStartPosition() {
    return this.data.showStartPosition;
  }
  get manualColumnCount() {
    return this.data.manualColumnCount;
  }
  get unsubscribe() {
    return this.data.unsubscribe;
  }
  get popstateHandler() {
    return this.data.popstateHandler;
  }
  get hasData() {
    return this.data.sequences.length > 0;
  }
  get isHMRRestored() {
    return this.wasRestoredFromHMR;
  }

  // ============================================================
  // DERIVED GETTERS
  // ============================================================

  get circularSequences(): SequenceEntry[] {
    return this.data.sequences.filter((s) => s.isCircular);
  }

  get filteredSequences(): SequenceEntry[] {
    const circular = this.circularSequences;
    const loader = loopLabelerServices.sequenceLoader;
    if (!loader) return circular;

    return loader.filterSequences(
      circular,
      this.data.labels,
      this.data.filterMode
    );
  }

  get currentSequence(): SequenceEntry | null {
    return this.filteredSequences[this.data.currentIndex] ?? null;
  }

  get currentLabel(): LabeledSequence | null {
    if (!this.currentSequence) return null;
    return this.data.labels.get(this.currentSequence.word) ?? null;
  }

  get currentComputedDetection(): LOOPDetectionResult | null {
    if (!this.currentSequence) return null;

    const cacheKey = this.currentSequence.id;
    if (this.detectionCache.has(cacheKey)) {
      return this.detectionCache.get(cacheKey)!;
    }

    const detector = loopLabelerServices.detector;
    if (!detector) return null;

    const detection = detector.detectLOOP(this.currentSequence);
    this.detectionCache.set(cacheKey, detection);
    return detection;
  }

  get stats() {
    const loader = loopLabelerServices.sequenceLoader;
    if (!loader) {
      return {
        total: this.circularSequences.length,
        needsVerification: 0,
        verified: 0,
      };
    }
    return loader.calculateStats(this.circularSequences, this.data.labels);
  }

  // ============================================================
  // SETTERS (called by Controller)
  // ============================================================

  setSequences(sequences: SequenceEntry[]) {
    this.data.sequences = sequences;
  }

  /**
   * Update a specific sequence's fullMetadata (and optionally gridMode).
   * Used by lazy-fetch to populate step data after loading from source.
   */
  updateSequenceDetail(
    sequenceId: string,
    fullMetadata: SequenceEntry["fullMetadata"],
    gridMode?: string
  ) {
    const idx = this.data.sequences.findIndex((s) => s.id === sequenceId);
    if (idx < 0) return;

    // Replace the sequence object to trigger reactivity
    const updated = { ...this.data.sequences[idx]!, fullMetadata };
    if (gridMode !== undefined) {
      updated.gridMode = gridMode;
    }
    this.data.sequences[idx] = updated;
  }

  setLabels(labels: Map<string, LabeledSequence>) {
    this.data.labels = labels;
  }

  setCurrentIndex(index: number) {
    this.data.currentIndex = index;
  }

  setLoading(loading: boolean) {
    this.data.loading = loading;
  }

  setFilterModeInternal(mode: FilterMode) {
    this.data.filterMode = mode;
  }

  setNotes(notes: string) {
    this.data.notes = notes;
  }

  setSyncStatus(status: SyncStatus) {
    this.data.syncStatus = status;
  }

  setLabelingMode(mode: LabelingMode) {
    this.data.labelingMode = mode;
  }

  setShowExport(show: boolean) {
    this.data.showExport = show;
  }

  setShowStartPosition(show: boolean) {
    this.data.showStartPosition = show;
  }

  setManualColumnCount(count: number | null) {
    this.data.manualColumnCount = count;
  }

  setUnsubscribe(fn: (() => void) | null) {
    this.data.unsubscribe = fn;
  }

  setPopstateHandler(handler: ((event: PopStateEvent) => void) | null) {
    this.data.popstateHandler = handler;
  }

  // ============================================================
  // LABEL MUTATIONS (called by Controller)
  // ============================================================

  updateLabel(word: string, label: LabeledSequence) {
    this.data.labels.set(word, label);
    this.data.labels = new Map(this.data.labels);
  }

  deleteLabel(word: string) {
    this.data.labels.delete(word);
    this.data.labels = new Map(this.data.labels);
  }

  removeSequence(sequenceId: string) {
    this.data.sequences = this.data.sequences.filter(
      (s) => s.id !== sequenceId
    );
  }

  clearDetectionCache(sequenceId?: string) {
    if (sequenceId) {
      this.detectionCache.delete(sequenceId);
    } else {
      this.detectionCache.clear();
    }
  }

  // ============================================================
  // RESET
  // ============================================================

  reset() {
    this.data = {
      sequences: [],
      labels: new Map(),
      currentIndex: 0,
      loading: false,
      filterMode: "all",
      notes: "",
      syncStatus: "idle",
      labelingMode: "whole",
      showExport: false,
      showStartPosition: true,
      manualColumnCount: null,
      unsubscribe: null,
      popstateHandler: null,
    };
    this.detectionCache.clear();
  }

  // ============================================================
  // HMR DATA EXPORT
  // ============================================================

  getHMRData(): LOOPLabelerStateData {
    return {
      ...this.data,
      popstateHandler: null,
    };
  }
}

// ============================================================
// NOTE ON INSTANTIATION
// ============================================================
//
// Singletons (loopLabelerState, loopLabelerServices, loopLabelerController)
// are created in loop-labeler-composition.ts to avoid circular dependencies.
// Import from there, not from this file.
//
// This file only exports the CLASS and TYPES.
