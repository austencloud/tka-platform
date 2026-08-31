export type ViewerPanelDirection = "horizontal" | "vertical";
export type ViewerFocusedPane = "animation" | "image" | null;

export interface ViewerPanelLayoutInput {
  isFullscreen: boolean;
  fullscreenStackVertical: boolean;
  isMobile: boolean;
  isLandscapeMobile: boolean;
  adaptiveVerticalSplit: boolean;
  focusedPane: ViewerFocusedPane;
  practiceActive: boolean;
  practiceCanvasFraction: number;
}

export interface ViewerPanelLayout {
  direction: ViewerPanelDirection;
  sizes: [number, number];
  previewPreferredSize?: string;
}

interface ViewerPanelDirectionInput {
  responsiveDirection: ViewerPanelDirection;
  retainedSplitDirection: ViewerPanelDirection | null;
  focusedPane: ViewerFocusedPane;
  focusReleasePending: boolean;
}

export const MIN_VIEWER_PANE_REVEAL_SIZE = 240;

/**
 * A focused workspace only has one readable pane, so changing its split axis
 * carries no useful information. Keep the last real Side-by-Side axis through
 * focus and its release; otherwise an outer inspector can make the temporary
 * stage portrait-shaped and turn a horizontal return into a vertical squeeze.
 */
export function resolveViewerPanelDirection(
  input: ViewerPanelDirectionInput
): ViewerPanelDirection {
  if (
    input.retainedSplitDirection &&
    (input.focusedPane !== null || input.focusReleasePending)
  ) {
    return input.retainedSplitDirection;
  }
  return input.responsiveDirection;
}

export function isViewerPaneReadyToReveal(
  _direction: ViewerPanelDirection,
  width: number,
  height: number
): boolean {
  // A panel can have plenty of room along the split axis while an outer dock
  // transition briefly leaves it only a few pixels on the cross axis. Both
  // dimensions must describe a readable surface before its opacity rises.
  return (
    width >= MIN_VIEWER_PANE_REVEAL_SIZE &&
    height >= MIN_VIEWER_PANE_REVEAL_SIZE
  );
}

interface ViewerPaneRevealInput {
  pane: Exclude<ViewerFocusedPane, null>;
  focusedPane: ViewerFocusedPane;
  direction: ViewerPanelDirection;
  width: number;
  height: number;
}

/**
 * A focused pane owns the full stage and the covered pane stays invisible.
 * Split mode reveals either pane only while its current two-dimensional
 * geometry is readable.
 */
export function resolveViewerPaneRevealReady(
  input: ViewerPaneRevealInput
): boolean {
  if (input.focusedPane === input.pane) return true;
  if (input.focusedPane !== null) return false;
  return isViewerPaneReadyToReveal(input.direction, input.width, input.height);
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * Resolve the two pane allocations before the workspace moves. Keeping this
 * decision atomic prevents a responsive direction change and a mode change
 * from briefly describing two different layouts to the mounted canvases.
 */
export function resolveViewerPanelLayout(
  input: ViewerPanelLayoutInput
): ViewerPanelLayout {
  if (input.practiceActive) {
    const direction: ViewerPanelDirection =
      input.isMobile && !input.isLandscapeMobile ? "vertical" : "horizontal";
    if (direction === "vertical") {
      return {
        direction,
        sizes: [1, 1],
        previewPreferredSize: "auto",
      };
    }

    const canvasFraction = clampFraction(input.practiceCanvasFraction);
    return {
      direction,
      sizes: [canvasFraction, 1 - canvasFraction],
    };
  }

  const direction: ViewerPanelDirection = input.isFullscreen
    ? input.fullscreenStackVertical
      ? "vertical"
      : "horizontal"
    : input.isLandscapeMobile ||
        (!input.isMobile && !input.adaptiveVerticalSplit)
      ? "horizontal"
      : "vertical";

  if (input.focusedPane === "animation") {
    return { direction, sizes: [1, 0] };
  }

  if (input.focusedPane === "image") {
    return { direction, sizes: [0, 1] };
  }

  return { direction, sizes: [1, 1] };
}
