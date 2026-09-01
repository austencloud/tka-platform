import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { FocusTrap } from "$lib/shared/foundation/ui/drawer/focus-trap";
import BentoPropGrid from "./BentoPropGrid.svelte";

const CLUB_PICKER_PROPS = [
  PropType.CLUB,
  PropType.CLASSIC_CLUB,
  PropType.TORCH,
  PropType.BIGCLUB,
  PropType.BIGTORCH,
  PropType.FAN,
  PropType.TRIAD,
  PropType.MINIHOOP,
] as const;

describe("BentoPropGrid style chooser", () => {
  beforeEach(async () => {
    await page.viewport(760, 800);
    document.body.style.margin = "0";
  });

  it("shields prop cards behind the popover and selects only the chosen style", async () => {
    const onSelect = vi.fn();
    const drawer = document.createElement("div");
    document.body.append(drawer);

    render(BentoPropGrid, {
      target: drawer,
      props: {
        selectedPropType: PropType.CLUB,
        onSelect,
        allowedProps: CLUB_PICKER_PROPS,
      },
    });
    const focusTrap = new FocusTrap({ returnFocusOnDeactivate: false });
    focusTrap.activate(drawer);

    try {
      const trigger = page.getByRole("button", { name: "Choose Club style" });
      await trigger.click();

      const overlay = page.getByTestId("prop-style-overlay");
      await expect.element(overlay).toBeVisible();
      const overlayBounds = overlay.element().getBoundingClientRect();
      expect(overlayBounds.left).toBe(0);
      expect(overlayBounds.top).toBe(0);
      expect(overlayBounds.width).toBe(window.innerWidth);
      expect(overlayBounds.height).toBe(window.innerHeight);
      expect(getComputedStyle(overlay.element()).pointerEvents).toBe("auto");

      const torchOption = page.getByRole("button", {
        name: "Select Torch prop type",
      });
      const torchBounds = torchOption.element().getBoundingClientRect();
      const hitTarget = document.elementFromPoint(
        torchBounds.left + torchBounds.width / 2,
        torchBounds.top + torchBounds.height / 2
      );
      const positioner = torchOption
        .element()
        .closest<HTMLElement>("[data-bits-floating-content-wrapper]");
      expect(positioner?.inert).toBe(false);
      expect(getComputedStyle(positioner!).zIndex).toBe("300");
      expect(getComputedStyle(overlay.element()).zIndex).toBe("299");
      expect(torchOption.element().contains(hitTarget)).toBe(true);

      await torchOption.click();

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(PropType.TORCH);
      await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    } finally {
      focusTrap.deactivate();
      drawer.remove();
    }
  });

  it("dismisses on the shield without activating the prop underneath", async () => {
    const onSelect = vi.fn();

    render(BentoPropGrid, {
      selectedPropType: PropType.CLUB,
      onSelect,
      allowedProps: CLUB_PICKER_PROPS,
    });

    const trigger = page.getByRole("button", { name: "Choose Club style" });
    await trigger.click();

    const overlay = page.getByTestId("prop-style-overlay");
    await overlay.click({ position: { x: 6, y: window.innerHeight - 6 } });

    expect(onSelect).not.toHaveBeenCalled();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
