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
    allowedIntensityValues: number[],
    isGenerating: boolean = false,
    hasSettingsChanged: boolean = false
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
  
        },
        gridColumnSpan: 2, // Always 2 columns (1/3 of row)
      });
    }

    // Row 3: Circular mode only cards (Slice Size + LOOP Type)
    // Determine if slice size selection is needed
    // LOOP types that include ROTATION support slice size choice (halved or quartered)
    // LOOP types without rotation only support halved mode
    const loopTypeAllowsSliceChoice =
      config.loopType === LOOPType.STRICT_ROTATED ||
      config.loopType === LOOPType.ROTATED_INVERTED ||
      config.loopType === LOOPType.ROTATED_SWAPPED ||
      config.loopType === LOOPType.MIRRORED_ROTATED ||
      config.loopType === LOOPType.MIRRORED_INVERTED_ROTATED ||
      config.loopType === LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;

    // Conditional: Slice Size (only in Circular mode AND when LOOP type allows choice)
    if (!isFreeformMode && loopTypeAllowsSliceChoice) {
      cardList.push({
        id: "slice-size",
        props: {
          currentSliceSize: config.sliceSize,
          onSliceSizeChange: handlers.handleSliceSizeChange,
          // Color now handled via CSS variables in component
          cardIndex: cardIndex++,
  
        },
        gridColumnSpan: 2,
      });
    }

    // Start/End Options Card - for position constraints
    // In circular mode: Add to row 3 with LOOP/SliceSize
    // In freeform mode: Add to final row with Generate button
    const hasStartEndCard =
      handlers.handleStartEndChange && handlers.startEndOptions;

    // Conditional: LOOP Type (only in Circular mode)
    // Row 3 layout depends on whether slice size and start/end are shown:
    // - SliceSize (2) + LOOP (2) + StartEnd (2) = 6 cols
    // - LOOP (4) + StartEnd (2) = 6 cols
    // - SliceSize (2) + LOOP (4) = 6 cols (no start/end)
    // - LOOP (6) = full row (no start/end, no slice size)
    if (!isFreeformMode) {
      // Determine LOOP column span based on what else is in row 3
      let loopColumnSpan: number;
      if (loopTypeAllowsSliceChoice && hasStartEndCard) {
        loopColumnSpan = 2; // SliceSize(2) + LOOP(2) + StartEnd(2)
      } else if (loopTypeAllowsSliceChoice) {
        loopColumnSpan = 4; // SliceSize(2) + LOOP(4)
      } else if (hasStartEndCard) {
        loopColumnSpan = 4; // LOOP(4) + StartEnd(2)
      } else {
        loopColumnSpan = 6; // LOOP(6) full row
      }

      cardList.push({
        id: "loop-type",
        props: {
          currentLOOPType: config.loopType,
          onLOOPTypeChange: handlers.handleLOOPTypeChange,
          shadowColor: "30deg 75% 55%", // Orange shadow
          cardIndex: cardIndex++,
  
        },
        gridColumnSpan: loopColumnSpan,
      });

      // Add Start/End card in row 3 for circular mode
      if (hasStartEndCard) {
        cardList.push({
          id: "start-end",
          props: {
            currentOptions: handlers.startEndOptions,
            onOptionsChange: handlers.handleStartEndChange,
            isFreeformMode: false, // Circular mode - hide end position selector
            cardIndex: cardIndex++,
    
            positionsResetTrigger: handlers.positionsResetTrigger,
            gridMode: handlers.currentGridMode,
          },
          gridColumnSpan: 2, // Always 2 cols in circular mode row 3
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
          hasSettingsChanged,
          onGenerateClicked: handlers.handleGenerateClick,
          config,
          startEndOptions: handlers.startEndOptions,
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
