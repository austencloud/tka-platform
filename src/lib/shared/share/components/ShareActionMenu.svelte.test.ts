import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import ShareActionMenuDrawerHarness from "./ShareActionMenu.drawer-regression.test-harness.svelte";

describe("ShareActionMenu in a viewer drawer", () => {
  it("keeps the menu and its trusted pointer action inside the open viewer", async () => {
    render(ShareActionMenuDrawerHarness);

    const viewer = page.getByRole("dialog", { name: "Sequence Viewer" });
    await expect.element(viewer).toBeVisible();

    await page.getByRole("button", { name: "Share sequence" }).click();

    const menu = page.getByRole("menu", { name: "Share sequence" });
    await expect.element(menu).toBeVisible();
    expect(viewer.element().contains(menu.element())).toBe(true);

    await page.getByRole("menuitem", { name: "Share Sequence…" }).click();

    await expect.element(viewer).toBeVisible();
    expect(
      document
        .querySelector('[data-testid="viewer-open-state"]')
        ?.textContent?.trim()
    ).toBe("true");
    expect(
      document
        .querySelector('[data-testid="selected-share-action"]')
        ?.textContent?.trim()
    ).toBe("share-sequence");
  });
});
