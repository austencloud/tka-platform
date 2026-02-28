import type { UIGenerationConfig } from "../../../state/generate-config.svelte";
import type {
  DifficultyLevel,
  GenerationMode,
  PropContinuity,
} from "../../domain/models/generate-models";
import type {
  LOOPType,
  SliceSize,
} from "../../../circular/domain/models/circular-models";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";

/**
 * Card descriptor for rendering in the UI
 * Contains all necessary information to render a specific card component
 */
export interface CardDescriptor {
  /** Unique identifier for the card (used as key in Svelte's each block) */
  id: string;
  /** Props to pass to the card component */
  props: Record<string, unknown>;
  /** Number of grid columns this card should span (1-6) */
  gridColumnSpan: number;
}

/**
 * Handlers for card interactions
 * Passed from parent component to wire up event callbacks
 */
export interface CardHandlers {
  handleLevelChange: (level: DifficultyLevel) => void;
  handleLengthChange: (length: number) => void;
  handleTurnIntensityChange: (intensity: number) => void;
  handlePropContinuityChange: (continuity: PropContinuity) => void;
  handleGridModeChange: (mode: GridMode) => void;
  handleGenerationModeChange: (mode: GenerationMode) => void;
  handleLOOPTypeChange: (loopType: LOOPType) => void;
  handleSliceSizeChange: (sliceSize: SliceSize) => void;
  handleStartEndChange?: (options: StartEndOptions) => void;
  handleGenerateClick?: () => Promise<void>;
  // Style card handlers
  handleConstraintPresetChange?: (v: "smooth" | "mixed" | "high-reversal") => void;
  handleHandPathModeChange?: (v: "smooth" | "mixed" | "high") => void;
  handleMotionTypeFilterChange?: (v: "no-dash" | "mixed" | "prefer-dash") => void;
  // Duration card handler
  handleOpenDurationPanel?: () => void;
  // Word input handlers (spell mode)
  wordInputValue?: string;
  handleWordInput?: (value: string) => void;
  handleWordSubmit?: () => void;
  // LOOP toggle handler
  handleLoopToggle?: () => void;
  // Start/End options (optional, for when start/end card is shown)
  startEndOptions?: StartEndOptions;
  // Trigger value that increments when positions are reset due to grid mode change
  positionsResetTrigger?: number;
  // Current grid mode for position picker filtering
  currentGridMode?: GridMode;
}

/**
 * Service for building card configuration arrays
 * Encapsulates the complex logic for determining which cards to display and how they should be laid out
 */
export interface ICardConfigurator {
  /**
   * Build an array of card descriptors based on current configuration
   * Handles conditional rendering logic (e.g., turn intensity only shown for non-beginner levels)
   * Calculates grid spans and responsive layouts
   *
   * @param config - Current generation configuration
   * @param currentLevel - Current difficulty level
   * @param isFreeformMode - Whether in freeform mode (vs circular mode)
   * @param handlers - Event handlers for card interactions
   * @param allowedIntensityValues - Allowed turn intensity values for current level
   * @param isGenerating - Whether generation is currently in progress
   * @returns Array of card descriptors ready for rendering
   */
  buildCardDescriptors(
    config: UIGenerationConfig,
    currentLevel: DifficultyLevel,
    isFreeformMode: boolean,
    handlers: CardHandlers,
    allowedIntensityValues: number[],
    isGenerating?: boolean,
    hasSettingsChanged?: boolean,
    loopEnabled?: boolean
  ): CardDescriptor[];
}
