import { InstagramAuthPolicyError } from "../auth/instagramAuthPolicy";
import { metaConnectFailureCode } from "./metaConnect";
import {
  MetaConnectError,
  metaConnectFailureMessage,
} from "./metaConnectStateStore";

describe("Meta publishing connection failures", () => {
  it("preserves connection-state failures", () => {
    expect(
      metaConnectFailureCode(new MetaConnectError("meta/state-expired"))
    ).toBe("meta/state-expired");
  });

  it("maps an Instagram app mismatch to an actionable public code", () => {
    const code = metaConnectFailureCode(
      new InstagramAuthPolicyError("instagram/app-configuration-mismatch")
    );

    expect(code).toBe("meta/app-configuration-mismatch");
    expect(metaConnectFailureMessage(code)).toContain(
      "Trying again will not fix this"
    );
  });

  it("maps an ineligible account without exposing provider text", () => {
    expect(
      metaConnectFailureCode(
        new InstagramAuthPolicyError("instagram/account-type-required")
      )
    ).toBe("meta/account-type-required");
  });

  it("keeps unknown failures in the provider bucket", () => {
    expect(metaConnectFailureCode(new Error("private provider detail"))).toBe(
      "meta/provider-error"
    );
  });
});
