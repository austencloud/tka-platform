import { AVATAR_DEFINITIONS, getAvatarModelPath } from "@austencloud/scene-3d";
import { DEPLOYED_AVATAR_DEFINITIONS } from "$lib/shared/3d/config/deployed-avatars";
import { avatarThumbnailUrl } from "$lib/shared/3d/constants/r2-cdn";
import { describe, expect, it } from "vitest";

const PERSONAL_AVATAR_ID = "personal-metaperson";

describe("avatar catalog license boundary", () => {
  it("makes the personal MetaPerson selectable during local development", () => {
    expect(
      AVATAR_DEFINITIONS.some((avatar) => avatar.id === PERSONAL_AVATAR_ID)
    ).toBe(true);
    expect(getAvatarModelPath(PERSONAL_AVATAR_ID)).toBe(
      "/models/avatars/bakeoff/personal-metaperson.glb"
    );
  });

  it("keeps evaluation avatars out of deployment consumers", () => {
    expect(
      DEPLOYED_AVATAR_DEFINITIONS.some(
        (avatar) => avatar.id === PERSONAL_AVATAR_ID
      )
    ).toBe(false);
    expect(DEPLOYED_AVATAR_DEFINITIONS).toHaveLength(16);
  });

  it("labels the local entry so deployment consumers can reject it", () => {
    const personalAvatar = AVATAR_DEFINITIONS.find(
      (avatar) => avatar.id === PERSONAL_AVATAR_ID
    );

    expect(personalAvatar).toMatchObject({
      name: "Austen",
      availability: "local-evaluation",
    });
    expect(avatarThumbnailUrl(PERSONAL_AVATAR_ID)).toBeNull();
  });
});
