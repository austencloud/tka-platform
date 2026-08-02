/**
 * CellCacheKeyDeriver Tests
 *
 * Proves that the lsp8 composition refactor produces distinct cache keys
 * for scenarios that previously collided (causing wrong-prop blobs).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/shared/application/state/app-state.svelte", () => ({
  getSettings: () => ({ bluePropType: "staff", redPropType: "staff" }),
}));

import { deriveCacheKey } from "$lib/shared/sequence-viewer/services/cell-cache-key-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// The class-with-injected-hasher collapsed into a standalone function
// (the hasher is now imported directly inside the module). Bind it to an
// object so the existing `deriver.deriveCacheKey(...)` call sites are unchanged.
const deriver = { deriveCacheKey };

function makeStartPosition(overrides?: {
  bluePropType?: PropType;
  redPropType?: PropType;
  blueStartLocation?: GridLocation;
  redStartLocation?: GridLocation;
}): PictographData {
  return {
    id: "test-start",
    letter: null,
    gridMode: GridMode.DIAMOND,
    motions: {
      [MotionColor.BLUE]: {
        motionType: MotionType.STATIC,
        startLocation: overrides?.blueStartLocation ?? GridLocation.NORTH,
        endLocation: overrides?.blueStartLocation ?? GridLocation.NORTH,
        startOrientation: "in",
        endOrientation: "in",
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.BLUE,
        isVisible: true,
        propType: overrides?.bluePropType ?? PropType.STAFF,
        arrowLocation: overrides?.blueStartLocation ?? GridLocation.NORTH,
        gridMode: GridMode.DIAMOND,
      },
      [MotionColor.RED]: {
        motionType: MotionType.STATIC,
        startLocation: overrides?.redStartLocation ?? GridLocation.SOUTH,
        endLocation: overrides?.redStartLocation ?? GridLocation.SOUTH,
        startOrientation: "in",
        endOrientation: "in",
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.RED,
        isVisible: true,
        propType: overrides?.redPropType ?? PropType.STAFF,
        arrowLocation: overrides?.redStartLocation ?? GridLocation.SOUTH,
        gridMode: GridMode.DIAMOND,
      },
    },
  } as PictographData;
}

function makeOptions(
  overrides?: Partial<PreviewCellRenderOptions>
): PreviewCellRenderOptions {
  return {
    size: 240,
    bluePropType: PropType.STAFF,
    showStepNumbers: false,
    showNonRadialPoints: true,
    handPointVisibility: "all",
    showTKA: true,
    showReversals: true,
    ...overrides,
  };
}

function makeBoxBetaStep(
  blueStartLocation: GridLocation,
  redStartLocation: GridLocation,
  endLocation: GridLocation
): PictographData {
  return {
    id: `beta-${blueStartLocation}-${endLocation}`,
    letter: "K",
    gridMode: GridMode.BOX,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: MotionType.ANTI,
        startLocation: blueStartLocation,
        endLocation,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.COUNTER,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 0.5,
        color: MotionColor.BLUE,
        gridMode: GridMode.BOX,
        propType: PropType.STAFF,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: MotionType.FLOAT,
        startLocation: redStartLocation,
        endLocation,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.COUNTER,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.RED,
        gridMode: GridMode.BOX,
        propType: PropType.STAFF,
      }),
    },
  };
}

describe("CellCacheKeyDeriver (lsp11/lsp12 composition)", () => {
  it("preserves lsp11 keys for fully-visible pictographs", () => {
    const key = deriver.deriveCacheKey(
      makeStartPosition(),
      undefined,
      false,
      makeOptions()
    );
    expect(key).toMatch(/^lsp11-/);
    expect(key).not.toContain("isVisible");
  });

  it("separates invisible placeholders from visible static motions", () => {
    const visible = makeStartPosition();
    const hidden = makeStartPosition();
    (hidden.motions.red as { isVisible: boolean }).isVisible = false;

    const visibleKey = deriver.deriveCacheKey(
      visible,
      undefined,
      false,
      makeOptions()
    );
    const hiddenKey = deriver.deriveCacheKey(
      hidden,
      undefined,
      false,
      makeOptions()
    );

    expect(visibleKey).toMatch(/^lsp11-/);
    expect(hiddenKey).toMatch(/^lsp12-/);
    expect(hiddenKey).toContain('"isVisible":true');
    expect(hiddenKey).toContain('"isVisible":false');
    expect(visibleKey).not.toBe(hiddenKey);
  });

  describe("targeted beta-offset geometry revision", () => {
    it.each([
      {
        step: 1,
        blueStart: GridLocation.SOUTHWEST,
        redStart: GridLocation.NORTHEAST,
        end: GridLocation.NORTHWEST,
      },
      {
        step: 3,
        blueStart: GridLocation.NORTHWEST,
        redStart: GridLocation.SOUTHEAST,
        end: GridLocation.NORTHEAST,
      },
    ])("rekeys supplied step $step", ({ blueStart, redStart, end }) => {
      const key = deriver.deriveCacheKey(
        makeBoxBetaStep(blueStart, redStart, end),
        undefined,
        false,
        makeOptions()
      );

      expect(key).toMatch(/^lsp11-/);
      expect(key).toContain('"propGeometryRevision":"beta-shift-map-v2"');
    });

    it("preserves the existing identity for an unaffected box shift", () => {
      const key = deriver.deriveCacheKey(
        makeBoxBetaStep(
          GridLocation.NORTHEAST,
          GridLocation.SOUTHWEST,
          GridLocation.SOUTHEAST
        ),
        undefined,
        false,
        makeOptions()
      );

      expect(key).toMatch(/^lsp11-/);
      expect(key).not.toContain("propGeometryRevision");
    });
  });

  describe("motion-intrinsic propType differentiation (the original bug)", () => {
    it("HAND vs STAFF motion propType produces different keys even with same settings propType", () => {
      const staffStart = makeStartPosition({
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });
      const handStart = makeStartPosition({
        bluePropType: PropType.HAND,
        redPropType: PropType.HAND,
      });

      // Both rendered with the same settings prop type
      const options = makeOptions({ bluePropType: PropType.STAFF });

      const staffKey = deriver.deriveCacheKey(
        staffStart,
        undefined,
        false,
        options
      );
      const handKey = deriver.deriveCacheKey(
        handStart,
        undefined,
        false,
        options
      );

      expect(staffKey).not.toBe(handKey);
    });

    it("FAN vs STAFF motion propType produces different keys", () => {
      const staffStart = makeStartPosition({
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      });
      const fanStart = makeStartPosition({
        bluePropType: PropType.FAN,
        redPropType: PropType.FAN,
      });

      const options = makeOptions({ bluePropType: PropType.STAFF });

      const staffKey = deriver.deriveCacheKey(
        staffStart,
        undefined,
        false,
        options
      );
      const fanKey = deriver.deriveCacheKey(
        fanStart,
        undefined,
        false,
        options
      );

      expect(staffKey).not.toBe(fanKey);
    });
  });

  describe("handPathMode differentiation", () => {
    it("handPathMode on vs off produces different keys for same pictograph data", () => {
      const data = makeStartPosition();
      const normalOptions = makeOptions({ handPathMode: false });
      const handPathOptions = makeOptions({ handPathMode: true });

      const normalKey = deriver.deriveCacheKey(
        data,
        undefined,
        false,
        normalOptions
      );
      const handPathKey = deriver.deriveCacheKey(
        data,
        undefined,
        false,
        handPathOptions
      );

      expect(normalKey).not.toBe(handPathKey);
    });
  });

  describe("handPointVisibility differentiation", () => {
    it("'all' vs 'active' produces different keys", () => {
      const data = makeStartPosition();
      const allOptions = makeOptions({ handPointVisibility: "all" });
      const activeOptions = makeOptions({ handPointVisibility: "active" });

      const allKey = deriver.deriveCacheKey(data, undefined, false, allOptions);
      const activeKey = deriver.deriveCacheKey(
        data,
        undefined,
        false,
        activeOptions
      );

      expect(allKey).not.toBe(activeKey);
    });
  });

  describe("gridMode differentiation (previously missing entirely)", () => {
    it("diamond vs box mode produces different keys", () => {
      // Diamond mode: cardinal locations
      const diamondStart = makeStartPosition({
        blueStartLocation: GridLocation.NORTH,
        redStartLocation: GridLocation.SOUTH,
      });
      // Box mode: intercardinal locations
      const boxStart = makeStartPosition({
        blueStartLocation: GridLocation.NORTHEAST,
        redStartLocation: GridLocation.SOUTHWEST,
      });

      const options = makeOptions();

      const diamondKey = deriver.deriveCacheKey(
        diamondStart,
        undefined,
        false,
        options
      );
      const boxKey = deriver.deriveCacheKey(
        boxStart,
        undefined,
        false,
        options
      );

      expect(diamondKey).not.toBe(boxKey);
    });
  });

  describe("cell-specific dimensions still differentiate", () => {
    it("different sizes produce different keys", () => {
      const data = makeStartPosition();
      const small = makeOptions({ size: 120 });
      const large = makeOptions({ size: 480 });

      const smallKey = deriver.deriveCacheKey(data, undefined, false, small);
      const largeKey = deriver.deriveCacheKey(data, undefined, false, large);

      expect(smallKey).not.toBe(largeKey);
    });

    it("different step numbers produce different keys when showStepNumbers is true", () => {
      const data = makeStartPosition();
      const options = makeOptions({ showStepNumbers: true });

      const key1 = deriver.deriveCacheKey(data, 1, false, options);
      const key2 = deriver.deriveCacheKey(data, 2, false, options);

      expect(key1).not.toBe(key2);
    });

    it("dark vs light mode produces different keys", () => {
      const data = makeStartPosition();
      const options = makeOptions();

      const darkKey = deriver.deriveCacheKey(data, undefined, true, options);
      const lightKey = deriver.deriveCacheKey(data, undefined, false, options);

      expect(darkKey).not.toBe(lightKey);
    });
  });

  describe("reversal flags differentiation (lsp11)", () => {
    it("blueReversal true vs false produces different keys when showReversals is on", () => {
      const plain = makeStartPosition();
      const reversed = {
        ...makeStartPosition(),
        blueReversal: true,
      } as PictographData;
      const options = makeOptions({ showReversals: true });

      const plainKey = deriver.deriveCacheKey(plain, undefined, false, options);
      const reversedKey = deriver.deriveCacheKey(
        reversed,
        undefined,
        false,
        options
      );

      expect(plainKey).not.toBe(reversedKey);
    });

    it("redReversal true vs false produces different keys when showReversals is on", () => {
      const plain = makeStartPosition();
      const reversed = {
        ...makeStartPosition(),
        redReversal: true,
      } as PictographData;
      const options = makeOptions({ showReversals: true });

      const plainKey = deriver.deriveCacheKey(plain, undefined, false, options);
      const reversedKey = deriver.deriveCacheKey(
        reversed,
        undefined,
        false,
        options
      );

      expect(plainKey).not.toBe(reversedKey);
    });

    it("reversal flags are neutralized when showReversals is off (no pointless cache split)", () => {
      const plain = makeStartPosition();
      const reversed = {
        ...makeStartPosition(),
        blueReversal: true,
        redReversal: true,
      } as PictographData;
      const options = makeOptions({ showReversals: false });

      const plainKey = deriver.deriveCacheKey(plain, undefined, false, options);
      const reversedKey = deriver.deriveCacheKey(
        reversed,
        undefined,
        false,
        options
      );

      expect(plainKey).toBe(reversedKey);
    });
  });

  describe("betaSwapped differentiation (lsp11)", () => {
    it("betaSwapped true vs false produces different keys", () => {
      const plain = makeStartPosition();
      const swapped = {
        ...makeStartPosition(),
        betaSwapped: true,
      } as PictographData;
      const options = makeOptions();

      const plainKey = deriver.deriveCacheKey(plain, undefined, false, options);
      const swappedKey = deriver.deriveCacheKey(
        swapped,
        undefined,
        false,
        options
      );

      expect(plainKey).not.toBe(swappedKey);
    });
  });

  describe("identical inputs produce identical keys (determinism)", () => {
    it("same data and options always produce the same key", () => {
      const data = makeStartPosition();
      const options = makeOptions();

      const key1 = deriver.deriveCacheKey(data, undefined, false, options);
      const key2 = deriver.deriveCacheKey(data, undefined, false, options);

      expect(key1).toBe(key2);
    });
  });
});
