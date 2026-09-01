import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStartEndOptionsState } from "$lib/features/create/generate/state/start-end-options-state.svelte";
import {
  getBlockedPositionsForPreset,
  StartPositionPreset,
} from "$lib/features/create/generate/shared/domain/start-position-presets";
import {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const { settings, updateSettings } = vi.hoisted(() => {
  const settings: Record<string, unknown> = {};
  return {
    settings,
    updateSettings: vi.fn((updates: Record<string, unknown>) => {
      Object.assign(settings, updates);
    }),
  };
});

vi.mock("$lib/shared/settings/state/settings-state.svelte", () => ({
  settingsService: { settings, updateSettings },
}));

function classicBlocked(gridMode: GridMode) {
  return getBlockedPositionsForPreset(StartPositionPreset.CLASSIC, gridMode);
}

describe("start-position preferences by grid mode", () => {
  beforeEach(() => {
    localStorage.clear();
    updateSettings.mockClear();
    settings.blockedStartPositions = [];
    settings.blockedStartPositionsByGridMode = {};
  });

  it("carries Classic 3 into an unvisited grid, then persists both", () => {
    const diamondPreference = classicBlocked(GridMode.DIAMOND);
    const boxPreference = classicBlocked(GridMode.BOX);
    const state = createStartEndOptionsState(undefined, GridMode.DIAMOND);

    state.updateOptions({ blockedStartPositions: diamondPreference });
    state.setGridMode(GridMode.BOX);

    expect(state.options.blockedStartPositions).toEqual(boxPreference);

    state.setGridMode(GridMode.DIAMOND);
    expect(state.options.blockedStartPositions).toEqual(diamondPreference);

    state.setGridMode(GridMode.BOX);
    expect(state.options.blockedStartPositions).toEqual(boxPreference);

    const restored = createStartEndOptionsState(undefined, GridMode.DIAMOND);
    expect(restored.options.blockedStartPositions).toEqual(diamondPreference);
    restored.setGridMode(GridMode.BOX);
    expect(restored.options.blockedStartPositions).toEqual(boxPreference);
  });

  it("distinguishes a saved All selection from an unvisited grid", () => {
    const diamondPreference = classicBlocked(GridMode.DIAMOND);
    const state = createStartEndOptionsState(undefined, GridMode.DIAMOND);

    state.updateOptions({ blockedStartPositions: diamondPreference });
    state.setGridMode(GridMode.BOX);
    state.updateOptions({ blockedStartPositions: [] });

    state.setGridMode(GridMode.DIAMOND);
    expect(state.options.blockedStartPositions).toEqual(diamondPreference);

    state.setGridMode(GridMode.BOX);
    expect(state.options.blockedStartPositions).toEqual([]);
  });

  it("migrates the legacy preference even when the other grid is active", () => {
    const boxPreference = classicBlocked(GridMode.BOX);
    settings.blockedStartPositions = boxPreference;
    const state = createStartEndOptionsState(undefined, GridMode.DIAMOND);

    expect(state.options.blockedStartPositions).toEqual([]);

    state.setGridMode(GridMode.BOX);
    expect(state.options.blockedStartPositions).toEqual(boxPreference);
  });

  it("restores literal blue/red start orientations", () => {
    localStorage.setItem(
      "tka-start-end-session-options",
      JSON.stringify({
        mustContainLetters: [],
        mustNotContainLetters: [],
        blueStartOrientation: "clock",
        redStartOrientation: "counter",
        timestamp: Date.now(),
      })
    );

    const state = createStartEndOptionsState(undefined, GridMode.DIAMOND);
    expect(state.options.leftStartOrientation).toBe("clock");
    expect(state.options.rightStartOrientation).toBe("counter");
  });

  it("restores custom selections and clears incompatible exact positions", () => {
    const diamondPreference = [GridPosition.ALPHA3, GridPosition.BETA7];
    const boxPreference = [GridPosition.ALPHA4, GridPosition.GAMMA10];
    settings.blockedStartPositions = diamondPreference;
    settings.blockedStartPositionsByGridMode = {
      [GridMode.DIAMOND]: diamondPreference,
      [GridMode.BOX]: boxPreference,
    };
    const state = createStartEndOptionsState(
      {
        startPosition: { letter: "A" } as PictographData,
        endPosition: { letter: "B" } as PictographData,
      },
      GridMode.DIAMOND
    );

    expect(state.setGridMode(GridMode.BOX)).toBe(true);
    expect(state.options.blockedStartPositions).toEqual(boxPreference);
    expect(state.options.startPosition).toBeNull();
    expect(state.options.endPosition).toBeNull();

    state.setGridMode(GridMode.DIAMOND);
    expect(state.options.blockedStartPositions).toEqual(diamondPreference);
  });
});
