import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface KeyboardContext {
  gridMode: GridMode;
  showCenter: boolean;
  isModalOpen: boolean;
  isInputFocused: boolean;
}

export type KeyboardAction =
  | { type: "position"; location: GridLocation }
  | { type: "turnUp" }
  | { type: "turnDown" }
  | { type: "toggleRotation" }
  | { type: "cycleOrientation" }
  | { type: "switchHand" }
  | { type: "undo" }
  | { type: "finish" };

const NUMPAD_TO_LOCATION: Record<string, GridLocation> = {
  Numpad7: GridLocation.NORTHWEST,
  Numpad8: GridLocation.NORTH,
  Numpad9: GridLocation.NORTHEAST,
  Numpad4: GridLocation.WEST,
  Numpad5: GridLocation.CENTER,
  Numpad6: GridLocation.EAST,
  Numpad1: GridLocation.SOUTHWEST,
  Numpad2: GridLocation.SOUTH,
  Numpad3: GridLocation.SOUTHEAST,
};

const CARDINAL: Set<GridLocation> = new Set([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

const INTERCARDINAL: Set<GridLocation> = new Set([
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
]);

function isLocationValidForMode(
  location: GridLocation,
  mode: GridMode,
  showCenter: boolean,
): boolean {
  if (location === GridLocation.CENTER) return showCenter;
  switch (mode) {
    case GridMode.DIAMOND:
      return CARDINAL.has(location);
    case GridMode.BOX:
      return INTERCARDINAL.has(location);
    case GridMode.SKEWED:
      return true;
    default:
      return true;
  }
}

export function handleAssembleKeyDown(
  e: KeyboardEvent,
  context: KeyboardContext,
): KeyboardAction | null {
  if (context.isInputFocused || context.isModalOpen) return null;

  const location = NUMPAD_TO_LOCATION[e.code];
  if (location !== undefined) {
    if (!isLocationValidForMode(location, context.gridMode, context.showCenter)) return null;
    return { type: "position", location };
  }

  switch (e.code) {
    case "NumpadAdd":
      return { type: "turnUp" };
    case "NumpadSubtract":
      return { type: "turnDown" };
    case "NumpadMultiply":
      return { type: "toggleRotation" };
    case "NumpadDivide":
      return { type: "cycleOrientation" };
    case "Numpad0":
      return { type: "switchHand" };
    case "NumpadDecimal":
      return { type: "undo" };
    case "NumpadEnter":
      return { type: "finish" };
    default:
      return null;
  }
}
