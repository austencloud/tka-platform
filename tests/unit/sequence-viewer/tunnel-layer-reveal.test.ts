import { describe, expect, it } from "vitest";
import {
  resolveTunnelGridOpacity,
  resolveTunnelLayerOpacity,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-layer-reveal";

describe("Tunnel layer reveal", () => {
  it("holds every layer inside a normalized opacity envelope", () => {
    expect(resolveTunnelLayerOpacity(-1, 0, 4)).toBe(0);
    expect(resolveTunnelLayerOpacity(2, 3, 4)).toBe(1);
  });

  it("blooms the closest layer before the farthest layer", () => {
    const near = resolveTunnelLayerOpacity(0.2, 0, 4);
    const far = resolveTunnelLayerOpacity(0.2, 3, 4);

    expect(near).toBeGreaterThan(far);
    expect(far).toBe(0);
  });

  it("settles every layer together at the transition endpoint", () => {
    const opacities = Array.from({ length: 6 }, (_, index) =>
      resolveTunnelLayerOpacity(1, index, 6)
    );

    expect(opacities).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe("Tunnel grid reveal", () => {
  it("removes the 2D grid on the same reversible progress as Tunnel", () => {
    expect(resolveTunnelGridOpacity(0, false)).toBe(1);
    expect(resolveTunnelGridOpacity(0.4, false)).toBeCloseTo(0.6);
    expect(resolveTunnelGridOpacity(1, false)).toBe(0);
  });

  it("keeps an authored Tunnel grid visible throughout the handoff", () => {
    expect(resolveTunnelGridOpacity(0, true)).toBe(1);
    expect(resolveTunnelGridOpacity(0.5, true)).toBe(1);
    expect(resolveTunnelGridOpacity(1, true)).toBe(1);
  });
});
