/**
 * Global prop drawer state
 *
 * Shared reactive state for the prop selection drawer.
 * Used by PropIndicatorButton (to open) and keyboard shortcuts (P key to toggle).
 * The actual PropSelectionSheet is mounted at the CreateModule level
 * to avoid stacking context issues with the workspace panel.
 */

let isOpen = $state(false);

export const propDrawerState = {
  get isOpen() {
    return isOpen;
  },
  set isOpen(value: boolean) {
    isOpen = value;
  },
  open() {
    isOpen = true;
  },
  close() {
    isOpen = false;
  },
  toggle() {
    isOpen = !isOpen;
  },
};
