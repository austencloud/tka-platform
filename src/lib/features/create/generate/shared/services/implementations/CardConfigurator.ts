import { LOOPType } from "../../../circular/domain/models/circular-models";
import type { UIGenerationConfig } from "../../../state/generate-config.svelte";
import { DifficultyLevel } from "../../domain/models/generate-models";
import type {
  CardDescriptor,
  CardHandlers,
  ICardConfigurator,
} from "../contracts/ICardConfigurator";

/**
 * Implementation of ICardConfigurator
 * Builds card descriptor arrays with conditional rendering and responsive grid layouts
 */
export class CardConfigurator implements ICardConfigurator {
  /**
   * Build card descriptors array for rendering
   * Extracted from CardBasedSettingsContainer to separate business logic from presentation
   */
  buildCardDescriptors(
    config: UIGenerationConfig,
    currentLevel: DifficultyLevel,
    isFreeformMode: boolean,
    handlers: CardHandlers,
    headerFontSize: string,
    allowedIntensityValues: number[],
    isGenerating: boolean = false
  ): CardDescriptor[] {
    const cardList: CardDescriptor[] = [];
    let cardIndex = 0;

    // Determine layout based on level
    const isBeginnerLevel = currentLevel === DifficultyLevel.BEGINNER;
    const shouldShowTurnIntensity = currentLevel !== DifficultyLevel.BEGINNER;

    // Row 1: Always visible cards (Level, Length, Generation Mode)
    // These cards are STABLE and never resize
    cardList.push({
      id: "level",
      props: {
        currentLevel,
        onLevelChange: handlers.handleLevelChange,
        cardIndex: cardIndex++,
        headerFontSize,
      },
      gridColumnSpan: 2, // Always 2 cols - stable
    });

    cardList.push({
      id: "length",
      props: {
        currentLength: config.length,
        currentMode: config.mode,
        onLengthChange: handlers.handleLengthChange,
        // Color now handled via CSS variables in component
        cardIndex: cardIndex++,
        headerFontSize,
      },
      gridColumnSpan: 2, // Always 2 cols - stable
    });

    cardList.push({
      id: "generation-mode",
      props: {
        currentMode: config.mode,
        onModeChange: handlers.handleGenerationModeChange,
        // Color now handled via CSS variables in component
        cardIndex: cardIndex++,
        headerFontSize,
      },
      gridColumnSpan: 2, // Always 2 cols - LOCKED TOP-RIGHT
    });

    // Row 2: Grid Mode and Prop Continuity
    // Expand to 3 cols each in Beginner mode (any type - Freeform or Circular)
    cardList.push({
      id: "grid-mode",
      props: {
        currentMode: config.gridMode,
        onModeChange: handlers.handleGridModeChange,
        // Color now handled via CSS variables in component
        cardIndex: cardIndex++,
        headerFontSize,
      },
      gridColumnSpan: isBeginnerLevel ? 3 : 2, // Expands in any Beginner mode
    });

    cardList.push({
      id: "prop-continuity",
      props: {
        currentContinuity: config.propContinuity,
        onContinuityChange: handlers.handlePropContinuityChange,
        // Color now handled via CSS variables in component
        cardIndex: cardIndex++,
        headerFontSize,
      },
      gridColumnSpan: isBeginnerLevel ? 3 : 2, // Expands in any Beginner mode
    });

    // Conditional: Turn Intensity (only when level !== BEGINNER)
    // Fills the last spot in Row 2 alongside Grid and PropCont
    if (shouldShowTurnIntensity) {
      cardList.push({
        id: "turn-intensity",
        props: {
          currentIntensity: config.turnIntensity,
          allowedValues: allowedIntensityValues,
          onIntensityChange: handlers.handleTurnIntensityChange,
          cardIndex: cardIndex++,
          headerFontSize,
        },
        gridColumnSpan: 2, // Always 2 columns (1/3 of row)
      });
    }

    // Start/End Options Card - for position constraints
    // In circular mode: shares row with Slice Size after LOOP
    // In freeform mode: shares row with Generate button
    const hasStartEndCard =
      handlers.handleStartEndChange && handlers.startEndOptions;

    // Circular mode: LOOP inline picker (full row), then Slice Size + Start/End row
    if (!isFreeformMode) {
      // LOOP inline picker - always full row
      cardList.push({
        id: "loop-type",
        props: {
          currentLOOPType: config.loopType,
          onLOOPTypeChange: handlers.handleLOOPTypeChange,
          shadowColor: "30deg 75% 55%", // Orange shadow
          cardIndex: cardIndex++,
          headerFontSize,
        },
        gridColumnSpan: 6,
      });

      // LOOP types that include ROTATION support slice size choice (halved or quartered)
      const loopTypeAllowsSliceChoice =
        config.loopType === LOOPType.STRICT_ROTATED ||
        config.loopType === LOOPType.ROTATED_INVERTED ||
        config.loopType === LOOPType.ROTATED_SWAPPED ||
        config.loopType === LOOPType.MIRRORED_ROTATED ||
        config.loopType === LOOPType.MIRRORED_INVERTED_ROTATED ||
        config.loopType === LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;

      // Slice Size + Start/End share the row after LOOP
      if (loopTypeAllowsSliceChoice) {
        cardList.push({
          id: "slice-size",
          props: {
            currentSliceSize: config.sliceSize,
            onSliceSizeChange: handlers.handleSliceSizeChange,
            cardIndex: cardIndex++,
            headerFontSize,
          },
          gridColumnSpan: hasStartEndCard ? 2 : 6,
        });
      }

      if (hasStartEndCard) {
        cardList.push({
          id: "start-end",
          props: {
            currentOptions: handlers.startEndOptions,
            onOptionsChange: handlers.handleStartEndChange,
            isFreeformMode: false,
            cardIndex: cardIndex++,
            headerFontSize,
            positionsResetTrigger: handlers.positionsResetTrigger,
            gridMode: handlers.currentGridMode,
          },
          gridColumnSpan: loopTypeAllowsSliceChoice ? 4 : 6,
        });
      }
    }

    // In freeform mode: Start/End shares row with Generate button
    if (isFreeformMode && hasStartEndCard) {
      cardList.push({
        id: "start-end",
        props: {
          currentOptions: handlers.startEndOptions,
          onOptionsChange: handlers.handleStartEndChange,
          isFreeformMode: true, // Freeform mode - show end position selector
          cardIndex: cardIndex++,
          headerFontSize,
          positionsResetTrigger: handlers.positionsResetTrigger,
          gridMode: handlers.currentGridMode,
        },
        gridColumnSpan: 2, // 2 cols - shares row with Generate button (4 cols)
      });
    }

    // Generate Button Card - always at the end
    // In freeform mode with Start/End: 4 cols (shares row with Start/End)
    // Otherwise: 6 cols (full width)
    if (handlers.handleGenerateClick) {
      const generateColumnSpan = isFreeformMode && hasStartEndCard ? 4 : 6;
      cardList.push({
        id: "generate-button",
        props: {
          isGenerating,
          onGenerateClicked: handlers.handleGenerateClick,
          config, // Pass the config so the button can convert it to GenerationOptions
          startEndOptions: handlers.startEndOptions, // Pass start/end options for generation
        },
        gridColumnSpan: generateColumnSpan,
      });
    }

    return cardList;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const cardConfigurator = new CardConfigurator();
