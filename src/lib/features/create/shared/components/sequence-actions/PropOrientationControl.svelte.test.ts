import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, it, expect, vi } from "vitest";
import PropOrientationControl from "./PropOrientationControl.svelte";
import { expectNoA11yViolations } from "$test-helpers/component-a11y";

describe("PropOrientationControl", () => {
  it("shows the current orientation as the selected option", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange: vi.fn(),
    });
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to In" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("emits exactly the picked orientation", async () => {
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange,
    });

    await page
      .getByRole("radio", { name: "Set blue orientation to Out" })
      .click();

    expect(onOrientationChange).toHaveBeenCalledTimes(1);
    expect(onOrientationChange).toHaveBeenCalledWith("out");
  });

  it("reaches a far orientation in one press, not three", async () => {
    // This is the whole point of the change: Counter used to be three steps
    // around a cycle whose order was not written down anywhere on screen.
    const onOrientationChange = vi.fn();
    render(PropOrientationControl, {
      color: "red",
      orientation: "in",
      onOrientationChange,
    });

    await page
      .getByRole("radio", { name: "Set red orientation to CCW" })
      .click();

    expect(onOrientationChange).toHaveBeenCalledTimes(1);
    expect(onOrientationChange).toHaveBeenCalledWith("counter");
  });

  it("removes orientations outside the host's allowed vocabulary", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      allowedOrientations: ["in", "out"],
      onOrientationChange: vi.fn(),
    });

    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to In" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to Out" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to CW" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to CCW" }))
      .not.toBeInTheDocument();
  });

  it("offers the interradial orientations only when asked to", async () => {
    render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      showInterradial: true,
      onOrientationChange: vi.fn(),
    });

    await expect
      .element(
        page.getByRole("radio", { name: "Set blue orientation to CW·In" })
      )
      .toBeVisible();
  });

  it("tracks the controlled orientation prop on rerender", async () => {
    const screen = render(PropOrientationControl, {
      color: "blue",
      orientation: "in",
      onOrientationChange: vi.fn(),
    });
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to In" }))
      .toHaveAttribute("aria-checked", "true");

    await screen.rerender({
      color: "blue",
      orientation: "out",
      onOrientationChange: vi.fn(),
    });
    await expect
      .element(page.getByRole("radio", { name: "Set blue orientation to Out" }))
      .toHaveAttribute("aria-checked", "true");
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
