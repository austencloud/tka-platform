import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
import {
  RotationDirection,
  type RotationDirection as RotationDirectionValue,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridMode,
  type GridMode as GridModeValue,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface LetterExplorerRouteState {
  letter: string;
  gridMode: GridModeValue;
  variation: number;
  blueTurns: TurnValue;
  redTurns: TurnValue;
  blueRotation: RotationDirectionValue;
  redRotation: RotationDirectionValue;
}

export const LETTER_EXPLORER_PARAMS = [
  "letter",
  "grid",
  "variation",
  "blueTurns",
  "redTurns",
  "blueRotation",
  "redRotation",
] as const;

function parseTurn(value: string | null): TurnValue {
  if (value === "fl") return "fl";
  const numeric = Number(value);
  if (
    Number.isFinite(numeric) &&
    numeric >= 0 &&
    numeric <= 3 &&
    numeric * 2 === Math.round(numeric * 2)
  ) {
    return numeric;
  }
  return 0;
}

function parseRotation(value: string | null): RotationDirectionValue {
  return value === RotationDirection.COUNTER_CLOCKWISE
    ? RotationDirection.COUNTER_CLOCKWISE
    : RotationDirection.CLOCKWISE;
}

export function parseLetterExplorerRoute(
  searchParams: URLSearchParams,
  allowedLetters: ReadonlySet<string>
): LetterExplorerRouteState | null {
  const letter = searchParams.get("letter");
  if (!letter || !allowedLetters.has(letter)) return null;

  const rawVariation = Number(searchParams.get("variation"));
  const variation =
    Number.isInteger(rawVariation) && rawVariation >= 0 ? rawVariation : 0;

  return {
    letter,
    gridMode:
      searchParams.get("grid") === GridMode.BOX
        ? GridMode.BOX
        : GridMode.DIAMOND,
    variation,
    blueTurns: parseTurn(searchParams.get("blueTurns")),
    redTurns: parseTurn(searchParams.get("redTurns")),
    blueRotation: parseRotation(searchParams.get("blueRotation")),
    redRotation: parseRotation(searchParams.get("redRotation")),
  };
}

export function writeLetterExplorerRoute(
  url: URL,
  state: LetterExplorerRouteState | null
): void {
  for (const parameter of LETTER_EXPLORER_PARAMS) {
    url.searchParams.delete(parameter);
  }

  if (!state) return;

  url.searchParams.set("letter", state.letter);
  url.searchParams.set("grid", state.gridMode);
  url.searchParams.set("variation", String(state.variation));
  if (state.blueTurns !== 0) {
    url.searchParams.set("blueTurns", String(state.blueTurns));
    url.searchParams.set("blueRotation", state.blueRotation);
  }
  if (state.redTurns !== 0) {
    url.searchParams.set("redTurns", String(state.redTurns));
    url.searchParams.set("redRotation", state.redRotation);
  }
  url.hash = "cat-letter";
}

export function hasLetterExplorerEdits(
  state: LetterExplorerRouteState
): boolean {
  return state.blueTurns !== 0 || state.redTurns !== 0;
}
