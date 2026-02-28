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
import type { IVariationExplorationOrchestrator } from "$lib/features/create/spell/services/contracts/IVariationExplorationOrchestrator";
import type { IRandomSequenceGenerator } from "$lib/features/create/spell/services/contracts/IRandomSequenceGenerator";
import type { ISpellServiceLoader } from "$lib/features/create/spell/services/contracts/ISpellServiceLoader";
import { createConstraintSet } from "$lib/shared/sequence-engine/constraints";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { sequenceExtender } from "$lib/features/create/shared/services/implementations/SequenceExtender";
import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

export function createGenerationActionsState(
  getSequenceState?: () => SequenceState | undefined,
  getIsSequential?: () => boolean,
  getConfig?: () => UIGenerationConfig | undefined,
  getSpellState?: () => SpellModeState | undefined
) {
  let isGenerating = $state(false);
  let lastGeneratedSequence = $state<SequenceData | null>(null);
  let lastGeneratedConfig = $state<UIGenerationConfig | null>(null);
  let generationError = $state<string | null>(null);
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

      lastGeneratedSequence = generatedSequence;
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
              loopType: options.loopType,
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

      const letters = parseResult.expandedLetters;
      spellState.setExpandedWord(parseResult.expandedWord || spellState.inputWord);

      if (parseResult.letterSources) {
        spellState.setLetterSources(parseResult.letterSources);
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
        letters
      );

      const constraintSet = createConstraintSet(config?.constraintPreset ?? "smooth", {
        handPathMode: config?.handPathMode ?? "mixed",
      });

      // Generate sequence with level and turn intensity from config
      const sequence = await spellGenerator.generateRandomSequence(letters, {
        gridMode: (config?.gridMode ?? "diamond") as GridMode,
        constraints,
        constraintSet,
        letterSources: parseResult.letterSources,
        level: levelToDifficulty(config?.level ?? 2),
        turnIntensity: config?.turnIntensity ?? 1.0,
      });

      if (!sequence) {
        spellState.setError("Could not generate a valid sequence. Try different settings.");
        return;
      }

      // Derive start position
      let sequenceWithStart = sequence;
      const firstStep = sequence.steps?.[0];
      if (!sequence.startPosition && firstStep) {
        try {
          const derived = startPositionDeriver.deriveFromFirstBeat(firstStep);
          sequenceWithStart = { ...sequence, startPosition: derived };
        } catch {
          // Use sequence without start position
        }
      }

      // Build final sequence with spell metadata
      const finalExpandedWord = parseResult.expandedWord || spellState.inputWord;
      const finalSequence: SequenceData = {
        ...sequenceWithStart,
        name: spellState.inputWord,
        word: finalExpandedWord,
        metadata: {
          ...sequenceWithStart.metadata,
          spellData: {
            expandedWord: finalExpandedWord,
            letterSources: parseResult.letterSources,
          },
        },
      };

      // Apply LOOP extension if loopEnabled
      let loopedSequence: SequenceData = finalSequence;
      if (config?.loopEnabled) {
        const loopType = (config.loopType as LOOPType) || LOOPType.STRICT_REWOUND;
        loopedSequence = await applySpellLoopExtension(finalSequence, loopType, parseResult.letterSources);
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

      lastGeneratedSequence = loopedSequence;
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
            additionalData: { word: spellState.inputWord },
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
    letterSources?: Array<{ letter: Letter; isOriginal: boolean; stepIndex: number }>
  ): Promise<SequenceData> {
    try {
      // Analyze if sequence can be directly extended
      const analysis = sequenceExtender.analyzeSequence(sequence);

      if (analysis.canExtend) {
        // Direct extension — the sequence ends at a LOOP-compatible position
        const extended = await sequenceExtender.extendSequence(sequence, { loopType });
        if (extended) {
          return updateLoopMetadata(extended, sequence, letterSources);
        }
      }

      // Not directly extendable — find bridge letters
      const bridgeOptions = await sequenceExtender.getCircularizationOptions(sequence);
      if (bridgeOptions.length === 0) {
        // No bridge options — return sequence without LOOP
        console.warn("[SpellGenerate] No bridge options found for LOOP extension");
        return sequence;
      }

      // Pick the first viable bridge option
      const bestBridge = bridgeOptions[0]!;
      const bridgeLetter = bestBridge.bridgeLetters[0];
      if (!bridgeLetter) return sequence;

      // Extend with the bridge letter
      const extended = await sequenceExtender.extendWithBridge(
        sequence,
        bridgeLetter,
        loopType
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
    onGenerateClicked,
    onSpellGenerate,
    clearError,
    getGenerationSummary,
  };
}
