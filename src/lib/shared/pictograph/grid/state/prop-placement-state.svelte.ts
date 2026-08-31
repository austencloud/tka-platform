import { untrack } from "svelte";
import type { GridLocation, GridMode } from "../domain/enums/grid-enums";
import type { PropPlacementChange } from "../domain/prop-placement";
import type { PlacementGridPoint } from "../services/placement-grid-points";
import {
  HandSide,
  type Orientation,
} from "../../shared/domain/enums/pictograph-enums";
import { normalizeOrientationForLocation } from "../domain/orientation-from-drag";

interface PlacementSnapshot {
  leftLocation: GridLocation | null;
  rightLocation: GridLocation | null;
  activeColor: HandSide | null;
  leftOrientation: Orientation;
  rightOrientation: Orientation;
}

interface PropPlacementStateInputs {
  getGridMode: () => GridMode;
  getShowCenter: () => boolean;
  getInitialLeftLocation: () => GridLocation | null;
  getInitialRightLocation: () => GridLocation | null;
  getResetEpoch: () => number;
  getDisabled: () => boolean;
  getEditAfterCompletion: () => boolean;
  getShowUndo: () => boolean;
  getAllowUndoAfterComplete: () => boolean;
  getLeftOrientation: () => Orientation;
  getRightOrientation: () => Orientation;
  getLeftNoun: () => string;
  getRightNoun: () => string;
  getActivePoints: () => PlacementGridPoint[];
}

interface PropPlacementStateDependencies {
  triggerHaptic: () => void;
  onChange: (change: PropPlacementChange) => void;
  onPlacementComplete: (
    leftLocation: GridLocation,
    rightLocation: GridLocation
  ) => void;
  onOrientationChange: (color: HandSide, orientation: Orientation) => void;
}

function buildInitializationKey(inputs: PropPlacementStateInputs): string {
  return `${inputs.getGridMode()}:${inputs.getShowCenter()}:${inputs.getInitialLeftLocation() ?? ""}:${inputs.getInitialRightLocation() ?? ""}:${inputs.getResetEpoch()}`;
}

export type PropPlacementState = ReturnType<typeof createPropPlacementState>;

export function createPropPlacementState(
  inputs: PropPlacementStateInputs,
  dependencies: PropPlacementStateDependencies
) {
  let leftLocation = $state<GridLocation | null>(
    inputs.getInitialLeftLocation()
  );
  let rightLocation = $state<GridLocation | null>(inputs.getInitialRightLocation());
  let activeColor = $state<HandSide | null>(
    inputs.getInitialLeftLocation()
      ? inputs.getInitialRightLocation()
        ? null
        : HandSide.RIGHT
      : HandSide.LEFT
  );
  let history = $state<PlacementSnapshot[]>([]);
  let liveAnnouncement = $state("");
  let initializationKey = buildInitializationKey(inputs);

  function isComplete(): boolean {
    return leftLocation !== null && rightLocation !== null;
  }

  function changeCanUndo(): boolean {
    return (
      !inputs.getDisabled() &&
      history.length > 0 &&
      (inputs.getAllowUndoAfterComplete() || !isComplete())
    );
  }

  function publishChange(): void {
    dependencies.onChange({
      leftLocation,
      rightLocation,
      activeColor,
      complete: isComplete(),
      canUndo: changeCanUndo(),
    });

    if (leftLocation && rightLocation) {
      dependencies.onPlacementComplete(leftLocation, rightLocation);
    }
  }

  function committedOrientationFor(color: HandSide): Orientation {
    return color === HandSide.LEFT
      ? inputs.getLeftOrientation()
      : inputs.getRightOrientation();
  }

  function pushHistory(): void {
    history = [
      ...history,
      {
        leftLocation,
        rightLocation,
        activeColor,
        leftOrientation: leftLocation
          ? normalizeOrientationForLocation(
              inputs.getLeftOrientation(),
              leftLocation
            )
          : inputs.getLeftOrientation(),
        rightOrientation: rightLocation
          ? normalizeOrientationForLocation(
              inputs.getRightOrientation(),
              rightLocation
            )
          : inputs.getRightOrientation(),
      },
    ];
  }

  function normalizePlacedOrientation(
    color: HandSide,
    location: GridLocation
  ): void {
    const current = committedOrientationFor(color);
    const normalized = normalizeOrientationForLocation(current, location);
    if (normalized !== current) {
      dependencies.onOrientationChange(color, normalized);
    }
  }

  function labelForLocation(location: GridLocation | null): string {
    return (
      inputs.getActivePoints().find((point) => point.location === location)
        ?.label ?? "unknown point"
    );
  }

  function selectPoint(
    location: GridLocation,
    color: HandSide | null = activeColor
  ): void {
    if (inputs.getDisabled() || color === null) return;

    const label = labelForLocation(location);
    pushHistory();
    normalizePlacedOrientation(color, location);

    if (color === HandSide.LEFT) {
      leftLocation = location;
      activeColor = rightLocation === null ? HandSide.RIGHT : null;
      dependencies.triggerHaptic();
      liveAnnouncement =
        rightLocation === null
          ? `${inputs.getLeftNoun()} placed at ${label}. Place the ${inputs.getRightNoun()}.`
          : `${inputs.getLeftNoun()} moved to ${label}. Position ready.`;
    } else {
      rightLocation = location;
      activeColor = leftLocation === null ? HandSide.LEFT : null;
      dependencies.triggerHaptic();
      liveAnnouncement =
        leftLocation === null
          ? `${inputs.getRightNoun()} placed at ${label}. Place the ${inputs.getLeftNoun()}.`
          : `${inputs.getRightNoun()} placed at ${label}. ${inputs.getLeftNoun()} at ${labelForLocation(leftLocation)}, ${inputs.getRightNoun()} at ${label}. Position ready.`;
    }

    publishChange();
  }

  function edit(color: HandSide): void {
    if (inputs.getDisabled() || !inputs.getEditAfterCompletion()) return;
    activeColor = color;
    const noun =
      color === HandSide.LEFT ? inputs.getLeftNoun() : inputs.getRightNoun();
    liveAnnouncement = `Choose a new location for the ${noun}.`;
    dependencies.triggerHaptic();
    publishChange();
  }

  function undo(): void {
    const previous = history.at(-1);
    if (!previous) return;

    leftLocation = previous.leftLocation;
    rightLocation = previous.rightLocation;
    activeColor = previous.activeColor;
    history = history.slice(0, -1);
    if (inputs.getLeftOrientation() !== previous.leftOrientation) {
      dependencies.onOrientationChange(
        HandSide.LEFT,
        previous.leftOrientation
      );
    }
    if (inputs.getRightOrientation() !== previous.rightOrientation) {
      dependencies.onOrientationChange(
        HandSide.RIGHT,
        previous.rightOrientation
      );
    }
    dependencies.triggerHaptic();
    liveAnnouncement =
      activeColor === HandSide.RIGHT
        ? `${inputs.getLeftNoun()} placement restored. Place the ${inputs.getRightNoun()}.`
        : activeColor === HandSide.LEFT
          ? `Place the ${inputs.getLeftNoun()}.`
          : "Previous position restored.";
    publishChange();
  }

  function reset(): void {
    leftLocation = null;
    rightLocation = null;
    activeColor = HandSide.LEFT;
    history = [];
    liveAnnouncement = "";
    publishChange();
  }

  function synchronizeInputs(): void {
    const nextInitializationKey = buildInitializationKey(inputs);
    if (nextInitializationKey === initializationKey) return;

    untrack(() => {
      initializationKey = nextInitializationKey;
      leftLocation = inputs.getInitialLeftLocation();
      rightLocation = inputs.getInitialRightLocation();
      activeColor = inputs.getInitialLeftLocation()
        ? inputs.getInitialRightLocation()
          ? null
          : HandSide.RIGHT
        : HandSide.LEFT;
      history = [];
      liveAnnouncement = "";
    });
  }

  return {
    get leftLocation() {
      return leftLocation;
    },
    get rightLocation() {
      return rightLocation;
    },
    get activeColor() {
      return activeColor;
    },
    get isComplete() {
      return isComplete();
    },
    get canPlace() {
      return !inputs.getDisabled() && activeColor !== null;
    },
    get canUndo() {
      return inputs.getShowUndo() && changeCanUndo();
    },
    get historyLength() {
      return history.length;
    },
    get liveAnnouncement() {
      return liveAnnouncement;
    },
    committedOrientationFor,
    selectPoint,
    edit,
    undo,
    reset,
    synchronizeInputs,
  };
}
