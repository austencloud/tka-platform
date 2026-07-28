import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

vi.mock("./PictographGrid.svelte", async () => ({
  default: (
    await import("./StartPositionPickerPresetTestStub.svelte")
  ).default,
}));

vi.mock("./BuildStartPosition.svelte", async () => ({
  default: (
    await import("./StartPositionPickerBuildTestStub.svelte")
  ).default,
}));

import StartPositionPicker from "./StartPositionPicker.svelte";

function pickerState() {
  return {
    positions: [{}],
    allVariations: [],
    selectedPosition: null,
    currentGridMode: GridMode.DIAMOND,
    blueOrientation: Orientation.IN,
    redOrientation: Orientation.IN,
    selectPosition: vi.fn(),
    setBlueOrientation: vi.fn(),
    setRedOrientation: vi.fn(),
    setOrientation: vi.fn(),
    setSelectedPosition: vi.fn(),
    clearSelectedPosition: vi.fn(),
    loadPositions: vi.fn(),
    loadAllVariations: vi.fn(),
    setGridMode: vi.fn(),
    onSelectedPositionChange: vi.fn(),
  };
}

describe("StartPositionPicker paths", () => {
  beforeEach(() => {
    localStorage.removeItem("tka-start-position-picker-prefs");
  });

  it("offers Presets and Build as direct single-select paths", async () => {
    render(StartPositionPicker, {
      startPositionState: pickerState() as never,
      embedded: true,
    });

    await expect.element(page.getByTestId("preset-path")).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Presets" }))
      .toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Build" }).click();
    await expect.element(page.getByTestId("build-path")).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Build" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
