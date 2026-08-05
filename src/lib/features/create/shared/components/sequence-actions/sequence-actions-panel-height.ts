const DRILLDOWN_HEIGHT_BONUS = 48;
const MAXIMUM_MINIMUM_WORKSPACE_HEIGHT = 280;
const MINIMUM_WORKSPACE_RATIO = 0.42;

interface PanelHeightInput {
  basePanelHeight: number;
  viewportHeight: number;
  workspaceContext: boolean;
  hasDrilldown: boolean;
}

/**
 * A drill-down gets one additional control row while the sequence keeps a
 * useful workspace band above it. The base height is already the product's
 * measured controls footprint, so constrained viewports never shrink below it.
 */
export function getSequenceActionsPanelHeight({
  basePanelHeight,
  viewportHeight,
  workspaceContext,
  hasDrilldown,
}: PanelHeightInput): number {
  if (!workspaceContext || !hasDrilldown) return basePanelHeight;

  const minimumWorkspaceHeight = Math.min(
    MAXIMUM_MINIMUM_WORKSPACE_HEIGHT,
    viewportHeight * MINIMUM_WORKSPACE_RATIO
  );
  const maximumDrawerHeight = Math.max(
    basePanelHeight,
    viewportHeight - minimumWorkspaceHeight
  );

  return Math.min(
    basePanelHeight + DRILLDOWN_HEIGHT_BONUS,
    maximumDrawerHeight
  );
}
