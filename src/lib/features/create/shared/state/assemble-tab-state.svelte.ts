/**
 * Assemble Tab State
 *
 * Manages the Assemble tab's integration into the Create module.
 * Owns an isolated SequenceState and builder state (from assemble-lab).
 *
 * Undo is handled by builderState.undoStep() directly (per-step granularity),
 * wired through CreateModuleState.undo() when activeTab === "assemble".
 *
 * Builder mutations update the editable sequence document directly. Sequence
 * editor mutations hydrate the builder through the same state boundary.
 */

import type { SequenceRepository } from "$lib/shared/create/services/sequence-repository";
import type { SequencePersister } from "$lib/features/create/shared/services/sequence-persister";
import type { SequenceStatsCalculator } from "$lib/features/create/shared/services/sequence-stats-calculator";
import type { SequenceTransformer } from "$lib/features/create/shared/services/sequence-transforms/sequence-transformer";
import type { SequenceValidator } from "$lib/features/create/shared/services/sequence-validator";
import {
  reversalDetector,
  type ReversalDetector,
} from "$lib/shared/create/services/reversal-detector";
import { createSequenceState } from "./sequence-state-orchestrator.svelte";
import type { SequenceState } from "./sequence-state-orchestrator.svelte";
import { createAssembleState } from "$lib/features/assemble-lab/state/assemble-state.svelte";
import type {
  AssembleState,
  BuilderPhase,
} from "$lib/features/assemble-lab/state/assemble-state.svelte";
import {
  stepToMotion,
  convertToStartPosition,
  convertToPictographs,
  lookupLetter,
  sequenceToBuilderHydration,
} from "$lib/features/assemble-lab/services/builder-step-converter";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";
import { generateSequenceWord } from "$lib/features/create/shared/services/sequence-stats-calculator";

export function createAssembleTabState(
  sequenceService?: SequenceRepository,
  sequencePersister?: SequencePersister,
  sequenceStatisticsService?: SequenceStatsCalculator,
  sequenceTransformer?: SequenceTransformer,
  sequenceValidationService?: SequenceValidator
) {
  // Tab-specific state
  let isInitialized = $state(false);
  let error = $state<string | null>(null);

  let sequenceState: SequenceState | null = null;
  let isApplyingBuilderChange = false;
  let isDestroyed = false;
  const letterCache = new Map<string, Letter | null>();

  // The builder reports document changes at the mutation boundary. This keeps
  // sequence edits and builder edits out of competing reactive effects.
  const builderState: AssembleState = createAssembleState({
    onDocumentChange: syncBuilderToSequence,
  });

  // Isolated editable sequence document for this tab.
  const ReversalDetector: ReversalDetector | undefined = reversalDetector;
  sequenceState = sequenceService
    ? createSequenceState({
        sequenceService,
        ...(sequencePersister && { SequencePersister: sequencePersister }),
        ...(sequenceStatisticsService && { sequenceStatisticsService }),
        ...(sequenceTransformer && {
          SequenceTransformer: sequenceTransformer,
        }),
        ...(sequenceValidationService && { sequenceValidationService }),
        ...(ReversalDetector && { ReversalDetector }),
        tabId: "assemble",
        onCurrentSequenceChange: syncSequenceToBuilder,
      })
    : null;

  // Undo for assemble tab is handled directly by builderState.undoStep()
  // (wired through CreateModuleState.undo() which delegates to builderState
  // when activeTab === "assemble"). No snapshot-based undo controller needed.

  function sameMotionCore(left: MotionData, right: MotionData): boolean {
    return (
      left.isVisible === right.isVisible &&
      left.startLocation === right.startLocation &&
      left.endLocation === right.endLocation &&
      left.rotationDirection === right.rotationDirection &&
      left.turns === right.turns &&
      left.startOrientation === right.startOrientation &&
      left.endOrientation === right.endOrientation &&
      left.gridMode === right.gridMode
    );
  }

  function mergeBuilderStep(
    generated: StepData,
    existing: StepData | undefined,
    index: number
  ): StepData {
    if (!existing) return generated;

    const blue = sameMotionCore(existing.motions.blue, generated.motions.blue)
      ? existing.motions.blue
      : generated.motions.blue;
    const red = sameMotionCore(existing.motions.red, generated.motions.red)
      ? existing.motions.red
      : generated.motions.red;

    return {
      ...generated,
      ...existing,
      stepNumber: index + 1,
      gridMode: builderState.gridMode,
      motions: { blue, red },
    };
  }

  function syncBuilderToSequence(): void {
    if (!sequenceState || isApplyingBuilderChange || isDestroyed) return;

    const blueSteps = builderState.blueSteps;
    const redSteps = builderState.redSteps;
    const gridMode = builderState.gridMode;
    const startPicto = convertToStartPosition(
      blueSteps,
      redSteps,
      builderState.currentPosition,
      builderState.currentOrientation,
      builderState.activeHand,
      gridMode
    );
    const current = sequenceState.currentSequence;
    const generatedSteps = convertToPictographs(
      blueSteps,
      redSteps,
      gridMode
    ).map((pictograph, index) =>
      createStepData({
        ...pictograph,
        stepNumber: index + 1,
        duration: current?.steps[index]?.duration ?? 1,
        letter: current?.steps[index]?.letter ?? null,
      })
    );
    const steps = generatedSteps.map((step, index) =>
      mergeBuilderStep(step, current?.steps[index], index)
    );
    const startPosition = startPicto
      ? createStartPositionData({ ...startPicto })
      : undefined;

    isApplyingBuilderChange = true;
    try {
      if (!startPosition && steps.length === 0) {
        if (current) sequenceState.setCurrentSequence(null);
        return;
      }

      const currentDocument: SequenceData = current ?? {
        id: crypto.randomUUID(),
        name: "Assemble Sequence",
        word: "",
        steps: [],
        thumbnails: [],
        isFavorite: false,
        isCircular: false,
        metadata: {},
        tags: [],
      };
      const {
        startPosition: _oldStartPosition,
        startingPosition: _oldStartingPosition,
        ...currentWithoutStart
      } = currentDocument;
      let next: SequenceData = {
        ...currentWithoutStart,
        steps,
        word: "",
        sequenceLength: steps.length,
        gridMode,
        ...(startPosition && {
          startPosition,
          startingPosition: startPosition,
        }),
      };
      next = { ...next, word: generateSequenceWord(next) };
      sequenceState.setCurrentSequence(next);
    } finally {
      isApplyingBuilderChange = false;
    }

    scheduleLetterLookups();
  }

  function builderPairKey(index: number): string | null {
    const blue = builderState.blueSteps[index];
    const red = builderState.redSteps[index];
    if (!blue || !red) return null;
    return JSON.stringify([builderState.gridMode, blue, red]);
  }

  function scheduleLetterLookups(): void {
    if (!sequenceState || isDestroyed) return;
    const paired = Math.min(
      builderState.blueSteps.length,
      builderState.redSteps.length
    );

    for (let index = 0; index < paired; index += 1) {
      const key = builderPairKey(index);
      if (!key || letterCache.has(key)) continue;
      const existingLetter =
        sequenceState.currentSequence?.steps[index]?.letter ?? null;
      if (existingLetter) {
        letterCache.set(key, existingLetter);
        continue;
      }

      const blueMotion = stepToMotion(
        builderState.blueSteps[index]!,
        MotionColor.BLUE,
        builderState.gridMode
      );
      const redMotion = stepToMotion(
        builderState.redSteps[index]!,
        MotionColor.RED,
        builderState.gridMode
      );
      letterCache.set(key, null);
      void lookupLetter(blueMotion, redMotion, builderState.gridMode).then(
        (letter) => {
          letterCache.set(key, letter);
          applyResolvedLetter(index, key, letter);
        }
      );
    }
  }

  function applyResolvedLetter(
    index: number,
    key: string,
    letter: Letter | null
  ): void {
    if (!sequenceState || isDestroyed || builderPairKey(index) !== key) return;
    const current = sequenceState.currentSequence;
    const step = current?.steps[index];
    if (!current || !step || step.letter === letter) return;

    const steps = current.steps.map((candidate, candidateIndex) =>
      candidateIndex === index ? { ...candidate, letter } : candidate
    );
    let next: SequenceData = { ...current, steps, word: "" };
    next = { ...next, word: generateSequenceWord(next) };
    isApplyingBuilderChange = true;
    try {
      sequenceState.setCurrentSequence(next);
    } finally {
      isApplyingBuilderChange = false;
    }
  }

  function syncSequenceToBuilder(sequence: SequenceData | null): void {
    if (isApplyingBuilderChange || isDestroyed) return;
    if (sequence) {
      builderState.hydrateFromSequence(sequenceToBuilderHydration(sequence));
      scheduleLetterLookups();
      return;
    }

    builderState.hydrateFromSequence({
      blueSteps: [],
      redSteps: [],
      gridMode: builderState.gridMode,
      startPoses: {},
    });
  }

  let prevAssemblePhase: BuilderPhase | null = null;
  const cleanupEffects = $effect.root(() => {
    $effect(() => {
      const phase = builderState.phase;
      if (phase === "complete" && prevAssemblePhase !== "complete") {
        void getPropUnlockManager().recordCreation("construct");
      }
      prevAssemblePhase = phase;
    });
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async function initializeAssembleTab() {
    if (!sequenceState) {
      isInitialized = true;
      return;
    }

    try {
      if (sequencePersister) {
        await sequenceState.initializeWithPersistence();
      }
      isInitialized = true;
    } catch (err) {
      console.error("AssembleTabState: Failed to initialize:", err);
      error = err instanceof Error ? err.message : "Failed to initialize";
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State access
    get isInitialized() {
      return isInitialized;
    },
    get isPersistenceInitialized() {
      return isInitialized;
    },
    get error() {
      return error;
    },
    get hasError() {
      return error !== null;
    },

    // Builder state (consumed by InteractiveGrid & BuilderControls)
    get assembleBuilderState() {
      return builderState;
    },

    // Sequence state (consumed by StepGrid via SequenceState)
    get sequenceState() {
      return sequenceState;
    },

    // Undo is handled by builderState.undoStep() via CreateModuleState.undo()
    get canUndo() {
      return builderState.canUndo;
    },
    undo: () => {
      if (!builderState.canUndo) return false;
      void builderState.undoStep();
      return true;
    },

    // Initialization
    initializeAssembleTab,

    // Cleanup - call when Create module unmounts
    destroy: () => {
      isDestroyed = true;
      cleanupEffects();
    },
  };
}

export type AssembleTabState = ReturnType<typeof createAssembleTabState>;
