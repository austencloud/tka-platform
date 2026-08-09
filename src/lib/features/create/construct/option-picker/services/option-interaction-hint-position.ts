export interface RectLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface OptionInteractionHintPosition {
  top: number;
  left: number;
  arrowLeft: number;
  placement: "above" | "below";
}

interface PositionInput {
  container: RectLike;
  anchor: RectLike;
  hintWidth: number;
  hintHeight: number;
  gap?: number;
  edgePadding?: number;
  topInset?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function calculateOptionInteractionHintPosition({
  container,
  anchor,
  hintWidth,
  hintHeight,
  gap = 12,
  edgePadding = 8,
  topInset = 0,
}: PositionInput): OptionInteractionHintPosition {
  const anchorCenter = anchor.left - container.left + anchor.width / 2;
  const left = clamp(
    anchorCenter - hintWidth / 2,
    edgePadding,
    container.width - hintWidth - edgePadding
  );
  const topBoundary = Math.max(edgePadding, topInset + edgePadding);
  const spaceAbove = anchor.top - container.top - topBoundary;
  const spaceBelow = container.bottom - anchor.bottom;
  const placement =
    spaceAbove >= hintHeight + gap || spaceAbove >= spaceBelow
      ? "above"
      : "below";
  const desiredTop =
    placement === "above"
      ? anchor.top - container.top - hintHeight - gap
      : anchor.bottom - container.top + gap;
  const top = clamp(
    desiredTop,
    topBoundary,
    container.height - hintHeight - edgePadding
  );
  const arrowLeft = clamp(anchorCenter - left, 18, hintWidth - 18);

  return { top, left, arrowLeft, placement };
}
