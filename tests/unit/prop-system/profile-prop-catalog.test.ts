import { describe, expect, it } from "vitest";

import {
  PROFILE_PROP_FAMILIES,
  getLegacyProfileProps,
  getProfilePropFamily,
  toggleProfilePropVariant,
} from "$lib/shared/community/domain/profile-prop-catalog";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

describe("profile prop catalog", () => {
  it("keeps Torch inside Club instead of creating a second family", () => {
    const club = getProfilePropFamily(PropType.TORCH);

    expect(club?.representative).toBe(PropType.CLUB);
    expect(club?.variants).toContain(PropType.CLUB);
    expect(club?.variants).toContain(PropType.TORCH);
    expect(
      PROFILE_PROP_FAMILIES.map((family) => family.representative)
    ).not.toContain(PropType.TORCH);
  });

  it("keeps Trigeng inside the Triad family", () => {
    expect(getProfilePropFamily(PropType.TRIGENG)?.representative).toBe(
      PropType.TRIAD
    );
  });

  it("does not offer rendering novelties as ordinary setup families", () => {
    const representatives = PROFILE_PROP_FAMILIES.map(
      (family) => family.representative
    );

    expect(representatives).not.toContain(PropType.CHICKEN);
    expect(representatives).not.toContain(PropType.GUITAR);
    expect(representatives).not.toContain(PropType.HAND);
  });

  it("preserves unsupported saved props as legacy values", () => {
    expect(
      getLegacyProfileProps([PropType.STAFF, PropType.CHICKEN, PropType.GUITAR])
    ).toEqual([PropType.CHICKEN, PropType.GUITAR]);
  });

  it("toggles Club and Torch independently inside the same family", () => {
    const withTorch = toggleProfilePropVariant([PropType.CLUB], PropType.TORCH);
    expect(withTorch).toEqual([PropType.CLUB, PropType.TORCH]);

    expect(toggleProfilePropVariant(withTorch, PropType.CLUB)).toEqual([
      PropType.TORCH,
    ]);
  });
});
