import { describe, expect, it } from "vitest";
import {
  interpolateTunnelLayerProp,
  resolveTunnelGridOpacity,
  resolveTunnelLayerOpacity,
  resolveTunnelLayerProgress,
  tunnelLayerPositionSeparation,
  TUNNEL_REVEAL_DURATION,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-layer-reveal";
import { DURATION } from "$lib/shared/transitions/transitions";

describe("Tunnel layer reveal", () => {
  it("uses one canonical structural phrase for the formation change", () => {
    expect(TUNNEL_REVEAL_DURATION).toBe(DURATION.emphasis + DURATION.normal);
  });

  it("holds every layer inside a normalized opacity envelope", () => {
    expect(resolveTunnelLayerOpacity(-1, 0, 4)).toBe(0);
    expect(resolveTunnelLayerOpacity(2, 3, 4)).toBe(1);
  });

  it("starts the whole ensemble during the opening fifth", () => {
    const near = resolveTunnelLayerOpacity(0.2, 0, 4);
    const far = resolveTunnelLayerOpacity(0.2, 3, 4);

    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it("settles every layer together at the transition endpoint", () => {
    const opacities = Array.from({ length: 6 }, (_, index) =>
      resolveTunnelLayerOpacity(1, index, 6)
    );

    expect(opacities).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("keeps a subtle depth spread without backloading the outer copies", () => {
    const opacities = Array.from({ length: 7 }, (_, index) =>
      resolveTunnelLayerOpacity(0.5, index, 7)
    );

    expect(Math.min(...opacities)).toBeGreaterThan(0.35);
    expect(opacities[0] - opacities[6]).toBeLessThan(0.15);
    expect(opacities).toEqual([...opacities].sort((a, b) => b - a));
  });

  it("does not ease the shared reveal clock a second time", () => {
    expect(resolveTunnelLayerProgress(0.5, 0, 7)).toBe(0.5);
  });

  it("uses the same reversible progress for position and opacity", () => {
    expect(resolveTunnelLayerProgress(0.42, 1, 4)).toBe(
      resolveTunnelLayerOpacity(0.42, 1, 4)
    );
  });

  it("peels a copy from the live prop into its Tunnel pose", () => {
    const base = { centerPathAngle: 0, staffRotationAngle: 0 };
    const target = {
      centerPathAngle: Math.PI / 2,
      staffRotationAngle: Math.PI,
    };

    expect(interpolateTunnelLayerProp(base, target, 0)).toEqual(base);
    expect(interpolateTunnelLayerProp(base, target, 0.5)).toEqual({
      centerPathAngle: Math.PI / 4,
      staffRotationAngle: Math.PI / 2,
      x: 0.5,
      y: 0.5,
    });
    expect(interpolateTunnelLayerProp(base, target, 1)).toEqual(target);
  });

  it("keeps canvas position continuous across the angle seam", () => {
    const degrees = (value: number) => (value * Math.PI) / 180;
    const midpoint = interpolateTunnelLayerProp(
      { centerPathAngle: degrees(350), staffRotationAngle: degrees(350) },
      { centerPathAngle: degrees(10), staffRotationAngle: degrees(10) },
      0.5
    );

    expect(midpoint?.x).toBeCloseTo(Math.cos(degrees(10)));
    expect(midpoint?.y).toBeCloseTo(0);
    expect(midpoint?.centerPathAngle).toBeCloseTo(0);
    expect(midpoint?.staffRotationAngle).toBeCloseTo(0);
  });

  it("reports the visible positional separation from the live pair", () => {
    expect(
      tunnelLayerPositionSeparation(
        { centerPathAngle: 0, staffRotationAngle: 0 },
        { centerPathAngle: Math.PI / 3, staffRotationAngle: Math.PI }
      )
    ).toBeCloseTo(1);
  });
});

describe("Tunnel grid reveal", () => {
  it("removes the 2D grid on the same reversible progress as Tunnel", () => {
    expect(resolveTunnelGridOpacity(0, false)).toBe(1);
    expect(resolveTunnelGridOpacity(0.5, false)).toBe(0.5);
    expect(resolveTunnelGridOpacity(1, false)).toBe(0);
  });

  it("keeps an authored Tunnel grid visible throughout the handoff", () => {
    expect(resolveTunnelGridOpacity(0, true)).toBe(1);
    expect(resolveTunnelGridOpacity(0.5, true)).toBe(1);
    expect(resolveTunnelGridOpacity(1, true)).toBe(1);
  });
});
