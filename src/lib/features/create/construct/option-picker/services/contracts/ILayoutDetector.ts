/**
 * Layout configuration object
 */
export type LayoutConfig = {
  containerWidth: number;
  optionsPerRow?: number;
  [key: string]: unknown;
};

/**
 * Service for detecting optimal layout based on device and content
 */
export interface ILayoutDetector {
  /**
   * Determines if horizontal swipe layout should be used
   * @param layoutConfig - Current layout configuration
   * @param sectionCount - Number of sections to display
   * @param enableHorizontalSwipe - Whether horizontal swipe is enabled
   * @returns Whether to use horizontal swipe layout
   */
  shouldUseHorizontalSwipe(
    layoutConfig: LayoutConfig | null | undefined,
    sectionCount: number,
    enableHorizontalSwipe: boolean
  ): boolean;

  /**
   * Calculates optimal layout parameters for current device
   * @param containerWidth - Available container width
   * @param sectionCount - Number of sections
   * @returns Layout parameters
   */
  calculateLayoutParameters(
    containerWidth: number,
    sectionCount: number
  ): {
    useSwipe: boolean;
    optionsPerRow: number;
    hasLimitedColumns: boolean;
    isNarrowScreen: boolean;
  };
}
