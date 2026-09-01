// @vitest-environment jsdom

import { effect_root } from "svelte/internal/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChoreoCardSizingState } from "$lib/shared/choreo-card/state/choreo-card-sizing-state.svelte";

const disposals: Array<() => void> = [];

afterEach(() => {
  while (disposals.length > 0) disposals.pop()?.();
  vi.unstubAllGlobals();
});

describe("ChoreoCard contained sizing motion", () => {
  it("restores the captured split box instead of chasing the returning panel", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        disconnect(): void {}
      }
    );
    const container = document.createElement("div");
    let exposeContainer = false;
    let phase: "focus" | "return" | null = null;
    let sizing!: ReturnType<typeof createChoreoCardSizingState>;

    const dispose = effect_root(() => {
      sizing = createChoreoCardSizingState(() => ({
        containerElement: exposeContainer ? container : undefined,
        previewStackElement: undefined,
        previewAspectRatio: 322 / 280,
        forceContain: true,
        needsScroll: false,
        fitWidth: true,
        containSizeMotion: phase,
        containModel: {
          cols: 4,
          gridHeightUnits: 3,
          headerUnits: 0,
          footerUnits: 0,
          headerMinPx: 0,
        },
      }));
    });
    disposals.push(dispose);

    const update = (width: number, height: number) => {
      exposeContainer = true;
      sizing.updateContainedDimensions({ width, height });
      exposeContainer = false;
    };

    update(322, 280);
    expect([sizing.containedWidth, sizing.containedHeight]).toEqual([322, 280]);
    expect(sizing.flipSuppressed).toBe(false);

    phase = "focus";
    update(375, 561);
    expect(sizing.containedWidth).toBe(375);
    expect(sizing.flipSuppressed).toBe(true);

    phase = null;
    update(375, 561);
    expect(sizing.flipSuppressed).toBe(false);
    phase = "return";
    update(375, 400);

    expect([sizing.containedWidth, sizing.containedHeight]).toEqual([322, 280]);
    expect(sizing.flipSuppressed).toBe(true);

    phase = null;
    update(322, 280);
    phase = "restore";
    update(8, 280);
    expect([sizing.containedWidth, sizing.containedHeight]).toEqual([322, 280]);
    expect(sizing.flipSuppressed).toBe(true);
  });
});
