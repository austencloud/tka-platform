import { scryptSync } from "node:crypto";
import {
  isMagicLinkStateId,
  isMagicLinkRequestId,
  isMagicLinkCode,
  MAGIC_LINK_STATE_LIFETIME_MS,
  MAGIC_LINK_CODE_MAX_ATTEMPTS,
  parseMagicLinkCodeState,
  parseMagicLinkSignInState,
  verifyMagicLinkCode,
} from "./magicLinkStateStore";

describe("magic-link sign-in state", () => {
  it("uses 256-bit URL-safe state with a 30-minute lifetime", () => {
    expect(isMagicLinkStateId("a".repeat(43))).toBe(true);
    expect(isMagicLinkStateId("short")).toBe(false);
    expect(MAGIC_LINK_STATE_LIFETIME_MS).toBe(30 * 60 * 1000);
  });

  it("validates the request id and exact six-digit code shape", () => {
    expect(isMagicLinkRequestId("144599f0-7a73-4f38-8f3d-a654dc6c47c6")).toBe(
      true
    );
    expect(isMagicLinkRequestId("request-1")).toBe(false);
    expect(isMagicLinkCode("012345")).toBe(true);
    expect(isMagicLinkCode("12345")).toBe(false);
    expect(isMagicLinkCode("12345a")).toBe(false);
  });

  it("verifies a salted scrypt code hash", () => {
    const salt = Buffer.from("0123456789abcdef", "utf8");
    const expected = scryptSync("012345", salt, 32, {
      N: 16_384,
      r: 8,
      p: 1,
    });

    expect(
      verifyMagicLinkCode(
        "012345",
        salt.toString("base64"),
        expected.toString("base64")
      )
    ).toBe(true);
    expect(
      verifyMagicLinkCode(
        "012346",
        salt.toString("base64"),
        expected.toString("base64")
      )
    ).toBe(false);
  });

  it("accepts only live, unused code state below the attempt limit", () => {
    const live = {
      email: "person@example.com",
      initiatingUid: "user-1",
      codeSalt: "salt",
      codeHash: "hash",
      codeAttempts: MAGIC_LINK_CODE_MAX_ATTEMPTS - 1,
      codeConsumedAt: null,
      expiresAt: { toMillis: () => 31_000 },
    };

    expect(parseMagicLinkCodeState(live, 30_000)).toEqual({
      email: "person@example.com",
      initiatingUid: "user-1",
      codeSalt: "salt",
      codeHash: "hash",
      codeAttempts: MAGIC_LINK_CODE_MAX_ATTEMPTS - 1,
    });
    expect(
      parseMagicLinkCodeState(
        { ...live, codeAttempts: MAGIC_LINK_CODE_MAX_ATTEMPTS },
        30_000
      )
    ).toBeNull();
    expect(
      parseMagicLinkCodeState(
        { ...live, codeConsumedAt: { toMillis: () => 30_000 } },
        30_000
      )
    ).toBeNull();
    expect(parseMagicLinkCodeState(live, 31_000)).toBeNull();
  });

  it("returns the bound email before expiration", () => {
    expect(
      parseMagicLinkSignInState(
        {
          email: "person@example.com",
          expiresAt: { toMillis: () => 31_000 },
        },
        30_000
      )
    ).toEqual({ email: "person@example.com", expiresAtMs: 31_000 });
  });

  it("rejects expired or malformed state", () => {
    expect(
      parseMagicLinkSignInState(
        {
          email: "person@example.com",
          expiresAt: { toMillis: () => 30_000 },
        },
        30_000
      )
    ).toBeNull();
    expect(
      parseMagicLinkSignInState({ email: "person@example.com" }, 0)
    ).toBeNull();
  });
});
