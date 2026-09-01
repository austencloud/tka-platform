import { describe, it, expect, vi, afterEach } from "vitest";
import { createViewerState } from "./viewer-state.svelte";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe("createViewerState URL seeding", () => {
  it("initialMode wins over persisted mode", () => {
    localStorage.setItem("tka-viewer-mode", "card");
    const state = createViewerState({ initialMode: "tunnel", persist: false });
    expect(state.viewerMode).toBe("tunnel");
  });

  it("persist:false never writes viewer-mode or split keys", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const state = createViewerState({ initialMode: "split", persist: false });
    state.setViewerMode("card");
    state.setSplitConfig({ leftPane: "animation", rightPane: "card" });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("no options preserves today's behavior (loads + persists)", () => {
    const state = createViewerState();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    state.setViewerMode("card");
    expect(setItem).toHaveBeenCalledWith("tka-viewer-mode", "card");
  });

  it("URL post-studio is honored (explicit-intent carve-out)", () => {
    const state = createViewerState({ initialMode: "post-studio", persist: false });
    expect(state.viewerMode).toBe("post-studio");
  });
});
