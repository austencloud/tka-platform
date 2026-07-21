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

  it("calls onchange with the clicked value and reflects the new selection (aria-pressed) on rerender", async () => {
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

  // The construct option picker swaps the whole turn palette when the level
  // changes (4 buttons at L2, 8 at L3). Segments are keyed + FLIPped for that,
  // and a keyed each is exactly where a stale-node bug would show up.
  it("swaps the rendered segments when the option list itself changes", async () => {
    const onchange = vi.fn();
    const screen = render(SegmentedControl, {
      options: OPTIONS,
      value: "a",
      onchange,
    });

    const GROWN = [
      { value: "a", label: "Alpha" },
      { value: "a2", label: "Delta" },
      { value: "b", label: "Beta" },
      { value: "c", label: "Gamma" },
    ];
    await screen.rerender({ options: GROWN, value: "a", onchange });

    // Arrival rendered, survivor kept its selection.
    await expect.element(page.getByRole("button", { name: "Delta" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Alpha" }))
      .toHaveAttribute("aria-pressed", "true");

    // Shrinking back drops it again — no orphaned node left behind by the key.
    await screen.rerender({ options: OPTIONS, value: "a", onchange });
    expect(page.getByRole("button", { name: "Delta" }).elements()).toHaveLength(0);
  });

  // Icon-only options (the picker's All/Continuous filter) drop the visible
  // label, so the accessible name has to come from aria-label instead.
  it("keeps an accessible name when an option renders as an icon only", async () => {
    render(SegmentedControl, {
      options: [
        { value: "all", label: "All", icon: "fas fa-asterisk" },
        { value: "continuous", label: "Continuous", icon: "fas fa-infinity" },
      ],
      value: "all",
      onchange: vi.fn(),
    });

    await expect
      .element(page.getByRole("button", { name: "Continuous" }))
      .toHaveAttribute("title", "Continuous");
    await expectNoA11yViolations();
  });

  it("has no AAA a11y violations", async () => {
    render(SegmentedControl, { options: OPTIONS, value: "a", onchange: vi.fn() });
    await expectNoA11yViolations();
  });
});
