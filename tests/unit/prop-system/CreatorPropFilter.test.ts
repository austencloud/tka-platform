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

import { filterByProps } from "../../../src/lib/features/browse/creators/services/creator-prop-filter";
import { PropType } from "../../../src/lib/shared/pictograph/prop/domain/enums/PropType";

function makeProfile(
  id: string,
  propsISpinWith: PropType[],
  favoriteProp?: PropType
) {
  return {
    id,
    displayName: id,
    propsISpinWith,
    favoriteProp: favoriteProp ?? null,
  } as unknown as UserProfile;
}

describe("CreatorPropFilter", () => {
  const staffOnly = makeProfile("alice", [PropType.STAFF]);
  const fanOnly = makeProfile("bob", [PropType.FAN]);
  const staffAndFan = makeProfile("carol", [PropType.STAFF, PropType.FAN]);
  const noProps = makeProfile("dave", []);
  const allProfiles = [staffOnly, fanOnly, staffAndFan, noProps];

  describe("filterByProps", () => {
    it("uses AND logic — requires ALL selected props", () => {
      const result = filterByProps(allProfiles, [PropType.STAFF, PropType.FAN]);
      // Only carol has both staff AND fan
      expect(result).toEqual([staffAndFan]);
    });
  });
});
