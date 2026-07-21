import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import TKAWordGlyphHarness from "./__tests__/TKAWordGlyphHarness.svelte";

vi.mock("$lib/shared/render/get-glyph-cache", () => ({
  getGlyphCache: () => ({
    getGlyphDataUrl: () => "/test-glyph.svg",
  }),
}));

function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

describe("TKAWordGlyph fitToParent", () => {
  it("keeps every glyph inside a narrow host and returns to natural scale", async () => {
    const longWord = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const screen = render(TKAWordGlyphHarness, {
      width: 280,
      word: longWord,
    });

    const host = page.getByTestId("glyph-host").element() as HTMLElement;
    await vi.waitFor(() => {
      expect(host.querySelectorAll("img")).toHaveLength(longWord.length);
    });
    await nextPaint();

    const row = host.querySelector(".glyph-row") as HTMLElement;
    const hostRect = host.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    expect(rowRect.left).toBeGreaterThanOrEqual(hostRect.left - 0.5);
    expect(rowRect.right).toBeLessThanOrEqual(hostRect.right + 0.5);
    expect(row.style.transform).not.toBe("scale(1)");

    await screen.rerender({ width: 280, word: "AB" });
    await nextPaint();

    expect(row.style.transform).toBe("scale(1)");
  });
});
