import { render } from "vitest-browser-svelte";
import { page } from "@vitest/browser/context";
import { describe, it, expect, vi } from "vitest";
import FilterChipBase from "./FilterChipBase.svelte";

describe("FilterChipBase (toggle mode)", () => {
  it("exposes a switch role with aria-pressed reflecting `active`", async () => {
    render(FilterChipBase, { label: "Loops", mode: "toggle", active: false });
    const chip = page.getByRole("switch", { name: "Loops" });
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

    await page.getByRole("switch", { name: "Loops" }).click();
    expect(onclick).toHaveBeenCalledOnce();

    // Controlled component: parent flips `active` → ARIA must follow.
    await screen.rerender({ label: "Loops", mode: "toggle", active: true, onclick });
    await expect
      .element(page.getByRole("switch", { name: "Loops" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
