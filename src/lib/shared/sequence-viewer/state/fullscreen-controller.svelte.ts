import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

export interface FullscreenControllerDeps {
  getHapticService: () => HapticFeedback | null;
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

export function createFullscreenController(deps: FullscreenControllerDeps) {
  let isFullscreen = $state(false);
  let fullscreenControlsVisible = $state(false);
  let controlsHideTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearControlsTimeout() {
    if (controlsHideTimeout) {
      clearTimeout(controlsHideTimeout);
      controlsHideTimeout = null;
    }
  }

  function scheduleControlsHide() {
    clearControlsTimeout();
    controlsHideTimeout = setTimeout(() => {
      fullscreenControlsVisible = false;
    }, 3000);
  }

  function showFullscreenControls() {
    fullscreenControlsVisible = true;
    scheduleControlsHide();
  }

  function enterFullscreen() {
    deps.getHapticService()?.trigger("selection");
    isFullscreen = true;
    showFullscreenControls();
    deps.announce("Fullscreen mode. Tap to show controls, press Escape to exit.", "assertive");
  }

  function exitFullscreen() {
    deps.getHapticService()?.trigger("selection");
    isFullscreen = false;
    fullscreenControlsVisible = false;
    clearControlsTimeout();
    deps.announce("Exited fullscreen");
  }

  function handleFullscreenTap() {
    if (isFullscreen && !fullscreenControlsVisible) {
      showFullscreenControls();
    }
  }

  return {
    get isFullscreen() { return isFullscreen; },
    set isFullscreen(v: boolean) { isFullscreen = v; },
    get fullscreenControlsVisible() { return fullscreenControlsVisible; },
    enterFullscreen,
    exitFullscreen,
    handleFullscreenTap,
    clearControlsTimeout,
  };
}
