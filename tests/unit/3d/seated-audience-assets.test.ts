import { describe, expect, it } from "vitest";
import {
  SEATED_AUDIENCE_ANIMATION_URLS,
  SEATED_AUDIENCE_AVATAR_IDS,
  SEATED_AUDIENCE_AVATAR_URLS,
} from "$lib/shared/3d/config/seated-audience-assets";
import { DEPLOYED_AVATAR_DEFINITIONS } from "$lib/shared/3d/config/deployed-avatars";

describe("seated audience assets", () => {
  it("resolves every seat model through the deployed avatar registry", () => {
    expect(SEATED_AUDIENCE_AVATAR_URLS).toHaveLength(
      SEATED_AUDIENCE_AVATAR_IDS.length
    );

    for (const [index, modelUrl] of SEATED_AUDIENCE_AVATAR_URLS.entries()) {
      const parsed = new URL(modelUrl);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname).toBe("assets.tkaflowarts.com");
      expect(parsed.pathname).toBe(
        `/models/avatars/v2026-07-23-r1/${SEATED_AUDIENCE_AVATAR_IDS[index]}.glb.bin`
      );
    }
  });

  it("loads both sitting animations from immutable CDN paths", () => {
    expect(SEATED_AUDIENCE_ANIMATION_URLS).toEqual([
      "https://assets.tkaflowarts.com/animations/v2026-07-23-r1/sitting-idle-a.fbx.bin",
      "https://assets.tkaflowarts.com/animations/v2026-07-23-r1/sitting-idle-b.fbx.bin",
    ]);
  });

  it("does not infer deployment from URL shape or hide registered avatars", () => {
    expect(DEPLOYED_AVATAR_DEFINITIONS).toHaveLength(16);
    expect(
      DEPLOYED_AVATAR_DEFINITIONS.every(
        ({ modelPath }) =>
          new URL(modelPath).protocol === "https:" &&
          new URL(modelPath).hostname === "assets.tkaflowarts.com"
      )
    ).toBe(true);
  });
});
