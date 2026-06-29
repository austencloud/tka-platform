import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import SegmentedControl from "./SegmentedControl.svelte";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("SegmentedControl", () => {
  it("marks exactly the selected option as pressed", async () => {
    render(SegmentedControl, { options: OPTIONS, value: "a", onchange: vi.fn() });
    await expect
      .element(page.getByRole("button", { name: "Alpha" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect
      .element(page.getByRole("button", { name: "Beta" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("calls onchange with the clicked value and moves the indicator on rerender", async () => {
    const onchange = vi.fn();
    const screen = render(SegmentedControl, {
      options: OPTIONS,
      value: "a",
      onchange,
    });

    await page.getByRole("button", { name: "Beta" }).click();
    expect(onchange).toHaveBeenCalledWith("b");

    await screen.rerender({ options: OPTIONS, value: "b", onchange });
    await expect
      .element(page.getByRole("button", { name: "Beta" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect
      .element(page.getByRole("button", { name: "Alpha" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("has no AAA a11y violations", async () => {
    render(SegmentedControl, { options: OPTIONS, value: "a", onchange: vi.fn() });
    await expectNoA11yViolations();
  });
});
