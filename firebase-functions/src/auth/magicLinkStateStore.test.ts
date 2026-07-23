import {
  isMagicLinkStateId,
  MAGIC_LINK_STATE_LIFETIME_MS,
  parseMagicLinkSignInState,
} from "./magicLinkStateStore";

describe("magic-link sign-in state", () => {
  it("uses 256-bit URL-safe state with a 30-minute lifetime", () => {
    expect(isMagicLinkStateId("a".repeat(43))).toBe(true);
    expect(isMagicLinkStateId("short")).toBe(false);
    expect(MAGIC_LINK_STATE_LIFETIME_MS).toBe(30 * 60 * 1000);
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
