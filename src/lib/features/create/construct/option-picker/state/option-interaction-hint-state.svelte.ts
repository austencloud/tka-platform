export interface OptionInteractionHintMarker {
  hasSeen(): boolean;
  markSeen(): void;
}

export type OptionInteractionHintPresentation = "anchored" | "workspace-banner";

export interface OptionInteractionHintState {
  readonly isVisible: boolean;
  readonly presentation: OptionInteractionHintPresentation;
  revealIfUnseen(): void;
  dismiss(): void;
  setPresentation(presentation: OptionInteractionHintPresentation): void;
}

export function createOptionInteractionHintState(
  marker: OptionInteractionHintMarker
): OptionInteractionHintState {
  let isVisible = $state(false);
  let presentation = $state<OptionInteractionHintPresentation>("anchored");

  function revealIfUnseen() {
    if (!marker.hasSeen()) isVisible = true;
  }

  function dismiss() {
    if (!isVisible) return;
    isVisible = false;
    marker.markSeen();
  }

  function setPresentation(
    nextPresentation: OptionInteractionHintPresentation
  ) {
    presentation = nextPresentation;
  }

  return {
    get isVisible() {
      return isVisible;
    },
    get presentation() {
      return presentation;
    },
    revealIfUnseen,
    dismiss,
    setPresentation,
  };
}
