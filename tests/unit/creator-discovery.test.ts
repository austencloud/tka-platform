import { describe, expect, it } from "vitest";
import { matchesCreatorQuery } from "$lib/features/creators/domain/creator-search";
import { pickCreatorSamplesByOwnerId } from "$lib/features/browse/gallery-home/pick-representatives";
import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

function creator(
  patch: Partial<EnhancedUserProfile> = {}
): EnhancedUserProfile {
  return {
    id: "creator-1",
    username: "cloud",
    displayName: "Austen Cloud",
    sequenceCount: 2,
    collectionCount: 0,
    followerCount: 5,
    followingCount: 1,
    joinedDate: new Date("2026-01-01"),
    isFeatured: false,
    favoriteProp: PropType.STAFF,
    location: {
      city: "Chicago",
      country: "US",
      lat: null,
      lng: null,
    },
    bio: "Builds musical toss patterns",
    ...patch,
  };
}

function sequence(
  id: string,
  ownerId: string | undefined,
  word: string
): SequenceData {
  return {
    id,
    name: word,
    word,
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
    ownerId,
  };
}

describe("creator discovery", () => {
  it("searches the same profile details shown on creator cards", () => {
    const profile = creator();

    expect(matchesCreatorQuery(profile, "austen")).toBe(true);
    expect(matchesCreatorQuery(profile, "musical patterns")).toBe(true);
    expect(matchesCreatorQuery(profile, "staff chicago")).toBe(true);
    expect(matchesCreatorQuery(profile, "poi")).toBe(false);
  });

  it("joins sample work by stable owner ID and caps each creator", () => {
    const samples = pickCreatorSamplesByOwnerId(
      [
        sequence("3", "creator-1", "C"),
        sequence("1", "creator-1", "A"),
        sequence("2", "creator-1", "B"),
        sequence("4", "creator-2", "D"),
        sequence("missing-owner", undefined, "E"),
      ],
      2
    );

    expect(samples.get("creator-1")?.map((item) => item.word)).toEqual([
      "A",
      "B",
    ]);
    expect(samples.get("creator-2")?.map((item) => item.word)).toEqual(["D"]);
    expect(samples.has("")).toBe(false);
  });
});
