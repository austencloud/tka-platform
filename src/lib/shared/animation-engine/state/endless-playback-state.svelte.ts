import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  SourceMode,
  IBroadcastProvider,
  PlaybackHistoryEntry,
  IEndlessSpinnerOrchestrator,
  IInfiniteSequenceGenerator,
} from "$lib/shared/animation-engine/domain/chaining-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { CopyResult } from "$lib/shared/browse/services/ClaudeCodeCopier";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
import { SequenceChainingOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceChainingOrchestrator";
import { createAnimationPanelState, type AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import { getClaudeCodeCopier } from "$lib/shared/browse/getClaudeCodeCopier";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";

export interface EndlessPlaybackConfig {
  modes: SourceMode[];
  defaultMode: SourceMode;
  historyCapacity?: number;
  propType?: PropType;
  broadcastProvider?: IBroadcastProvider;
  spinnerOrchestrator: IEndlessSpinnerOrchestrator;
  infiniteGenerator: IInfiniteSequenceGenerator;
  playbackController: AnimationPlaybackController;
}

export interface EndlessPlaybackState {
  readonly currentSequence: SequenceData | null;
  readonly sourceMode: SourceMode;
  readonly history: readonly PlaybackHistoryEntry[];
  readonly isChainingNow: boolean;
  readonly isPreloading: boolean;
  readonly derivedStartPosition: ReturnType<typeof startPositionDeriver.getOrDeriveStartPosition>;
  readonly currentLetter: Letter | null;
  readonly currentStepData: StepData | StartPositionData | null;
  readonly gridMode: GridMode | null;
  readonly totalSteps: number;
  readonly animationState: AnimationPanelState;
  readonly playbackController: AnimationPlaybackController;
  readonly servicesReady: boolean;

  initialize(): Promise<void>;
  setSourceMode(mode: SourceMode): Promise<void>;
  setPropType(type: PropType): void;
  skip(): void;
  shuffle(): Promise<void>;
  copyForAI(): Promise<CopyResult>;
  copyHistoryEntry(index: number): Promise<CopyResult>;
  hotSwapSequence(sequence: SequenceData): void;
  dispose(): void;
}

export function createEndlessPlayback(config: EndlessPlaybackConfig): EndlessPlaybackState {
  const animationState = createAnimationPanelState();
  const playbackController = config.playbackController;

  const orchestrator = new SequenceChainingOrchestrator(
    config.spinnerOrchestrator,
    config.infiniteGenerator,
    config.broadcastProvider,
    { historyCapacity: config.historyCapacity ?? 30 }
  );

  if (config.propType) {
    orchestrator.setPropType(config.propType);
  }

  let _currentSequence = $state<SequenceData | null>(null);
  let _sourceMode = $state<SourceMode>(config.defaultMode);
  let _servicesReady = $state(false);

  orchestrator.onSequenceSwapped((seq) => {
    _currentSequence = seq;
  });

  // Derived values — eliminates the ~30-line block duplicated across 6 surfaces
  const derivedStartPosition = $derived.by(() => {
    if (!animationState.sequenceData) return null;
    return startPositionDeriver.getOrDeriveStartPosition(animationState.sequenceData);
  });

  const currentLetter = $derived.by((): Letter | null => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) {
      const startPos = derivedStartPosition;
      if (startPos && "letter" in startPos) return (startPos.letter as Letter) || null;
      return null;
    }
    const steps = animationState.sequenceData.steps;
    if (steps?.length) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, steps.length - 1));
      return (steps[idx]?.letter as Letter) || null;
    }
    return null;
  });

  const currentStepData = $derived.by((): StepData | StartPositionData | null => {
    if (!animationState.sequenceData) return null;
    const step = animationState.currentStep;
    if (step < 1) return (derivedStartPosition as StartPositionData | null) || null;
    const steps = animationState.sequenceData.steps;
    if (steps?.length) {
      const idx = Math.max(0, Math.min(Math.floor(step) - 1, steps.length - 1));
      return steps[idx] || null;
    }
    return null;
  });

  const gridMode: GridMode | null = $derived(
    _currentSequence?.gridMode ?? animationState.sequenceData?.gridMode ?? null
  );

  // Auto-chaining effect — replaces the most-duplicated pattern
  $effect(() => {
    if (_sourceMode === "pick" || _sourceMode === "live") return;
    orchestrator.checkAndChain(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      _sourceMode,
      _servicesReady,
      !!_currentSequence
    );
  });

  // Preload effect
  $effect(() => {
    if (_sourceMode === "pick" || _sourceMode === "live") return;
    orchestrator.checkAndPreload(
      Math.floor(animationState.currentStep),
      animationState.totalSteps,
      _sourceMode,
      _servicesReady,
      !!_currentSequence
    );
  });

  return {
    get currentSequence() { return _currentSequence; },
    get sourceMode() { return _sourceMode; },
    get history() { return orchestrator.getHistory(); },
    get isChainingNow() { return orchestrator.isChainingNow; },
    get isPreloading() { return orchestrator.isPreloading; },
    get derivedStartPosition() { return derivedStartPosition; },
    get currentLetter() { return currentLetter; },
    get currentStepData() { return currentStepData; },
    get gridMode() { return gridMode; },
    get totalSteps() { return animationState.totalSteps; },
    get animationState() { return animationState; },
    get playbackController() { return playbackController; },
    get servicesReady() { return _servicesReady; },

    async initialize() {
      await orchestrator.initialize(playbackController, animationState);
      _servicesReady = true;
      if (_sourceMode !== "pick") {
        await orchestrator.startAutoMode(_sourceMode);
      }
    },

    async setSourceMode(mode: SourceMode) {
      _sourceMode = mode;
      if (mode !== "pick") {
        await orchestrator.startAutoMode(mode);
      }
    },

    setPropType(type: PropType) {
      orchestrator.setPropType(type);
    },

    skip() {
      orchestrator.skip();
    },

    async shuffle() {
      await orchestrator.shuffle();
    },

    async copyForAI(): Promise<CopyResult> {
      const seq = animationState.sequenceData;
      if (!seq) return { success: false, error: new Error("No sequence loaded") };
      return getClaudeCodeCopier().copyForClaude(seq);
    },

    async copyHistoryEntry(index: number): Promise<CopyResult> {
      const entry = orchestrator.getHistory()[index];
      if (!entry) return { success: false, error: new Error("History entry not found") };
      return getClaudeCodeCopier().copyForClaude(entry.sequence);
    },

    hotSwapSequence(sequence: SequenceData) {
      orchestrator.hotSwapSequence(sequence);
    },

    dispose() {
      orchestrator.dispose();
      playbackController.dispose();
      animationState.dispose();
    },
  };
}
