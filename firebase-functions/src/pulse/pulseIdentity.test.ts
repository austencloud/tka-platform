import {
  isGuestSession,
  isGuestUpgrade,
  resolveDisplayName,
  type AuthIdentity,
} from "./pulseIdentity";

const guest: AuthIdentity = {
  email: null,
  displayName: null,
  isAnonymous: true,
};
const full: AuthIdentity = {
  email: "someone@example.com",
  displayName: "Real Person",
  isAnonymous: false,
};

/** The doc a guest's first library save mints: a count, and no identity. */
const identityLessDoc = { sequenceCount: 1, lastActivityDate: {} };

describe("isGuestSession", () => {
  it("believes auth over the doc", () => {
    expect(isGuestSession(guest, identityLessDoc)).toBe(true);
    expect(isGuestSession(guest, { isAnonymous: false })).toBe(true);
    expect(isGuestSession(full, { isAnonymous: true })).toBe(false);
  });

  it("catches the identity-less doc that used to read as a signup", () => {
    expect(isGuestSession(guest, identityLessDoc)).toBe(true);
  });

  it("falls back to the doc flag when the auth lookup failed", () => {
    expect(isGuestSession(null, { isAnonymous: true })).toBe(true);
    expect(isGuestSession(null, { isAnonymous: false })).toBe(false);
    // Unknown either way — prior behavior: treat as a full account and ping.
    expect(isGuestSession(null, identityLessDoc)).toBe(false);
    expect(isGuestSession(null, null)).toBe(false);
  });
});

describe("isGuestUpgrade", () => {
  it("fires on the canonical flag flip", () => {
    expect(isGuestUpgrade({ isAnonymous: true }, { isAnonymous: false })).toBe(
      true
    );
  });

  it("fires when the pre-write doc had no flag at all", () => {
    expect(isGuestUpgrade(identityLessDoc, { isAnonymous: false })).toBe(true);
  });

  it("does not fire without a full account after", () => {
    expect(isGuestUpgrade({ isAnonymous: true }, { isAnonymous: true })).toBe(
      false
    );
    expect(isGuestUpgrade({ isAnonymous: false }, { isAnonymous: false })).toBe(
      false
    );
    expect(isGuestUpgrade(identityLessDoc, identityLessDoc)).toBe(false);
  });
});

describe("resolveDisplayName", () => {
  it("prefers the doc's own name", () => {
    expect(resolveDisplayName({ displayName: "Austen" }, full)).toBe("Austen");
    expect(resolveDisplayName({ username: "austen" }, full)).toBe("austen");
  });

  it("falls back to auth, then the email local part", () => {
    expect(resolveDisplayName(identityLessDoc, full)).toBe("Real Person");
    expect(
      resolveDisplayName(identityLessDoc, { ...full, displayName: null })
    ).toBe("someone");
  });

  it("names a guest a guest instead of 'Someone'", () => {
    expect(resolveDisplayName(identityLessDoc, guest)).toBe("A guest");
    expect(resolveDisplayName({ isAnonymous: true }, null)).toBe("A guest");
  });

  it("still says 'Someone' when nothing at all is known", () => {
    expect(resolveDisplayName(identityLessDoc, null)).toBe("Someone");
    expect(resolveDisplayName(null, null)).toBe("Someone");
  });
});
