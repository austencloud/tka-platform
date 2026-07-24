import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WordHeader from "./WordHeader.svelte";

const glyphCacheState = vi.hoisted(() => ({
  loaded: new Set<string>(),
  loadCalls: [] as string[][],
  pendingLetters: [] as string[],
  resolvePending: null as (() => void) | null,
}));

vi.mock("$app/environment", () => ({
  browser: true,
  building: false,
  dev: false,
  version: "test",
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

beforeEach(() => {
  glyphCacheState.loaded.clear();
  glyphCacheState.loadCalls.length = 0;
  glyphCacheState.pendingLetters = [];
  glyphCacheState.resolvePending = null;
});

describe("WordHeader glyph loading", () => {
  it("keeps a Greek letter visible while loading and repaints from the cache", async () => {
    render(WordHeader, {
      word: "γ",
      visible: true,
    });

    await vi.waitFor(() => {
      expect(document.querySelector(".letter")?.textContent).toContain("γ");
    });

    const fallback = document.querySelector(".letter") as HTMLElement;
    expect(getComputedStyle(fallback).fontFamily).toContain("TKA Letters");
    await vi.waitFor(() => {
      expect(glyphCacheState.loadCalls).toEqual([["γ"]]);
    });

    glyphCacheState.resolvePending?.();

    await vi.waitFor(() => {
      expect(document.querySelector('img[alt="γ"]')).not.toBeNull();
    });
  });
});
