import { describe, it, expect } from "vitest";
import { buildStartEndOptions } from "../customize-start-end-options";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const SNAPSHOT: StartEndOptions = {
  blockedStartPositions: [],
  startPosition: null,
  endPosition: null,
  mustContainLetters: [],
  mustNotContainLetters: [],
  blueStartOrientation: Orientation.IN,
  redStartOrientation: Orientation.IN,
};

// Mirror of the overlay's live local state.
interface Local {
  blockedStartPositions: GridPosition[];
  endPosition: PictographData | null;
  blueStartOrientation: Orientation;
  redStartOrientation: Orientation;
}

function localFrom(base: StartEndOptions): Local {
  return {
    blockedStartPositions: base.blockedStartPositions,
    endPosition: base.endPosition,
    blueStartOrientation: base.blueStartOrientation ?? Orientation.IN,
    redStartOrientation: base.redStartOrientation ?? Orientation.IN,
  };
}

describe("buildStartEndOptions", () => {
  it("changing red orientation preserves a previously-changed blue orientation", () => {
    // The overlay opens with a frozen snapshot; `engine` simulates the engine's
    // full-REPLACE setOptions(). `local` is the overlay's live mirror.
    const snapshot = SNAPSHOT;
    const local = localFrom(snapshot);
    let engine: StartEndOptions = { ...snapshot };

    // User changes blue → OUT
    local.blueStartOrientation = Orientation.OUT;
    engine = buildStartEndOptions(snapshot, local);
    expect(engine.blueStartOrientation).toBe(Orientation.OUT);
    expect(engine.redStartOrientation).toBe(Orientation.IN);

    // User then changes red → CLOCK. Blue MUST survive (the original bug reset
    // it because the handler spread the frozen IN/IN snapshot).
    local.redStartOrientation = Orientation.CLOCK;
    engine = buildStartEndOptions(snapshot, local);
    expect(engine.blueStartOrientation).toBe(Orientation.OUT);
    expect(engine.redStartOrientation).toBe(Orientation.CLOCK);
  });

  it("changing orientation preserves blocked start positions", () => {
    const snapshot = SNAPSHOT;
    const local = localFrom(snapshot);
    let engine: StartEndOptions;

    const blocked = ["alpha1", "beta3"] as unknown as GridPosition[];
    local.blockedStartPositions = blocked;
    engine = buildStartEndOptions(snapshot, local);
    expect(engine.blockedStartPositions).toEqual(blocked);

    // Now change blue orientation — blocked positions must not revert to [].
    local.blueStartOrientation = Orientation.COUNTER;
    engine = buildStartEndOptions(snapshot, local);
    expect(engine.blockedStartPositions).toEqual(blocked);
    expect(engine.blueStartOrientation).toBe(Orientation.COUNTER);
  });

  it("changing a position preserves both start orientations", () => {
    const snapshot = SNAPSHOT;
    const local = localFrom(snapshot);
    let engine: StartEndOptions;

    local.blueStartOrientation = Orientation.OUT;
    local.redStartOrientation = Orientation.COUNTER;
    buildStartEndOptions(snapshot, local);

    // User toggles a position. Orientations must persist.
    local.blockedStartPositions = ["gamma11"] as unknown as GridPosition[];
    engine = buildStartEndOptions(snapshot, local);
    expect(engine.blueStartOrientation).toBe(Orientation.OUT);
    expect(engine.redStartOrientation).toBe(Orientation.COUNTER);
    expect(engine.blockedStartPositions).toEqual(["gamma11"]);
  });

  it("preserves unmanaged fields (must-contain letters) from the snapshot", () => {
    const snapshot: StartEndOptions = {
      ...SNAPSHOT,
      mustContainLetters: ["A"] as unknown as StartEndOptions["mustContainLetters"],
    };
    const local = localFrom(snapshot);
    local.blueStartOrientation = Orientation.CLOCK;
    const engine = buildStartEndOptions(snapshot, local);
    expect(engine.mustContainLetters).toEqual(snapshot.mustContainLetters);
  });

  it("always clears the deprecated startPosition", () => {
    const snapshot: StartEndOptions = {
      ...SNAPSHOT,
      startPosition: { letter: "A" } as unknown as PictographData,
    };
    const local = localFrom(snapshot);
    const engine = buildStartEndOptions(snapshot, local);
    expect(engine.startPosition).toBeNull();
  });
});
