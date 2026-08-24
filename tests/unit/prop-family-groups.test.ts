import { describe, expect, it } from "vitest";

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  getAllVariations,
  getBasePropType,
  getPropTypeDisplayInfo,
} from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";

describe("prop family groups", () => {
  it("groups all Double Staff builds together", () => {
    expect(getPropTypeDisplayInfo(PropType.STAFF).label).toBe("Double Staff");
    expect(getBasePropType(PropType.CAPSULE_BATON)).toBe(PropType.STAFF);
    expect(getBasePropType(PropType.FIRE_DOUBLE_STAFF)).toBe(PropType.STAFF);
    expect(getAllVariations(PropType.STAFF)).toEqual(
      expect.arrayContaining([
        PropType.STAFF,
        PropType.CAPSULE_BATON,
        PropType.FIRE_DOUBLE_STAFF,
      ])
    );
  });

  it.each([
    [PropType.BIGCHICKEN, PropType.CHICKEN],
    [PropType.TORCH, PropType.CLUB],
    [PropType.UKULELE, PropType.GUITAR],
    [PropType.TRIQUETRA2, PropType.TRIQUETRA],
    [PropType.TRIGENG, PropType.TRIAD],
  ])("maps %s to the %s family", (variant, family) => {
    expect(getBasePropType(variant)).toBe(family);
    expect(getAllVariations(family)).toContain(variant);
  });
});
