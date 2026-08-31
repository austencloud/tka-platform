/**
 * Selected Arrow State
 *
 * Manages the currently selected arrow in the pictograph adjustment editor.
 * Uses Svelte 5 runes for reactivity across components.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

interface SelectedArrow {
  motionData: MotionData;
  color: HandSide;
  pictographData: PictographData;
}

// Use $state for Svelte 5 reactivity
let _selectedArrow = $state<SelectedArrow | null>(null);

// Keep observer pattern for non-Svelte code (like KeyboardShortcutManager)
type SelectionObserver = () => void;
const observers = new Set<SelectionObserver>();

function notifyObservers() {
  observers.forEach((observer) => observer());
}

export const selectedArrowState = {
  get selectedArrow() {
    return _selectedArrow;
  },

  selectArrow(
    motionData: MotionData,
    color: HandSide,
    pictographData: PictographData
  ) {
    _selectedArrow = { motionData, color, pictographData };
    notifyObservers();
  },

  clearSelection() {
    _selectedArrow = null;
    notifyObservers();
  },

  isSelected(motionData: MotionData, color: HandSide): boolean {
    if (!_selectedArrow) return false;
    return (
      _selectedArrow.color === color &&
      _selectedArrow.motionData.motionType === motionData.motionType &&
      _selectedArrow.motionData.startLocation === motionData.startLocation &&
      _selectedArrow.motionData.endLocation === motionData.endLocation
    );
  },

  /**
   * Register an observer to be notified when selection changes.
   * Returns an unsubscribe function.
   */
  subscribe(observer: SelectionObserver): () => void {
    observers.add(observer);
    return () => observers.delete(observer);
  },
};
