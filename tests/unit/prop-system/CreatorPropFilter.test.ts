/**
 * CreatorPropFilter Unit Tests
 *
 * The filterByProps intersection logic determines which creators
 * appear when filtering by prop type. A bug here silently shows
 * the wrong creators — OR (any match) vs AND (all match) would
 * produce plausible-looking but wrong results.
 */

import { describe, it, expect, vi } from "vitest";

// Mock firebase/firestore and auth/firebase to avoid protobufjs import side-effects
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn().mockResolvedValue({}),
}));

import { CreatorPropFilter } from "../../../src/lib/features/browse/creators/services/implementations/CreatorPropFilter";
import { PropType } from "../../../src/lib/shared/pictograph/prop/domain/enums/PropType";
import type { UserProfile } from "../../../src/lib/shared/community/domain/models/enhanced-user-profile";

function makeProfile(
  id: string,
  propsISpinWith: PropType[],
  favoriteProp?: PropType
): UserProfile {
  return {
    id,
    displayName: id,
    propsISpinWith,
    favoriteProp: favoriteProp ?? null,
  } as unknown as UserProfile;
}

describe("CreatorPropFilter", () => {
  const filter = new CreatorPropFilter();

  const staffOnly = makeProfile("alice", [PropType.STAFF]);
  const fanOnly = makeProfile("bob", [PropType.FAN]);
  const staffAndFan = makeProfile("carol", [PropType.STAFF, PropType.FAN]);
  const noProps = makeProfile("dave", []);
  const allProfiles = [staffOnly, fanOnly, staffAndFan, noProps];

  describe("filterByProps", () => {
    it("returns all profiles when no props required", () => {
      const result = filter.filterByProps(allProfiles, []);
      expect(result).toEqual(allProfiles);
    });

    it("filters to creators who have the required prop", () => {
      const result = filter.filterByProps(allProfiles, [PropType.STAFF]);
      expect(result).toEqual([staffOnly, staffAndFan]);
    });

    it("uses AND logic — requires ALL selected props", () => {
      const result = filter.filterByProps(allProfiles, [PropType.STAFF, PropType.FAN]);
      // Only carol has both staff AND fan
      expect(result).toEqual([staffAndFan]);
    });

    it("excludes creators with no propsISpinWith from any filter", () => {
      const result = filter.filterByProps(allProfiles, [PropType.STAFF]);
      expect(result).not.toContainEqual(noProps);
    });

    it("returns empty when no creators match all required props", () => {
      const result = filter.filterByProps(allProfiles, [PropType.BUUGENG]);
      expect(result).toEqual([]);
    });

    it("handles undefined propsISpinWith gracefully", () => {
      const undefinedProps = { id: "x", displayName: "x" } as unknown as UserProfile;
      const result = filter.filterByProps([undefinedProps], [PropType.STAFF]);
      expect(result).toEqual([]);
    });
  });

  describe("groupByFavoriteProp", () => {
    it("groups creators by their favorite prop", () => {
      const profiles = [
        makeProfile("a", [PropType.STAFF], PropType.STAFF),
        makeProfile("b", [PropType.FAN], PropType.FAN),
        makeProfile("c", [PropType.STAFF], PropType.STAFF),
      ];

      const groups = filter.groupByFavoriteProp(profiles);

      expect(groups.get(PropType.STAFF)?.length).toBe(2);
      expect(groups.get(PropType.FAN)?.length).toBe(1);
    });

    it("puts creators without a favorite in the 'none' group", () => {
      const profiles = [
        makeProfile("a", [PropType.STAFF]),
        makeProfile("b", [PropType.FAN], PropType.FAN),
      ];

      const groups = filter.groupByFavoriteProp(profiles);

      expect(groups.get("none")?.length).toBe(1);
      expect(groups.get("none")?.[0].id).toBe("a");
    });

    it("returns empty map for empty input", () => {
      const groups = filter.groupByFavoriteProp([]);
      expect(groups.size).toBe(0);
    });
  });
});
