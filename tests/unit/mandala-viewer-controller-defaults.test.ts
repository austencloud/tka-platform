import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { effect_root } from "svelte/internal/client";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  MandalaViewerController,
  type MandalaViewState,
} from "$lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte";

const VIEW_STORAGE_KEY = "tka_mandala_view_state";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MandalaViewerController view overrides", () => {
  it("uses local color defaults without replacing the saved viewer palette", () => {
    const savedView: MandalaViewState = {
      pathShape: "concave",
      rotation: 45,
      speed: 1.5,
      depth: 80,
      colorMode: "flow",
      preset: "custom",
      customBlue: "#123456",
      customRed: "#654321",
      lineWeight: 4,
    };
    const storage = new Map([[VIEW_STORAGE_KEY, JSON.stringify(savedView)]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });

    let controller!: MandalaViewerController;
    const cleanup = effect_root(() => {
      controller = new MandalaViewerController(
        {
          getSequence: () => ({ steps: [] }) as SequenceData,
          getBluePropType: () => "staff",
          getRedPropType: () => "staff",
        },
        {
          viewOverrides: {
            colorMode: "solid",
            preset: "custom",
            customBlue: "#0000ff",
            customRed: "#ff0000",
          },
          persistViewState: false,
        }
      );
    });

    expect(controller.colorMode).toBe("solid");
    expect(controller.show).toBe("both");
    expect(controller.customBlue).toBe("#0000ff");
    expect(controller.customRed).toBe("#ff0000");
    expect(controller.pathShape).toBe("concave");

    controller.customBlue = "#00ffff";
    controller.show = "blue";
    flushSync();
    expect(controller.show).toBe("blue");
    expect(JSON.parse(storage.get(VIEW_STORAGE_KEY)!)).toEqual(savedView);

    cleanup();
  });
});
