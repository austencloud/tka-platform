import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";
import type {
  LabeledSequence,
  FilterMode,
} from "../domain/models/label-models";
import type { LOOPDetectionResult } from "../services/ILOOPDetector";
import { LOOPLabelerServiceLocator } from "./loop-labeler-service-locator";
import type { LabelingMode, SyncStatus } from "../domain/types/labeler-types";

export type { LabelingMode, SyncStatus } from "../domain/types/labeler-types";

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

  get circularSequences(): SequenceEntry[] {
    return this.data.sequences.filter((s) => s.isCircular);
  }

  get filteredSequences(): SequenceEntry[] {
    const circular = this.circularSequences;
    return loopLabelerServices.sequenceLoader.filterSequences(
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
    return loopLabelerServices.sequenceLoader.calculateStats(this.circularSequences, this.data.labels);
  }

  setSequences(sequences: SequenceEntry[]) {
    this.data.sequences = sequences;
  }

  updateSequenceDetail(
    sequenceId: string,
    fullMetadata: SequenceEntry["fullMetadata"],
    gridMode?: string
  ) {
    const idx = this.data.sequences.findIndex((s) => s.id === sequenceId);
    if (idx < 0) return;

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

  getHMRData(): LOOPLabelerStateData {
    return {
      ...this.data,
      popstateHandler: null,
    };
  }
}
