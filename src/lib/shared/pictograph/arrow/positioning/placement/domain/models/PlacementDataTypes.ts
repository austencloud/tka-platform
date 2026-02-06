/**
 * Arrow Placement Data Types
 *
 * Domain models for arrow placement data structures.
 */

/**
 * JSON structure for placement data loaded from files
 */
export interface JsonPlacementData {
  [motionType: string]: {
    [placementKey: string]: {
      [turns: string]: [number, number] | null;
    };
  };
}

/**
 * Grid-specific placement data
 */
export interface GridPlacementData {
  [motionType: string]: {
    [placementKey: string]: {
      [turns: string]: [number, number];
    };
  };
}

/**
 * Complete placement data for all grid modes
 */
export interface AllPlacementData {
  [key: string]: GridPlacementData;
}
