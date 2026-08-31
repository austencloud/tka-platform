import { describe, expect, it, vi } from "vitest";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getPlacementGridPoints } from "$lib/shared/pictograph/grid/services/placement-grid-points";
import { createPropPlacementState } from "$lib/shared/pictograph/grid/state/prop-placement-state.svelte";
import {
  HandSide,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

function createHarness() {
  const values = {
    gridMode: GridMode.DIAMOND,
    showCenter: false,
    initialLeftLocation: null as GridLocation | null,
    initialRightLocation: null as GridLocation | null,
    resetEpoch: 0,
    disabled: false,
    editAfterCompletion: true,
    showUndo: true,
    allowUndoAfterComplete: true,
    leftOrientation: Orientation.IN,
    rightOrientation: Orientation.IN,
  };
  const onChange = vi.fn();
  const onPlacementComplete = vi.fn();
  const onOrientationChange = vi.fn();
  const triggerHaptic = vi.fn();
  const state = createPropPlacementState(
    {
      getGridMode: () => values.gridMode,
      getShowCenter: () => values.showCenter,
      getInitialLeftLocation: () => values.initialLeftLocation,
      getInitialRightLocation: () => values.initialRightLocation,
      getResetEpoch: () => values.resetEpoch,
      getDisabled: () => values.disabled,
      getEditAfterCompletion: () => values.editAfterCompletion,
      getShowUndo: () => values.showUndo,
      getAllowUndoAfterComplete: () => values.allowUndoAfterComplete,
      getLeftOrientation: () => values.leftOrientation,
      getRightOrientation: () => values.rightOrientation,
      getLeftNoun: () => "left prop",
      getRightNoun: () => "right prop",
      getActivePoints: () =>
        getPlacementGridPoints(values.gridMode, values.showCenter),
    },
    {
      triggerHaptic,
      onChange,
      onPlacementComplete,
      onOrientationChange,
    }
  );
  return {
    values,
    state,
    onChange,
    onPlacementComplete,
    onOrientationChange,
    triggerHaptic,
  };
}

describe("prop placement state", () => {
  it("places blue then red and publishes a complete position", () => {
    const harness = createHarness();

    harness.state.selectPoint(GridLocation.NORTH);
    harness.state.selectPoint(GridLocation.SOUTH);

    expect(harness.state.leftLocation).toBe(GridLocation.NORTH);
    expect(harness.state.rightLocation).toBe(GridLocation.SOUTH);
    expect(harness.state.activeColor).toBeNull();
    expect(harness.state.isComplete).toBe(true);
    expect(harness.state.historyLength).toBe(2);
    expect(harness.onPlacementComplete).toHaveBeenCalledWith(
      GridLocation.NORTH,
      GridLocation.SOUTH
    );
    expect(harness.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ complete: true, canUndo: true })
    );
  });

  it("restores the previous placement and active color on undo", () => {
    const harness = createHarness();
    harness.state.selectPoint(GridLocation.NORTH);
    harness.state.selectPoint(GridLocation.SOUTH);

    harness.state.undo();

    expect(harness.state.leftLocation).toBe(GridLocation.NORTH);
    expect(harness.state.rightLocation).toBeNull();
    expect(harness.state.activeColor).toBe(HandSide.RIGHT);
    expect(harness.state.historyLength).toBe(1);
    expect(harness.state.liveAnnouncement).toContain("right prop");
  });

  it("synchronizes new initial inputs only when their reset key changes", () => {
    const harness = createHarness();
    harness.state.selectPoint(GridLocation.NORTH);
    harness.values.initialLeftLocation = GridLocation.WEST;
    harness.values.initialRightLocation = GridLocation.EAST;
    harness.values.resetEpoch += 1;

    harness.state.synchronizeInputs();

    expect(harness.state.leftLocation).toBe(GridLocation.WEST);
    expect(harness.state.rightLocation).toBe(GridLocation.EAST);
    expect(harness.state.activeColor).toBeNull();
    expect(harness.state.historyLength).toBe(0);
  });

  it("keeps external move commands inert when completion editing is disabled", () => {
    const harness = createHarness();
    harness.values.editAfterCompletion = false;

    harness.state.edit(HandSide.RIGHT);

    expect(harness.state.activeColor).toBe(HandSide.LEFT);
    expect(harness.onChange).not.toHaveBeenCalled();
  });
});
