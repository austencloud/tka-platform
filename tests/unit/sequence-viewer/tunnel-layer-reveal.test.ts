import { describe, expect, it } from "vitest";
import {
  resolveTunnelGridOpacity,
  resolveTunnelLayerOpacity,
  TUNNEL_REVEAL_DURATION,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-layer-reveal";
import { DURATION } from "$lib/shared/transitions/transitions";

describe("Tunnel layer reveal", () => {
  it("uses the canonical dramatic clock for a readable formation wave", () => {
    expect(TUNNEL_REVEAL_DURATION).toBe(DURATION.dramatic);
  });

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

  it("holds a readable center-out spread through the middle of the reveal", () => {
    const opacities = Array.from({ length: 7 }, (_, index) =>
      resolveTunnelLayerOpacity(0.5, index, 7)
    );

    expect(opacities[0] - opacities[6]).toBeGreaterThan(0.45);
    expect(opacities).toEqual([...opacities].sort((a, b) => b - a));
  });
});

describe("Tunnel grid reveal", () => {
  it("removes the 2D grid on the same reversible progress as Tunnel", () => {
    expect(resolveTunnelGridOpacity(0, false)).toBe(1);
    expect(resolveTunnelGridOpacity(0.19, false)).toBeCloseTo(0.5);
    expect(resolveTunnelGridOpacity(0.38, false)).toBe(0);
    expect(resolveTunnelGridOpacity(1, false)).toBe(0);
  });

  it("keeps an authored Tunnel grid visible throughout the handoff", () => {
    expect(resolveTunnelGridOpacity(0, true)).toBe(1);
    expect(resolveTunnelGridOpacity(0.5, true)).toBe(1);
    expect(resolveTunnelGridOpacity(1, true)).toBe(1);
  });
});
