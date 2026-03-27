/**
 * User Proportions State
 *
 * Reactive state for user's physical measurements.
 * Automatically calculates derived scene dimensions when inputs change.
 */

import {
  type UserProportions,
  type DerivedSceneDimensions,
  calculateSceneDimensions,
  DEFAULT_USER_PROPORTIONS,
  feetInchesToCm,
  inchesToCm,
} from "../config/user-proportions";

/**
 * Reactive user proportions state
 */
class UserProportionsState {
  // User inputs
  private _heightCm = $state(DEFAULT_USER_PROPORTIONS.heightCm);
  private _staffLengthCm = $state(DEFAULT_USER_PROPORTIONS.staffLengthCm);
  private _build = $state<UserProportions["build"]>(
    DEFAULT_USER_PROPORTIONS.build
  );

  // Derived dimensions (automatically recalculated)
  private _dimensions = $derived(
    calculateSceneDimensions({
      heightCm: this._heightCm,
      staffLengthCm: this._staffLengthCm,
      build: this._build,
    })
  );

  // Getters for current values
  get heightCm(): number {
    return this._heightCm;
  }

  get staffLengthCm(): number {
    return this._staffLengthCm;
  }

  get build(): UserProportions["build"] {
    return this._build;
  }

  get dimensions(): DerivedSceneDimensions {
    return this._dimensions;
  }

  // Convenience getters for common dimensions
  get staffLength(): number {
    return this._dimensions.staffLength;
  }

  get handPointRadius(): number {
    return this._dimensions.handPointRadius;
  }

  get outerPointRadius(): number {
    return this._dimensions.outerPointRadius;
  }

  get gridSize(): number {
    return this._dimensions.gridSize;
  }

  get avatarScale(): number {
    return this._dimensions.avatarScale;
  }

  get groundY(): number {
    return this._dimensions.groundY;
  }

  // Setters
  setHeightCm(cm: number): void {
    this._heightCm = Math.max(100, Math.min(250, cm)); // Clamp to reasonable range
  }

  setHeightFeetInches(feet: number, inches: number = 0): void {
    this.setHeightCm(feetInchesToCm(feet, inches));
  }

  setStaffLengthCm(cm: number): void {
    this._staffLengthCm = Math.max(30, Math.min(200, cm)); // Clamp to reasonable range
  }

  setStaffLengthInches(inches: number): void {
    this.setStaffLengthCm(inchesToCm(inches));
  }

  setBuild(build: UserProportions["build"]): void {
    this._build = build;
  }

  // Set all at once
  setProportions(props: Partial<UserProportions>): void {
    if (props.heightCm !== undefined) this.setHeightCm(props.heightCm);
    if (props.staffLengthCm !== undefined)
      this.setStaffLengthCm(props.staffLengthCm);
    if (props.build !== undefined) this.setBuild(props.build);
  }

  // Reset to defaults
  reset(): void {
    this._heightCm = DEFAULT_USER_PROPORTIONS.heightCm;
    this._staffLengthCm = DEFAULT_USER_PROPORTIONS.staffLengthCm;
    this._build = DEFAULT_USER_PROPORTIONS.build;
  }

  // Get current proportions as object (for persistence)
  getProportions(): UserProportions {
    return {
      heightCm: this._heightCm,
      staffLengthCm: this._staffLengthCm,
      build: this._build,
    };
  }

  // Display helpers
  get heightDisplay(): string {
    const totalInches = this._heightCm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }

  get staffLengthDisplay(): string {
    const inches = Math.round(this._staffLengthCm / 2.54);
    return `${inches}"`;
  }
}

// Singleton instance
export const userProportionsState = new UserProportionsState();
