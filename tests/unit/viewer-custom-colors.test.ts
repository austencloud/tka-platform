import { afterEach, describe, expect, it, vi } from "vitest";
import { effect_root } from "svelte/internal/client";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import {
  DEFAULT_VIEWER_CUSTOM_COLORS,
  resolveViewerCustomColorPair,
} from "$lib/shared/sequence-viewer/domain/viewer-custom-colors";
import {
  STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY,
  VIEWER_CUSTOM_COLORS_STORAGE_KEY,
  consumeStagedViewerCustomColors,
  loadViewerCustomColorPreference,
  saveViewerCustomColorPreference,
  stageViewerCustomColors,
} from "$lib/shared/sequence-viewer/services/viewer-custom-color-preferences";
import { createViewerCustomColorState } from "$lib/shared/sequence-viewer/state/viewer-custom-colors-state.svelte";
import { MandalaViewerController } from "$lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte";
import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("viewer custom color preference", () => {
  it("normalizes the canonical pair and round-trips its versioned record", () => {
    const storage = new MemoryStorage();

    saveViewerCustomColorPreference(
      { blue: " #0DF ", red: "#FFB000" },
      storage
    );

    expect(loadViewerCustomColorPreference(storage)).toEqual({
      blue: "#00ddff",
      red: "#ffb000",
    });
    expect(
      JSON.parse(storage.getItem(VIEWER_CUSTOM_COLORS_STORAGE_KEY)!)
    ).toEqual({
      version: 1,
      colors: { blue: "#00ddff", red: "#ffb000" },
    });
  });

  it("migrates the one authored legacy pair instead of the other surface's default", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "tka_tunnel_view_state",
      JSON.stringify({
        colors: { mode: "custom", custom: DEFAULT_VIEWER_CUSTOM_COLORS },
      })
    );
    storage.setItem(
      "tka_mandala_view_state",
      JSON.stringify({ customBlue: "#123456", customRed: "#abcdef" })
    );

    expect(loadViewerCustomColorPreference(storage)).toEqual({
      blue: "#123456",
      red: "#abcdef",
    });
  });

  it("uses Tunnel deterministically when both legacy pairs were authored", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "tka_tunnel_view_state",
      JSON.stringify({
        colors: {
          mode: "custom",
          custom: { blue: "#112233", red: "#445566" },
        },
      })
    );
    storage.setItem(
      "tka_mandala_view_state",
      JSON.stringify({ customBlue: "#778899", customRed: "#aabbcc" })
    );

    expect(loadViewerCustomColorPreference(storage)).toEqual({
      blue: "#112233",
      red: "#445566",
    });
  });

  it("can inspect a legacy preference without writing from an ephemeral editor", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "tka_mandala_view_state",
      JSON.stringify({ customBlue: "#123456", customRed: "#abcdef" })
    );

    expect(loadViewerCustomColorPreference(storage, false)).toEqual({
      blue: "#123456",
      red: "#abcdef",
    });
    expect(storage.getItem(VIEWER_CUSTOM_COLORS_STORAGE_KEY)).toBeNull();
  });

  it("consumes a staged artifact pair once without writing a preference", () => {
    const storage = new MemoryStorage();
    stageViewerCustomColors({ blue: "#123456", red: "#abcdef" }, storage);

    expect(consumeStagedViewerCustomColors(storage)).toEqual({
      blue: "#123456",
      red: "#abcdef",
    });
    expect(storage.getItem(STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY)).toBeNull();
    expect(consumeStagedViewerCustomColors(storage)).toBeNull();
  });
});

describe("shared viewer custom color state", () => {
  it("synchronizes both controllers without changing either appearance mode", () => {
    const persist = vi.fn();
    const state = createViewerCustomColorState(
      resolveViewerCustomColorPair({ blue: "#001122", red: "#334455" }),
      persist
    );
    const pathPolicy = new AnimationVisibilityStateManager({ ephemeral: true });
    let tunnel!: TunnelViewController;
    let mandala!: MandalaViewerController;

    const cleanup = effect_root(() => {
      tunnel = new TunnelViewController({
        getSequence: () => ({ steps: [] }) as SequenceData,
        customColorState: state,
        persistViewState: false,
      });
      mandala = new MandalaViewerController(
        {
          getSequence: () => ({ steps: [] }) as SequenceData,
          getBluePropType: () => "staff",
          getRedPropType: () => "staff",
          pathPolicy,
          customColorState: state,
        },
        { persistViewState: false }
      );
    });

    tunnel.colorMode = "hands";
    mandala.preset = "aurora";
    mandala.colorMode = "flow";

    tunnel.setCustomPropColor("blue", "#00d4ff");
    expect(mandala.customBlue).toBe("#00d4ff");
    expect(tunnel.colorMode).toBe("hands");
    expect(tunnel.exactPropColors).toBeNull();
    expect(mandala.preset).toBe("aurora");

    mandala.customRed = "#ffb000";
    expect(tunnel.customPropColors.red).toBe("#ffb000");
    expect(mandala.colorMode).toBe("flow");
    expect(persist).toHaveBeenLastCalledWith({
      blue: "#00d4ff",
      red: "#ffb000",
    });

    tunnel.colors = {
      mode: "custom",
      custom: { blue: "#abcdef", red: "#123456" },
    };
    expect(mandala.customBlue).toBe("#abcdef");
    expect(mandala.customRed).toBe("#123456");
    expect(persist).toHaveBeenCalledTimes(2);

    mandala.preset = "custom";
    expect(mandala.accentPair).toEqual(["#abcdef", "#123456"]);
    tunnel.colorMode = "custom";
    expect(tunnel.exactPropColors).toEqual({
      blue: "#abcdef",
      red: "#123456",
    });

    cleanup();
  });
});
