import { isStaleAnonymousAccount } from "./cleanupStaleAnonymousAccounts";
import type { UserRecord } from "firebase-admin/auth";

const THIRTY_ONE_DAYS_AGO = new Date(
  Date.now() - 31 * 24 * 60 * 60 * 1000
).toUTCString();
const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toUTCString();

function user(partial: Partial<UserRecord>): UserRecord {
  return {
    uid: "u",
    providerData: [],
    metadata: { creationTime: ONE_DAY_AGO, lastSignInTime: ONE_DAY_AGO },
    ...partial,
  } as UserRecord;
}

describe("isStaleAnonymousAccount", () => {
  const now = Date.now();
  it("anonymous + idle > 30 days → stale", () => {
    expect(
      isStaleAnonymousAccount(
        user({
          providerData: [],
          metadata: {
            creationTime: THIRTY_ONE_DAYS_AGO,
            lastSignInTime: THIRTY_ONE_DAYS_AGO,
          } as UserRecord["metadata"],
        }),
        now
      )
    ).toBe(true);
  });
  it("anonymous + active < 30 days → keep", () => {
    expect(isStaleAnonymousAccount(user({ providerData: [] }), now)).toBe(
      false
    );
  });
  it("linked (has providerData) → never stale, even if old", () => {
    expect(
      isStaleAnonymousAccount(
        user({
          providerData: [
            { providerId: "google.com" } as UserRecord["providerData"][number],
          ],
          metadata: {
            creationTime: THIRTY_ONE_DAYS_AGO,
            lastSignInTime: THIRTY_ONE_DAYS_AGO,
          } as UserRecord["metadata"],
        }),
        now
      )
    ).toBe(false);
  });
  it("Instagram custom-auth account → never stale, even without providerData", () => {
    expect(
      isStaleAnonymousAccount(
        user({
          providerData: [],
          customClaims: { instagram: true },
          metadata: {
            creationTime: THIRTY_ONE_DAYS_AGO,
            lastSignInTime: THIRTY_ONE_DAYS_AGO,
          } as UserRecord["metadata"],
        }),
        now
      )
    ).toBe(false);
  });
});
