export interface OptionInteractionHintMarker {
  hasSeen(): boolean;
  markSeen(): void;
}

export interface OptionInteractionHintState {
  readonly isVisible: boolean;
  revealIfUnseen(): void;
  dismiss(): void;
}

export function createOptionInteractionHintState(
  marker: OptionInteractionHintMarker
): OptionInteractionHintState {
  let isVisible = $state(false);

  function revealIfUnseen() {
    if (!marker.hasSeen()) isVisible = true;
  }

  function dismiss() {
    if (!isVisible) return;
    isVisible = false;
    marker.markSeen();
  }

  return {
    get isVisible() {
      return isVisible;
    },
    revealIfUnseen,
    dismiss,
  };
}
