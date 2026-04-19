import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface ViewerPlaybackState {
  animationState: AnimationPanelState;
  animationLoading: boolean;
  currentStep: number;
  isPlaying: boolean;
  currentLetter: Letter | null;
  currentStepData: StartPositionData | StepData | null;
  highlightedStepIndex: number | null;
}

export interface ImageCompositionProps {
  showWord: boolean;
  showStepNumbers: boolean;
  showDifficulty: boolean;
  showStartPos: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
  showQRCode: boolean;
  showMandala?: boolean;
  showLoopGlyph?: boolean;
  darkMode: boolean;
  columnCount: number | null;
  forceContain: boolean;
  userName: string;
}

export interface PropRenderingProps {
  bluePropType?: PropType;
  redPropType?: PropType;
  catDogModeEnabled?: boolean;
}

export interface ViewerLayoutState {
  isFullscreen: boolean;
  fullscreenStackVertical: boolean;
  isMobile: boolean;
  isLandscapeMobile?: boolean;
  focusedPane: "animation" | "image" | "video-upload" | null;
  /** When true, suppress pane close buttons (during export mode) */
  suppressCloseButton?: boolean;
}
