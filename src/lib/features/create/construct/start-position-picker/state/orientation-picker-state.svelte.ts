/**
 * Global orientation picker state
 *
 * Shared reactive state for the orientation picker drawer.
 * Used by OrientationCycler (to open) and OrientationPickerDrawer (to render).
 * The actual drawer is mounted at the CreateModule level
 * to avoid stacking context issues.
 */
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

type OrientationPickerCallback = (orientation: Orientation) => void;

let isOpen = $state(false);
let activeColor = $state<"blue" | "red">("blue");
let currentOrientation = $state<Orientation | null>(null);
let onSelectCallback = $state<OrientationPickerCallback | null>(null);

export const orientationPickerState = {
  get isOpen() {
    return isOpen;
  },
  get activeColor() {
    return activeColor;
  },
  get currentOrientation() {
    return currentOrientation;
  },
  open(
    color: "blue" | "red",
    orientation: Orientation,
    onSelect: OrientationPickerCallback
  ) {
    activeColor = color;
    currentOrientation = orientation;
    onSelectCallback = onSelect;
    isOpen = true;
  },
  close() {
    isOpen = false;
  },
  select(orientation: Orientation) {
    onSelectCallback?.(orientation);
    isOpen = false;
  },
};
