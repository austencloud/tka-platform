import { isBackgroundInteractionBlocked } from "$lib/shared/background/shared/background-interaction-routing";
import { afterEach, describe, expect, it } from "vitest";

function mount(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  return document.body.firstElementChild as HTMLElement;
}

describe("background interaction routing", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lets transparent structural wrappers pass through to the ocean", () => {
    const target = mount(
      '<main><section><div id="target"></div></section></main>'
    ).querySelector("#target");

    expect(isBackgroundInteractionBlocked(target)).toBe(false);
  });

  it("keeps controls and visible content from triggering the ocean", () => {
    const root = mount(
      '<div><button id="button">Play</button><h2 id="heading">Sequence</h2><span id="label">Count</span></div>'
    );

    expect(isBackgroundInteractionBlocked(root.querySelector("#button"))).toBe(
      true
    );
    expect(isBackgroundInteractionBlocked(root.querySelector("#heading"))).toBe(
      true
    );
    expect(isBackgroundInteractionBlocked(root.querySelector("#label"))).toBe(
      true
    );
  });

  it("gives an entire foreground panel ownership of clicks in its empty space", () => {
    const panel = mount(
      '<div style="background-color: rgba(10, 20, 30, 0.72)"><div id="empty"></div></div>'
    );

    expect(isBackgroundInteractionBlocked(panel.querySelector("#empty"))).toBe(
      true
    );
  });

  it("supports an explicit block for foreground surfaces painted by pseudo-elements", () => {
    const surface = mount(
      '<div data-background-interaction="block"><div id="empty"></div></div>'
    );

    expect(
      isBackgroundInteractionBlocked(surface.querySelector("#empty"))
    ).toBe(true);
  });
});
