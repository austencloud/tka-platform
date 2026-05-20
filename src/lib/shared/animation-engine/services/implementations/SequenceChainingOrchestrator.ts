/**
 * Sequence Chaining Orchestrator Implementation
 *
 * Extracted from FireTuningTab.svelte. Manages the auto-chaining
 * subsystem: preloading next sequences, detecting sequence completion,
 * and hot-swapping sequences into the playback controller.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { EndState } from "$lib/shared/landing/domain/types";
import type { IInfiniteSequenceGenerator, IEndlessSpinnerOrchestrator, IBroadcastProvider, PlaybackHistoryEntry, SourceMode } from "$lib/shared/animation-engine/domain/chaining-types";
// re-export for existing consumers
export type { SourceMode };

import * as propTypeApplierModule from "$lib/shared/landing/services/prop-type-applier";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceChainingOrchestrator {
  private playbackController: AnimationPlaybackController | null = null;
  private animationState: AnimationPanelState | null = null;
  private readonly propTypeApplier = propTypeApplierModule;

  private _isChainingNow = false;
  private _isPreloading = false;
  private preloadedSequence: SequenceData | null = null;
  private lastStep = -1;
  private currentSequence: SequenceData | null = null;

  private swapCallback: ((seq: SequenceData) => void) | null = null;
  private errorCallback: ((message: string) => void) | null = null;

  // --- Configurable propType ---
  private _propType: PropType = PropType.STAFF;

  // --- History tracking ---
  private _history: PlaybackHistoryEntry[] = [];
  private _historyCapacity: number;

  // --- Live mode ---
  private broadcastUnsubscribe: (() => void) | null = null;
  private _sourceMode: SourceMode = "library";

  constructor(
    private readonly spinnerOrchestrator: IEndlessSpinnerOrchestrator,
    private readonly infiniteGenerator: IInfiniteSequenceGenerator,
    private readonly broadcastProvider?: IBroadcastProvider,
    options?: { historyCapacity?: number }
  ) {
    this._historyCapacity = options?.historyCapacity ?? 30;
  }

  get isChainingNow(): boolean {
    return this._isChainingNow;
  }

  get isPreloading(): boolean {
    return this._isPreloading;
  }

  get propType(): PropType {
    return this._propType;
  }

  setPropType(type: PropType): void {
    this._propType = type;
  }

  get historyCapacity(): number {
    return this._historyCapacity;
  }

  getHistory(): readonly PlaybackHistoryEntry[] {
    return this._history;
  }

  async initialize(
    playbackController: AnimationPlaybackController,
    animationState: AnimationPanelState
  ): Promise<void> {
    this.playbackController = playbackController;
    this.animationState = animationState;
    await this.spinnerOrchestrator.initialize();
  }

  async startAutoMode(mode: SourceMode): Promise<void> {
    this._sourceMode = mode;
    this.preloadedSequence = null;
    this.lastStep = -1;

    if (mode === "library") {
      const initial = await this.spinnerOrchestrator.getInitialSequence();
      if (initial) {
        this.doHotSwap(initial);
        this.preloadNext(mode);
      }
    } else if (mode === "infinite") {
      const generated = await this.infiniteGenerator.generateInitial();
      if (generated) {
        this.doHotSwap(generated.sequence);
        this.preloadNext(mode);
      }
    } else if (mode === "live") {
      if (!this.broadcastProvider) {
        this.errorCallback?.("Live mode requires a broadcast provider");
        return;
      }
      this.broadcastUnsubscribe = this.broadcastProvider.subscribeToBroadcast((state) => {
        if (state?.currentSequence) {
          this.doHotSwap(state.currentSequence as unknown as SequenceData);
        }
      });
    }
  }

  skip(): void {
    this.chainToNext();
  }

  async shuffle(): Promise<void> {
    if (!this.playbackController) return;
    this._isChainingNow = true;
    try {
      const generated = await this.infiniteGenerator.generateInitial();
      if (generated) this.doHotSwap(generated.sequence);
    } catch (err) {
      console.error("SequenceChainingOrchestrator: shuffle failed:", err);
      this.errorCallback?.("Shuffle failed - could not generate a new sequence");
    } finally {
      this._isChainingNow = false;
    }
  }

  hotSwapSequence(sequenceData: SequenceData): void {
    this.doHotSwap(sequenceData);
  }

  checkAndChain(
    currentStep: number,
    totalSteps: number,
    sourceMode: SourceMode,
    servicesReady: boolean,
    hasSequence: boolean
  ): void {
    if (sourceMode === "pick" || sourceMode === "live") return;

    const floored = Math.floor(currentStep);

    if (
      servicesReady &&
      !this._isChainingNow &&
      hasSequence &&
      this.lastStep >= totalSteps - 1 &&
      floored <= 1 &&
      totalSteps > 0
    ) {
      this.chainToNext();
    }

    this.lastStep = floored;
  }

  checkAndPreload(
    currentStep: number,
    totalSteps: number,
    sourceMode: SourceMode,
    servicesReady: boolean,
    hasSequence: boolean
  ): void {
    if (sourceMode === "pick" || sourceMode === "live") return;

    const floored = Math.floor(currentStep);
    const shouldPreload =
      servicesReady &&
      !this._isPreloading &&
      !this.preloadedSequence &&
      hasSequence &&
      totalSteps > 2 &&
      floored >= 2 &&
      floored < totalSteps - 1;

    if (shouldPreload) this.preloadNext(sourceMode);
  }

  onSequenceSwapped(callback: (seq: SequenceData) => void): void {
    this.swapCallback = callback;
  }

  onError(callback: (message: string) => void): void {
    this.errorCallback = callback;
  }

  dispose(): void {
    this.broadcastUnsubscribe?.();
    this.broadcastUnsubscribe = null;
    this.playbackController = null;
    this.animationState = null;
    this.preloadedSequence = null;
    this.swapCallback = null;
    this.errorCallback = null;
    this._history = [];
  }

  // --- Private helpers ---

  private doHotSwap(sequenceData: SequenceData): void {
    if (!this.playbackController || !this.animationState) return;

    // Push to history before swapping
    this._history = [
      {
        sequence: sequenceData,
        timestamp: Date.now(),
        sourceMode: this._sourceMode,
        word: sequenceData.word ?? sequenceData.name,
      },
      ...this._history,
    ].slice(0, this._historyCapacity);

    this.currentSequence = sequenceData;
    this.lastStep = -1;

    const applied = this.propTypeApplier.applyToSequence(sequenceData, this._propType);

    this.animationState.setShouldLoop(true);
    const ok = this.playbackController.initialize(applied, this.animationState);
    if (!ok) return;

    this.animationState.setPlaybackMode("continuous");
    this.playbackController.seekToStep(1);

    if (!this.animationState.isPlaying) {
      this.playbackController.togglePlayback();
    }

    this.swapCallback?.(sequenceData);
  }

  private extractEndState(): EndState {
    if (!this.currentSequence) {
      return { position: null, blueOrientation: null, redOrientation: null };
    }

    const seq = this.currentSequence;
    const finalStep = seq.steps?.[seq.steps.length - 1];
    let position = finalStep?.endPosition ?? null;

    // Fallback 1: derive from motion end locations
    if (!position && gridPositionDeriver && finalStep?.motions) {
      const blueMotion = finalStep.motions[MotionColor.BLUE];
      const redMotion = finalStep.motions[MotionColor.RED];
      if (blueMotion?.endLocation && redMotion?.endLocation) {
        try {
          position = gridPositionDeriver.getGridPositionFromLocations(
            blueMotion.endLocation,
            redMotion.endLocation
          );
        } catch {
          /* silently fail */
        }
      }
    }

    // Fallback 2: for circular sequences, end position = start position
    if (!position && seq.isCircular) {
      const startPos = seq.startPosition ?? seq.startingPosition;
      if (startPos) {
        position = startPos.gridPosition ?? startPos.startPosition ?? null;
      }
    }

    return {
      position,
      blueOrientation: (finalStep?.motions?.blue?.endOrientation ?? null) as Orientation | null,
      redOrientation: (finalStep?.motions?.red?.endOrientation ?? null) as Orientation | null,
    };
  }

  private chainToNext(): void {
    if (!this.playbackController || this._isChainingNow) return;

    // Synchronous swap from preloaded sequence
    if (this.preloadedSequence) {
      this._isChainingNow = true;
      this.doHotSwap(this.preloadedSequence);
      this.preloadedSequence = null;
      this._isChainingNow = false;
      // Detect current mode from whether infiniteGenerator was used for preload
      this.preloadNext(this.inferCurrentMode());
      return;
    }

    // Fallback: async generation if preload wasn't ready
    this._isChainingNow = true;
    this.chainAsync();
  }

  private async chainAsync(): Promise<void> {
    try {
      const endState = this.extractEndState();
      // Try infinite first, then library
      const generated = await this.infiniteGenerator.generateFromEndState(endState);
      if (generated) {
        this.doHotSwap(generated.sequence);
      } else {
        const nextSeq = await this.spinnerOrchestrator.getNextSequence(endState);
        if (nextSeq) this.doHotSwap(nextSeq);
      }
    } catch (err) {
      console.error("SequenceChainingOrchestrator: chain failed:", err);
      this.errorCallback?.("Failed to load next sequence");
    } finally {
      this._isChainingNow = false;
      this.preloadNext(this.inferCurrentMode());
    }
  }

  private async preloadNext(mode: SourceMode): Promise<void> {
    if (!this.currentSequence || this._isPreloading || this.preloadedSequence) return;
    this._isPreloading = true;
    try {
      const endState = this.extractEndState();

      if (mode === "infinite") {
        const generated = await this.infiniteGenerator.generateFromEndState(endState);
        this.preloadedSequence = generated?.sequence ?? null;
      } else if (mode === "library") {
        const nextSeq = await this.spinnerOrchestrator.getNextSequence(endState);
        this.preloadedSequence =
          nextSeq ?? (await this.spinnerOrchestrator.getInitialSequence());
      }
    } catch (err) {
      console.error("SequenceChainingOrchestrator: preload failed:", err);
    } finally {
      this._isPreloading = false;
    }
  }

  /**
   * Infer the current source mode based on which service has activity.
   * Used when the orchestrator needs to preload but doesn't receive
   * the mode parameter directly (e.g. after a synchronous chain swap).
   */
  private inferCurrentMode(): SourceMode {
    if (this._sourceMode !== "library") return this._sourceMode;
    if (this.infiniteGenerator.getSessionCount() > 0) return "infinite";
    return "library";
  }
}
