/**
 * Tests for PropPositionCalculator
 *
 * These tests catch silent bugs - wrong endpoint positions would cause
 * trails to render in the wrong place, which might not be immediately obvious.
 */

import { describe, it, expect } from "vitest";
import { PropPositionCalculator } from "$lib/shared/animation-engine/services/implementations/PropPositionCalculator";
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { PropEndpointConfig } from "$lib/shared/animation-engine/services/contracts/IPropPositionCalculator";

describe("PropPositionCalculator", () => {
  const calculator = new PropPositionCalculator();

  const defaultConfig: PropEndpointConfig = {
    canvasSize: 500,
    propDimensions: { width: 100, height: 20 },
  };

  // Helper to create a prop state with polar coordinates
  function createPolarPropState(
    centerPathAngle: number,
    staffRotationAngle: number
  ): PropState {
    return {
      centerPathAngle,
      staffRotationAngle,
    };
  }

  // Helper to create a prop state with Cartesian coordinates (for dash motions)
  function createCartesianPropState(
    x: number,
    y: number,
    staffRotationAngle: number
  ): PropState {
    return {
      centerPathAngle: 0, // Not used when x,y are provided
      staffRotationAngle,
      x,
      y,
    };
  }

  describe("calculateCenter", () => {
    it("returns canvas center when prop is at angle 0", () => {
      const prop = createPolarPropState(0, 0);
      const center = calculator.calculateCenter(prop, defaultConfig);

      // At angle 0, center is offset to the right of canvas center
      // Canvas center is 250,250. Offset is scaledHalfwayRadius * cos(0) = positive
      expect(center.x).toBeGreaterThan(250);
      expect(center.y).toBeCloseTo(250, 1);
    });

    it("uses Cartesian coordinates when x,y provided", () => {
      const prop = createCartesianPropState(0, 0, 0);
      const center = calculator.calculateCenter(prop, defaultConfig);

      // x=0, y=0 means at grid center (canvas center)
      expect(center.x).toBeCloseTo(250, 1);
      expect(center.y).toBeCloseTo(250, 1);
    });

    it("scales with canvas size", () => {
      const prop = createPolarPropState(0, 0);

      const smallConfig: PropEndpointConfig = { ...defaultConfig, canvasSize: 100 };
      const largeConfig: PropEndpointConfig = { ...defaultConfig, canvasSize: 1000 };

      const smallCenter = calculator.calculateCenter(prop, smallConfig);
      const largeCenter = calculator.calculateCenter(prop, largeConfig);

      // Larger canvas should produce center further from origin
      expect(largeCenter.x).toBeGreaterThan(smallCenter.x);
    });
  });

  describe("calculateEndpoint", () => {
    it("calculates left and right endpoints differently", () => {
      const prop = createPolarPropState(0, 0);

      const left = calculator.calculateEndpoint(prop, defaultConfig, 0);
      const right = calculator.calculateEndpoint(prop, defaultConfig, 1);

      // Endpoints should be on opposite sides of center
      expect(left.x).not.toBeCloseTo(right.x, 1);
    });

    it("endpoints are symmetric around center", () => {
      const prop = createPolarPropState(0, 0);

      const left = calculator.calculateEndpoint(prop, defaultConfig, 0);
      const right = calculator.calculateEndpoint(prop, defaultConfig, 1);
      const center = calculator.calculateCenter(prop, defaultConfig);

      // Distance from center to left should equal distance from center to right
      const leftDist = Math.hypot(left.x - center.x, left.y - center.y);
      const rightDist = Math.hypot(right.x - center.x, right.y - center.y);

      expect(leftDist).toBeCloseTo(rightDist, 1);
    });

    it("rotates endpoints based on staffRotationAngle", () => {
      const horizontal = createPolarPropState(0, 0); // Staff horizontal
      const vertical = createPolarPropState(0, Math.PI / 2); // Staff vertical

      const hLeft = calculator.calculateEndpoint(horizontal, defaultConfig, 0);
      const vLeft = calculator.calculateEndpoint(vertical, defaultConfig, 0);

      // At different staff angles, endpoints should be at different positions
      // Even though center is the same (same centerPathAngle)
      expect(Math.abs(hLeft.x - vLeft.x)).toBeGreaterThan(5);
    });

    it("returns center for hand props", () => {
      const prop = createPolarPropState(Math.PI / 4, Math.PI / 4);

      const left = calculator.calculateEndpoint(prop, defaultConfig, 0, "hand");
      const right = calculator.calculateEndpoint(prop, defaultConfig, 1, "hand");
      const center = calculator.calculateCenter(prop, defaultConfig);

      // Hand props should return center for both endpoints
      expect(left.x).toBeCloseTo(center.x, 1);
      expect(left.y).toBeCloseTo(center.y, 1);
      expect(right.x).toBeCloseTo(center.x, 1);
      expect(right.y).toBeCloseTo(center.y, 1);
    });

    it("returns center for hand props (case insensitive)", () => {
      const prop = createPolarPropState(0, 0);

      const upper = calculator.calculateEndpoint(prop, defaultConfig, 1, "HAND");
      const lower = calculator.calculateEndpoint(prop, defaultConfig, 1, "hand");
      const mixed = calculator.calculateEndpoint(prop, defaultConfig, 1, "Hand");

      expect(upper.x).toBeCloseTo(lower.x, 5);
      expect(mixed.x).toBeCloseTo(lower.x, 5);
    });
  });

  describe("calculateEndpoints", () => {
    it("returns both endpoints at once", () => {
      const prop = createPolarPropState(0, 0);

      const endpoints = calculator.calculateEndpoints(prop, defaultConfig);

      expect(endpoints).toHaveProperty("left");
      expect(endpoints).toHaveProperty("right");
      expect(endpoints.left.x).not.toBeCloseTo(endpoints.right.x, 1);
    });

    it("matches individual endpoint calculations", () => {
      const prop = createPolarPropState(Math.PI / 4, Math.PI / 6);

      const endpoints = calculator.calculateEndpoints(prop, defaultConfig);
      const left = calculator.calculateEndpoint(prop, defaultConfig, 0);
      const right = calculator.calculateEndpoint(prop, defaultConfig, 1);

      expect(endpoints.left.x).toBeCloseTo(left.x, 5);
      expect(endpoints.left.y).toBeCloseTo(left.y, 5);
      expect(endpoints.right.x).toBeCloseTo(right.x, 5);
      expect(endpoints.right.y).toBeCloseTo(right.y, 5);
    });

    it("returns center for both endpoints on hand props", () => {
      const prop = createPolarPropState(0, 0);

      const endpoints = calculator.calculateEndpoints(prop, defaultConfig, "hand");
      const center = calculator.calculateCenter(prop, defaultConfig);

      expect(endpoints.left.x).toBeCloseTo(center.x, 5);
      expect(endpoints.left.y).toBeCloseTo(center.y, 5);
      expect(endpoints.right.x).toBeCloseTo(center.x, 5);
      expect(endpoints.right.y).toBeCloseTo(center.y, 5);
    });
  });

  describe("edge cases", () => {
    it("handles zero canvas size gracefully", () => {
      const prop = createPolarPropState(0, 0);
      const config: PropEndpointConfig = {
        canvasSize: 0,
        propDimensions: { width: 100, height: 20 },
      };

      // Should not throw
      const center = calculator.calculateCenter(prop, config);
      expect(center).toBeDefined();
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
    });

    it("handles negative angles", () => {
      const prop = createPolarPropState(-Math.PI / 4, -Math.PI / 4);

      const endpoints = calculator.calculateEndpoints(prop, defaultConfig);

      expect(endpoints.left).toBeDefined();
      expect(endpoints.right).toBeDefined();
      expect(Number.isFinite(endpoints.left.x)).toBe(true);
      expect(Number.isFinite(endpoints.left.y)).toBe(true);
    });

    it("handles angles > 2π", () => {
      const prop = createPolarPropState(3 * Math.PI, Math.PI); // Same as π

      const endpoints = calculator.calculateEndpoints(prop, defaultConfig);

      expect(Number.isFinite(endpoints.left.x)).toBe(true);
      expect(Number.isFinite(endpoints.right.x)).toBe(true);
    });

    it("handles custom grid offset", () => {
      const prop = createPolarPropState(0, 0);
      const config: PropEndpointConfig = {
        ...defaultConfig,
        gridHalfwayOffset: 200, // Larger than default 150
      };

      const defaultCenter = calculator.calculateCenter(prop, defaultConfig);
      const customCenter = calculator.calculateCenter(prop, config);

      // Larger offset should push center further from canvas center
      const defaultDist = Math.hypot(defaultCenter.x - 250, defaultCenter.y - 250);
      const customDist = Math.hypot(customCenter.x - 250, customCenter.y - 250);

      expect(customDist).toBeGreaterThan(defaultDist);
    });
  });
});
