import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TKAWordGlyphHarness from "./__tests__/TKAWordGlyphHarness.svelte";

const glyphCacheState = vi.hoisted(() => ({
  loaded: new Set<string>(),
  loadCalls: [] as string[][],
  pendingLetters: [] as string[],
  resolvePending: null as (() => void) | null,
}));

vi.mock("$lib/shared/render/get-glyph-cache", () => ({
  getGlyphCache: () => ({
    getGlyphDataUrl: (letter: string) =>
      glyphCacheState.loaded.has(letter) ? "/test-glyph.svg" : null,
    loadGlyphsByLetter: (letters: string[]) => {
      glyphCacheState.loadCalls.push([...letters]);
      glyphCacheState.pendingLetters = [...letters];

      return new Promise<void>((resolve) => {
        glyphCacheState.resolvePending = () => {
          for (const letter of glyphCacheState.pendingLetters) {
            glyphCacheState.loaded.add(letter);
          }
          resolve();
        };
      });
    },
  }),
}));

function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

beforeEach(() => {
  glyphCacheState.loaded.clear();
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    glyphCacheState.loaded.add(letter);
  }
  glyphCacheState.loadCalls.length = 0;
  glyphCacheState.pendingLetters = [];
  glyphCacheState.resolvePending = null;
});

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

  it("uses the TKA font while a Greek glyph loads, then swaps in its SVG", async () => {
    render(TKAWordGlyphHarness, {
      width: 280,
      word: "γ",
    });

    const host = page.getByTestId("glyph-host").element() as HTMLElement;
    await vi.waitFor(() => {
      expect(host.querySelector(".glyph-fallback")?.textContent).toBe("γ");
    });

    const fallback = host.querySelector(".glyph-fallback") as HTMLElement;
    expect(getComputedStyle(fallback).fontFamily).toContain("TKA Letters");
    expect(glyphCacheState.loadCalls).toEqual([["γ"]]);

    glyphCacheState.resolvePending?.();

    await vi.waitFor(() => {
      expect(host.querySelector('img[alt="γ"]')).not.toBeNull();
    });
    expect(host.querySelector(".glyph-fallback")).toBeNull();
  });
});
