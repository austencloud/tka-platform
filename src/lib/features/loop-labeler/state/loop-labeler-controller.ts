import type { LOOPLabelerState } from "./loop-labeler-state.svelte.ts";
import type { LabelingMode } from "../domain/types/labeler-types";
import type { LOOPLabelerServiceLocator } from "./loop-labeler-service-locator";
import type {
  LabeledSequence,
  FilterMode,
} from "../domain/models/label-models";
import type { LOOPDetectionResult } from "../services/ILOOPDetector";
import type { SequenceEntry } from "$lib/shared/loop-labeler/domain/sequence-models";

const STORAGE_KEY = "tka-loop-labeler-state";

export class LOOPLabelerController {
  constructor(
    private state: LOOPLabelerState,
    private services: LOOPLabelerServiceLocator
  ) {}

  loadPersistedState(): {
    filterMode?: FilterMode;
    showStartPosition?: boolean;
    manualColumnCount?: number | null;
    labelingMode?: LabelingMode;
    lastSequenceId?: string | null;
  } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        filterMode: parsed.filterMode || "needsVerification",
        showStartPosition: parsed.showStartPosition ?? true,
        manualColumnCount: parsed.manualColumnCount ?? null,
        labelingMode: parsed.labelingMode || "whole",
        lastSequenceId: parsed.lastSequenceId || null,
      };
    } catch {
      return null;
    }
  }

  persistState(): void {
    try {
      const existing = this.loadPersistedState();
      const stateToPersist = {
        filterMode: existing?.filterMode || this.state.filterMode,
        showStartPosition: this.state.showStartPosition,
        manualColumnCount: this.state.manualColumnCount,
        labelingMode: this.state.labelingMode,
        lastSequenceId: this.state.currentSequence?.id || null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch (error) {
      console.warn("[LOOPLabelerController] Failed to persist state:", error);
    }
  }

  persistFilterMode(): void {
    try {
      const existing = this.loadPersistedState();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...existing, filterMode: this.state.filterMode })
      );
    } catch (error) {
      console.warn(
        "[LOOPLabelerController] Failed to persist filterMode:",
        error
      );
    }
  }

  async initialize(): Promise<void> {
    const sequenceLoader = this.services.sequenceLoader;
    const labelsRepo = this.services.labelsRepository;

    if (!labelsRepo) {
      console.error("[LOOPLabelerController] Required services not available");
      this.state.setLoading(false);
      return;
    }

    try {
      const persisted = this.loadPersistedState();
      const lastSequenceId = persisted?.lastSequenceId;

      const nav = this.services.navigator;
      const urlSeqId = nav.getSequenceFromUrl();

      const sequenceIdToRestore = urlSeqId || lastSequenceId || null;

      const sequences = await sequenceLoader.loadSequences();
      this.state.setSequences(sequences);

      if (!persisted?.filterMode) {
        const urlFilter = nav.getFilterFromUrl();
        if (
          urlFilter &&
          ["all", "needsVerification", "verified"].includes(urlFilter)
        ) {
          this.state.setFilterModeInternal(urlFilter as FilterMode);
        }
      }

      let isInitialLoad = true;
      const isExternalUrl = urlSeqId !== null && urlSeqId !== lastSequenceId;

      const unsubscribe = labelsRepo.subscribeToLabels((labels) => {
        this.state.setLabels(labels);
        if (isInitialLoad) {
          isInitialLoad = false;
          this.restoreSequencePosition(sequenceIdToRestore, isExternalUrl);
        }
      });

      this.state.setUnsubscribe(unsubscribe);
      this.setupPopstateListener();
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to initialize:", error);
      this.state.setLoading(false);
    }
  }

  private restoreSequencePosition(
    sequenceId: string | null,
    isFromUrl: boolean
  ): void {
    if (sequenceId && this.state.sequences.length > 0) {
      this.navigateToSequenceInternal(sequenceId, {
        adjustFilter: isFromUrl,
        logPrefix: "Restore",
      });
    }

    this.services.navigator.updateUrlWithSequence(
      this.state.currentSequence?.id ?? null,
      this.state.filterMode,
      false
    );
    this.state.setLoading(false);
  }

  private setupPopstateListener(): void {
    if (typeof window === "undefined") return;

    const existingHandler = this.state.popstateHandler;
    if (existingHandler) {
      window.removeEventListener("popstate", existingHandler);
    }

    const handler = (event: PopStateEvent) => {
      const historyState = event.state as { sequenceId?: string } | null;
      const seqId =
        historyState?.sequenceId ??
        this.services.navigator.getSequenceFromUrl();
      if (seqId) {
        this.navigateToSequenceInternal(seqId, { logPrefix: "Popstate" });
      }
    };

    this.state.setPopstateHandler(handler);
    window.addEventListener("popstate", handler);
  }

  dispose(): void {
    const unsubscribe = this.state.unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      this.state.setUnsubscribe(null);
    }

    const handler = this.state.popstateHandler;
    if (handler && typeof window !== "undefined") {
      window.removeEventListener("popstate", handler);
      this.state.setPopstateHandler(null);
    }
  }

  private navigateToSequenceInternal(
    sequenceId: string,
    options: {
      adjustFilter?: boolean;
      updateUrl?: boolean;
      addToHistory?: boolean;
      persist?: boolean;
      logPrefix?: string;
    } = {}
  ): boolean {
    const {
      adjustFilter = true,
      updateUrl = false,
      addToHistory = true,
      persist = false,
      logPrefix = "Navigate",
    } = options;

    const targetSeq = this.state.circularSequences.find(
      (s) => s.id === sequenceId
    );
    if (!targetSeq) {
      console.warn(`[${logPrefix}] Sequence "${sequenceId}" not found`);
      return false;
    }

    if (adjustFilter) {
      const label = this.state.labels.get(targetSeq.word);
      const needsVerification = label?.needsVerification === true;
      const isVerified = label && !label.needsVerification;

      if (this.state.filterMode === "needsVerification" && !needsVerification) {
        this.state.setFilterModeInternal("verified");
      } else if (this.state.filterMode === "verified" && !isVerified) {
        this.state.setFilterModeInternal("needsVerification");
      }
    }

    const targetIndex = this.state.filteredSequences.findIndex(
      (s) => s.id === sequenceId
    );
    if (targetIndex < 0) {
      return false;
    }

    this.state.setCurrentIndex(targetIndex);

    if (updateUrl) {
      this.services.navigator.updateUrlWithSequence(
        sequenceId,
        this.state.filterMode,
        addToHistory
      );
    }
    if (persist) {
      this.persistState();
    }

    return true;
  }

  nextSequence(): void {
    const nav = this.services.navigator;

    const newIndex = nav.getNextIndex(
      this.state.currentIndex,
      this.state.filteredSequences.length
    );
    this.state.setCurrentIndex(newIndex);

    if (this.state.currentSequence) {
      nav.updateUrlWithSequence(
        this.state.currentSequence.id,
        this.state.filterMode
      );
      this.persistState();
    }
  }

  previousSequence(): void {
    const nav = this.services.navigator;

    const newIndex = nav.getPreviousIndex(this.state.currentIndex);
    this.state.setCurrentIndex(newIndex);

    if (this.state.currentSequence) {
      nav.updateUrlWithSequence(
        this.state.currentSequence.id,
        this.state.filterMode
      );
      this.persistState();
    }
  }

  skipSequence(): void {
    this.nextSequence();
  }

  jumpToSequence(sequenceId: string): void {
    this.navigateToSequenceInternal(sequenceId, {
      updateUrl: true,
      addToHistory: true,
      persist: true,
      logPrefix: "Jump",
    });
  }

  private detailFetchInFlight = new Set<string>();

  async ensureSequenceDetail(): Promise<void> {
    const seq = this.state.currentSequence;
    if (!seq) return;

    if (seq.fullMetadata?.sequence && seq.fullMetadata.sequence.length > 0) return;

    if (!seq.sourceRef) {
      console.warn(`[LOOPLabelerController] No sourceRef for sequence "${seq.word}" (${seq.id})`);
      return;
    }

    if (this.detailFetchInFlight.has(seq.id)) return;

    this.detailFetchInFlight.add(seq.id);
    try {
      const rawSequence = await this.services.sequenceLoader.loadSequenceDetail(seq.sourceRef);
      if (!rawSequence || rawSequence.length === 0) return;

      const metadataGridMode = rawSequence[0]?.gridMode;

      this.state.updateSequenceDetail(
        seq.id,
        { sequence: rawSequence },
        metadataGridMode
      );
    } catch (error) {
      console.error(`[LOOPLabelerController] Failed to load detail for "${seq.word}":`, error);
    } finally {
      this.detailFetchInFlight.delete(seq.id);
    }
  }

  setFilterMode(mode: FilterMode): void {
    this.state.setFilterModeInternal(mode);
    this.state.setCurrentIndex(0);
    this.persistFilterMode();

    const firstSeq = this.state.filteredSequences[0];
    this.services.navigator.updateUrlWithSequence(firstSeq?.id ?? null, mode);
  }

  setNotes(notes: string): void {
    this.state.setNotes(notes);
  }

  setLabelingMode(mode: LabelingMode): void {
    this.state.setLabelingMode(mode);
    this.persistState();
  }

  setShowExport(show: boolean): void {
    this.state.setShowExport(show);
  }

  setShowStartPosition(show: boolean): void {
    this.state.setShowStartPosition(show);
    this.persistState();
  }

  setManualColumnCount(count: number | null): void {
    this.state.setManualColumnCount(count);
    this.persistState();
  }

  async saveLabel(label: LabeledSequence): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    this.state.updateLabel(label.word, label);
    this.state.setSyncStatus("syncing");

    try {
      await repo.saveLabelToFirebase(label.word, label);

      repo.saveToLocalStorage(this.state.labels);

      this.state.setSyncStatus("synced");
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to save label:", error);
      repo.saveToLocalStorage(this.state.labels);
      this.state.setSyncStatus("error");
    }
  }

  async removeLabel(word: string): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    this.state.deleteLabel(word);
    this.state.setSyncStatus("syncing");

    try {
      await repo.deleteLabelFromFirebase(word);

      repo.saveToLocalStorage(this.state.labels);

      this.state.setSyncStatus("synced");
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to delete label:", error);
      repo.saveToLocalStorage(this.state.labels);
      this.state.setSyncStatus("error");
    }
  }

  async deleteSequenceFromDatabase(
    sequenceId: string,
    word: string
  ): Promise<{ success: boolean; error?: string }> {
    const repo = this.services.labelsRepository;
    if (!repo)
      return { success: false, error: "Labels repository not available" };

    try {
      this.state.setSyncStatus("syncing");
      const result = await repo.deleteSequenceFromDatabase(sequenceId, word);

      if (result.success) {
        this.state.deleteLabel(word);
        this.state.removeSequence(sequenceId);
        this.state.clearDetectionCache(sequenceId);

        if (this.state.currentIndex >= this.state.filteredSequences.length) {
          this.state.setCurrentIndex(
            Math.max(0, this.state.filteredSequences.length - 1)
          );
        }

        repo.saveToLocalStorage(this.state.labels);
        this.state.setSyncStatus("synced");
      } else {
        this.state.setSyncStatus("error");
      }

      return result;
    } catch (error) {
      this.state.setSyncStatus("error");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async verifySequence(
    sequence: SequenceEntry,
    detection: LOOPDetectionResult | null,
    currentLabel: LabeledSequence | null
  ): Promise<void> {
    const label: LabeledSequence = {
      word: sequence.word,
      designations: [], 
      isFreeform: detection?.isFreeform ?? false,
      isModular: detection?.isModular ?? false,
      needsVerification: false, 
      labeledAt: new Date().toISOString(),
      notes: currentLabel?.notes || "",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
    };

    await this.saveLabel(label);
  }

  async markAsFreeform(
    sequence: SequenceEntry,
    currentLabel: LabeledSequence | null,
    notes: string
  ): Promise<void> {
    const label: LabeledSequence = {
      word: sequence.word,
      designations: [],
      isFreeform: true,
      isModular: false,
      needsVerification: false,
      labeledAt: new Date().toISOString(),
      notes: notes || "",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
    };

    await this.saveLabel(label);
  }

  async markAsUnknown(
    sequence: SequenceEntry,
    currentLabel: LabeledSequence | null,
    notes: string
  ): Promise<void> {
    const label: LabeledSequence = {
      word: sequence.word,
      designations: [],
      isFreeform: false,
      isModular: false,
      isUnknown: true,
      needsVerification: true, 
      labeledAt: new Date().toISOString(),
      notes: notes || "Marked as unknown - needs further investigation",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
    };

    await this.saveLabel(label);
  }

  async saveModularDetection(
    sequence: SequenceEntry,
    detection: LOOPDetectionResult,
    currentLabel: LabeledSequence | null,
    notes: string
  ): Promise<void> {
    const label: LabeledSequence = {
      word: sequence.word,
      designations: [],
      isFreeform: false,
      isModular: true,
      needsVerification: false,
      labeledAt: new Date().toISOString(),
      notes: notes || "",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
      stepPairGroups: detection.stepPairGroups,
    };

    await this.saveLabel(label);
  }

  exportLabels(): void {
    this.services.navigator.exportLabelsAsJson(this.state.labels);
  }

  async importLabels(file: File): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    try {
      const importedLabels = await this.services.navigator.importLabelsFromJson(file);
      this.state.setLabels(importedLabels);
      repo.saveToLocalStorage(this.state.labels);
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to import labels:", error);
    }
  }

  async syncLocalStorageToFirebase(): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    this.state.setSyncStatus("syncing");
    try {
      await repo.syncLocalStorageToFirebase(this.state.labels);
      this.state.setSyncStatus("synced");
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to sync:", error);
      this.state.setSyncStatus("error");
    }
  }

  reset(): void {
    this.dispose();
    this.services.clear();
    this.state.reset();
  }

  cacheServices(): void {
    this.services.cacheAll();
  }
}
