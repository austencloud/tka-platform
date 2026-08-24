import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import ConstructGuideEntry from "./ConstructGuideEntry.svelte";

describe("ConstructGuideEntry analytics boundary", () => {
  it("records a rendered offer and an unchosen departure", async () => {
    const onOfferViewed = vi.fn();
    const onOfferIgnored = vi.fn();
    const screen = render(ConstructGuideEntry, {
      offerVisible: true,
      onOfferViewed,
      onOfferIgnored,
    });

    await expect
      .element(page.getByText("New to Construct?", { exact: true }))
      .toBeVisible();
    expect(onOfferViewed).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event("pagehide"));
    expect(onOfferIgnored).toHaveBeenCalledOnce();
    expect(onOfferIgnored.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(0);

    screen.unmount();
    expect(onOfferIgnored).toHaveBeenCalledOnce();
  });

  it("does not call an explicit choice ignored", async () => {
    const onShowGuide = vi.fn();
    const onOfferIgnored = vi.fn();
    const screen = render(ConstructGuideEntry, {
      offerVisible: true,
      onShowGuide,
      onOfferIgnored,
    });

    await page.getByRole("button", { name: "Show guide" }).click();
    expect(onShowGuide).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event("pagehide"));
    screen.unmount();
    expect(onOfferIgnored).not.toHaveBeenCalled();
  });
});
