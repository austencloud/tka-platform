import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import LazyMountLifecycleTestHarness from "./LazyMountLifecycleTestHarness.svelte";
import LazyMountTestHarness from "./LazyMountTestHarness.svelte";

describe("LazyMount recovery", () => {
  it("retries a recoverable loader rejection from a visible error state", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    render(LazyMountTestHarness);

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Test component did not load.");
    await expect
      .element(page.getByRole("status", { name: "Lazy mount status" }))
      .toHaveTextContent("error");

    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByText("Loaded after retry")).toBeVisible();
    await expect
      .element(page.getByRole("status", { name: "Lazy mount status" }))
      .toHaveTextContent("loaded");
    expect(errorLog).toHaveBeenCalledWith(
      "[LazyMount] failed to load test component",
      expect.any(Error)
    );
    errorLog.mockRestore();
  });

  it("settles a late rejection without reporting it after teardown", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    render(LazyMountLifecycleTestHarness);

    await expect
      .element(page.getByRole("status", { name: "Lazy mount teardown status" }))
      .toHaveTextContent("loading");

    await page.getByRole("button", { name: "Close loader" }).click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect
      .element(page.getByRole("status", { name: "Lazy mount teardown status" }))
      .toHaveTextContent("loading");
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
