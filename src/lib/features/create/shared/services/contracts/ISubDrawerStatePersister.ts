/**
 * ISubDrawerStatePersister
 *
 * Persists sub-drawer state to sessionStorage for HMR survival.
 * Clears on tab close (session end).
 */

export type SubDrawerType =
  | "help"
  | "turnPattern"
  | "rotationDirection"
  | "duration"
  | "extend"
  | null;

export interface ISubDrawerStatePersister {
  /**
   * Get the currently active sub-drawer from storage
   */
  getActiveSubDrawer(): SubDrawerType;

  /**
   * Save the active sub-drawer to storage
   * Pass null to clear
   */
  setActiveSubDrawer(drawer: SubDrawerType): void;

  /**
   * Clear the stored sub-drawer state
   */
  clear(): void;
}
