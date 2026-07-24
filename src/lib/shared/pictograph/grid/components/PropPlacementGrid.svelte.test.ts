import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

vi.mock(
  "$lib/shared/pictograph/shared/components/PictographContainer.svelte",
  async () => ({
    default: (await import("./PropPlacementGridTestRenderer.svelte")).default,
  })
);

import PropPlacementGrid from "./PropPlacementGrid.svelte";

describe("PropPlacementGrid", () => {
  it("places blue then red and permits a shared point", async () => {
    const onChange = vi.fn();
    const onPlacementComplete = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.DIAMOND,
      bluePropType: PropType.TORCH,
      redPropType: PropType.BIGTORCH,
      onChange,
      onPlacementComplete,
    });

    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Place the blue prop");

    await page.getByRole("button", { name: "East point" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: null,
      activeColor: "red",
      complete: false,
    });
    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Place the red prop");

    await page.getByRole("button", { name: "East point (blue prop)" }).click();
    expect(onPlacementComplete).toHaveBeenCalledWith(
      GridLocation.EAST,
      GridLocation.EAST
    );
    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Pose ready");
  });

  it("edits either prop after completion and restores one placement with Undo", async () => {
    const onChange = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.DIAMOND,
      initialBlueLocation: GridLocation.EAST,
      initialRedLocation: GridLocation.WEST,
      editAfterCompletion: true,
      onChange,
    });

    await page.getByRole("button", { name: "Move red" }).click();
    await page.getByRole("button", { name: "North point" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.NORTH,
      activeColor: null,
      complete: true,
    });

    await page.getByRole("button", { name: "Undo placement" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.WEST,
      activeColor: "red",
      complete: true,
    });
  });

  it("supports keyboard placement on the Box grid", async () => {
    const onChange = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.BOX,
      onChange,
    });

    const northeast = page.getByRole("button", {
      name: "Northeast point",
    });
    const element = northeast.element() as SVGCircleElement;
    element.focus();
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.NORTHEAST,
      redLocation: null,
      activeColor: "red",
      complete: false,
    });
  });
});
