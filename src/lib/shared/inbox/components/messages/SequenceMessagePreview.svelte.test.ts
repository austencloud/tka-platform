import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/shared/choreo-card/components/TKAWordGlyph.svelte", async () => ({
  default: (await import("./SequenceMessagePreviewGlyphTestStub.svelte"))
    .default,
}));

import SequenceMessagePreview from "./SequenceMessagePreview.svelte";

class IdleIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("SequenceMessagePreview activation", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IdleIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays static until Play is activated and exposes resolution failure", async () => {
    let finishResolution: (value: null) => void = () => {};
    const loadSequence = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          finishResolution = resolve;
        })
    );

    render(SequenceMessagePreview, {
      word: "YR0L",
      loadSequence,
    });

    const playButton = page.getByRole("button", {
      name: "Play YR0L preview",
    });
    await expect.element(playButton).toBeVisible();
    expect(loadSequence).not.toHaveBeenCalled();
    expect(document.querySelector("button button")).toBeNull();

    await playButton.click();
    expect(loadSequence).toHaveBeenCalledOnce();
    await expect.element(playButton).toBeDisabled();
    await expect.element(page.getByText("Loading")).toBeVisible();

    finishResolution(null);
    await expect.element(page.getByText("Preview unavailable")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
  });
});
