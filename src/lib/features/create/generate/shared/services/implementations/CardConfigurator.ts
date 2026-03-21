import type { UIGenerationConfig } from "../../../state/generate-config.svelte";
import { DifficultyLevel } from "../../domain/models/generate-models";
import { LOOPType, ROTATED_LOOP_TYPES } from "../../../circular/domain/models/circular-models";
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
 *
 *   Row 1: Word(2) + Preset(2) + Length(2) = 6
 *   Row 2 (beginner): Level(3) + GridMode(3) = 6
 *   Row 2 (non-beginner): Level(2) + GridMode(2) + TurnIntensity(2) = 6
 *   Row 3 (no slice): Customize(3) + LOOP(3) = 6
 *   Row 3 (with slice): Customize(2) + LOOP(2) + Slice(2) = 6
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

    // ─── Row 1: Word(2) + Preset(2) + Length(2) = 6 ───

    cardList.push({
      id: "word-input",
      props: {
        wordValue: handlers.wordInputValue ?? "",
        onWordChange: handlers.handleWordInput,
        onWordSubmit: handlers.handleWordSubmit,
        disabled: isGenerating,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: 2,
    });

    // Favorite card
    if (handlers.handleOpenPresetDrawer) {
      cardList.push({
        id: "preset",
        props: {
          activeFavoriteId: handlers.activeFavoriteId ?? null,
          activeFavoriteName: handlers.activeFavoriteName ?? null,
          onOpenDrawer: handlers.handleOpenPresetDrawer,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // Length card — always interactive, with constrained bounds in spell mode
    const hasWord = !!(handlers.wordInputValue?.trim());
    if (hasWord) {
      const naturalDisplayLength = handlers.computedWordLength ?? handlers.wordInputValue!.trim().length;
      const bridgeInfo = handlers.bridgeInfo;
      const bridgeSubtitle = bridgeInfo && bridgeInfo.totalBridges > 0
        ? `+${bridgeInfo.totalBridges} bridge${bridgeInfo.totalBridges !== 1 ? "s" : ""}`
        : "";

      cardList.push({
        id: "length",
        props: {
          currentLength: naturalDisplayLength,
          currentMode: config.mode,
          loopEnabled,
          onLengthChange: handlers.handleSpellLengthChange ?? handlers.handleLengthChange,
          locked: false,
          minOverride: bridgeInfo?.naturalDisplayLength || undefined,
          subtitle: bridgeSubtitle,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    } else {
      cardList.push({
        id: "length",
        props: {
          currentLength: config.length,
          currentMode: config.mode,
          loopEnabled,
          onLengthChange: handlers.handleLengthChange,
          locked: false,
          cardIndex: cardIndex++,
        },
        gridColumnSpan: 2,
      });
    }

    // ─── Row 2: Level + GridMode [+ TurnIntensity] ───

    // Beginner: Level(3) + GridMode(3) = 6
    // Non-beginner: Level(2) + GridMode(2) + TurnIntensity(2) = 6
    const row2Span = isBeginnerLevel ? 3 : 2;

    cardList.push({
      id: "level",
      props: {
        currentLevel,
        onLevelChange: handlers.handleLevelChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: row2Span,
    });

    cardList.push({
      id: "grid-mode",
      props: {
        currentMode: config.gridMode,
        onModeChange: handlers.handleGridModeChange,
        cardIndex: cardIndex++,
      },
      gridColumnSpan: row2Span,
    });

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
      cardList.push({
        id: "generate-button",
        props: {
          isGenerating,
          hasSettingsChanged,
          onGenerateClicked: handlers.handleGenerateClick,
          config,
          startEndOptions: handlers.startEndOptions,
          // Orientation cycle completion (freeform LOOP only)
          needsCycleCompletion: handlers.needsCycleCompletion ?? false,
          onCompleteCycle: handlers.handleCompleteCycle,
        },
        gridColumnSpan: 6,
      });
    }

    return cardList;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const cardConfigurator = new CardConfigurator();
