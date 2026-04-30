/**
 * LOOPLabelerController
 *
 * All behavior/actions for the LOOP Labeler.
 * Operates on LOOPLabelerState, uses services via LOOPLabelerServiceLocator.
 */

import type { LOOPLabelerState } from "./loop-labeler-state.svelte";
import type { LabelingMode } from "../domain/types/labeler-types";
import type { LOOPLabelerServiceLocator } from "./LOOPLabelerServiceLocator";
import type {
  LabeledSequence,
  FilterMode,
} from "../domain/models/label-models";
import type { LOOPDetectionResult } from "../services/contracts/ILOOPDetector";
import type { SequenceEntry } from "../domain/models/sequence-models";

const STORAGE_KEY = "tka-loop-labeler-state";

export class LOOPLabelerController {
  constructor(
    private state: LOOPLabelerState,
    private services: LOOPLabelerServiceLocator
  ) {}

  // ============================================================
  // PERSISTENCE
  // ============================================================

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

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async initialize(): Promise<void> {
    const sequenceLoader = this.services.sequenceLoader;
    const labelsRepo = this.services.labelsRepository;

    if (!sequenceLoader || !labelsRepo) {
      console.error("[LOOPLabelerController] Required services not available");
      this.state.setLoading(false);
      return;
    }

    try {
      const persisted = this.loadPersistedState();
      const lastSequenceId = persisted?.lastSequenceId;
      const nav = this.services.navigator;
      const urlSeqId = nav?.getSequenceFromUrl();

      const sequenceIdToRestore = urlSeqId || lastSequenceId || null;

      // Load sequences
      const sequences = await sequenceLoader.loadSequences();
      this.state.setSequences(sequences);

      // Check URL filter if localStorage didn't have one
      if (!persisted?.filterMode) {
        const urlFilter = nav?.getFilterFromUrl();
        if (
          urlFilter &&
          ["all", "needsVerification", "verified"].includes(urlFilter)
        ) {
          this.state.setFilterModeInternal(urlFilter as FilterMode);
        }
      }

      // Subscribe to labels
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

    const nav = this.services.navigator;
    nav?.updateUrlWithSequence(
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
        this.services.navigator?.getSequenceFromUrl();
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

  // ============================================================
  // NAVIGATION
  // ============================================================

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
      this.services.navigator?.updateUrlWithSequence(
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
    if (!nav) return;

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
    if (!nav) return;

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

  // ============================================================
  // DETAIL LOADING
  // ============================================================

  /** Tracks in-flight fetches to prevent duplicate requests */
  private detailFetchInFlight = new Set<string>();

  /**
   * Ensure the current sequence has fullMetadata loaded.
   * If not, lazy-fetch from the source library document.
   * Returns immediately if data is already present.
   */
  async ensureSequenceDetail(): Promise<void> {
    const seq = this.state.currentSequence;
    if (!seq) return;

    // Already has data
    if (seq.fullMetadata?.sequence && seq.fullMetadata.sequence.length > 0) return;

    // No source ref - can't fetch
    if (!seq.sourceRef) {
      console.warn(`[LOOPLabelerController] No sourceRef for sequence "${seq.word}" (${seq.id})`);
      return;
    }

    // Already fetching
    if (this.detailFetchInFlight.has(seq.id)) return;

    this.detailFetchInFlight.add(seq.id);
    try {
      const loader = this.services.sequenceLoader;
      if (!loader) return;

      const rawSequence = await loader.loadSequenceDetail(seq.sourceRef);
      if (!rawSequence || rawSequence.length === 0) return;

      // Extract authoritative grid mode from metadata element (index 0)
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

  // ============================================================
  // FILTERS & UI STATE
  // ============================================================

  setFilterMode(mode: FilterMode): void {
    this.state.setFilterModeInternal(mode);
    this.state.setCurrentIndex(0);
    this.persistFilterMode();

    const nav = this.services.navigator;
    const firstSeq = this.state.filteredSequences[0];
    nav?.updateUrlWithSequence(firstSeq?.id ?? null, mode);
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

  // ============================================================
  // LABELS MANAGEMENT
  // ============================================================

  async saveLabel(label: LabeledSequence): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    // Optimistic update for responsive UI
    this.state.updateLabel(label.word, label);
    this.state.setSyncStatus("syncing");

    try {
      // Firebase FIRST - this is the source of truth
      await repo.saveLabelToFirebase(label.word, label);

      // Then update localStorage as cache
      repo.saveToLocalStorage(this.state.labels);

      this.state.setSyncStatus("synced");
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to save label:", error);
      // Still save to localStorage as fallback (will be recovered on next load)
      repo.saveToLocalStorage(this.state.labels);
      this.state.setSyncStatus("error");
    }
  }

  async removeLabel(word: string): Promise<void> {
    const repo = this.services.labelsRepository;
    if (!repo) return;

    // Optimistic update for responsive UI
    this.state.deleteLabel(word);
    this.state.setSyncStatus("syncing");

    try {
      // Firebase FIRST - this is the source of truth
      await repo.deleteLabelFromFirebase(word);

      // Then update localStorage as cache
      repo.saveToLocalStorage(this.state.labels);

      this.state.setSyncStatus("synced");
    } catch (error) {
      console.error("[LOOPLabelerController] Failed to delete label:", error);
      // Still save to localStorage as fallback
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

  // ============================================================
  // LABELING OPERATIONS
  // ============================================================

  /**
   * Verify a sequence - marks the computed detection as verified.
   * With on-the-fly detection, this just marks "verified" without storing designations.
   */
  async verifySequence(
    sequence: SequenceEntry,
    detection: LOOPDetectionResult | null,
    currentLabel: LabeledSequence | null
  ): Promise<void> {
    const label: LabeledSequence = {
      word: sequence.word,
      designations: [], // Don't store - computed on-the-fly
      isFreeform: detection?.isFreeform ?? false,
      isModular: detection?.isModular ?? false,
      needsVerification: false, // Mark as verified
      labeledAt: new Date().toISOString(),
      notes: currentLabel?.notes || "",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
    };

    await this.saveLabel(label);
  }

  /**
   * Mark a sequence as freeform (circular but no recognizable pattern).
   */
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

  /**
   * Mark a sequence as unknown (needs further investigation).
   */
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
      needsVerification: true, // Keep in review queue
      labeledAt: new Date().toISOString(),
      notes: notes || "Marked as unknown - needs further investigation",
      sections: currentLabel?.sections || [],
      stepPairs: currentLabel?.stepPairs || [],
    };

    await this.saveLabel(label);
  }

  /**
   * Save a modular detection result directly.
   * Used when detection found a modular pattern.
   */
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

  // ============================================================
  // EXPORT / IMPORT
  // ============================================================

  exportLabels(): void {
    this.services.navigator?.exportLabelsAsJson(this.state.labels);
  }

  async importLabels(file: File): Promise<void> {
    const nav = this.services.navigator;
    const repo = this.services.labelsRepository;
    if (!nav || !repo) return;

    try {
      const importedLabels = await nav.importLabelsFromJson(file);
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

  // ============================================================
  // RESET
  // ============================================================

  reset(): void {
    this.dispose();
    this.services.clear();
    this.state.reset();
  }

  cacheServices(): void {
    this.services.cacheAll();
  }
}
  