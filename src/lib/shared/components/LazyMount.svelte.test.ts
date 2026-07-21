import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import LazyMountTestHarness from "./LazyMountTestHarness.svelte";

describe("LazyMount recovery", () => {
  it("retries a recoverable loader rejection from a visible error state", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    render(LazyMountTestHarness);

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Test component did not load.");

    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByText("Loaded after retry")).toBeVisible();
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});
