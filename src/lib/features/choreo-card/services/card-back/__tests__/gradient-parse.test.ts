/**
 * Tests for parseLinearGradient — the CSS linear-gradient → GradientSpec parser
 * the BackJob painter consumes. Focus is the PROOF-MODE shapes the print path
 * actually produces (single linear-gradient, hex/rgb stops, % offsets) plus the
 * documented multi-layer fallback.
 */

import { describe, it, expect } from "vitest";
import { parseLinearGradient } from "../gradient-parse";

describe("parseLinearGradient", () => {
  it("parses an angled multi-hex-stop gradient with explicit % offsets", () => {
    const spec = parseLinearGradient(
      "linear-gradient(135deg, #1e1b4b 0%, #4338ca 20%, #a5b4fc 40%)"
    );
    expect(spec).toEqual({
      type: "linear",
      angleDeg: 135,
      stops: [
        { offset: 0, color: "#1e1b4b" },
        { offset: 0.2, color: "#4338ca" },
        { offset: 0.4, color: "#a5b4fc" },
      ],
    });
  });

  it("parses the white proof-mode background gradient", () => {
    const spec = parseLinearGradient(
      "linear-gradient(180deg, #ffffff 0%, #f8f9fc 50%, #ffffff 100%)"
    );
    expect(spec).toEqual({
      type: "linear",
      angleDeg: 180,
      stops: [
        { offset: 0, color: "#ffffff" },
        { offset: 0.5, color: "#f8f9fc" },
        { offset: 1, color: "#ffffff" },
      ],
    });
  });

  it("parses rgba() stops without splitting on their interior commas", () => {
    const spec = parseLinearGradient(
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(199,210,254,0.92) 35%, rgba(255,255,255,0.98) 50%)"
    );
    expect(spec.angleDeg).toBe(180);
    expect(spec.stops).toEqual([
      { offset: 0, color: "rgba(255,255,255,0.98)" },
      { offset: 0.35, color: "rgba(199,210,254,0.92)" },
      { offset: 0.5, color: "rgba(255,255,255,0.98)" },
    ]);
  });

  it("handles rgba() with spaces after commas", () => {
    const spec = parseLinearGradient(
      "linear-gradient(90deg, rgba(0, 0, 0, 0.5) 0%, rgba(255, 0, 0, 1) 100%)"
    );
    expect(spec.stops).toEqual([
      { offset: 0, color: "rgba(0, 0, 0, 0.5)" },
      { offset: 1, color: "rgba(255, 0, 0, 1)" },
    ]);
  });

  it("defaults the angle to 180 when no angle prefix is present", () => {
    const spec = parseLinearGradient("linear-gradient(#000 0%, #fff 100%)");
    expect(spec.angleDeg).toBe(180);
    expect(spec.stops).toEqual([
      { offset: 0, color: "#000" },
      { offset: 1, color: "#fff" },
    ]);
  });

  it("maps `to <side>` keyword directions to angles", () => {
    expect(parseLinearGradient("linear-gradient(to top, #000, #fff)").angleDeg).toBe(0);
    expect(parseLinearGradient("linear-gradient(to right, #000, #fff)").angleDeg).toBe(90);
    expect(parseLinearGradient("linear-gradient(to bottom, #000, #fff)").angleDeg).toBe(180);
  });

  it("distributes positionless stops evenly across [0,1]", () => {
    const spec = parseLinearGradient("linear-gradient(90deg, #000, #888, #fff)");
    expect(spec.stops).toEqual([
      { offset: 0, color: "#000" },
      { offset: 0.5, color: "#888" },
      { offset: 1, color: "#fff" },
    ]);
  });

  it("parses the LAST linear-gradient when multiple layers are stacked (documented limitation)", () => {
    // Mirrors the non-proof rainbow background: rainbow rgba layer over a base.
    const css =
      "linear-gradient(135deg, rgba(255,0,0,0.15) 0%, rgba(128,0,255,0.12) 70%), " +
      "linear-gradient(180deg, #161625 0%, #1e1e30 50%, #181828 100%)";
    const spec = parseLinearGradient(css);
    expect(spec.angleDeg).toBe(180);
    expect(spec.stops).toEqual([
      { offset: 0, color: "#161625" },
      { offset: 0.5, color: "#1e1e30" },
      { offset: 1, color: "#181828" },
    ]);
  });

  it("does not throw on a non-linear gradient input", () => {
    expect(() => parseLinearGradient("radial-gradient(circle, #000, #fff)")).not.toThrow();
  });
});
