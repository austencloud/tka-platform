import { untrack } from "svelte";
import type { GridLocation, GridMode } from "../domain/enums/grid-enums";
import type { PropPlacementChange } from "../domain/prop-placement";
import type { PlacementGridPoint } from "../services/placement-grid-points";
import {
  MotionColor,
  type Orientation,
} from "../../shared/domain/enums/pictograph-enums";
import { normalizeOrientationForLocation } from "../domain/orientation-from-drag";

interface PlacementSnapshot {
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  activeColor: MotionColor | null;
  blueOrientation: Orientation;
  redOrientation: Orientation;
}

interface PropPlacementStateInputs {
  getGridMode: () => GridMode;
  getShowCenter: () => boolean;
  getInitialBlueLocation: () => GridLocation | null;
  getInitialRedLocation: () => GridLocation | null;
  getResetEpoch: () => number;
  getDisabled: () => boolean;
  getEditAfterCompletion: () => boolean;
  getShowUndo: () => boolean;
  getAllowUndoAfterComplete: () => boolean;
  getBlueOrientation: () => Orientation;
  getRedOrientation: () => Orientation;
  getBlueNoun: () => string;
  getRedNoun: () => string;
  getActivePoints: () => PlacementGridPoint[];
}

interface PropPlacementStateDependencies {
  triggerHaptic: () => void;
  onChange: (change: PropPlacementChange) => void;
  onPlacementComplete: (
    blueLocation: GridLocation,
    redLocation: GridLocation
  ) => void;
  onOrientationChange: (color: MotionColor, orientation: Orientation) => void;
}

function buildInitializationKey(inputs: PropPlacementStateInputs): string {
  return `${inputs.getGridMode()}:${inputs.getShowCenter()}:${inputs.getInitialBlueLocation() ?? ""}:${inputs.getInitialRedLocation() ?? ""}:${inputs.getResetEpoch()}`;
}

export type PropPlacementState = ReturnType<typeof createPropPlacementState>;

export function createPropPlacementState(
  inputs: PropPlacementStateInputs,
  dependencies: PropPlacementStateDependencies
) {
  let blueLocation = $state<GridLocation | null>(
    inputs.getInitialBlueLocation()
  );
  let redLocation = $state<GridLocation | null>(inputs.getInitialRedLocation());
  let activeColor = $state<MotionColor | null>(
    inputs.getInitialBlueLocation()
      ? inputs.getInitialRedLocation()
        ? null
        : MotionColor.RED
      : MotionColor.BLUE
  );
  let history = $state<PlacementSnapshot[]>([]);
  let liveAnnouncement = $state("");
  let initializationKey = buildInitializationKey(inputs);

  function isComplete(): boolean {
    return blueLocation !== null && redLocation !== null;
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
      blueLocation,
      redLocation,
      activeColor,
      complete: isComplete(),
      canUndo: changeCanUndo(),
    });

    if (blueLocation && redLocation) {
      dependencies.onPlacementComplete(blueLocation, redLocation);
    }
  }

  function committedOrientationFor(color: MotionColor): Orientation {
    return color === MotionColor.BLUE
      ? inputs.getBlueOrientation()
      : inputs.getRedOrientation();
  }

  function pushHistory(): void {
    history = [
      ...history,
      {
        blueLocation,
        redLocation,
        activeColor,
        blueOrientation: blueLocation
          ? normalizeOrientationForLocation(
              inputs.getBlueOrientation(),
              blueLocation
            )
          : inputs.getBlueOrientation(),
        redOrientation: redLocation
          ? normalizeOrientationForLocation(
              inputs.getRedOrientation(),
              redLocation
            )
          : inputs.getRedOrientation(),
      },
    ];
  }

  function normalizePlacedOrientation(
    color: MotionColor,
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
    color: MotionColor | null = activeColor
  ): void {
    if (inputs.getDisabled() || color === null) return;

    const label = labelForLocation(location);
    pushHistory();
    normalizePlacedOrientation(color, location);

    if (color === MotionColor.BLUE) {
      blueLocation = location;
      activeColor = redLocation === null ? MotionColor.RED : null;
      dependencies.triggerHaptic();
      liveAnnouncement =
        redLocation === null
          ? `${inputs.getBlueNoun()} placed at ${label}. Place the ${inputs.getRedNoun()}.`
          : `${inputs.getBlueNoun()} moved to ${label}. Position ready.`;
    } else {
      redLocation = location;
      activeColor = blueLocation === null ? MotionColor.BLUE : null;
      dependencies.triggerHaptic();
      liveAnnouncement =
        blueLocation === null
          ? `${inputs.getRedNoun()} placed at ${label}. Place the ${inputs.getBlueNoun()}.`
          : `${inputs.getRedNoun()} placed at ${label}. ${inputs.getBlueNoun()} at ${labelForLocation(blueLocation)}, ${inputs.getRedNoun()} at ${label}. Position ready.`;
    }

    publishChange();
  }

  function edit(color: MotionColor): void {
    if (inputs.getDisabled() || !inputs.getEditAfterCompletion()) return;
    activeColor = color;
    const noun =
      color === MotionColor.BLUE ? inputs.getBlueNoun() : inputs.getRedNoun();
    liveAnnouncement = `Choose a new location for the ${noun}.`;
    dependencies.triggerHaptic();
    publishChange();
  }

  function undo(): void {
    const previous = history.at(-1);
    if (!previous) return;

    blueLocation = previous.blueLocation;
    redLocation = previous.redLocation;
    activeColor = previous.activeColor;
    history = history.slice(0, -1);
    if (inputs.getBlueOrientation() !== previous.blueOrientation) {
      dependencies.onOrientationChange(
        MotionColor.BLUE,
        previous.blueOrientation
      );
    }
    if (inputs.getRedOrientation() !== previous.redOrientation) {
      dependencies.onOrientationChange(
        MotionColor.RED,
        previous.redOrientation
      );
    }
    dependencies.triggerHaptic();
    liveAnnouncement =
      activeColor === MotionColor.RED
        ? `${inputs.getBlueNoun()} placement restored. Place the ${inputs.getRedNoun()}.`
        : activeColor === MotionColor.BLUE
          ? `Place the ${inputs.getBlueNoun()}.`
          : "Previous position restored.";
    publishChange();
  }

  function reset(): void {
    blueLocation = null;
    redLocation = null;
    activeColor = MotionColor.BLUE;
    history = [];
    liveAnnouncement = "";
    publishChange();
  }

  function synchronizeInputs(): void {
    const nextInitializationKey = buildInitializationKey(inputs);
    if (nextInitializationKey === initializationKey) return;

    untrack(() => {
      initializationKey = nextInitializationKey;
      blueLocation = inputs.getInitialBlueLocation();
      redLocation = inputs.getInitialRedLocation();
      activeColor = inputs.getInitialBlueLocation()
        ? inputs.getInitialRedLocation()
          ? null
          : MotionColor.RED
        : MotionColor.BLUE;
      history = [];
      liveAnnouncement = "";
    });
  }

  return {
    get blueLocation() {
      return blueLocation;
    },
    get redLocation() {
      return redLocation;
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
