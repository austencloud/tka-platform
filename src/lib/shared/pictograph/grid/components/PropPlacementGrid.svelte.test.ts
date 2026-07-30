import { commands, page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
// Type-only: pulls in the BrowserCommands augmentation without bundling the
// node-side command implementation into the browser.
import type {} from "$test-helpers/browser-commands/real-touch";

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
      .toHaveTextContent("Place the left prop");

    await page.getByRole("button", { name: "East point" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: null,
      activeColor: "red",
      complete: false,
      canUndo: true,
    });
    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Place the right prop");

    await page.getByRole("button", { name: "East point (left prop)" }).click();
    expect(onPlacementComplete).toHaveBeenCalledWith(
      GridLocation.EAST,
      GridLocation.EAST
    );
    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Position ready");
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

    await page.getByRole("button", { name: "Move right prop" }).click();
    await page.getByRole("button", { name: "North point" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.NORTH,
      activeColor: null,
      complete: true,
      canUndo: true,
    });

    await page.getByRole("button", { name: "Undo placement" }).click();
    expect(onChange).toHaveBeenLastCalledWith({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.WEST,
      activeColor: "red",
      complete: true,
      // The undo just consumed the only entry in the history.
      canUndo: false,
    });
  });

  it("commits a dragged aim under REAL touch input (regression: gesture-arbitration pointercancel)", async () => {
    // Real CDP touch, not dispatchEvent: the 2026-07-29 bug was Chromium
    // stealing the drag with a `pointercancel` (touch-action: none on the SVG
    // circle is not honoured; it must sit on the HTML .grid-wrapper). A
    // synthetic-event version of this test passes even with the bug present.
    const onOrientationChange = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.DIAMOND,
      onOrientationChange,
    });

    const north = page.getByRole("button", { name: "North point" });
    const rect = (north.element() as SVGCircleElement).getBoundingClientRect();
    const from = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    // Drag away from center (north) — for the North point that renders as OUT,
    // which differs from the default IN, so a commit is observable.
    await commands.dispatchRealTouchDrag(from, { x: from.x, y: from.y - 80 });

    expect(onOrientationChange).toHaveBeenCalledWith(
      MotionColor.BLUE,
      Orientation.OUT
    );
  });

  it("re-aims a prop from an already-complete position", async () => {
    const onOrientationChange = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.DIAMOND,
      initialBlueLocation: GridLocation.EAST,
      initialRedLocation: GridLocation.WEST,
      betaSwapped: true,
      editAfterCompletion: true,
      renderTray: false,
      hitTargetRadius: 160,
      onOrientationChange,
    });

    await expect
      .element(page.getByTestId("placement-prompt"))
      .toHaveTextContent("Drag a prop to aim it");
    await expect
      .element(page.getByTestId("placement-pictograph"))
      .toHaveAttribute("data-beta-swapped", "true");

    const east = page.getByRole("button", {
      name: "East point (left prop)",
    });
    expect((east.element() as SVGCircleElement).getAttribute("r")).toBe("160");
    const rect = (east.element() as SVGCircleElement).getBoundingClientRect();
    const from = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    await commands.dispatchRealTouchDrag(from, {
      x: from.x + 80,
      y: from.y,
    });

    expect(onOrientationChange).toHaveBeenCalledWith(
      MotionColor.BLUE,
      Orientation.OUT
    );
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
      canUndo: true,
    });
  });

  it("offers merged and center placement with center-safe aiming", async () => {
    const onOrientationChange = vi.fn();
    render(PropPlacementGrid, {
      gridMode: GridMode.SKEWED,
      showCenter: true,
      onOrientationChange,
    });

    expect(document.querySelectorAll(".click-target")).toHaveLength(9);
    await page.getByRole("button", { name: "Center point" }).click();

    expect(onOrientationChange).toHaveBeenCalledWith(
      MotionColor.BLUE,
      Orientation.CENTER_N
    );
  });
});
