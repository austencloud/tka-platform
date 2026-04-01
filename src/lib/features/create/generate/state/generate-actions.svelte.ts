/**
 * Generation Actions State - Reactive wrapper for generation orchestration
 *
 * Delegates complex generation logic to IGenerationOrchestrator.
 * Manages reactive state and workbench animation updates.
 */

import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
import { setPendingGenerationAnimation } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { container } from "$lib/shared/di";
import type { GenerationOptions } from "../shared/domain/models/generate-models";
import type { IGenerationOrchestrator } from "../shared/services/contracts/IGenerationOrchestrator";
import { generationOrchestrator } from "../shared/services/implementations/GenerationOrchestrator";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";
import { levelToDifficulty, type UIGenerationConfig } from "../shared/utils/config-mapper";
import {
  getTemplateById,
  templateToPattern,
} from "$lib/features/create/shared/domain/templates/duration-templates";
import type { SpellModeState } from "./spell-mode-state.svelte";
import type { UndoMetadata, UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
import { UndoOperationType as UndoOp } from "$lib/features/create/shared/services/contracts/IUndoManager";
import type { IVariationExplorationOrchestrator } from "$lib/features/create/spell/services/contracts/IVariationExplorationOrchestrator";
import type { IRandomSequenceGenerator } from "$lib/features/create/spell/services/contracts/IRandomSequenceGenerator";
import type { ISpellServiceLoader } from "$lib/features/create/spell/services/contracts/ISpellServiceLoader";
import { createConstraintSet } from "$lib/shared/sequence-engine/constraints";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { sequenceExtender } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { LOOPType, SliceSize, ROTATED_LOOP_TYPES } from "$lib/features/create/generate/circular/domain/models/circular-models";
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/AccessTier";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { orientationCycleExtender } from "$lib/features/create/generate/circular/services/implementations/OrientationCycleExtender";
import { turnAllocator } from "../shared/services/implementations/TurnAllocator";
import { turnManager } from "../shared/services/implementations/TurnManager";
import { PropContinuity } from "../shared/domain/models/generate-models";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { reversalDetector } from "$lib/features/create/shared/services/implementations/ReversalDetector";

// Letters with dash motions (Type 3, 4, and 5)
const DASH_LETTERS: Set<string> = new Set([
  "W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-",
  "Φ", "Ψ", "Λ",
  "Φ-", "Ψ-", "Λ-",
]);

export function createGenerationActionsState(
  getSequenceState?: () => SequenceState | undefined,
  getIsSequential?: () => boolean,
  getConfig?: () => UIGenerationConfig | undefined,
  getSpellState?: () => SpellModeState | undefined,
  pushUndoSnapshot?: (type: UndoOperationType, metadata?: UndoMetadata) => void
) {
  let isGenerating = $state(false);
  let lastGeneratedSequence = $state<SequenceData | null>(null);
  let lastGeneratedConfig = $state<UIGenerationConfig | null>(null);
  let generationError = $state<string | null>(null);
  let needsCycleCompletion = $state(false);
  let orchestrationService: IGenerationOrchestrator | null = null;

  async function onGenerateClicked(options: GenerationOptions) {
    if (isGenerating) return;

    isGenerating = true;
    generationError = null;

    try {
      if (!orchestrationService) {
        orchestrationService = generationOrchestrator;
      }

      let generatedSequence =
        await orchestrationService.generateSequence(options);

      // Apply duration rhythm template if configured
      const config = getConfig?.();
      if (config?.durationTemplateId) {
        const template = getTemplateById(config.durationTemplateId);
        if (template) {
          try {
            const pattern = templateToPattern(
              template,
              "system",
              generatedSequence.steps.length
            );
            const durationManager = container.items.durationPatternManager;
            const result = durationManager.applyPattern(pattern, generatedSequence);
            if (result.success && result.sequence) {
              generatedSequence = result.sequence;
            } else {
              console.warn("Duration template application failed:", result.error);
            }
          } catch (err) {
            console.warn("Duration template application error:", err);
          }
        }
      }

      // Enforce tier beat cap post-generation — handles words with bridge letters
      // that push the sequence beyond what the user's tier allows.
      const tier = resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role));
      const maxBeats = getMaxBeats(tier);
      if (generatedSequence.steps.length > maxBeats) {
        generatedSequence = {
          ...generatedSequence,
          steps: generatedSequence.steps.slice(0, maxBeats),
        };
      }

      // Snapshot current state before replacing so the user can undo back to it
      pushUndoSnapshot?.(UndoOp.GENERATE_SEQUENCE, {
        description: "Generate sequence",
      });

      lastGeneratedSequence = generatedSequence;
      needsCycleCompletion =
        (generatedSequence.orientationCycleCount ?? 1) > 1;
      const currentConfig = getConfig?.();
      lastGeneratedConfig = currentConfig ? { ...currentConfig } : null;
      await updateWorkbenchWithSequence(generatedSequence);
    } catch (error) {
      generationError =
        error instanceof Error ? error.message : "Unknown generation error";

      // Show user-facing error with bug report option
      const errorService = container.items.errorHandler;
      if (errorService) {
        errorService.showUserError({
          message: "Sequence generation failed",
          technicalDetails: generationError,
          error: error instanceof Error ? error : new Error(generationError),
          severity: "error",
          context: {
            module: "create",
            tab: "generate",
            action: "generateSequence",
            additionalData: {
              mode: options.mode,
              length: options.length,
              gridMode: options.gridMode,
              difficulty: options.difficulty,
              loopType: options.loopType,
              sliceSize: options.sliceSize,
              constraintPreset: options.constraintPreset,
              handPathMode: options.handPathMode,
              motionTypeFilter: options.motionTypeFilter,
              turnIntensity: options.turnIntensity,
              startPosition: options.startPosition?.startPosition ?? null,
              endPosition: options.endPosition?.startPosition ?? null,
              blockedStartPositions: options.blockedStartPositions,
              mustContainLetters: options.mustContainLetters,
              mustNotContainLetters: options.mustNotContainLetters,
              propType: options.propType,
            },
          },
        });
      }

      console.error("Generation failed:", error);
    } finally {
      isGenerating = false;
    }
  }

  // Lazy-resolved spell services
  let spellOrchestrator: IVariationExplorationOrchestrator | null = null;
  let spellServiceLoader: ISpellServiceLoader | null = null;
  let spellGenerator: IRandomSequenceGenerator | null = null;

  async function onSpellGenerate() {
    const spellState = getSpellState?.();
    if (!spellState || !spellState.inputWord.trim()) return;
    if (isGenerating) return;

    isGenerating = true;
    spellState.setGenerating(true);
    spellState.clearError();
    generationError = null;

    try {
      // Lazy-resolve services
      if (!spellOrchestrator) {
        spellOrchestrator = container.items.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
      }
      if (!spellServiceLoader) {
        spellServiceLoader = container.items.spellServiceLoader as ISpellServiceLoader;
      }
      if (!spellGenerator) {
        spellGenerator = await spellServiceLoader.getRandomSequenceGenerator();
      }

      const config = getConfig?.();

      // Parse word with bridge letters
      const parseResult = await spellOrchestrator.parseWord(spellState.inputWord, {
        preferences: {
          constraintPreset: config?.constraintPreset ?? "smooth",
          handPathMode: config?.handPathMode ?? "mixed",
          motionTypeFilter: config?.motionTypeFilter ?? null,
          highContinuity: config?.constraintPreset === "smooth",
          makeCircular: false,
          selectedLOOPType: null,
          targetStepCount: null,
          maxReversals: null,
        },
      });

      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        return;
      }

      let finalLetters = parseResult.expandedLetters;
      let finalLetterSources = parseResult.letterSources ?? [];

      // If user requested a longer sequence, append extra bridge letters at the end
      const spellTarget = config?.spellTargetLength;
      if (spellTarget !== null && spellTarget !== undefined && config) {
        const extraBridgesNeeded = Math.max(0, spellTarget - finalLetters.length);

        if (extraBridgesNeeded > 0) {
          const graph = await (container.items.spellServiceLoader as ISpellServiceLoader).getTransitionGraph();
          const preferDash = config.motionTypeFilter === "prefer-dash";
          const avoidDash = config.motionTypeFilter === "no-dash";

          const extendedLetters = [...finalLetters];
          const extendedSources = [...finalLetterSources];

          for (let i = 0; i < extraBridgesNeeded; i++) {
            const lastLetter = extendedLetters[extendedLetters.length - 1];
            if (!lastLetter) break;

            const successors = graph.getValidSuccessors(lastLetter);
            if (successors.length === 0) break;

            let bridgeLetter: Letter;
            if (preferDash) {
              const dashOpts = successors.filter(b => DASH_LETTERS.has(b));
              const pool = dashOpts.length > 0 ? dashOpts : successors;
              bridgeLetter = pool[Math.floor(Math.random() * pool.length)]!;
            } else if (avoidDash) {
              const nonDashOpts = successors.filter(b => !DASH_LETTERS.has(b));
              const pool = nonDashOpts.length > 0 ? nonDashOpts : successors;
              bridgeLetter = pool[Math.floor(Math.random() * pool.length)]!;
            } else {
              bridgeLetter = successors[Math.floor(Math.random() * successors.length)]!;
            }

            extendedLetters.push(bridgeLetter);
            extendedSources.push({
              letter: bridgeLetter,
              isOriginal: false,
              stepIndex: extendedLetters.length,
            });
          }

          finalLetters = extendedLetters;
          finalLetterSources = extendedSources;
        }
      }

      spellState.setExpandedWord(finalLetters.join("") || spellState.inputWord);

      if (finalLetterSources.length > 0) {
        spellState.setLetterSources(finalLetterSources);
      }

      // Build constraints
      const constraintBuilder = await spellServiceLoader.getVariationConstraintBuilder();
      const constraints = constraintBuilder.buildConstraints(
        {
          constraintPreset: config?.constraintPreset ?? "smooth",
          handPathMode: config?.handPathMode ?? "mixed",
          motionTypeFilter: config?.motionTypeFilter ?? null,
          highContinuity: config?.constraintPreset === "smooth",
          makeCircular: false,
          selectedLOOPType: null,
          targetStepCount: null,
          maxReversals: null,
        },
        finalLetters
      );

      const constraintSet = createConstraintSet(config?.constraintPreset ?? "smooth", {
        handPathMode: config?.handPathMode ?? "mixed",
      });

      // Generate sequence with level and turn intensity from config
      const sequence = await spellGenerator.generateRandomSequence(finalLetters, {
        gridMode: (config?.gridMode ?? "diamond") as GridMode,
        constraints,
        constraintSet,
        letterSources: finalLetterSources,
        level: levelToDifficulty(config?.level ?? 2),
        turnIntensity: config?.turnIntensity ?? 1.0,
      });

      if (!sequence) {
        spellState.setError("Could not generate a valid sequence. Try different settings.");
        return;
      }

      // Apply turn allocation to spell-generated sequence.
      // The RandomSequenceGenerator selects pictographs with 0 turns (from CSV data).
      // We allocate turns post-hoc, then recalculate ALL orientations from scratch.
      // This is safe because recalculateAllOrientations() propagates from start position
      // through every step, computing endOri based on each step's actual turns.
      const level = config?.level ?? 2;
      let turnAppliedSequence = sequence;
      if (level >= 2 && sequence.steps?.length > 0) {
        const turnAllocation = await turnAllocator.allocateTurns(
          sequence.steps.length,
          level,
          config?.turnIntensity ?? 1.0
        );

        // Derive prop continuity from constraintPreset (same mapping as freeform pipeline)
        const propContinuity = config?.constraintPreset === "smooth"
          ? PropContinuity.CONTINUOUS
          : PropContinuity.RANDOM;

        // Apply allocated turns to each step
        const stepsWithTurns = [...sequence.steps];
        for (let i = 0; i < stepsWithTurns.length; i++) {
          const step = stepsWithTurns[i];
          if (!step) continue;
          const turnBlue = turnAllocation.blue[i] ?? 0;
          const turnRed = turnAllocation.red[i] ?? 0;
          // Clone step to avoid mutation
          stepsWithTurns[i] = { ...step, motions: { ...step.motions } };
          turnManager.setTurns(stepsWithTurns[i]!, turnBlue, turnRed);
          // Set rotation direction for dash/static motions that received non-zero turns.
          // CONTINUOUS: maintains the existing rotation direction across steps.
          // RANDOM: assigns random CW/CCW per step (more reversals).
          turnManager.updateDashStaticRotationDirections(stepsWithTurns[i]!, propContinuity, "", "");
        }

        // Rebuild sequence with new turns, then recalculate entire orientation chain
        turnAppliedSequence = { ...sequence, steps: stepsWithTurns };
      }

      // Derive start position (needed for orientation recalculation)
      let sequenceWithStart = turnAppliedSequence;
      const firstStep = turnAppliedSequence.steps?.[0];
      if (!turnAppliedSequence.startPosition && firstStep) {
        try {
          const derived = startPositionDeriver.deriveFromFirstBeat(firstStep);
          sequenceWithStart = { ...turnAppliedSequence, startPosition: derived };
        } catch {
          // Use sequence without start position
        }
      }

      // Recalculate orientations with the new turns and reprocess reversals
      if (level >= 2 && sequenceWithStart.startPosition) {
        sequenceWithStart = recalculateAllOrientations(sequenceWithStart, orientationCalculator);
        sequenceWithStart = reversalDetector.processReversals(sequenceWithStart);
      }

      // Build final sequence with spell metadata
      const finalExpandedWord = finalLetters.join("") || spellState.inputWord;
      const finalSequence: SequenceData = {
        ...sequenceWithStart,
        name: spellState.inputWord,
        word: finalExpandedWord,
        metadata: {
          ...sequenceWithStart.metadata,
          spellData: {
            expandedWord: finalExpandedWord,
            letterSources: finalLetterSources,
          },
        },
      };

      // Apply LOOP extension if loopEnabled
      let loopedSequence: SequenceData = finalSequence;
      if (config?.loopEnabled) {
        const loopType = (config.loopType as LOOPType) || LOOPType.STRICT_REWOUND;
        const sliceSize = (config.sliceSize as SliceSize) || SliceSize.HALVED;
        loopedSequence = await applySpellLoopExtension(finalSequence, loopType, sliceSize, finalLetterSources);
      }

      // Apply duration rhythm template if configured
      if (config?.durationTemplateId) {
        const template = getTemplateById(config.durationTemplateId);
        if (template) {
          try {
            const pattern = templateToPattern(template, "system", loopedSequence.steps.length);
            const durationManager = container.items.durationPatternManager;
            const result = durationManager.applyPattern(pattern, loopedSequence);
            if (result.success && result.sequence) {
              Object.assign(loopedSequence, result.sequence);
            }
          } catch {
            // Duration application failed, use sequence as-is
          }
        }
      }

      // Enforce tier beat cap post-generation — spell sequences with bridge letters
      // can exceed the user's allowed length.
      const spellTier = resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role));
      const spellMaxBeats = getMaxBeats(spellTier);
      if (loopedSequence.steps.length > spellMaxBeats) {
        loopedSequence = {
          ...loopedSequence,
          steps: loopedSequence.steps.slice(0, spellMaxBeats),
        };
      }

      // Snapshot current state before replacing so the user can undo back to it
      pushUndoSnapshot?.(UndoOp.SPELL_GENERATE, {
        description: `Spell generate: ${spellState.inputWord}`,
      });

      lastGeneratedSequence = loopedSequence;
      needsCycleCompletion = false; // Spell mode doesn't use orientation cycle completion
      const currentConfig = getConfig?.();
      lastGeneratedConfig = currentConfig ? { ...currentConfig } : null;
      await updateWorkbenchWithSequence(loopedSequence);
    } catch (error) {
      generationError = error instanceof Error ? error.message : "Spell generation failed";
      spellState.setError(generationError);

      const errorService = container.items.errorHandler;
      if (errorService) {
        errorService.showUserError({
          message: "Spell generation failed",
          technicalDetails: generationError,
          error: error instanceof Error ? error : new Error(generationError),
          severity: "error",
          context: {
            module: "create",
            tab: "generate",
            action: "spellGenerate",
            additionalData: (() => {
              const cfg = getConfig?.();
              return {
                word: spellState.inputWord,
                gridMode: cfg?.gridMode,
                difficulty: cfg?.level,
                constraintPreset: cfg?.constraintPreset,
                handPathMode: cfg?.handPathMode,
                motionTypeFilter: cfg?.motionTypeFilter,
                turnIntensity: cfg?.turnIntensity,
                loopEnabled: cfg?.loopEnabled,
                loopType: cfg?.loopType,
                sliceSize: cfg?.sliceSize,
              };
            })(),
          },
        });
      }
    } finally {
      isGenerating = false;
      spellState?.setGenerating(false);
    }
  }

  /**
   * Apply LOOP extension to a spell-generated sequence.
   * 1. Try direct extension (sequence already ends at LOOP-compatible position)
   * 2. If not, find bridge letters and auto-insert the first viable option
   * 3. Update letterSources and spell metadata accordingly
   */
  async function applySpellLoopExtension(
    sequence: SequenceData,
    loopType: LOOPType,
    sliceSize: SliceSize,
    letterSources?: Array<{ letter: Letter; isOriginal: boolean; stepIndex: number }>
  ): Promise<SequenceData> {
    try {
      // Path A: Try direct extension (sequence already ends at LOOP-compatible position)
      // Wrapped in its own try-catch so failures fall through to bridge-finding (Path B)
      const analysis = sequenceExtender.analyzeSequence(sequence);
      if (analysis.canExtend) {
        try {
          const extended = await sequenceExtender.extendSequence(sequence, { loopType, sliceSize });
          if (extended) {
            return updateLoopMetadata(extended, sequence, letterSources);
          }
        } catch {
          // Direct extension failed (e.g., position pair not valid for this LOOP type)
          // Fall through to bridge-finding below
        }
      }

      // Path B: Not directly extendable — find a bridge letter to make it LOOP-compatible
      // Try both circularization (cross-group) and extension (same-group) options
      const circularizationOptions = await sequenceExtender.getCircularizationOptions(sequence);
      const extensionOptions = await sequenceExtender.getAllExtensionOptions(sequence);
      const allBridgeOptions = [...circularizationOptions, ...extensionOptions];

      if (allBridgeOptions.length === 0) {
        console.warn("[SpellGenerate] No bridge options found for LOOP extension");
        return sequence;
      }

      // Filter bridge options to those compatible with the user's chosen LOOP type AND slice size
      // rotationRelation tells us the position pair geometry:
      //   "half" → valid for halved (180°)
      //   "quarter" → valid for quartered (90°)
      //   "exact" → same position (rewound only)
      const expectedRotation = sliceSize === SliceSize.QUARTERED ? "quarter" : "half";

      const compatibleBridges = allBridgeOptions.filter((opt) => {
        const hasLoopType = opt.availableLOOPs.some((l) => l.loopType === loopType);
        if (!hasLoopType) return false;
        // Also check slice size compatibility via rotation relation
        if (opt.rotationRelation) {
          return opt.rotationRelation === expectedRotation;
        }
        return true; // No rotation info = allow (e.g., rewound)
      });

      if (compatibleBridges.length === 0) {
        console.warn("[SpellGenerate] No bridge options compatible with", loopType, sliceSize);
        return sequence;
      }

      const bridgeOptions = compatibleBridges;

      // Pick the first viable bridge option
      const bestBridge = bridgeOptions[0]!;
      const bridgeLetter = bestBridge.bridgeLetters[0];
      if (!bridgeLetter) return sequence;

      // Extend with the bridge letter, passing the specific pictographData
      // to ensure the exact variation (and correct end position) is used
      const extended = await sequenceExtender.extendWithBridge(
        sequence,
        bridgeLetter,
        loopType,
        bestBridge.pictographData,
        sliceSize
      );

      if (!extended) return sequence;

      // Update letter sources to include the bridge letter
      const updatedSources = [
        ...(letterSources ?? []),
        {
          letter: bridgeLetter,
          isOriginal: false,
          stepIndex: (sequence.steps?.length ?? 0) + 1,
        },
      ];

      return updateLoopMetadata(extended, sequence, updatedSources);
    } catch (error) {
      console.warn("[SpellGenerate] LOOP extension failed:", error);
      return sequence;
    }
  }

  /**
   * Update sequence metadata after LOOP extension to include spell data
   * and bridge letter tracking.
   */
  function updateLoopMetadata(
    extended: SequenceData,
    original: SequenceData,
    letterSources?: Array<{ letter: Letter; isOriginal: boolean; stepIndex: number }>
  ): SequenceData {
    const originalStepCount = original.steps?.length ?? 0;

    // Build updated letterSources: original steps preserve their source,
    // LOOP-generated steps are marked as not original
    const extendedSources = extended.steps?.map((step, index) => {
      if (index < originalStepCount && letterSources?.[index]) {
        return {
          letter: (step.letter || "") as Letter,
          isOriginal: letterSources[index]!.isOriginal,
          stepIndex: index + 1,
        };
      }
      return {
        letter: (step.letter || "") as Letter,
        isOriginal: false,
        stepIndex: index + 1,
      };
    }) ?? [];

    const extendedWord = extended.word || extended.steps?.map(s => s.letter || "").join("") || "";

    return {
      ...extended,
      word: extendedWord,
      metadata: {
        ...extended.metadata,
        spellData: {
          originalWord: original.word || "",
          expandedWord: extendedWord,
          letterSources: extendedSources,
        },
      },
    };
  }

  async function updateWorkbenchWithSequence(sequence: SequenceData) {
    try {
      const sequenceState = getSequenceState?.();
      if (!sequenceState) return;

      const hasExistingSequence = sequenceState.getCurrentBeats().length > 0;

      if (hasExistingSequence) {
        window.dispatchEvent(new CustomEvent("clear-sequence-animation"));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const isSequential = getIsSequential?.() ?? false;

      // Set global flag BEFORE dispatching event - this flag persists even if StepGrid
      // isn't mounted yet (e.g., workspace is transitioning from empty to visible)
      setPendingGenerationAnimation(true);

      // Dispatch BEFORE updating sequence to prepare StepGrid for animation
      window.dispatchEvent(
        new CustomEvent("prepare-sequence-animation", {
          detail: {
            isSequential,
            stepCount: sequence.steps.length,
          },
        })
      );

      // Small delay to ensure the prepare event is processed before updating sequence
      // This allows the StepGrid to set up animation state before receiving new steps
      await new Promise((resolve) => setTimeout(resolve, 10));

      sequenceState.setCurrentSequence(sequence);
    } catch (error) {
      throw new Error(
        `Workbench update failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extend the current sequence to complete its orientation cycle.
   * Only animates the NEW beats in — existing beats stay in place.
   */
  async function completeCycle() {
    const sequenceState = getSequenceState?.();
    if (!sequenceState) return;

    const currentSequence = sequenceState.currentSequence;
    if (!currentSequence) return;

    // Snapshot before extending so the user can undo the cycle completion
    pushUndoSnapshot?.(UndoOp.EXTEND_SEQUENCE, {
      description: "Complete orientation cycle",
    });

    const existingBeatCount = currentSequence.steps.length;
    const extended = orientationCycleExtender.extendIfNeeded(currentSequence);
    needsCycleCompletion = false;

    // Signal StepGrid to animate only new beats (from existingBeatCount onward)
    window.dispatchEvent(
      new CustomEvent("prepare-cycle-extension", {
        detail: {
          totalBeatCount: extended.steps.length,
          existingBeatCount,
        },
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    sequenceState.setCurrentSequence(extended);
  }

  function clearError() {
    generationError = null;
  }

  function getGenerationSummary() {
    return {
      isGenerating,
      hasLastGenerated: lastGeneratedSequence !== null,
      lastGeneratedName: lastGeneratedSequence?.name || null,
      lastGeneratedBeats: lastGeneratedSequence?.steps.length || 0,
      hasError: generationError !== null,
      errorMessage: generationError,
    };
  }

  return {
    get isGenerating() {
      return isGenerating;
    },
    get lastGeneratedSequence() {
      return lastGeneratedSequence;
    },
    get lastGeneratedConfig() {
      return lastGeneratedConfig;
    },
    get generationError() {
      return generationError;
    },
    get needsCycleCompletion() {
      return needsCycleCompletion;
    },
    onGenerateClicked,
    onSpellGenerate,
    completeCycle,
    clearError,
    getGenerationSummary,
  };
}
