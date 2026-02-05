/**
 * Arrow Location Service Contract
 *
 * Determines arrow location based on start and end positions using the same logic
 * as the desktop app's ShiftLocationCalculator.
 */

export interface ArrowLocationInput {
  startLocation: string;
  endLocation: string;
  motionType: string;
}

export interface IArrowLocator {
  calculateArrowLocation(input: ArrowLocationInput): string;
}
