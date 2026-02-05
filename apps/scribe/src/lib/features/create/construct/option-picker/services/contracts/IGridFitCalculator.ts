/**
 * Option Grid Fit Calculator Service Interface
 *
 * Unified sizing service for the option picker. Calculates optimal
 * pictograph sizes to fit N items within container bounds.
 *
 * Consolidates:
 * - Pure grid fitting (calculateFitSize)
 * - Column layout optimization (calculateOptimalColumnLayout)
 * - Device-aware sizing (calculateDeviceAwareSize)
 *
 * Used by: OptionViewer456Group, OptionViewerSection, OptionPickerContent
 */

/**
 * Device-specific configuration for sizing calculations
 */
export interface DeviceConfig {
  padding: { horizontal: number; vertical: number };
  gap: number;
  minItemSize: number;
  maxItemSize: number;
  scaleFactor: number;
}

/**
 * Parameters for device-aware sizing (desktop option picker)
 */
export interface DeviceAwareSizingParams {
  /** Number of items to display */
  count: number;
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Number of columns */
  columns: number;
  /** Whether this is a mobile device */
  isMobileDevice: boolean;
}

/**
 * Result from device-aware sizing calculation
 */
export interface DeviceAwareSizingResult {
  /** Final pictograph size in pixels */
  pictographSize: number;
  /** Size as CSS string */
  pictographSizeString: string;
  /** Grid gap as CSS string */
  gridGap: string;
  /** Device config used */
  deviceConfig: DeviceConfig;
}

export interface GridFitParams {
  /** Total number of items to display */
  itemCount: number;
  /** Maximum columns to use */
  columnCount: number;
  /** Available width in pixels */
  availableWidth: number;
  /** Available height in pixels */
  availableHeight: number;
  /** Gap between items in pixels */
  gridGap: number;
  /** Maximum allowed size (will not exceed this) */
  maxSize: number;
  /** Minimum allowed size (will not go below this) */
  minSize?: number;
}

export interface GridFitResult {
  /** Calculated pictograph size in pixels */
  pictographSize: number;
  /** Actual columns used (may be less than requested if fewer items) */
  columns: number;
  /** Rows needed at this column count */
  rows: number;
  /** CSS grid-template-columns value */
  gridColumns: string;
}

export interface IOptionGridFitCalculator {
  /**
   * Calculate the optimal pictograph size to fit all items
   * within the given container dimensions.
   *
   * The algorithm:
   * 1. Determines actual columns (min of requested and item count)
   * 2. Calculates rows needed
   * 3. Computes max size that fits width constraint
   * 4. Computes max size that fits height constraint
   * 5. Returns the smaller of the two (clamped to min/max bounds)
   */
  calculateFitSize(params: GridFitParams): GridFitResult;

  /**
   * Compare multiple column layouts and return whichever
   * produces larger pictographs.
   *
   * Used when the goal is to maximize pictograph size regardless
   * of column count.
   */
  calculateOptimalColumnLayout(params: {
    itemCount: number;
    availableWidth: number;
    availableHeight: number;
    gridGap: number;
    maxSize: number;
    minSize?: number;
    /** Column counts to compare (default: [4, 8]) */
    columnOptions?: number[];
  }): GridFitResult;

  /**
   * Calculate pictograph size with device-specific constraints.
   *
   * Applies device-appropriate padding, gaps, and size limits.
   * Used by desktop option picker (OptionPickerContent).
   */
  calculateDeviceAwareSize(params: DeviceAwareSizingParams): DeviceAwareSizingResult;

  /**
   * Get the device configuration for a device type.
   */
  getDeviceConfig(deviceType: "mobile" | "tablet" | "desktop"): DeviceConfig;
}
