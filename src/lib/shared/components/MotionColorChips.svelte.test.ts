import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import MotionColorChips from "./MotionColorChips.svelte";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";

describe("MotionColorChips", () => {
  it("clicking the blue chip calls onToggleBlue and leaves onToggleRed untouched", async () => {
    const onToggleBlue = vi.fn();
    const onToggleRed = vi.fn();
    render(MotionColorChips, {
      showBlue: true,
      showRed: true,
      onToggleBlue,
      onToggleRed,
    });

    // Label when showBlue=true is "Hide left motion"
    await page.getByRole("button", { name: "Hide left motion" }).click();
    expect(onToggleBlue).toHaveBeenCalledTimes(1);
    expect(onToggleRed).not.toHaveBeenCalled();
  });

  it("clicking the red chip calls onToggleRed and leaves onToggleBlue untouched", async () => {
    const onToggleBlue = vi.fn();
    const onToggleRed = vi.fn();
    render(MotionColorChips, {
      showBlue: true,
      showRed: true,
      onToggleBlue,
      onToggleRed,
    });

    // Label when showRed=true is "Hide right motion"
    await page.getByRole("button", { name: "Hide right motion" }).click();
    expect(onToggleRed).toHaveBeenCalledTimes(1);
    expect(onToggleBlue).not.toHaveBeenCalled();
  });

  it("aria-pressed reflects showBlue/showRed and updates on rerender", async () => {
    const screen = render(MotionColorChips, {
      showBlue: true,
      showRed: false,
      onToggleBlue: vi.fn(),
      onToggleRed: vi.fn(),
    });

    // showBlue=true → aria-pressed="true" (label="Hide left motion")
    await expect
      .element(page.getByRole("button", { name: "Hide left motion" }))
      .toHaveAttribute("aria-pressed", "true");
    // showRed=false → aria-pressed="false" (label="Show right motion")
    await expect
      .element(page.getByRole("button", { name: "Show right motion" }))
      .toHaveAttribute("aria-pressed", "false");

    // Flip showBlue to false — aria-pressed and label must update
    await screen.rerender({
      showBlue: false,
      showRed: false,
      onToggleBlue: vi.fn(),
      onToggleRed: vi.fn(),
    });
    await expect
      .element(page.getByRole("button", { name: "Show left motion" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("has no AAA a11y violations", async () => {
    render(MotionColorChips, {
      showBlue: true,
      showRed: true,
      onToggleBlue: vi.fn(),
      onToggleRed: vi.fn(),
    });
    await expectNoA11yViolations();
  });
});
