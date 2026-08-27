import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import CrossfadeTestHarness from "./CrossfadeTestHarness.svelte";

/**
 * The invariants here are the silent-failure class: a duplicated layer or a
 * frozen animateHeight box after an interrupted swap looks fine one frame
 * later in casual use and only shows up as intermittent layout jumps. Prop
 * Studio's build deck leans on both (rapid Triad/Trigeng toggling).
 */

const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

function layers(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".crossfade > .layer")];
}

describe("Crossfade interruption", () => {
  it("settles to exactly one layer with the final content after rapid key changes", async () => {
    const { container } = render(CrossfadeTestHarness);

    await page.getByRole("button", { name: "Rapid toggle" }).click();
    await settle();

    const settled = layers(container);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.textContent).toContain("beta panel");
  });

  it("eases the box to the final layer's height, not a stale interrupted one", async () => {
    const { container } = render(CrossfadeTestHarness);

    await page.getByRole("button", { name: "Rapid toggle" }).click();
    await settle();

    const box = container.querySelector<HTMLElement>(".crossfade");
    expect(box).not.toBeNull();
    // beta's panel is 160px tall; an interrupted height animation that froze
    // partway would leave the box between 60 and 160.
    expect(box!.getBoundingClientRect().height).toBeCloseTo(160, 0);
  });

  it("keeps tracking heights across later swaps after an interruption", async () => {
    const { container } = render(CrossfadeTestHarness);

    await page.getByRole("button", { name: "Rapid toggle" }).click();
    await settle();
    await page.getByRole("button", { name: "Show gamma" }).click();
    await settle();

    const settled = layers(container);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.textContent).toContain("gamma panel");
    const box = container.querySelector<HTMLElement>(".crossfade");
    expect(box!.getBoundingClientRect().height).toBeCloseTo(100, 0);
  });

  it("eases a taller layer back down instead of snapping to the short height", async () => {
    render(CrossfadeTestHarness);

    await page.getByRole("button", { name: "Measure collapse" }).click();
    await settle();

    const midpoint = Number(
      page.getByTestId("collapse-midpoint").element().textContent
    );
    expect(midpoint).toBeGreaterThan(60);
    expect(midpoint).toBeLessThan(160);
  });
});
