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
  HandSide,
  type Orientation,
} from "../../shared/domain/enums/pictograph-enums";
import type { PropPlacementState } from "./prop-placement-state.svelte";

interface PropPlacementAimInputs {
  getGridMode: () => GridMode;
  getActivePoints: () => PlacementGridPoint[];
  getCanAim: () => boolean;
  getCanDragLocations?: () => boolean;
  getEditAfterCompletion: () => boolean;
  getLeftOrientation: () => Orientation;
  getRightOrientation: () => Orientation;
  getLeftPropType: () => PropType;
  getRightPropType: () => PropType;
  getBetaSwapped: () => boolean;
}

interface PropPlacementAimDependencies {
  triggerHaptic: () => void;
  onOrientationChange: (color: HandSide, orientation: Orientation) => void;
}

interface PendingOrientation {
  color: HandSide;
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
  let dragHand = $state<HandSide | null>(null);
  let dragLocation = $state<GridLocation | null>(null);
  let dragAim = $state<Orientation | null>(null);
  let pendingOrientation = $state<PendingOrientation | null>(null);
  let pointerHandledPress = false;
  let hoverHand = $state<HandSide | null>(null);
  let hoverOutline = $state<string | null>(null);
  let locationDrag = $state<{
    pointerId: number;
    color: HandSide;
    start: { x: number; y: number };
    clientStart: { x: number; y: number };
    delta: { x: number; y: number };
    moved: boolean;
    initialLeft: GridLocation | null;
    initialRight: GridLocation | null;
  } | null>(null);

  function committedOrientationFor(color: HandSide): Orientation {
    return color === HandSide.LEFT
      ? inputs.getLeftOrientation()
      : inputs.getRightOrientation();
  }

  function shownOrientationFor(color: HandSide): Orientation {
    if (pendingOrientation?.color === color) {
      return pendingOrientation.orientation;
    }

    const location =
      color === HandSide.LEFT
        ? placement.leftLocation
        : placement.rightLocation;
    const orientation = committedOrientationFor(color);
    return location
      ? normalizeOrientationForLocation(orientation, location)
      : orientation;
  }

  function betaOffsets(): PlacementBetaOffsets {
    return calculatePlacementBetaOffsets({
      gridMode: inputs.getGridMode(),
      leftLocation: placement.leftLocation,
      rightLocation: placement.rightLocation,
      leftOrientation: shownOrientationFor(HandSide.LEFT),
      rightOrientation: shownOrientationFor(HandSide.RIGHT),
      leftPropType: inputs.getLeftPropType(),
      rightPropType: inputs.getRightPropType(),
      betaSwapped: inputs.getBetaSwapped(),
    });
  }

  function propCenter(color: HandSide): { x: number; y: number } | null {
    const location =
      color === HandSide.LEFT
        ? placement.leftLocation
        : placement.rightLocation;
    if (location === null) return null;

    const point = inputs
      .getActivePoints()
      .find((entry) => entry.location === location);
    if (!point) return null;

    const offsets = betaOffsets();
    const offset = color === HandSide.LEFT ? offsets.left : offsets.right;
    return { x: point.x + offset.x, y: point.y + offset.y };
  }

  function propElement(color: HandSide): SVGGraphicsElement | null {
    const selector =
      color === HandSide.LEFT ? ".left-prop-svg" : ".right-prop-svg";
    return gridWrapper?.querySelector<SVGGraphicsElement>(selector) ?? null;
  }

  const SHAPE_TOLERANCE = 26;

  function shapeDepth(color: HandSide, event: MouseEvent): number | null {
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

  function propOutline(color: HandSide): string | null {
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

  function colorUnderPointer(event: MouseEvent): HandSide | null {
    const left = shapeDepth(HandSide.LEFT, event);
    const right = shapeDepth(HandSide.RIGHT, event);
    const leftHit = left !== null && left > 0;
    const rightHit = right !== null && right > 0;

    if (leftHit && rightHit) {
      return (right as number) > (left as number)
        ? HandSide.RIGHT
        : HandSide.LEFT;
    }
    if (leftHit) return HandSide.LEFT;
    if (rightHit) return HandSide.RIGHT;
    return null;
  }

  function toSvgPoint(event: MouseEvent): { x: number; y: number } | null {
    const matrix = overlayElement?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
    return { x: point.x, y: point.y };
  }

  function resolvePressColor(
    location: GridLocation,
    event: MouseEvent | null = null
  ): HandSide | null {
    if (placement.activeHand !== null) return placement.activeHand;
    if (!inputs.getEditAfterCompletion()) return null;

    return occupiedColor(location, event);
  }

  function occupiedColor(
    location: GridLocation,
    event: MouseEvent | null = null
  ): HandSide | null {
    const leftHere = placement.leftLocation === location;
    const rightHere = placement.rightLocation === location;

    if (leftHere && rightHere && event) {
      const onProp = colorUnderPointer(event);
      if (onProp !== null) return onProp;

      const pointer = toSvgPoint(event);
      const left = propCenter(HandSide.LEFT);
      const right = propCenter(HandSide.RIGHT);
      if (pointer && left && right) {
        const toLeft = (pointer.x - left.x) ** 2 + (pointer.y - left.y) ** 2;
        const toRight = (pointer.x - right.x) ** 2 + (pointer.y - right.y) ** 2;
        return toRight < toLeft ? HandSide.RIGHT : HandSide.LEFT;
      }
    }

    if (leftHere) return HandSide.LEFT;
    if (rightHere) return HandSide.RIGHT;
    return null;
  }

  function isPressable(location: GridLocation): boolean {
    if (placement.canPlace) return true;
    return (
      (inputs.getCanAim() || placement.canEdit) &&
      resolvePressColor(location) !== null
    );
  }

  function clearHover(): void {
    hoverHand = null;
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
    hoverHand = color;
    hoverOutline = color === null ? null : propOutline(color);
  }

  function handlePointerDown(
    event: PointerEvent,
    location: GridLocation
  ): void {
    pointerHandledPress = false;
    if (startLocationDrag(event, occupiedColor(location, event))) return;
    if (!inputs.getCanAim() || dragPointerId !== null) return;
    const color = resolvePressColor(location, event);
    if (color === null) return;

    clearHover();
    pointerHandledPress = true;
    placement.selectPoint(location, color);
    dragPointerId = event.pointerId;
    dragHand = color;
    dragLocation = location;
    dragAim = normalizeOrientationForLocation(
      committedOrientationFor(color),
      location
    );
  }

  function handlePointerMove(event: PointerEvent): void {
    if (locationDrag?.pointerId === event.pointerId) {
      const pointer = toSvgPoint(event);
      if (!pointer || !locationDragValid()) {
        cancelLocationDrag();
        return;
      }
      const moved =
        locationDrag.moved ||
        Math.hypot(
          event.clientX - locationDrag.clientStart.x,
          event.clientY - locationDrag.clientStart.y
        ) >= 6;
      locationDrag = {
        ...locationDrag,
        moved,
        delta: {
          x: pointer.x - locationDrag.start.x,
          y: pointer.y - locationDrag.start.y,
        },
      };
      if (moved) event.preventDefault();
      return;
    }
    if (event.pointerId !== dragPointerId) return;
    if (dragHand === null || dragLocation === null) return;

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
    pendingOrientation = { color: dragHand, orientation: aimed };
    dependencies.triggerHaptic();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (locationDrag?.pointerId === event.pointerId) {
      const drag = locationDrag;
      const valid = locationDragValid();
      const pointer = toSvgPoint(event);
      locationDrag = null;
      if (!drag.moved) return; // A tap retains the existing select/place behavior.
      pointerHandledPress = true;
      if (
        !valid ||
        !pointer ||
        pointer.x < 0 ||
        pointer.x > 950 ||
        pointer.y < 0 ||
        pointer.y > 950
      )
        return;
      const nearest = inputs
        .getActivePoints()
        .reduce<PlacementGridPoint | null>(
          (best, point) =>
            !best ||
            Math.hypot(point.x - pointer.x, point.y - pointer.y) <
              Math.hypot(best.x - pointer.x, best.y - pointer.y)
              ? point
              : best,
          null
        );
      if (nearest) placement.selectPoint(nearest.location, drag.color);
      return;
    }
    if (event.pointerId !== dragPointerId) return;
    const color = dragHand;
    const aimed = dragAim;

    dragPointerId = null;
    dragHand = null;
    dragLocation = null;
    dragAim = null;

    if (color === null || aimed === null) return;
    if (aimed === committedOrientationFor(color)) return;
    dependencies.triggerHaptic();
    dependencies.onOrientationChange(color, aimed);
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (locationDrag?.pointerId === event.pointerId) {
      cancelLocationDrag();
      return;
    }
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    dragHand = null;
    dragLocation = null;
    dragAim = null;
    pendingOrientation = null;
  }

  function locationDragValid(): boolean {
    return Boolean(
      locationDrag &&
        placement.canEdit &&
        inputs.getCanDragLocations?.() &&
        placement.leftLocation === locationDrag.initialLeft &&
        placement.rightLocation === locationDrag.initialRight
    );
  }

  function startLocationDrag(
    event: PointerEvent,
    color: HandSide | null
  ): boolean {
    if (locationDrag) return true;
    if (
      !inputs.getCanDragLocations?.() ||
      inputs.getCanAim() ||
      !placement.canEdit ||
      event.button !== 0 ||
      color === null
    )
      return false;
    const pointer = toSvgPoint(event);
    if (!pointer) return false;
    locationDrag = {
      pointerId: event.pointerId,
      color,
      start: pointer,
      clientStart: { x: event.clientX, y: event.clientY },
      delta: { x: 0, y: 0 },
      moved: false,
      initialLeft: placement.leftLocation,
      initialRight: placement.rightLocation,
    };
    (event.currentTarget as Element | null)?.setPointerCapture?.(
      event.pointerId
    );
    return true;
  }

  function handleBoardPointerDown(event: PointerEvent): void {
    if (!inputs.getCanDragLocations?.() || inputs.getCanAim()) return;
    if (locationDrag) return;
    pointerHandledPress = false;
    startLocationDrag(event, colorUnderPointer(event));
  }

  function cancelLocationDrag(): void {
    if (locationDrag?.moved) pointerHandledPress = true;
    locationDrag = null;
  }

  function selectOrEdit(
    location: GridLocation,
    event: MouseEvent | null = null
  ): void {
    if (
      !inputs.getCanAim() &&
      placement.canEdit &&
      placement.activeHand === null
    ) {
      const color = resolvePressColor(location, event);
      if (color !== null) placement.edit(color);
      return;
    }
    placement.selectPoint(location);
  }

  function handleClick(location: GridLocation, event?: MouseEvent): void {
    if (pointerHandledPress) {
      pointerHandledPress = false;
      return;
    }
    selectOrEdit(location, event);
  }

  function handleKeydown(event: KeyboardEvent, location: GridLocation): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectOrEdit(location);
  }

  function retireCommittedPreview(): void {
    const pending = pendingOrientation;
    if (!pending) return;
    if (committedOrientationFor(pending.color) !== pending.orientation) return;
    pendingOrientation = null;
  }

  return {
    get locationDragColor() {
      return locationDrag?.moved ? locationDrag.color : null;
    },
    get locationDragDelta() {
      return locationDrag?.moved ? locationDrag.delta : { x: 0, y: 0 };
    },
    handleBoardPointerDown,
    cancelLocationDrag,
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
    get dragHand() {
      return dragHand;
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
    get shownLeftOrientation() {
      return shownOrientationFor(HandSide.LEFT);
    },
    get shownRightOrientation() {
      return shownOrientationFor(HandSide.RIGHT);
    },
    get isBeta() {
      return (
        placement.leftLocation !== null &&
        placement.leftLocation === placement.rightLocation
      );
    },
    get highlightColor() {
      return dragHand ?? hoverHand;
    },
    get highlightCenter() {
      const color = dragHand ?? hoverHand;
      return color === null ? null : propCenter(color);
    },
    get highlightStroke() {
      return (dragHand ?? hoverHand) === HandSide.RIGHT
        ? "var(--prop-red, #ef4444)"
        : "var(--prop-blue, #3b82f6)";
    },
    get hoverOutline() {
      return hoverOutline;
    },
    get hoverHand() {
      return hoverHand;
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
