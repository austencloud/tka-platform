// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadTunnelPresets, saveTunnelPresets, type TunnelPreset } from "./tunnel-presets";

const sample: TunnelPreset = {
  id: "look-1",
  name: "Bloom 8x",
  config: { fold: 8, mirror: true, effect: "bloom" },
};

describe("tunnel presets", () => {
  beforeEach(() => localStorage.clear());

  it("returns [] when nothing is stored", () => {
    expect(loadTunnelPresets()).toEqual([]);
  });

  it("round-trips through localStorage", () => {
    saveTunnelPresets([sample]);
    expect(loadTunnelPresets()).toEqual([sample]);
  });

  it("returns [] on corrupt JSON", () => {
    localStorage.setItem("tka_tunnel_presets", "{not json");
    expect(loadTunnelPresets()).toEqual([]);
  });
});
