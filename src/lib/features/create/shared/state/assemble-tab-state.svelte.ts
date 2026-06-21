/**
 * Assemble Tab State
 *
 * Manages the Assemble tab's integration into the Create module.
 * Owns an isolated SequenceState and builder state (from assemble-lab).
 *
 * Undo is handled by builderState.undoStep() directly (per-step granularity),
 * wired through CreateModuleState.undo() when activeTab === "assemble".
 *
 * The reactive bridge converts BuilderStep[] (visual builder's per-hand model)
 * into StepData[] (what SequenceState/StepGrid needs), keeping both in sync.
 */

import type { SequenceRepository } from "$lib/shared/create/services/sequence-repository";
import type { SequencePersister } from "$lib/features/create/shared/services/sequence-persister";
import type { SequenceStatsCalculator } from "$lib/features/create/shared/services/sequence-stats-calculator";
import type { SequenceTransformer } from "$lib/features/create/shared/services/sequence-transforms/sequence-transformer";
import type { SequenceValidator } from "$lib/features/create/shared/services/sequence-validator";
import { reversalDetector, type ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import { createSequenceState } from "./sequence-state-orchestrator.svelte";
import type { SequenceState } from "./sequence-state-orchestrator.svelte";
import { createAssembleState } from "$lib/features/assemble-lab/state/assemble-state.svelte";
import type { AssembleState, BuilderPhase } from "$lib/features/assemble-lab/state/assemble-state.svelte";
import {
  stepToMotion,
  convertToStartPosition,
  convertToPictographs,
  lookupLetter,
} from "$lib/features/assemble-lab/services/builder-step-converter";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "$lib/shared/create/factories/create-step-data";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import { getPropUnlockManager } from "$lib/shared/gamification/get-prop-unlock-manager";

export function createAssembleTabState(
  sequenceService?: SequenceRepository,
  sequencePersister?: SequencePersister,
  sequenceStatisticsService?: SequenceStatsCalculator,
  sequenceTransformer?: SequenceTransformer,
  sequenceValidationService?: SequenceValidator,
) {
  // Tab-specific state
  let isInitialized = $state(false);
  let error = $state<string | null>(null);

  // Builder state (per-hand click model from assemble-lab)
  const builderState: AssembleState = createAssembleState();

  // Letter cache: step index -> resolved letter
  let letterCache = $state<Map<number, Letter | null>>(new Map());

  // Isolated sequence state for this tab
  const ReversalDetector: ReversalDetector | undefined = reversalDetector;
  const sequenceState: SequenceState | null = sequenceService
    ? createSequenceState({
        sequenceService,
        ...(sequencePersister && { SequencePersister: sequencePersister }),
        ...(sequenceStatisticsService && { sequenceStatisticsService }),
        ...(sequenceTransformer && { SequenceTransformer: sequenceTransformer }),
        ...(sequenceValidationService && { sequenceValidationService }),
        ...(ReversalDetector && { ReversalDetector }),
        tabId: "assemble",
      })
    : null;

  // Undo for assemble tab is handled directly by builderState.undoStep()
  // (wired through CreateModuleState.undo() which delegates to builderState
  // when activeTab === "assemble"). No snapshot-based undo controller needed.

  // ============================================================================
  // REACTIVE BRIDGE: BuilderStep[] -> SequenceState
  //
  // Uses $effect.root() because this factory runs outside component context
  // (called from CreateModuleInitializer.initialize() after an await).
  // $effect.root() creates a standalone reactive scope with manual cleanup.
  // ============================================================================

  let cleanupEffects: (() => void) | null = null;

  // Tracks the previous builder phase so the construct-completion counter fires
  // exactly once on the transition INTO "complete" (edge-triggered), not on
  // every reactive tick while the sequence sits in the complete phase.
  let prevAssemblePhase: BuilderPhase | null = null;

  function startReactiveBridge(): void {
    // Prevent double-init
    if (cleanupEffects) return;

    cleanupEffects = $effect.root(() => {
      // Reset or trim letter cache when steps change
      $effect(() => {
        const blueLen = builderState.blueSteps.length;
        const redLen = builderState.redSteps.length;
        if (blueLen === 0 && redLen === 0) {
          letterCache = new Map();
        } else {
          // Trim cache entries that no longer have corresponding steps
          // (e.g., after truncation via delete)
          const paired = Math.min(blueLen, redLen);
          let trimmed = false;
          const newCache = new Map(letterCache);
          for (const key of newCache.keys()) {
            if (key >= paired) {
              newCache.delete(key);
              trimmed = true;
            }
          }
          if (trimmed) {
            letterCache = newCache;
          }
        }
      });

      // Async letter lookup for paired steps
      $effect(() => {
        const blueSteps = builderState.blueSteps;
        const redSteps = builderState.redSteps;
        const paired = Math.min(blueSteps.length, redSteps.length);
        const gm = builderState.gridMode;

        for (let i = 0; i < paired; i++) {
          if (letterCache.has(i)) continue;
          const blueMotion = stepToMotion(blueSteps[i]!, MotionColor.BLUE, gm);
          const redMotion = stepToMotion(redSteps[i]!, MotionColor.RED, gm);
          // Mark as pending
          letterCache = new Map(letterCache).set(i, null);
          lookupLetter(blueMotion, redMotion, gm).then((letter) => {
            letterCache = new Map(letterCache).set(i, letter);
          });
        }
      });

      // Sync builder state -> sequence state
      $effect(() => {
        if (!sequenceState) return;

        const blueSteps = builderState.blueSteps;
        const redSteps = builderState.redSteps;
        const currentPos = builderState.currentPosition;
        const currentOri = builderState.currentOrientation;
        const activeHand = builderState.activeHand;
        const gm = builderState.gridMode;

        // Build start position
        const startPicto = convertToStartPosition(
          blueSteps, redSteps, currentPos, currentOri, activeHand, gm,
        );

        // Build step pictographs
        const stepPictos = convertToPictographs(blueSteps, redSteps, gm);

        // Apply cached letters
        const stepsWithLetters = stepPictos.map((p, i) => {
          const letter = letterCache.get(i) ?? undefined;
          return createStepData({
            ...p,
            letter,
            stepNumber: i + 1,
            duration: 1,
          });
        });

        // Update sequence state
        const currentSeq = sequenceState.currentSequence;
        const startPositionData = startPicto
          ? createStartPositionData({ ...startPicto })
          : undefined;

        if (!startPositionData && stepsWithLetters.length === 0) {
          if (currentSeq) {
            sequenceState.setCurrentSequence(null);
          }
          return;
        }

        sequenceState.setCurrentSequence({
          id: currentSeq?.id ?? crypto.randomUUID(),
          name: currentSeq?.name ?? "Assemble Sequence",
          word: "",
          steps: stepsWithLetters,
          gridMode: gm,
          thumbnails: [],
          isFavorite: false,
          isCircular: false,
          metadata: {},
          tags: [],
          ...(startPositionData && { startingPosition: startPositionData }),
        });
      });

      // Count one "construct" creation on each transition into the terminal
      // "complete" phase (when the user finishes assembling both hands). The
      // prevAssemblePhase guard makes this edge-triggered: it fires once per
      // completion, not on every reactive tick while phase stays "complete".
      $effect(() => {
        const phase = builderState.phase;
        if (phase === "complete" && prevAssemblePhase !== "complete") {
          void getPropUnlockManager().recordCreation("construct");
        }
        prevAssemblePhase = phase;
      });
    });
  }

  // Start the bridge immediately - $effect.root() doesn't need component context
  startReactiveBridge();

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
    get isInitialized() { return isInitialized; },
    get isPersistenceInitialized() { return isInitialized; },
    get error() { return error; },
    get hasError() { return error !== null; },

    // Builder state (consumed by InteractiveGrid & BuilderControls)
    get assembleBuilderState() { return builderState; },

    // Sequence state (consumed by StepGrid via SequenceState)
    get sequenceState() { return sequenceState; },

    // Undo is handled by builderState.undoStep() via CreateModuleState.undo()
    get canUndo() { return builderState.canUndo; },
    undo: () => {
      if (!builderState.canUndo) return false;
      void builderState.undoStep();
      return true;
    },

    // Initialization
    initializeAssembleTab,

    // Cleanup - call when Create module unmounts
    destroy: () => {
      if (cleanupEffects) {
        cleanupEffects();
        cleanupEffects = null;
      }
    },
  };
}

export type AssembleTabState = ReturnType<typeof createAssembleTabState>;
