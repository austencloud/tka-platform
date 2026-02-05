/**
 * Global Adjustment Version State
 *
 * A simple reactive counter that increments when global adjustments change.
 * Components can depend on this to re-render when adjustments are saved.
 */

// Reactive version counter
let _version = $state(0);

export const globalAdjustmentVersion = {
  /**
   * Get the current version number.
   * Components that read this will re-render when it changes.
   */
  get version() {
    return _version;
  },

  /**
   * Increment the version to trigger re-renders.
   * Call this after saving/deleting global adjustments.
   */
  increment() {
    _version++;
  },
};
