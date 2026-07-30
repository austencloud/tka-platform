import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import PropOrientationControl from "./PropOrientationControl.svelte";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";

describe("PropOrientationControl", () => {
  it("shows the current orientation label", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange: vi.fn(),
    });
    await expect.element(page.getByText("In")).toBeVisible();
  });

  it("emits exactly the picked orientation from the popover (the bug's control)", async () => {
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange,
    });

    await page.getByRole("button", { name: "Select blue orientation" }).click();
    await page
      .getByRole("button", { name: "Set blue orientation to Out" })
      .click();

    expect(onOrientationChange).toHaveBeenCalledTimes(1);
    expect(onOrientationChange).toHaveBeenCalledWith("out");
  });

  it("cycles to the next cardinal orientation (in → counter)", async () => {
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "red",
      orientation: "in",
      onOrientationChange,
    });
    await page.getByRole("button", { name: "Next red orientation" }).click();
    expect(onOrientationChange).toHaveBeenCalledWith("counter");
  });

  it("removes orientations outside the host's allowed vocabulary", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      allowedOrientations: ["in", "out"],
      onOrientationChange: vi.fn(),
    });

    await page.getByRole("button", { name: "Select blue orientation" }).click();

    await expect
      .element(page.getByRole("button", { name: "Set blue orientation to In" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Set blue orientation to Out" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Set blue orientation to CW" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Set blue orientation to CCW" }))
      .not.toBeInTheDocument();
  });

  it("cycles only through the host's allowed vocabulary", async () => {
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "red",
      orientation: "in",
      allowedOrientations: ["in", "out"],
      onOrientationChange,
    });

    await page.getByRole("button", { name: "Next red orientation" }).click();

    expect(onOrientationChange).toHaveBeenCalledWith("out");
  });

  it("tracks the controlled orientation prop on rerender", async () => {
    const screen = render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange: vi.fn(),
    });
    await expect.element(page.getByText("In")).toBeVisible();

    await screen.rerender({
      color: "blue",
      orientation: "out",
      onOrientationChange: vi.fn(),
    });
    await expect.element(page.getByText("Out")).toBeVisible();
  });

  it("has no AAA a11y violations", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange: vi.fn(),
    });
    await expectNoA11yViolations();
  });
});
