import type { UIGenerationConfig } from "../../../state/generate-config.svelte";
import { DifficultyLevel, GenerationMode } from "../../domain/models/generate-models";
import { LOOPType } from "../../../circular/domain/models/circular-models";
import type {
  CardDescriptor,
  CardHandlers,
  ICardConfigurator,
} from "../contracts/ICardConfigurator";

const ROTATED_LOOP_TYPES = new Set([
  LOOPType.STRICT_ROTATED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
]);

/**
 * Implementation of ICardConfigurator
 * Builds card descriptor arrays with conditional rendering and responsive grid layouts
 *
 * Grid is 6 columns. Cards auto-wrap to new rows when a row fills up.
 * Mode is ALWAYS top-left (position 0) to prevent FLIP animation jumping on mode toggle.
 *
 * FREEFORM (non-spell):
 *   Row 1: Mode(2) + Level(2) + Length(2) = 6
 *   Row 2 (beginner): GridMode(3) + PropCont(3) = 6
 *   Row 2 (non-beginner): GridMode(2) + PropCont(2) + TurnIntensity(2) = 6
 *   Row 3 (no slice): Customize(3) + LOOP(3) = 6
 *   Row 3 (with slice): Customize(2) + LOOP(2) + Slice(2) = 6
 *   Row 4: Generate(6)
 *
 * SPELL:
 *   Row 1: Mode(2) + Level(4) = 6
 *   Row 2 (beginner): GridMode(3) + PropCont(3) = 6
 *   Row 2 (non-beginner): GridMode(2) + PropCont(2) + TurnIntensity(2) = 6
 *   Row 3 (beginner): Customize(3) + LOOP(3) = 6
 *   Row 3 (non-beginner): Customize(2) + LOOP(2) + [Slice(2)] = 6
 *   Row 4: SpellGenerate(6) — word input embedded in generate bar
 */
export class CardConfigurator implements ICardConfigurator {
  buildCardDescriptors(
    config: UIGenerationConfig,
    currentLevel: DifficultyLevel,
    isFreeformMode: boolean,
    handlers: CardHandlers,
    allowedIntensityValues: number[],
    isGenerating: boolean = false,
    hasSettingsChanged: boolean = false,
    loopEnabled: boolean = false
  ): CardDescriptor[] {
    const cardList: CardDescriptor[] = [];
    let cardIndex = 0;

    const isBeginnerLevel = currentLevel === DifficultyLevel.BEGINNER;
    const shouldShowTurnIntensity = currentLevel !== DifficultyLevel.BEGINNER;
    const isSpellMode = config.mode === GenerationMode.SPELL;

    // ─── Mode is ALWAYS first (top-left) to prevent FLIP animation jumps ───

    cardList.push({
      id: "generation-mode",
      props: {
        currentMode: config.mode,
        onModeChange: handlers.handleGenerationModeChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: 2,
    });

    // ─── Row 1 remainder: Level (spell gets wider) or Level+Length (freeform) ───

    // Level card — in spell mode it spans 4 (no Length card), freeform spans 2
    cardList.push({
      id: "level",
      props: {
        currentLevel,
        onLevelChange: handlers.handleLevelChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: isSpellMode ? 4 : 2,
    });

    if (!isSpellMode) {
      // Freeform Row 1: Mode(2) + Level(2) + Length(2) = 6
      cardList.push({
        id: "length",
        props: {
          currentLength: config.length,
          currentMode: config.mode,
          loopEnabled,
          onLengthChange: handlers.handleLengthChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // ─── Row 2: Grid Mode + Prop Continuity [+ TurnIntensity] ───

    // Grid + PropCont sizing:
    // Beginner: 3 each (no TurnIntensity)
    // Non-beginner: 2 each (TurnIntensity fills remaining)
    const gridPropSpan = isBeginnerLevel ? 3 : 2;

    cardList.push({
      id: "grid-mode",
      props: {
        currentMode: config.gridMode,
        onModeChange: handlers.handleGridModeChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: gridPropSpan,
    });

    cardList.push({
      id: "prop-continuity",
      props: {
        currentContinuity: config.propContinuity,
        onContinuityChange: handlers.handlePropContinuityChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: gridPropSpan,
    });

    // TurnIntensity (non-beginner only)
    // In non-spell: completes Row 2 → GridMode(2)+PropCont(2)+TurnIntensity(2)=6
    // In spell: starts Row 3 → TurnIntensity(2)+Customize(2)+LOOP(2)=6
    if (shouldShowTurnIntensity) {
      cardList.push({
        id: "turn-intensity",
        props: {
          currentIntensity: config.turnIntensity,
          allowedValues: allowedIntensityValues,
          onIntensityChange: handlers.handleTurnIntensityChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // ─── Customize + LOOP [+ Slice] row ───
    // When LOOP is enabled with a rotated type, add a Slice card: Customize(2)+LOOP(2)+Slice(2)
    // Otherwise two cards share the row at span 3 each.
    const showSliceCard = loopEnabled && ROTATED_LOOP_TYPES.has(config.loopType as LOOPType);
    const customizeLoopSpan = showSliceCard ? 2 : 3;

    // Customize card (absorbs Style + Rhythm + Start/End)
    const hasStartEnd = handlers.handleStartEndChange && handlers.startEndOptions;
    if (handlers.handleConstraintPresetChange) {
      cardList.push({
        id: "customize",
        props: {
          constraintPreset: config.constraintPreset,
          handPathMode: config.handPathMode,
          motionTypeFilter: config.motionTypeFilter,
          durationTemplateId: config.durationTemplateId,
          stepCount: config.length,
          startEndOptions: handlers.startEndOptions ?? null,
          gridMode: handlers.currentGridMode,
          isFreeformMode: !loopEnabled,
          onConstraintPresetChange: handlers.handleConstraintPresetChange,
          onHandPathModeChange: handlers.handleHandPathModeChange,
          onMotionTypeFilterChange: handlers.handleMotionTypeFilterChange,
          onDurationTemplateSelect: handlers.handleDurationTemplateSelect,
          onStartEndChange: hasStartEnd ? handlers.handleStartEndChange : null,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: customizeLoopSpan,
      });
    }

    // Consolidated LOOP card (toggle + type selection)
    if (handlers.handleLoopToggle) {
      cardList.push({
        id: "loop",
        props: {
          loopEnabled,
          currentLOOPType: config.loopType,
          onLoopToggle: handlers.handleLoopToggle,
          onLOOPTypeChange: handlers.handleLOOPTypeChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: customizeLoopSpan,
      });
    }

    // Slice size card (only when LOOP enabled with a rotated variant)
    if (showSliceCard && handlers.handleSliceSizeChange) {
      cardList.push({
        id: "slice-size",
        props: {
          currentSliceSize: config.sliceSize,
          onSliceSizeChange: handlers.handleSliceSizeChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // ─── Generate Button (always last, full width) ───

    if (handlers.handleGenerateClick) {
      const spellDisabled = isSpellMode && !(handlers.wordInputValue?.trim());

      cardList.push({
        id: "generate-button",
        props: {
          isGenerating,
          hasSettingsChanged,
          onGenerateClicked: handlers.handleGenerateClick,
          config,
          startEndOptions: handlers.startEndOptions,
          disabled: spellDisabled,
          // Spell mode: embed word input in the generate bar
          spellMode: isSpellMode,
          wordInputValue: isSpellMode ? (handlers.wordInputValue ?? "") : undefined,
          onWordInput: isSpellMode ? handlers.handleWordInput : undefined,
          onWordSubmit: isSpellMode ? handlers.handleWordSubmit : undefined,
          // Orientation cycle completion (freeform LOOP only)
          needsCycleCompletion: handlers.needsCycleCompletion ?? false,
          onCompleteCycle: handlers.handleCompleteCycle,
        },
        gridColumnSpan: 6, // Always full width — no cards share this row
      });
    }

    return cardList;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const cardConfigurator = new CardConfigurator();
