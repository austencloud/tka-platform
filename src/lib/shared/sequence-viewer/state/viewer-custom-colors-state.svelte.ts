import {
  resolveViewerCustomColorPair,
  type ViewerCustomColorHand,
  type ViewerCustomColorPair,
} from "../domain/viewer-custom-colors";

export interface ViewerCustomColorState {
  readonly colors: ViewerCustomColorPair;
  setColor(hand: ViewerCustomColorHand, value: string): void;
  hydrate(colors: ViewerCustomColorPair): void;
}

export function createViewerCustomColorState(
  initialColors: ViewerCustomColorPair,
  persist?: (colors: ViewerCustomColorPair) => void
): ViewerCustomColorState {
  let colors = $state(resolveViewerCustomColorPair(initialColors));

  return {
    get colors() {
      return colors;
    },
    setColor(hand, value) {
      const next = resolveViewerCustomColorPair(
        { ...colors, [hand]: value },
        colors
      );
      colors = next;
      persist?.({ ...next });
    },
    hydrate(value) {
      colors = resolveViewerCustomColorPair(value, colors);
    },
  };
}
