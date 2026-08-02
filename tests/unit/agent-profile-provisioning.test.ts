import { describe, expect, it } from "vitest";
import {
  AGENT_PROFILE,
  assertSafeAgentPublicProfile,
  buildAgentAdminMetadata,
  buildAgentOwnerPrivateProfile,
  buildAgentPublicProfile,
} from "../../scripts/provision-agent-profile";

describe("agent profile provisioning", () => {
  it("keeps credentials and test markers out of the public profile", () => {
    const profile = buildAgentPublicProfile("timestamp");

    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("isTestAccount");
    expect(profile).not.toHaveProperty("testAccountPurpose");
    expect(() => assertSafeAgentPublicProfile(profile)).not.toThrow();
  });

  it("provisions an ordinary hidden user", () => {
    const profile = buildAgentPublicProfile("timestamp");

    expect(profile).toMatchObject({
      publicProfileVersion: 2,
      displayName: "Codex + Claude",
      username: "codex-claude",
      role: "user",
      isAdmin: false,
      isHidden: true,
      isFeatured: false,
      isAnonymous: false,
    });
  });

  it("puts owner and admin data in their protected documents", () => {
    expect(buildAgentOwnerPrivateProfile()).toEqual({
      email: AGENT_PROFILE.email,
    });
    expect(buildAgentAdminMetadata("timestamp")).toEqual({
      isTestAccount: true,
      testAccountPurpose: AGENT_PROFILE.testAccountPurpose,
      adminLabel: AGENT_PROFILE.adminLabel,
      adminNotes: AGENT_PROFILE.adminNotes,
      updatedAt: "timestamp",
    });
  });

  it("rejects a private field added to the public document", () => {
    const unsafeProfile = {
      ...buildAgentPublicProfile("timestamp"),
      email: AGENT_PROFILE.email,
    };

    expect(() => assertSafeAgentPublicProfile(unsafeProfile)).toThrow("email");
  });

  it("preserves counters when refreshing an existing profile", () => {
    const patch = buildAgentPublicProfile("new-timestamp", {
      sequenceCount: 7,
      totalXP: 42,
    });

    expect(patch).not.toHaveProperty("sequenceCount");
    expect(patch).not.toHaveProperty("totalXP");
    expect(patch.updatedAt).toBe("new-timestamp");
  });
});
