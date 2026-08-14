import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import FilterChipBase from "./FilterChipBase.svelte";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";

describe("FilterChipBase (toggle mode)", () => {
  it("exposes aria-pressed reflecting `active` on the toggle button", async () => {
    render(FilterChipBase, { label: "Loops", mode: "toggle", active: false });
    const chip = page.getByRole("button", { name: "Loops" });
    await expect.element(chip).toBeVisible();
    await expect.element(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("fires onclick when activated, and reflects the new active prop on rerender", async () => {
    const onclick = vi.fn();
    const screen = render(FilterChipBase, {
      label: "Loops",
      mode: "toggle",
      active: false,
      onclick,
    });

    await page.getByRole("button", { name: "Loops" }).click();
    expect(onclick).toHaveBeenCalledOnce();

    // Controlled component: parent flips `active` → ARIA must follow.
    await screen.rerender({
      label: "Loops",
      mode: "toggle",
      active: true,
      onclick,
    });
    await expect
      .element(page.getByRole("button", { name: "Loops" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("has no AAA a11y violations", async () => {
    render(FilterChipBase, { label: "Loops", mode: "toggle", active: true });
    await expectNoA11yViolations();
  });
});

describe("FilterChipBase (dropdown mode)", () => {
  it("exposes listbox popup semantics with aria-expanded", async () => {
    const screen = render(FilterChipBase, {
      label: "Sort",
      mode: "dropdown",
      expanded: false,
    });
    const chip = page.getByRole("button", { name: "Sort" });
    await expect.element(chip).toHaveAttribute("aria-haspopup", "listbox");
    await expect.element(chip).toHaveAttribute("aria-expanded", "false");

    await screen.rerender({ label: "Sort", mode: "dropdown", expanded: true });
    await expect
      .element(page.getByRole("button", { name: "Sort" }))
      .toHaveAttribute("aria-expanded", "true");
  });
});

describe("FilterChipBase (display mode)", () => {
  it("keeps chip styling without exposing a fake button", async () => {
    render(FilterChipBase, {
      label: "Rotated (quartered)",
      mode: "display",
      active: true,
      chipColor: "#36c3ff",
    });

    const chip = document.querySelector(".filter-chip");
    expect(chip?.tagName).toBe("SPAN");
    expect(chip).toHaveTextContent("Rotated (quartered)");
    expect(document.querySelector("button")).toBeNull();
  });
});
