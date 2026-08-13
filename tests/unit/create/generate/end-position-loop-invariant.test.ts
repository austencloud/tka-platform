import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStartEndOptionsState } from "$lib/features/create/generate/state/start-end-options-state.svelte";
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

describe("LOOP end-position invariant", () => {
  beforeEach(() => {
    localStorage.clear();
    updateSettings.mockClear();
    settings.blockedStartPositions = [];
    settings.blockedStartPositionsByGridMode = {};
  });

  it("clears current and legacy end constraints without resetting other customization", () => {
    const startPosition = { letter: "A" } as PictographData;
    const state = createStartEndOptionsState(
      {
        blockedStartPositions: [GridPosition.ALPHA3],
        startPosition,
        endPosition: { letter: "B" } as PictographData,
        endPositions: [GridPosition.ALPHA1, GridPosition.BETA3],
      },
      GridMode.DIAMOND
    );

    expect(state.reconcileLoopEnabled(false)).toBe(false);
    expect(state.options.endPosition).not.toBeNull();
    expect(state.options.endPositions).toEqual([
      GridPosition.ALPHA1,
      GridPosition.BETA3,
    ]);

    expect(state.reconcileLoopEnabled(true)).toBe(true);
    expect(state.options.endPosition).toBeNull();
    expect(state.options.endPositions).toEqual([]);
    expect(state.options.startPosition).toEqual(startPosition);
    expect(state.options.blockedStartPositions).toEqual([GridPosition.ALPHA3]);
    expect(state.reconcileLoopEnabled(true)).toBe(false);

    const restored = createStartEndOptionsState(undefined, GridMode.DIAMOND);
    expect(restored.options.endPosition).toBeNull();
    expect(restored.options.endPositions).toEqual([]);
  });
});
