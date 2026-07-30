import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

vi.mock(
  "$lib/shared/pictograph/shared/components/PictographContainer.svelte",
  async () => ({
    default: (
      await import("$lib/shared/pictograph/grid/components/PropPlacementGridTestRenderer.svelte")
    ).default,
  })
);

import BuildStartPosition from "./BuildStartPosition.svelte";

describe("BuildStartPosition", () => {
  it("applies merged and center poses through the Assemble placement contract", async () => {
    const onBlueOrientationChange = vi.fn();
    const onRedOrientationChange = vi.fn();
    const onApplyPlacement = vi.fn();

    render(BuildStartPosition, {
      gridMode: GridMode.SKEWED,
      showCenter: true,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      blueOrientation: Orientation.IN,
      redOrientation: Orientation.OUT,
      onBlueOrientationChange,
      onRedOrientationChange,
      onApplyPlacement,
    });

    const center = page.getByRole("button", { name: "Center point" });
    const centerElement = center.element() as SVGCircleElement;
    centerElement.focus();
    centerElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await expect
      .element(page.getByRole("button", { name: "Center point (left prop)" }))
      .toBeVisible();
    const north = page.getByRole("button", { name: "North point" });
    const northElement = north.element() as SVGCircleElement;
    northElement.focus();
    northElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await expect
      .element(page.getByRole("button", { name: "North point (right prop)" }))
      .toBeVisible();
    const applyButton = page
      .getByRole("button", {
        name: "Use this position",
      })
      .element() as HTMLButtonElement;
    expect(applyButton.disabled).toBe(false);
    applyButton.click();

    expect(onBlueOrientationChange).toHaveBeenCalledWith(Orientation.CENTER_N);
    await vi.waitFor(() =>
      expect(onApplyPlacement).toHaveBeenCalledWith(
        expect.objectContaining({
          blueLocation: GridLocation.CENTER,
          redLocation: GridLocation.NORTH,
          gridMode: GridMode.SKEWED,
          blueOrientation: Orientation.CENTER_N,
          redOrientation: Orientation.OUT,
        })
      )
    );
  });
});
