/**
 * Arrow Placement Data Types
 *
 * Domain models for arrow placement data structures.
 */

export interface JsonPlacementData {
  [motionType: string]: {
    [placementKey: string]: {
      [turns: string]: [number, number] | null;
    };
  };
}

export interface GridPlacementData {
  [motionType: string]: {
    [placementKey: string]: {
      [turns: string]: [number, number];
    };
  };
}

export interface AllPlacementData {
  [key: string]: GridPlacementData;
}
