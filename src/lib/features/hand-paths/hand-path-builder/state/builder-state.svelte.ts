/**
 * Builder State - Hand Path Builder
 *
 * Three-phase construction: blue hand → red hand → complete.
 * Pure spatial paths: no rotation direction, no turn counts.
 * Each tap adds a location; min 2 locations per hand to proceed.
 * Red hand must match blue hand length before completing.
 *
 * Path names follow the TKA naming convention:
 *   Cardinals uppercase (N, E, S, W)
 *   Intercardinals title-case (Ne, Se, Sw, Nw)
 *   Concatenated: ["n", "ne", "s"] → "NNeS"
 */

import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { handPathToName } from "$lib/shared/foundation/services/hand-path-namer";

export type BuilderPhase = "blue" | "red" | "complete";

// Active grid locations per grid mode
const DIAMOND_LOCATIONS = new Set<GridLocation>([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

const BOX_LOCATIONS = new Set<GridLocation>([
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
]);

const SKEWED_LOCATIONS = new Set<GridLocation>([
  GridLocation.NORTH,
  GridLocation.NORTHEAST,
  GridLocation.EAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTH,
  GridLocation.SOUTHWEST,
  GridLocation.WEST,
  GridLocation.NORTHWEST,
]);

function getActiveLocations(mode: GridMode): GridLocation[] {
  switch (mode) {
    case GridMode.DIAMOND: return [...DIAMOND_LOCATIONS];
    case GridMode.BOX: return [...BOX_LOCATIONS];
    default: return [...SKEWED_LOCATIONS];
  }
}

function isLocationActive(location: GridLocation, mode: GridMode): boolean {
  switch (mode) {
    case GridMode.DIAMOND: return DIAMOND_LOCATIONS.has(location);
    case GridMode.BOX: return BOX_LOCATIONS.has(location);
    default: return SKEWED_LOCATIONS.has(location);
  }
}

/** Describes a hand movement from one grid location to another */
export interface HandMove {
  from: GridLocation;
  to: GridLocation;
}

export interface BuilderState {
  readonly phase: BuilderPhase;
  readonly gridMode: GridMode;
  readonly blueLocations: GridLocation[];
  readonly redLocations: GridLocation[];
  readonly bluePathName: string;
  readonly redPathName: string;
  readonly availableLocations: GridLocation[];
  readonly canSwitchToRed: boolean;
  readonly canComplete: boolean;
  readonly activeLocations: GridLocation[];
  readonly lastLocation: GridLocation | null;
  readonly canUndo: boolean;
  readonly isAnimating: boolean;
  addLocation(loc: GridLocation): Promise<void>;
  setAnimationCallback(cb: (move: HandMove) => Promise<void>): void;
  undo(): void;
  switchToRed(): void;
  complete(): void;
  reset(): void;
  setGridMode(mode: GridMode): void;
}

export function createBuilderState(): BuilderState {
  let phase = $state<BuilderPhase>("blue");
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let blueLocations = $state<GridLocation[]>([]);
  let redLocations = $state<GridLocation[]>([]);
  let isAnimating = $state(false);

  // Animation callback - set by HandPathBuilderLab to animate hand movement
  let animationCallback: ((move: HandMove) => Promise<void>) | null = null;

  // Derived path names - live-update as locations are tapped
  const bluePathName = $derived(
    blueLocations.length > 0 ? handPathToName(blueLocations) : ""
  );
  const redPathName = $derived(
    redLocations.length > 0 ? handPathToName(redLocations) : ""
  );

  // Which locations the grid should render as tappable
  const availableLocations = $derived(getActiveLocations(gridMode));

  // Phase gate conditions
  const canSwitchToRed = $derived(blueLocations.length >= 2);
  const canComplete = $derived(
    phase === "red" &&
    redLocations.length >= 2 &&
    redLocations.length === blueLocations.length
  );

  // The locations being built in the current phase
  const activeLocations = $derived(
    phase === "blue" ? blueLocations : redLocations
  );

  // Most-recently tapped location (for visual highlight)
  const lastLocation = $derived(
    activeLocations.length > 0
      ? activeLocations[activeLocations.length - 1]!
      : null
  );

  // Can undo when there are locations in the active phase
  const canUndo = $derived(activeLocations.length > 0);

  async function addLocation(loc: GridLocation): Promise<void> {
    // Ignore taps outside the active grid mode
    if (!isLocationActive(loc, gridMode)) return;
    // Block during animation
    if (isAnimating) return;

    // Don't allow adding to red if lengths would exceed blue
    if (phase === "red" && redLocations.length >= blueLocations.length) return;

    const currentLocs = phase === "blue" ? blueLocations : redLocations;
    const previousLoc = currentLocs.length > 0
      ? currentLocs[currentLocs.length - 1]!
      : null;

    // If there's a previous location and an animation callback, animate first
    if (previousLoc && animationCallback) {
      isAnimating = true;
      try {
        await animationCallback({ from: previousLoc, to: loc });
      } finally {
        isAnimating = false;
      }
    }

    // After animation completes, add the location
    if (phase === "blue") {
      blueLocations = [...blueLocations, loc];
    } else if (phase === "red") {
      redLocations = [...redLocations, loc];
    }
  }

  function setAnimationCallback(cb: (move: HandMove) => Promise<void>): void {
    animationCallback = cb;
  }

  function undo(): void {
    if (phase === "blue" && blueLocations.length > 0) {
      blueLocations = blueLocations.slice(0, -1);
    } else if (phase === "red" && redLocations.length > 0) {
      redLocations = redLocations.slice(0, -1);
    }
  }

  function switchToRed(): void {
    if (!canSwitchToRed) return;
    phase = "red";
  }

  function complete(): void {
    if (!canComplete) return;
    phase = "complete";
  }

  function reset(): void {
    phase = "blue";
    blueLocations = [];
    redLocations = [];
  }

  function setGridMode(mode: GridMode): void {
    gridMode = mode;
    reset();
  }

  return {
    get phase() { return phase; },
    get gridMode() { return gridMode; },
    get blueLocations() { return blueLocations; },
    get redLocations() { return redLocations; },
    get bluePathName() { return bluePathName; },
    get redPathName() { return redPathName; },
    get availableLocations() { return availableLocations; },
    get canSwitchToRed() { return canSwitchToRed; },
    get canComplete() { return canComplete; },
    get activeLocations() { return activeLocations; },
    get lastLocation() { return lastLocation; },
    get canUndo() { return canUndo; },
    get isAnimating() { return isAnimating; },

    addLocation,
    setAnimationCallback,
    undo,
    switchToRed,
    complete,
    reset,
    setGridMode,
  };
}
