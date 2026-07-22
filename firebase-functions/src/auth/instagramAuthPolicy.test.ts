import { createHmac } from "node:crypto";
import {
  InstagramAuthPolicyError,
  instagramSignedRequestFromBody,
  isAllowedInstagramReturnOrigin,
  parseInstagramTokenResponse,
  resolveInstagramIdentity,
  verifyInstagramSignedRequest,
} from "./instagramAuthPolicy";

describe("Instagram auth policy", () => {
  describe("return origins", () => {
    it.each([
      "https://tkaflowarts.com",
      "https://dev.tkaflowarts.com",
      "https://tka-platform.pages.dev",
      "https://feature.tka-platform.pages.dev",
      "https://localhost:5173",
      "https://localhost:5199",
    ])("accepts app-owned origin %s", (origin) => {
      expect(isAllowedInstagramReturnOrigin(origin)).toBe(true);
    });

    it.each([
      "http://tkaflowarts.com",
      "https://tkaflowarts.com.attacker.example",
      "https://localhost:5200",
      "https://example.pages.dev",
      "not-a-url",
    ])("rejects untrusted origin %s", (origin) => {
      expect(isAllowedInstagramReturnOrigin(origin)).toBe(false);
    });
  });

  it("preserves an Instagram ID larger than Number.MAX_SAFE_INTEGER", () => {
    const result = parseInstagramTokenResponse(
      '{"access_token":"token-value","user_id":17841470000001234}'
    );
    expect(result).toEqual({
      accessToken: "token-value",
      userId: "17841470000001234",
    });
  });

  it("rejects a token response without both credential fields", () => {
    expect(() => parseInstagramTokenResponse('{"user_id":"123"}')).toThrow(
      InstagramAuthPolicyError
    );
  });

  describe("identity resolution", () => {
    it("upgrades a new anonymous identity in place", () => {
      expect(
        resolveInstagramIdentity({
          intent: "signin",
          requesterUid: "anon",
          requesterWasAnonymous: true,
          existingUid: null,
        })
      ).toEqual({ resolvedUid: "anon", collision: false, createLink: true });
    });

    it("signs into the existing uid and reports an anonymous collision", () => {
      expect(
        resolveInstagramIdentity({
          intent: "signin",
          requesterUid: "anon",
          requesterWasAnonymous: true,
          existingUid: "existing",
        })
      ).toEqual({
        resolvedUid: "existing",
        collision: true,
        createLink: false,
      });
    });

    it("refuses to link an identity owned by another uid", () => {
      expect(() =>
        resolveInstagramIdentity({
          intent: "link",
          requesterUid: "current",
          requesterWasAnonymous: false,
          existingUid: "other",
        })
      ).toThrow("instagram/already-linked");
    });

    it("requires the connected identity for reauthentication", () => {
      expect(() =>
        resolveInstagramIdentity({
          intent: "reauth",
          requesterUid: "current",
          requesterWasAnonymous: false,
          existingUid: null,
        })
      ).toThrow("instagram/reauth-mismatch");
    });
  });

  it("verifies Meta signed_request without rounding its user ID", () => {
    const secret = "test-secret";
    const payload = Buffer.from(
      '{"algorithm":"HMAC-SHA256","user_id":17841470000001234}'
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

    expect(
      verifyInstagramSignedRequest(`${signature}.${payload}`, secret)
    ).toBe("17841470000001234");
    expect(() =>
      verifyInstagramSignedRequest(`wrong.${payload}`, secret)
    ).toThrow("instagram/invalid-response");
  });

  it("reads signed_request from Meta's form body shapes", () => {
    expect(
      instagramSignedRequestFromBody({ signed_request: "signed.payload" })
    ).toBe("signed.payload");
    expect(
      instagramSignedRequestFromBody("signed_request=signed.payload")
    ).toBe("signed.payload");
    expect(
      instagramSignedRequestFromBody(
        Buffer.from("signed_request=signed.payload", "utf8")
      )
    ).toBe("signed.payload");
  });
});
