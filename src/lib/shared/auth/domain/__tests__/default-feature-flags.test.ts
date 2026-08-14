import { describe, it, expect } from "vitest";
import {
  DEFAULT_FEATURE_FLAGS,
  getDefaultFeatureConfig,
} from "../default-feature-flags";

describe("onboarding first-session-activation flag", () => {
  it("is registered and defaulted off", () => {
    const config = getDefaultFeatureConfig(
      "capability:onboarding:first-session-activation"
    );
    expect(config).not.toBeNull();
    expect(config?.enabled).toBe(false);
    expect(config?.minimumRole).toBe("user");
  });

  it("appears exactly once in DEFAULT_FEATURE_FLAGS", () => {
    const matches = DEFAULT_FEATURE_FLAGS.filter(
      (f) => f.id === "capability:onboarding:first-session-activation"
    );
    expect(matches.length).toBe(1);
  });
});

describe("Create tab access", () => {
  it("releases Fuse to user accounts while Assemble stays admin-only", () => {
    const fuse = getDefaultFeatureConfig("tab:create:fuse");
    const assemble = getDefaultFeatureConfig("tab:create:assemble");

    expect(fuse?.enabled).toBe(true);
    expect(fuse?.minimumRole).toBe("user");
    expect(assemble?.minimumRole).toBe("admin");
  });
});
