import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import LaunchpadTile from "./LaunchpadTile.svelte";
import type { LaunchpadTileDef } from "./launchpad-tiles";

const ACTION_TILE = {
  id: "what-is",
  href: "#what-is",
  heading: "What is a CAP?",
  descriptor: "One prop traces a closed loop.",
  span: "1x1",
  color: "#38bdf8",
  icon: "fa-infinity",
  activate: true,
} satisfies LaunchpadTileDef;

describe("LaunchpadTile enhanced actions", () => {
  it("keeps the fallback href and intercepts an ordinary activation", async () => {
    const onActivate = vi.fn();
    render(LaunchpadTile, {
      tile: ACTION_TILE,
      active: false,
      index: 0,
      onActivate,
    });

    const link = page.getByRole("link", { name: /What is a CAP\?/ });
    await expect.element(link).toHaveAttribute("href", "#what-is");

    const element = document.querySelector<HTMLAnchorElement>(
      '[data-tile-id="what-is"] .tile-link'
    );
    expect(element).toBeInstanceOf(HTMLAnchorElement);
    expect(
      document.querySelector('[data-tile-id="what-is"] button.tile-link')
    ).toBeNull();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    element!.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledWith(ACTION_TILE);

    const modifiedClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    element!.dispatchEvent(modifiedClick);

    expect(modifiedClick.defaultPrevented).toBe(false);
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
