export interface ArrivalRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PictographArrivalTransform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
}

export function translateArrivalRect(
  rect: ArrivalRect,
  translateX: number,
  translateY: number
): ArrivalRect {
  return {
    left: rect.left + translateX,
    top: rect.top + translateY,
    width: rect.width,
    height: rect.height,
  };
}

export function hasUsableArrivalRect(rect: ArrivalRect): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function calculatePictographArrivalTransform(
  source: ArrivalRect,
  destination: ArrivalRect
): PictographArrivalTransform | null {
  if (!hasUsableArrivalRect(source) || !hasUsableArrivalRect(destination)) {
    return null;
  }

  return {
    translateX: destination.left - source.left,
    translateY: destination.top - source.top,
    scaleX: destination.width / source.width,
    scaleY: destination.height / source.height,
  };
}
