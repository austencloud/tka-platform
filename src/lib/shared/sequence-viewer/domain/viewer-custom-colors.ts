import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";

export type ViewerCustomColorHand = "blue" | "red";

export interface ViewerCustomColorPair {
  blue: string;
  red: string;
}

export const DEFAULT_VIEWER_CUSTOM_COLORS: ViewerCustomColorPair = {
  blue: getMotionColor(MotionColor.BLUE, "dark"),
  red: getMotionColor(MotionColor.RED, "dark"),
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeViewerHexColor(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const expanded = /^#[0-9a-f]{3}$/i.test(trimmed)
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed;
  return HEX_COLOR.test(expanded) ? expanded.toLowerCase() : fallback;
}

export function resolveViewerCustomColorPair(
  value: unknown,
  fallback: ViewerCustomColorPair = DEFAULT_VIEWER_CUSTOM_COLORS
): ViewerCustomColorPair {
  const candidate =
    value && typeof value === "object"
      ? (value as { blue?: unknown; red?: unknown })
      : null;
  return {
    blue: normalizeViewerHexColor(candidate?.blue, fallback.blue),
    red: normalizeViewerHexColor(candidate?.red, fallback.red),
  };
}

export function viewerCustomColorPairsEqual(
  left: ViewerCustomColorPair,
  right: ViewerCustomColorPair
): boolean {
  return (
    left.blue.toLowerCase() === right.blue.toLowerCase() &&
    left.red.toLowerCase() === right.red.toLowerCase()
  );
}
