/**
 * Prop Mode Helpers Tests
 *
 * Tests for the isCatDogMode and getThumbnailPathForPropConfig helpers.
 * These determine cache keys and paths for thumbnails.
 */

import { describe, it, expect } from "vitest";

// Inline the logic to avoid triggering full app initialization
const PropType = {
  STAFF: "staff",
  BUUGENG: "buugeng",
  CLUB: "club",
} as const;

type PropTypeValue = (typeof PropType)[keyof typeof PropType];

function isCatDogMode(
  bluePropType: PropTypeValue | undefined,
  redPropType: PropTypeValue | undefined,
  catDogModeEnabled: boolean | undefined
): boolean {
  if (!catDogModeEnabled) return false;
  if (!bluePropType || !redPropType) return false;
  return bluePropType !== redPropType;
}

function getThumbnailPathForPropConfig(
  sequenceName: string,
  bluePropType: PropTypeValue | undefined,
  redPropType: PropTypeValue | undefined,
  catDogModeEnabled: boolean | undefined,
  lightMode: boolean = false
): string | null {
  if (isCatDogMode(bluePropType, redPropType, catDogModeEnabled)) {
    // Cat-dog mode: unique per prop combination - no shared path
    return null;
  }

  const propType = bluePropType || redPropType || PropType.STAFF;
  const mode = lightMode ? "light" : "dark";
  return `/thumbnails/${propType}/${sequenceName}_${mode}.webp`;
}

describe("isCatDogMode", () => {
  it("returns false when catDogModeEnabled is false", () => {
    expect(
      isCatDogMode(PropType.STAFF, PropType.BUUGENG, false)
    ).toBe(false);
  });

  it("returns false when catDogModeEnabled is undefined", () => {
    expect(
      isCatDogMode(PropType.STAFF, PropType.BUUGENG, undefined)
    ).toBe(false);
  });

  it("returns false when bluePropType is undefined", () => {
    expect(
      isCatDogMode(undefined, PropType.BUUGENG, true)
    ).toBe(false);
  });

  it("returns false when redPropType is undefined", () => {
    expect(
      isCatDogMode(PropType.STAFF, undefined, true)
    ).toBe(false);
  });

  it("returns false when both prop types are the same", () => {
    expect(
      isCatDogMode(PropType.STAFF, PropType.STAFF, true)
    ).toBe(false);
  });

  it("returns true when enabled with different prop types", () => {
    expect(
      isCatDogMode(PropType.STAFF, PropType.BUUGENG, true)
    ).toBe(true);
  });

  it("returns true for any different prop combination when enabled", () => {
    expect(
      isCatDogMode(PropType.CLUB, PropType.BUUGENG, true)
    ).toBe(true);
  });
});

describe("getThumbnailPathForPropConfig", () => {
  it("returns path for single prop mode", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      PropType.STAFF,
      PropType.STAFF,
      false,
      false
    );
    expect(path).toBe("/thumbnails/staff/TestSeq_dark.webp");
  });

  it("returns light mode path when lightMode is true", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      PropType.STAFF,
      PropType.STAFF,
      false,
      true
    );
    expect(path).toBe("/thumbnails/staff/TestSeq_light.webp");
  });

  it("uses blue prop type when both are same", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      PropType.BUUGENG,
      PropType.BUUGENG,
      false
    );
    expect(path).toBe("/thumbnails/buugeng/TestSeq_dark.webp");
  });

  it("returns null for cat-dog mode (no shared path)", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      PropType.STAFF,
      PropType.BUUGENG,
      true
    );
    expect(path).toBeNull();
  });

  it("falls back to blue prop when red is undefined", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      PropType.CLUB,
      undefined,
      false
    );
    expect(path).toBe("/thumbnails/club/TestSeq_dark.webp");
  });

  it("falls back to red prop when blue is undefined", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      undefined,
      PropType.BUUGENG,
      false
    );
    expect(path).toBe("/thumbnails/buugeng/TestSeq_dark.webp");
  });

  it("falls back to STAFF when both props are undefined", () => {
    const path = getThumbnailPathForPropConfig(
      "TestSeq",
      undefined,
      undefined,
      false
    );
    expect(path).toBe("/thumbnails/staff/TestSeq_dark.webp");
  });
});
