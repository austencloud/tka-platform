import type { UIGenerationConfig } from "../../../state/generate-config.svelte";
import { DifficultyLevel, GenerationMode } from "../../domain/models/generate-models";
import type {
  CardDescriptor,
  CardHandlers,
  ICardConfigurator,
} from "../contracts/ICardConfigurator";

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
 *   Row 3: Customize(3) + LOOP(3) = 6
 *   Row 4: Generate(6)
 *
 * SPELL:
 *   Row 1: Mode(2) + WordInput(4) = 6
 *   Row 2 (beginner): Level(2) + GridMode(2) + PropCont(2) = 6
 *   Row 2 (non-beginner): Level(2) + GridMode(2) + PropCont(2) = 6
 *   Row 3 (beginner): Customize(3) + LOOP(3) = 6
 *   Row 3 (non-beginner): TurnIntensity(2) + Customize(2) + LOOP(2) = 6
 *   Row 4: Generate(6)
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

    // ─── Row 1 remainder: WordInput (spell) or Level+Length (freeform) ───

    if (isSpellMode && handlers.handleWordInput) {
      // Spell Row 1: Mode(2) + WordInput(4) = 6
      cardList.push({
        id: "word-input",
        props: {
          value: handlers.wordInputValue ?? "",
          onInput: handlers.handleWordInput,
          onSubmit: handlers.handleWordSubmit,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 4,
      });
    } else {
      // Freeform Row 1: Mode(2) + Level(2) + Length(2) = 6
      cardList.push({
        id: "level",
        props: {
          currentLevel,
          onLevelChange: handlers.handleLevelChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });

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

    // ─── Row 2: [Level if spell] + Grid Mode + Prop Continuity [+ TurnIntensity] ───

    // In spell mode, Level drops to Row 2: Level(2) + GridMode(2) + PropCont(2) = 6
    if (isSpellMode) {
      cardList.push({
        id: "level",
        props: {
          currentLevel,
          onLevelChange: handlers.handleLevelChange,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // Grid + PropCont sizing:
    // Spell: always 2 (Level fills the remaining slot)
    // Freeform beginner: 3 each (no TurnIntensity)
    // Freeform non-beginner: 2 each (TurnIntensity fills remaining)
    const gridPropSpan = isSpellMode ? 2 : (isBeginnerLevel ? 3 : 2);

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

    // ─── Customize + LOOP row ───
    // These two cards share a row. Their span depends on context:
    // - Non-spell beginner: GridMode(3)+PropCont(3) fills Row 2, so Row 3 = Customize(3)+LOOP(3)
    // - Non-spell non-beginner: Row 2 filled by GridMode+PropCont+TurnIntensity, Row 3 = Customize(3)+LOOP(3)
    // - Spell beginner: Row 2 = Level+GridMode+PropCont (all 2), Row 3 = Customize(3)+LOOP(3)
    // - Spell non-beginner: Row 3 = TurnIntensity(2)+Customize(2)+LOOP(2)
    const customizeLoopSpan = (isSpellMode && shouldShowTurnIntensity) ? 2 : 3;

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
          startEndOptions: handlers.startEndOptions ?? null,
          gridMode: handlers.currentGridMode,
          isFreeformMode: !loopEnabled,
          onConstraintPresetChange: handlers.handleConstraintPresetChange,
          onHandPathModeChange: handlers.handleHandPathModeChange,
          onMotionTypeFilterChange: handlers.handleMotionTypeFilterChange,
          onOpenDurationPanel: handlers.handleOpenDurationPanel,
          onStartEndChange: hasStartEnd ? handlers.handleStartEndChange : null,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: customizeLoopSpan,
      });
    }

    // Consolidated LOOP card (absorbs toggle + type + slice size)
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
