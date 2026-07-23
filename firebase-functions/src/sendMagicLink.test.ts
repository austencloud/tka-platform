import * as functions from "firebase-functions";
import {
  handleResolveMagicLinkEmail,
  handleSendMagicLink,
  type MagicLinkRuntime,
  type ResolveMagicLinkEmailRuntime,
} from "./sendMagicLink";

const REQUEST_ID = "144599f0-7a73-4f38-8f3d-a654dc6c47c6";
const RECIPIENT = "person@example.com";
const MAGIC_LINK_STATE = "a".repeat(43);
const MAGIC_LINK_EXPIRES_AT = 1_800_000;
const MAGIC_LINK =
  "https://the-kinetic-alphabet.firebaseapp.com/__/auth/action?oobCode=secret";

type RuntimeOverrides = Partial<Omit<MagicLinkRuntime, "logger">> & {
  logger?: Partial<MagicLinkRuntime["logger"]>;
};

function providerResponse(
  body: Record<string, unknown>,
  status = 201
): Pick<Response, "ok" | "status" | "json"> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createRuntime(overrides: RuntimeOverrides = {}) {
  let now = 1_000;
  const info = jest.fn();
  const error = jest.fn();

  const runtime: MagicLinkRuntime = {
    brevoApiKey: "brevo-test-key",
    senderEmail: "noreply@tkaflowarts.com",
    senderName: "Flow Arts Composer",
    appCheckStatus: "missing",
    authStatus: "anonymous",
    now: () => {
      now += 25;
      return now;
    },
    createRequestId: () => REQUEST_ID,
    createSignInState: jest.fn().mockResolvedValue({
      state: MAGIC_LINK_STATE,
      expiresAtMs: MAGIC_LINK_EXPIRES_AT,
    }),
    generateLink: jest.fn().mockResolvedValue(MAGIC_LINK),
    fetch: jest
      .fn()
      .mockResolvedValue(providerResponse({ messageId: "brevo-message-1" })),
    ...overrides,
    logger: {
      info,
      error,
      ...overrides.logger,
    },
  };

  return { runtime, info, error };
}

async function expectHttpsError(
  promise: Promise<unknown>,
  code: functions.https.FunctionsErrorCode
) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("handleSendMagicLink", () => {
  it.each(["", "not-an-email", "person@example"])(
    "rejects invalid recipient input without calling Firebase or Brevo: %p",
    async (email) => {
      const { runtime } = createRuntime();

      await expectHttpsError(
        handleSendMagicLink({ email }, runtime),
        "invalid-argument"
      );

      expect(runtime.generateLink).not.toHaveBeenCalled();
      expect(runtime.fetch).not.toHaveBeenCalled();
    }
  );

  it("reports missing provider configuration without exposing the recipient", async () => {
    const { runtime, error } = createRuntime({ brevoApiKey: undefined });

    await expectHttpsError(
      handleSendMagicLink({ email: RECIPIENT }, runtime),
      "failed-precondition"
    );

    expect(runtime.generateLink).not.toHaveBeenCalled();
    expect(runtime.createSignInState).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain(RECIPIENT);
  });

  it("maps Firebase's invalid-email error to a callable validation error", async () => {
    const authError = Object.assign(new Error("invalid email"), {
      code: "auth/invalid-email",
    });
    const { runtime } = createRuntime({
      generateLink: jest.fn().mockRejectedValue(authError),
    });

    await expectHttpsError(
      handleSendMagicLink({ email: RECIPIENT }, runtime),
      "invalid-argument"
    );
    expect(runtime.fetch).not.toHaveBeenCalled();
  });

  it("maps a rejected Brevo request to an internal callable error", async () => {
    const { runtime, error } = createRuntime({
      fetch: jest.fn().mockResolvedValue(providerResponse({}, 429)),
    });

    await expectHttpsError(
      handleSendMagicLink({ email: RECIPIENT }, runtime),
      "internal"
    );

    expect(error).toHaveBeenCalledWith(
      "Magic link request failed",
      expect.objectContaining({
        requestId: REQUEST_ID,
        stage: "provider_request",
        providerStatus: 429,
      })
    );
  });

  it("returns provider details and correlates the accepted request", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(providerResponse({ messageId: "brevo-message-2" }));
    const { runtime, info } = createRuntime({ fetch });

    await expect(
      handleSendMagicLink(
        {
          email: RECIPIENT,
          continueUrl: "https://tkaflowarts.com/create",
          requestId: REQUEST_ID,
        },
        runtime
      )
    ).resolves.toEqual({
      success: true,
      message: "Magic link sent. Check your email.",
      requestId: REQUEST_ID,
      subject: "Your Flow Arts Composer sign-in link",
      senderEmail: "noreply@tkaflowarts.com",
    });

    expect(runtime.generateLink).toHaveBeenCalledWith(RECIPIENT, {
      url: `https://tkaflowarts.com/create?magicLinkState=${MAGIC_LINK_STATE}`,
      handleCodeInApp: true,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({ method: "POST" })
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        to: [{ email: RECIPIENT }],
        subject: "Your Flow Arts Composer sign-in link",
        tags: ["authentication", "magic-link"],
        headers: { "X-Mailin-custom": `request_id:${REQUEST_ID}` },
      })
    );
    expect(String(request.body)).toContain("expires in 30 minutes");
    expect(String(request.body)).not.toContain("expires in 1 hour");
    expect(info).toHaveBeenCalledWith(
      "Magic link provider accepted",
      expect.objectContaining({
        requestId: REQUEST_ID,
        providerMessageId: "brevo-message-2",
        providerStatus: 201,
      })
    );
  });

  it("maps a provider timeout to a retryable callable error", async () => {
    const { runtime, error } = createRuntime({
      fetch: jest
        .fn()
        .mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    });

    await expectHttpsError(
      handleSendMagicLink({ email: RECIPIENT }, runtime),
      "unavailable"
    );
    expect(error).toHaveBeenCalledWith(
      "Magic link request failed",
      expect.objectContaining({ errorCode: "provider/timeout" })
    );
  });

  it("never writes a recipient or sign-in link to structured logs", async () => {
    const { runtime, info, error } = createRuntime();

    await handleSendMagicLink({ email: RECIPIENT }, runtime);

    const serializedLogs = JSON.stringify({
      info: info.mock.calls,
      error: error.mock.calls,
    });
    expect(serializedLogs).not.toContain(RECIPIENT);
    expect(serializedLogs).not.toContain(MAGIC_LINK);
    expect(serializedLogs).toContain(REQUEST_ID);
  });
});

describe("handleResolveMagicLinkEmail", () => {
  function createResolveRuntime(
    result: Awaited<
      ReturnType<ResolveMagicLinkEmailRuntime["resolveSignInState"]>
    >
  ): ResolveMagicLinkEmailRuntime {
    return {
      resolveSignInState: jest.fn().mockResolvedValue(result),
    };
  }

  it("returns the email bound to a valid opaque state", async () => {
    const runtime = createResolveRuntime({
      email: RECIPIENT,
      expiresAtMs: MAGIC_LINK_EXPIRES_AT,
    });

    await expect(
      handleResolveMagicLinkEmail(
        { action: "resolve-email", state: MAGIC_LINK_STATE },
        runtime
      )
    ).resolves.toEqual({
      success: true,
      email: RECIPIENT,
    });
    expect(runtime.resolveSignInState).toHaveBeenCalledWith(MAGIC_LINK_STATE);
  });

  it("rejects missing, malformed, or expired state without returning an email", async () => {
    const runtime = createResolveRuntime(null);

    await expectHttpsError(
      handleResolveMagicLinkEmail(
        { action: "resolve-email", state: "expired" },
        runtime
      ),
      "failed-precondition"
    );
  });
});
