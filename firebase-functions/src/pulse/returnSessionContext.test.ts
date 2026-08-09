import {
  RETURN_SESSION_CONTEXT_MAX_SKEW_MS,
  resolveFreshPostHogSessionId,
} from "./returnSessionContext";

function timestamp(millis: number) {
  return { toMillis: () => millis };
}

describe("resolveFreshPostHogSessionId", () => {
  const activityTimestamp = Date.parse("2026-08-09T12:00:00.000Z");

  it("returns the session captured beside the activity update", () => {
    expect(
      resolveFreshPostHogSessionId(
        {
          postHogSessionId: "session-123",
          postHogSessionCapturedAt: timestamp(activityTimestamp - 500),
        },
        activityTimestamp
      )
    ).toBe("session-123");
  });

  it("rejects stale context from an earlier browser session", () => {
    expect(
      resolveFreshPostHogSessionId(
        {
          postHogSessionId: "stale-session",
          postHogSessionCapturedAt: timestamp(
            activityTimestamp - RETURN_SESSION_CONTEXT_MAX_SKEW_MS - 1
          ),
        },
        activityTimestamp
      )
    ).toBeNull();
  });

  it.each([
    undefined,
    {},
    { postHogSessionId: "" },
    { postHogSessionId: "session-without-time" },
  ])("rejects incomplete context %#", (context) => {
    expect(resolveFreshPostHogSessionId(context, activityTimestamp)).toBeNull();
  });
});
