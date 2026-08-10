import type { GridLocation, GridMode } from "../domain/enums/grid-enums";
import {
  aimDirectionsFor,
  normalizeOrientationForLocation,
  orientationFromDrag,
} from "../domain/orientation-from-drag";
import type { PlacementGridPoint } from "../services/placement-grid-points";
import {
  calculatePlacementBetaOffsets,
  type PlacementBetaOffsets,
} from "../services/prop-placement-view-model";
import type { PropType } from "../../prop/domain/enums/prop-type";
import {
  MotionColor,
  type Orientation,
} from "../../shared/domain/enums/pictograph-enums";
import type { PropPlacementState } from "./prop-placement-state.svelte";

interface PropPlacementAimInputs {
  getGridMode: () => GridMode;
  getActivePoints: () => PlacementGridPoint[];
  getCanAim: () => boolean;
  getEditAfterCompletion: () => boolean;
  getBlueOrientation: () => Orientation;
  getRedOrientation: () => Orientation;
  getBluePropType: () => PropType;
  getRedPropType: () => PropType;
  getBetaSwapped: () => boolean;
}

interface PropPlacementAimDependencies {
  triggerHaptic: () => void;
  onOrientationChange: (color: MotionColor, orientation: Orientation) => void;
}

interface PendingOrientation {
  color: MotionColor;
  orientation: Orientation;
}

export type PropPlacementAimState = ReturnType<
  typeof createPropPlacementAimState
>;

export function createPropPlacementAimState(
  placement: PropPlacementState,
  inputs: PropPlacementAimInputs,
  dependencies: PropPlacementAimDependencies
) {
  let overlayElement: SVGSVGElement | null = null;
  let gridWrapper: HTMLDivElement | null = null;
  let dragPointerId: number | null = null;
  let dragColor = $state<MotionColor | null>(null);
  let dragLocation = $state<GridLocation | null>(null);
  let dragAim = $state<Orientation | null>(null);
  let pendingOrientation = $state<PendingOrientation | null>(null);
  let pointerHandledPress = false;
  let hoverColor = $state<MotionColor | null>(null);
  let hoverOutline = $state<string | null>(null);

  function committedOrientationFor(color: MotionColor): Orientation {
    return color === MotionColor.BLUE
      ? inputs.getBlueOrientation()
      : inputs.getRedOrientation();
  }

  function shownOrientationFor(color: MotionColor): Orientation {
    if (pendingOrientation?.color === color) {
      return pendingOrientation.orientation;
    }

    const location =
      color === MotionColor.BLUE
        ? placement.blueLocation
        : placement.redLocation;
    const orientation = committedOrientationFor(color);
    return location
      ? normalizeOrientationForLocation(orientation, location)
      : orientation;
  }

  function betaOffsets(): PlacementBetaOffsets {
    return calculatePlacementBetaOffsets({
      gridMode: inputs.getGridMode(),
      blueLocation: placement.blueLocation,
      redLocation: placement.redLocation,
      blueOrientation: shownOrientationFor(MotionColor.BLUE),
      redOrientation: shownOrientationFor(MotionColor.RED),
      bluePropType: inputs.getBluePropType(),
      redPropType: inputs.getRedPropType(),
      betaSwapped: inputs.getBetaSwapped(),
    });
  }

  function propCenter(color: MotionColor): { x: number; y: number } | null {
    const location =
      color === MotionColor.BLUE
        ? placement.blueLocation
        : placement.redLocation;
    if (location === null) return null;

    const point = inputs
      .getActivePoints()
      .find((entry) => entry.location === location);
    if (!point) return null;

    const offsets = betaOffsets();
    const offset = color === MotionColor.BLUE ? offsets.blue : offsets.red;
    return { x: point.x + offset.x, y: point.y + offset.y };
  }

  function propElement(color: MotionColor): SVGGraphicsElement | null {
    const selector =
      color === MotionColor.BLUE ? ".blue-prop-svg" : ".red-prop-svg";
    return gridWrapper?.querySelector<SVGGraphicsElement>(selector) ?? null;
  }

  const SHAPE_TOLERANCE = 26;

  function shapeDepth(color: MotionColor, event: PointerEvent): number | null {
    const element = propElement(color);
    if (!element) return null;

    try {
      const matrix = element.getScreenCTM();
      if (!matrix) return null;
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse()
      );
      const box = element.getBBox();
      if (box.width === 0 || box.height === 0) return null;
      const insetX = Math.min(local.x - box.x, box.x + box.width - local.x);
      const insetY = Math.min(local.y - box.y, box.y + box.height - local.y);
      return Math.min(insetX, insetY) + SHAPE_TOLERANCE;
    } catch {
      return null;
    }
  }

  function propOutline(color: MotionColor): string | null {
    const element = propElement(color);
    if (!element || !overlayElement) return null;

    try {
      const propMatrix = element.getScreenCTM();
      const overlayMatrix = overlayElement.getScreenCTM();
      if (!propMatrix || !overlayMatrix) return null;

      const toOverlay = overlayMatrix.inverse().multiply(propMatrix);
      const box = element.getBBox();
      if (box.width === 0 || box.height === 0) return null;
      const pad = 12;
      const corners: Array<[number, number]> = [
        [box.x - pad, box.y - pad],
        [box.x + box.width + pad, box.y - pad],
        [box.x + box.width + pad, box.y + box.height + pad],
        [box.x - pad, box.y + box.height + pad],
      ];

      return corners
        .map(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(toOverlay);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        })
        .join(" ");
    } catch {
      return null;
    }
  }

  function colorUnderPointer(event: PointerEvent): MotionColor | null {
    const blue = shapeDepth(MotionColor.BLUE, event);
    const red = shapeDepth(MotionColor.RED, event);
    const blueHit = blue !== null && blue > 0;
    const redHit = red !== null && red > 0;

    if (blueHit && redHit) {
      return (red as number) > (blue as number)
        ? MotionColor.RED
        : MotionColor.BLUE;
    }
    if (blueHit) return MotionColor.BLUE;
    if (redHit) return MotionColor.RED;
    return null;
  }

  function toSvgPoint(event: PointerEvent): { x: number; y: number } | null {
    const matrix = overlayElement?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
    return { x: point.x, y: point.y };
  }

  function resolvePressColor(
    location: GridLocation,
    event: PointerEvent | null = null
  ): MotionColor | null {
    if (placement.activeColor !== null) return placement.activeColor;
    if (!inputs.getEditAfterCompletion()) return null;

    const blueHere = placement.blueLocation === location;
    const redHere = placement.redLocation === location;

    if (blueHere && redHere && event) {
      const onProp = colorUnderPointer(event);
      if (onProp !== null) return onProp;

      const pointer = toSvgPoint(event);
      const blue = propCenter(MotionColor.BLUE);
      const red = propCenter(MotionColor.RED);
      if (pointer && blue && red) {
        const toBlue = (pointer.x - blue.x) ** 2 + (pointer.y - blue.y) ** 2;
        const toRed = (pointer.x - red.x) ** 2 + (pointer.y - red.y) ** 2;
        return toRed < toBlue ? MotionColor.RED : MotionColor.BLUE;
      }
    }

    if (blueHere) return MotionColor.BLUE;
    if (redHere) return MotionColor.RED;
    return null;
  }

  function isPressable(location: GridLocation): boolean {
    if (placement.canPlace) return true;
    return inputs.getCanAim() && resolvePressColor(location) !== null;
  }

  function clearHover(): void {
    hoverColor = null;
    hoverOutline = null;
  }

  function updateHover(event: PointerEvent, location: GridLocation): void {
    if (
      !inputs.getCanAim() ||
      dragPointerId !== null ||
      event.pointerType === "touch"
    ) {
      return;
    }

    const color = resolvePressColor(location, event);
    hoverColor = color;
    hoverOutline = color === null ? null : propOutline(color);
  }

  function handlePointerDown(
    event: PointerEvent,
    location: GridLocation
  ): void {
    if (!inputs.getCanAim() || dragPointerId !== null) return;
    const color = resolvePressColor(location, event);
    if (color === null) return;

    clearHover();
    pointerHandledPress = true;
    placement.selectPoint(location, color);
    dragPointerId = event.pointerId;
    dragColor = color;
    dragLocation = location;
    dragAim = normalizeOrientationForLocation(
      committedOrientationFor(color),
      location
    );
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== dragPointerId) return;
    if (dragColor === null || dragLocation === null) return;

    const pointer = toSvgPoint(event);
    const origin = inputs
      .getActivePoints()
      .find((point) => point.location === dragLocation);
    if (!pointer || !origin) return;

    const aimed = orientationFromDrag({
      location: dragLocation,
      gridMode: inputs.getGridMode(),
      dx: pointer.x - origin.x,
      dy: pointer.y - origin.y,
    });
    if (!aimed || aimed === dragAim) return;

    dragAim = aimed;
    pendingOrientation = { color: dragColor, orientation: aimed };
    dependencies.triggerHaptic();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.pointerId !== dragPointerId) return;
    const color = dragColor;
    const aimed = dragAim;

    dragPointerId = null;
    dragColor = null;
    dragLocation = null;
    dragAim = null;

    if (color === null || aimed === null) return;
    if (aimed === committedOrientationFor(color)) return;
    dependencies.triggerHaptic();
    dependencies.onOrientationChange(color, aimed);
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragColor = null;
    dragLocation = null;
    dragAim = null;
    pendingOrientation = null;
  }

  function handleClick(location: GridLocation): void {
    if (pointerHandledPress) {
      pointerHandledPress = false;
      return;
    }
    placement.selectPoint(location);
  }

  function handleKeydown(event: KeyboardEvent, location: GridLocation): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    placement.selectPoint(location);
  }

  function retireCommittedPreview(): void {
    const pending = pendingOrientation;
    if (!pending) return;
    if (committedOrientationFor(pending.color) !== pending.orientation) return;
    pendingOrientation = null;
  }

  return {
    get overlayElement() {
      return overlayElement;
    },
    set overlayElement(value: SVGSVGElement | null) {
      overlayElement = value;
    },
    get gridWrapper() {
      return gridWrapper;
    },
    set gridWrapper(value: HTMLDivElement | null) {
      gridWrapper = value;
    },
    get dragColor() {
      return dragColor;
    },
    get dragAim() {
      return dragAim;
    },
    get dragPoint() {
      return dragLocation === null
        ? null
        : (inputs
            .getActivePoints()
            .find((point) => point.location === dragLocation) ?? null);
    },
    get pendingOrientation() {
      return pendingOrientation;
    },
    get shownBlueOrientation() {
      return shownOrientationFor(MotionColor.BLUE);
    },
    get shownRedOrientation() {
      return shownOrientationFor(MotionColor.RED);
    },
    get isBeta() {
      return (
        placement.blueLocation !== null &&
        placement.blueLocation === placement.redLocation
      );
    },
    get highlightColor() {
      return dragColor ?? hoverColor;
    },
    get highlightCenter() {
      const color = dragColor ?? hoverColor;
      return color === null ? null : propCenter(color);
    },
    get highlightStroke() {
      return (dragColor ?? hoverColor) === MotionColor.RED
        ? "var(--prop-red, #ef4444)"
        : "var(--prop-blue, #3b82f6)";
    },
    get hoverOutline() {
      return hoverOutline;
    },
    get hoverColor() {
      return hoverColor;
    },
    get aimDirections() {
      return dragLocation === null
        ? []
        : aimDirectionsFor(dragLocation, inputs.getGridMode());
    },
    isPressable,
    updateHover,
    clearHover,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
    handleKeydown,
    retireCommittedPreview,
  };
}
