/**
 * Create Module Panel Coordination State Factory
 *
 * Manages panel state for CreateModule's construction interface using Svelte 5 runes pattern.
 * Coordinates Edit Panel, Animation Panel, and Tool Panel interactions.
 *
 * **PANEL MUTUAL EXCLUSIVITY RULES:**
 * - Only ONE modal/slide panel can be open at a time
 * - Opening any panel automatically closes all other panels
 * - Panels: Edit, Animation, Share, Filter, LOOP, CreationMethod
 *
 * **PERSISTED PANEL STATES:**
 * - Sequence Actions Panel: open/closed state and mode (turns/transforms)
 * - Video Record Panel: open/closed state
 * - Share Hub Panel: open/closed state
 * Other panels reset on page refresh for predictable UX.
 *
 * Domain: Create module - Panel State Management for Sequence Construction
 * Extracted from CreateModule.svelte monolith to follow runes state management pattern.
 */

import type { BeatData } from "../domain/models/BeatData";
import type { LOOPType } from "../../generate/circular/domain/models/circular-models";
import type { LOOPComponent } from "../../generate/shared/domain/models/generate-models";
import type { PictographData } from "../../../../shared/pictograph/shared/domain/models/PictographData";
import type { Letter } from "../../../../shared/foundation/domain/models/Letter";
import { GridMode } from "../../../../shared/pictograph/grid/domain/enums/grid-enums";
import { createPersistenceHelper } from "../../../../shared/state/utils/persistent-state";

/**
 * Target hand for transforms - which hand(s) to apply operations to
 */
export type TargetHand = "blue" | "red" | "both";

// ============================================================================
// PERSISTENCE HELPERS
// ============================================================================

const sequenceActionsPanelPersistence = createPersistenceHelper({
  key: "tka_sequence_actions_panel_open",
  defaultValue: false,
});

const videoRecordPanelPersistence = createPersistenceHelper({
  key: "tka_video_record_panel_open",
  defaultValue: false,
});

const shareHubPanelPersistence = createPersistenceHelper({
  key: "tka_share_hub_panel_open",
  defaultValue: false,
});

/**
 * Customize generation options - passed to the customize options sheet
 */
export interface CustomizeOptions {
  startPosition: PictographData | null;
  endPosition: PictographData | null;
  mustContainLetters: Letter[];
  mustNotContainLetters: Letter[];
}

export interface PanelCoordinationState {
  // Shift Start Mode State
  get isShiftStartMode(): boolean;
  get shiftStartHandler(): ((beatNumber: number) => void) | null;

  enterShiftStartMode(handler: (beatNumber: number) => void): void;
  exitShiftStartMode(): void;

  // Edit Panel State
  get isEditPanelOpen(): boolean;
  get editPanelBeatIndex(): number | null;
  get editPanelBeatData(): BeatData | null;
  get editPanelBeatsData(): BeatData[];

  openEditPanel(beatIndex: number, beatData: BeatData): void;
  openBatchEditPanel(beatsData: BeatData[]): void;
  closeEditPanel(): void;

  // Animation Panel State
  get isAnimationPanelOpen(): boolean;
  set isAnimationPanelOpen(value: boolean);
  get isAnimating(): boolean;

  openAnimationPanel(): void;
  closeAnimationPanel(): void;
  setAnimating(animating: boolean): void;

  // Sequence Transform Animation State
  get shouldOrbitAroundCenter(): boolean;

  triggerOrbitAnimation(): void;

  // Share Hub Panel State (Multi-format sharing)
  get isShareHubPanelOpen(): boolean;
  get requestedShareHubFormat(): "animation" | "static" | null;

  openShareHubPanel(format?: "animation" | "static"): void;
  closeShareHubPanel(): void;
  clearRequestedShareHubFormat(): void;

  // Save to Library Panel State
  get isSaveToLibraryPanelOpen(): boolean;

  openSaveToLibraryPanel(): void;
  closeSaveToLibraryPanel(): void;

  // Video Record Panel State
  get isVideoRecordPanelOpen(): boolean;
  set isVideoRecordPanelOpen(value: boolean);

  openVideoRecordPanel(): void;
  closeVideoRecordPanel(): void;

  // Filter Panel State
  get isFilterPanelOpen(): boolean;

  openFilterPanel(): void;
  closeFilterPanel(): void;

  // Sequence Actions Panel State
  get isSequenceActionsPanelOpen(): boolean;

  openSequenceActionsPanel(): void;
  closeSequenceActionsPanel(): void;

  // Target Hand Selection (for single-hand transforms)
  get targetHand(): TargetHand;
  setTargetHand(hand: TargetHand): void;

  // Beat Editor Panel State (non-modal - allows click-through to pictographs)
  get isBeatEditorPanelOpen(): boolean;

  openBeatEditorPanel(): void;
  closeBeatEditorPanel(): void;

  // Tool Panel Dimensions (for sizing other panels)
  get toolPanelHeight(): number;
  setToolPanelHeight(height: number): void;

  get toolPanelWidth(): number;
  setToolPanelWidth(width: number): void;

  // Button Panel Height (for accurate slide panel positioning)
  get buttonPanelHeight(): number;
  setButtonPanelHeight(height: number): void;

  // Navigation bar height (responsive to bottom nav safe areas)
  get navigationBarHeight(): number;
  setNavigationBarHeight(height: number): void;

  // Combined height for slide panels (tool + button)
  get combinedPanelHeight(): number;

  // Practice Mode
  get practiceBeatIndex(): number | null;
  setPracticeBeatIndex(index: number | null): void;

  // LOOP Panel State
  get isLOOPPanelOpen(): boolean;
  get loopSelectedComponents(): Set<LOOPComponent> | null;
  get loopCurrentType(): LOOPType | null;
  get loopOnChange(): ((loopType: LOOPType) => void) | null;

  openLOOPPanel(
    currentType: LOOPType,
    selectedComponents: Set<LOOPComponent>,
    onChange: (loopType: LOOPType) => void
  ): void;
  closeLOOPPanel(): void;

  // Creation Method Panel State
  get isCreationMethodPanelOpen(): boolean;

  openCreationMethodPanel(): void;
  closeCreationMethodPanel(): void;

  // Customize Options Panel State
  get isCustomizePanelOpen(): boolean;
  get customizeOptions(): CustomizeOptions | null;
  get customizeOnChange(): ((options: CustomizeOptions) => void) | null;
  get customizeIsFreeformMode(): boolean;
  get customizeGridMode(): GridMode;

  openCustomizePanel(
    currentOptions: CustomizeOptions,
    onChange: (options: CustomizeOptions) => void,
    isFreeformMode?: boolean,
    gridMode?: GridMode
  ): void;
  closeCustomizePanel(): void;

  // Close all panels at once (for clear sequence, etc.)
  closeAllPanels(): void;

  // Derived: Any Panel Open (for UI hiding coordination)
  get isAnyPanelOpen(): boolean;
}

export function createPanelCoordinationState(): PanelCoordinationState {
  // Shift start mode state
  let isShiftStartMode = $state(false);
  let shiftStartHandler = $state<((beatNumber: number) => void) | null>(null);

  // Edit panel state
  let isEditPanelOpen = $state(false);
  let editPanelBeatIndex = $state<number | null>(null);
  let editPanelBeatData = $state<BeatData | null>(null);
  let editPanelBeatsData = $state<BeatData[]>([]);

  // Animation panel state
  let isAnimationPanelOpen = $state(false);
  let isAnimating = $state(false);

  // Sequence transform animation state
  let shouldOrbitAroundCenter = $state(false);
  let orbitAnimationTimeout: ReturnType<typeof setTimeout> | null = null;

  // Share Hub panel state (Multi-format sharing - persisted)
  let isShareHubPanelOpen = $state(shareHubPanelPersistence.load());
  let requestedShareHubFormat = $state<"animation" | "static" | null>(null);

  // Save to Library panel state
  let isSaveToLibraryPanelOpen = $state(false);

  // Video record panel state (persisted)
  let isVideoRecordPanelOpen = $state(videoRecordPanelPersistence.load());

  // Filter panel state
  let isFilterPanelOpen = $state(false);

  // Sequence Actions panel state (persisted)
  let isSequenceActionsPanelOpen = $state(
    sequenceActionsPanelPersistence.load()
  );

  // Target hand selection for single-hand transforms (default: both)
  let targetHand = $state<TargetHand>("both");

  // Beat Editor panel state (non-modal - doesn't participate in closeAllPanels)
  let isBeatEditorPanelOpen = $state(false);

  // Auto-save panel open states
  $effect.root(() => {
    $effect(() => {
      void isVideoRecordPanelOpen;
      videoRecordPanelPersistence.setupAutoSave(isVideoRecordPanelOpen);
    });

    $effect(() => {
      void isSequenceActionsPanelOpen;
      sequenceActionsPanelPersistence.setupAutoSave(isSequenceActionsPanelOpen);
    });

    $effect(() => {
      void isShareHubPanelOpen;
      shareHubPanelPersistence.setupAutoSave(isShareHubPanelOpen);
    });
  });

  // Tool panel dimensions tracking
  let toolPanelHeight = $state(0);
  let toolPanelWidth = $state(0);

  // Button panel height tracking
  let buttonPanelHeight = $state(0);

  // Navigation bar height tracking (default to 64px)
  let navigationBarHeight = $state(64);

  // Practice mode
  let practiceBeatIndex = $state<number | null>(null);

  // LOOP panel state
  let isLOOPPanelOpen = $state(false);
  let loopSelectedComponents = $state<Set<LOOPComponent> | null>(null);
  let loopCurrentType = $state<LOOPType | null>(null);
  let loopOnChange = $state<((loopType: LOOPType) => void) | null>(null);

  // Creation method panel state
  let isCreationMethodPanelOpen = $state(false);

  // Customize options panel state
  let isCustomizePanelOpen = $state(false);
  let customizeOptions = $state<CustomizeOptions | null>(null);
  let customizeOnChange = $state<((options: CustomizeOptions) => void) | null>(
    null
  );
  let customizeIsFreeformMode = $state(true); // Default to freeform (shows end position)
  let customizeGridMode = $state<GridMode>(GridMode.DIAMOND); // Grid mode for position picker

  /**
   * CRITICAL: Close all panels to enforce mutual exclusivity
   * This ensures only ONE panel is open at a time, preventing state conflicts
   */
  function closeAllPanels() {
    // Exit shift start mode
    isShiftStartMode = false;
    shiftStartHandler = null;

    // Close all modal/slide panels
    isEditPanelOpen = false;
    editPanelBeatIndex = null;
    editPanelBeatData = null;
    editPanelBeatsData = [];

    isAnimationPanelOpen = false;
    isAnimating = false;

    isShareHubPanelOpen = false;
    requestedShareHubFormat = null;
    isSaveToLibraryPanelOpen = false;
    isVideoRecordPanelOpen = false;
    isFilterPanelOpen = false;
    isSequenceActionsPanelOpen = false;
    isBeatEditorPanelOpen = false;

    isLOOPPanelOpen = false;
    loopSelectedComponents = null;
    loopCurrentType = null;
    loopOnChange = null;

    isCreationMethodPanelOpen = false;

    isCustomizePanelOpen = false;
    customizeOptions = null;
    customizeOnChange = null;
    customizeIsFreeformMode = true;
    customizeGridMode = GridMode.DIAMOND;
  }

  return {
    // Shift Start Mode Getters
    get isShiftStartMode() {
      return isShiftStartMode;
    },
    get shiftStartHandler() {
      return shiftStartHandler;
    },

    enterShiftStartMode(handler: (beatNumber: number) => void) {
      isShiftStartMode = true;
      shiftStartHandler = handler;
    },

    exitShiftStartMode() {
      isShiftStartMode = false;
      shiftStartHandler = null;
    },

    // Edit Panel Getters
    get isEditPanelOpen() {
      return isEditPanelOpen;
    },
    get editPanelBeatIndex() {
      return editPanelBeatIndex;
    },
    get editPanelBeatData() {
      return editPanelBeatData;
    },
    get editPanelBeatsData() {
      return editPanelBeatsData;
    },

    openEditPanel(beatIndex: number, beatData: BeatData) {
      closeAllPanels();
      editPanelBeatIndex = beatIndex;
      editPanelBeatData = beatData;
      editPanelBeatsData = [];
      isEditPanelOpen = true;
    },

    openBatchEditPanel(beatsData: BeatData[]) {
      closeAllPanels();
      editPanelBeatsData = beatsData;
      editPanelBeatIndex = null;
      editPanelBeatData = null;
      isEditPanelOpen = true;
    },

    closeEditPanel() {
      isEditPanelOpen = false;
      editPanelBeatIndex = null;
      editPanelBeatData = null;
      editPanelBeatsData = [];
    },

    // Animation Panel Getters
    get isAnimationPanelOpen() {
      return isAnimationPanelOpen;
    },
    set isAnimationPanelOpen(value: boolean) {
      isAnimationPanelOpen = value;
    },
    get isAnimating() {
      return isAnimating;
    },

    openAnimationPanel() {
      closeAllPanels();
      isAnimationPanelOpen = true;
    },

    closeAnimationPanel() {
      isAnimationPanelOpen = false;
    },

    setAnimating(animating: boolean) {
      isAnimating = animating;
    },

    // Sequence Transform Animation Getters
    get shouldOrbitAroundCenter() {
      return shouldOrbitAroundCenter;
    },

    triggerOrbitAnimation() {
      // Clear any existing timeout
      if (orbitAnimationTimeout) {
        clearTimeout(orbitAnimationTimeout);
      }

      // Set flag to true to enable arc-based prop animation
      shouldOrbitAroundCenter = true;

      // Auto-reset after animation completes (200ms to match grid rotation)
      orbitAnimationTimeout = setTimeout(() => {
        shouldOrbitAroundCenter = false;
      }, 200);
    },

    // Share Hub Panel Getters
    get isShareHubPanelOpen() {
      return isShareHubPanelOpen;
    },
    get requestedShareHubFormat() {
      return requestedShareHubFormat;
    },

    openShareHubPanel(format?: "animation" | "static") {
      closeAllPanels();
      requestedShareHubFormat = format ?? null;
      isShareHubPanelOpen = true;
    },

    closeShareHubPanel() {
      isShareHubPanelOpen = false;
      requestedShareHubFormat = null;
    },

    clearRequestedShareHubFormat() {
      requestedShareHubFormat = null;
    },

    // Save to Library Panel Getters
    get isSaveToLibraryPanelOpen() {
      return isSaveToLibraryPanelOpen;
    },

    openSaveToLibraryPanel() {
      closeAllPanels();
      isSaveToLibraryPanelOpen = true;
    },

    closeSaveToLibraryPanel() {
      isSaveToLibraryPanelOpen = false;
    },

    // Video Record Panel Getters
    get isVideoRecordPanelOpen() {
      return isVideoRecordPanelOpen;
    },
    set isVideoRecordPanelOpen(value: boolean) {
      if (value) {
        // Opening should respect mutual exclusivity rules
        closeAllPanels();
      }

      isVideoRecordPanelOpen = value;
    },

    openVideoRecordPanel() {
      closeAllPanels();
      isVideoRecordPanelOpen = true;
    },

    closeVideoRecordPanel() {
      isVideoRecordPanelOpen = false;
    },

    // Filter Panel Getters
    get isFilterPanelOpen() {
      return isFilterPanelOpen;
    },

    openFilterPanel() {
      closeAllPanels();
      isFilterPanelOpen = true;
    },

    closeFilterPanel() {
      isFilterPanelOpen = false;
    },

    // Sequence Actions Panel Getters
    get isSequenceActionsPanelOpen() {
      return isSequenceActionsPanelOpen;
    },

    openSequenceActionsPanel() {
      console.log(
        `[panel-coordination] openSequenceActionsPanel called, current state: ${isSequenceActionsPanelOpen}`
      );
      // Only close other panels if this panel isn't already open
      // This prevents the panel from closing when beat operations update state
      if (!isSequenceActionsPanelOpen) {
        console.log(
          `[panel-coordination] Panel not open, closing other panels`
        );
        closeAllPanels();
      } else {
        console.log(
          `[panel-coordination] Panel already open, skipping closeAllPanels`
        );
      }
      isSequenceActionsPanelOpen = true;
      console.log(
        `[panel-coordination] Panel now open: ${isSequenceActionsPanelOpen}`
      );
    },

    closeSequenceActionsPanel() {
      console.log(
        `[panel-coordination] closeSequenceActionsPanel called, stack:`,
        new Error().stack
      );
      isSequenceActionsPanelOpen = false;
    },

    // Target Hand Selection
    get targetHand() {
      return targetHand;
    },

    setTargetHand(hand: TargetHand) {
      targetHand = hand;
    },

    // Beat Editor Panel Getters (non-modal)
    get isBeatEditorPanelOpen() {
      return isBeatEditorPanelOpen;
    },

    openBeatEditorPanel() {
      // Beat Editor is non-modal - it does NOT close other panels
      // This allows the user to click on pictographs while the panel is open
      isBeatEditorPanelOpen = true;
    },

    closeBeatEditorPanel() {
      isBeatEditorPanelOpen = false;
    },

    // Tool Panel Dimensions
    get toolPanelHeight() {
      return toolPanelHeight;
    },

    setToolPanelHeight(height: number) {
      toolPanelHeight = height;
    },

    get toolPanelWidth() {
      return toolPanelWidth;
    },

    setToolPanelWidth(width: number) {
      toolPanelWidth = width;
    },

    // Button Panel Height
    get buttonPanelHeight() {
      return buttonPanelHeight;
    },

    setButtonPanelHeight(height: number) {
      buttonPanelHeight = height;
    },

    // Navigation Bar Height
    get navigationBarHeight() {
      return navigationBarHeight;
    },

    setNavigationBarHeight(height: number) {
      navigationBarHeight = height > 0 ? height : 64;
    },

    // Combined Height (navigation bar + tool + button panels)
    // Navigation bar is 64px (min-height from MobileNavigation.svelte)
    get combinedPanelHeight() {
      return navigationBarHeight + toolPanelHeight + buttonPanelHeight;
    },

    // Practice Mode
    get practiceBeatIndex() {
      return practiceBeatIndex;
    },

    setPracticeBeatIndex(index: number | null) {
      practiceBeatIndex = index;
    },

    // LOOP Panel Getters
    get isLOOPPanelOpen() {
      return isLOOPPanelOpen;
    },
    get loopSelectedComponents() {
      return loopSelectedComponents;
    },
    get loopCurrentType() {
      return loopCurrentType;
    },
    get loopOnChange() {
      return loopOnChange;
    },

    openLOOPPanel(
      currentType: LOOPType,
      selectedComponents: Set<LOOPComponent>,
      onChange: (loopType: LOOPType) => void
    ) {
      closeAllPanels();
      loopCurrentType = currentType;
      loopSelectedComponents = selectedComponents;
      loopOnChange = onChange;
      isLOOPPanelOpen = true;
    },

    closeLOOPPanel() {
      isLOOPPanelOpen = false;
      loopCurrentType = null;
      loopSelectedComponents = null;
      loopOnChange = null;
    },

    // Creation Method Panel Getters
    get isCreationMethodPanelOpen() {
      return isCreationMethodPanelOpen;
    },

    openCreationMethodPanel() {
      closeAllPanels();
      isCreationMethodPanelOpen = true;
    },

    closeCreationMethodPanel() {
      isCreationMethodPanelOpen = false;
    },

    // Customize Options Panel Getters
    get isCustomizePanelOpen() {
      return isCustomizePanelOpen;
    },
    get customizeOptions() {
      return customizeOptions;
    },
    get customizeOnChange() {
      return customizeOnChange;
    },
    get customizeIsFreeformMode() {
      return customizeIsFreeformMode;
    },
    get customizeGridMode() {
      return customizeGridMode;
    },

    openCustomizePanel(
      currentOptions: CustomizeOptions,
      onChange: (options: CustomizeOptions) => void,
      isFreeformMode: boolean = true,
      gridMode: GridMode = GridMode.DIAMOND
    ) {
      closeAllPanels();
      customizeOptions = currentOptions;
      customizeOnChange = onChange;
      customizeIsFreeformMode = isFreeformMode;
      customizeGridMode = gridMode;
      isCustomizePanelOpen = true;
    },

    closeCustomizePanel() {
      isCustomizePanelOpen = false;
      customizeOptions = null;
      customizeOnChange = null;
      customizeIsFreeformMode = true;
      customizeGridMode = GridMode.DIAMOND;
    },

    // Close all panels at once
    closeAllPanels,

    // Derived: Check if any modal/slide panel is open
    // NOTE: Creation Method Panel is NOT included here because it should not hide navigation tabs
    get isAnyPanelOpen() {
      return (
        isEditPanelOpen ||
        isAnimationPanelOpen ||
        isShareHubPanelOpen ||
        isSaveToLibraryPanelOpen ||
        isVideoRecordPanelOpen ||
        isFilterPanelOpen ||
        isSequenceActionsPanelOpen ||
        isLOOPPanelOpen ||
        isCustomizePanelOpen
      );
    },
  };
}
