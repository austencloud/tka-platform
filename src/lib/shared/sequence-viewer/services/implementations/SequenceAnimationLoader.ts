import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import { getSequenceRepository } from "$lib/shared/create/getSequenceRepository";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

export interface AnimationLoadResult {
  success: boolean;
  sequenceData?: SequenceData;
  error?: string;
}

export interface AnimationLoadOptions {
  /** Initial BPM to restore */
  initialBpm?: number;
  /** Initial playback time in ms to restore */
  initialPlaybackTimeMs?: number;
  /** Whether to auto-start playback */
  autoStart?: boolean;
  /** Delay before auto-start in ms */
  autoStartDelay?: number;
}

/**
 * Handles loading and initializing sequence animation data.
 * Extracts animation loading logic from the sequence viewer.
 */
export class SequenceAnimationLoader {
  private _isLoading = false;
  private _lastLoadedSequenceId: string | null = null;

  get isLoading(): boolean {
    return this._isLoading;
  }

  async load(
    sequence: SequenceData,
    playbackController: AnimationPlaybackController,
    panelState: AnimationPanelState,
    options: AnimationLoadOptions = {}
  ): Promise<AnimationLoadResult> {
    const sequenceId = sequence.id || sequence.word || "unknown";

    // Skip if already loaded
    if (sequenceId === this._lastLoadedSequenceId) {
      return { success: true, sequenceData: panelState.sequenceData ?? undefined };
    }

    this._isLoading = true;
    panelState.setLoading(true);
    panelState.setError(null);

    try {
      const loadedSequence = await this.loadSequenceData(sequence);
      if (!loadedSequence) {
        throw new Error("Failed to load sequence");
      }

      panelState.setShouldLoop(true);
      const success = playbackController.initialize(loadedSequence, panelState);
      if (!success) {
        throw new Error("Failed to initialize playback");
      }

      this._lastLoadedSequenceId = sequenceId;
      panelState.setSequenceData(loadedSequence);

      // Restore BPM if provided
      if (options.initialBpm && options.initialBpm !== 60) {
        const speedMultiplier = options.initialBpm / 60;
        playbackController.setSpeed(speedMultiplier);
      }

      // Restore playback position if provided
      if (options.initialPlaybackTimeMs && options.initialPlaybackTimeMs > 0) {
        const targetStep = this.calculateStepFromTimeMs(
          options.initialPlaybackTimeMs,
          options.initialBpm || 60
        );
        playbackController.jumpToStep(targetStep);
      }

      // Auto-start after delay if requested
      if (options.autoStart !== false) {
        const delay = options.autoStartDelay ?? 300;
        setTimeout(() => {
          playbackController.togglePlayback();
        }, delay);
      }

      return { success: true, sequenceData: loadedSequence };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Animation data not available";
      console.warn("[SequenceAnimationLoader] Animation not available:", err);
      panelState.setError(error);
      return { success: false, error };
    } finally {
      this._isLoading = false;
      panelState.setLoading(false);
    }
  }

  isSequenceLoaded(sequenceId: string): boolean {
    return this._lastLoadedSequenceId === sequenceId;
  }

  reset(): void {
    this._lastLoadedSequenceId = null;
    this._isLoading = false;
  }

  private async loadSequenceData(seq: SequenceData): Promise<SequenceData | null> {
    const hasMotionData = (s: SequenceData) =>
      Array.isArray(s.steps) &&
      s.steps.length > 0 &&
      s.steps.some((step) => step?.motions?.blue && step?.motions?.red);

    if (hasMotionData(seq)) {
      return this.ensureWordPopulated(seq);
    }

    const galleryId = seq.word || seq.name;
    if (galleryId) {
      const hydrated = await getSequenceRepository().getSequence(galleryId);
      if (hydrated && hasMotionData(hydrated)) {
        return this.ensureWordPopulated(hydrated);
      }
    }

    return this.ensureWordPopulated(seq);
  }

  private ensureWordPopulated(seq: SequenceData): SequenceData {
    if (seq.word) return seq;
    const derivedWord =
      seq.steps
        ?.filter((step) => !!step.letter)
        .map((step) => step.letter)
        .join("") || "";
    if (!derivedWord) return seq;
    return { ...seq, word: simplifyRepeatedWord(derivedWord) };
  }

  private calculateStepFromTimeMs(timeMs: number, bpm: number): number {
    const msPerBeat = 60000 / bpm;
    return timeMs / msPerBeat;
  }
}
