import { createRawSnippet, type Snippet } from "svelte";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import type { GalleryCatalog } from "../gallery-drill-catalog.svelte";
import GalleryMaxTurnEditor from "./GalleryMaxTurnEditor.svelte";

const catalog = {
  maxTurnIntensityValues: [
    { value: 0.5, label: "≤0.5 turns", count: 180 },
    { value: 1, label: "≤1 turn", count: 305 },
    { value: 3, label: "≤3 turns", count: 564 },
  ],
  maxTurnIntensityCount: 564,
} as GalleryCatalog;

const valueHead = createRawSnippet<
  [title: string, hint?: string, trailing?: Snippet]
>((title) => ({ render: () => `<h2>${title()}</h2>` }));

describe("GalleryMaxTurnEditor", () => {
  it("does not apply the minimum turn limit when the slider mounts", async () => {
    const onPickExclusiveValue = vi.fn();

    render(GalleryMaxTurnEditor, {
      catalog,
      section: "max_turn_intensity",
      adaptiveValueLayout: true,
      isValueApplied: () => false,
      onPickExclusiveValue,
      onApply: vi.fn(),
      valueHead,
    });

    await expect
      .element(page.getByRole("slider", { name: "Maximum turn intensity" }))
      .toHaveAttribute("aria-valuenow", "3.5");
    expect(onPickExclusiveValue).not.toHaveBeenCalled();
  });
});
