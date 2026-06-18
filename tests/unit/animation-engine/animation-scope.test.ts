// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  ephemeralAdapter,
  createMemoryAdapter,
} from "$lib/shared/animation-engine/state/persistence-adapter";
import { createAnimationSettingsState } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

describe("persistence adapters", () => {
  it("ephemeral adapter never loads or persists", () => {
    expect(ephemeralAdapter.load()).toBeNull();
    ephemeralAdapter.save({ bpm: 120 });
    expect(ephemeralAdapter.load()).toBeNull();
  });

  it("memory adapter round-trips a delta", () => {
    const store: Record<string, unknown> = {};
    const adapter = createMemoryAdapter(store);
    adapter.save({ bpm: 90 });
    expect(adapter.load()).toEqual({ bpm: 90 });
  });
});

describe("ephemeral animation settings", () => {
  it("seeds from defaults and does not write localStorage", () => {
    let wrote = false;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      wrote = true;
    });
    const settings = createAnimationSettingsState({ ephemeral: true });
    settings.setBpm(99);
    expect(settings.bpm).toBe(99);
    expect(wrote).toBe(false);
    spy.mockRestore();
  });
});
