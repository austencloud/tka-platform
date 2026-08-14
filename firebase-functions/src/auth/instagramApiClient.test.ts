import { exchangeInstagramAuthorizationCode } from "./instagramApiClient";

describe("Instagram authorization-code exchange", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses Meta's multipart token request with the exact redirect URI", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "short-lived-token",
          user_id: "17841400000000000",
        }),
        { status: 200 }
      )
    );

    await expect(
      exchangeInstagramAuthorizationCode({
        code: "fresh-code",
        appId: "app-id",
        appSecret: "app-secret",
        redirectUrl: "https://tkaflowarts.com/api/share/meta/callback",
      })
    ).resolves.toEqual({
      accessToken: "short-lived-token",
      userId: "17841400000000000",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);

    const body = init?.body as FormData;
    expect(body.get("client_id")).toBe("app-id");
    expect(body.get("client_secret")).toBe("app-secret");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("redirect_uri")).toBe(
      "https://tkaflowarts.com/api/share/meta/callback"
    );
    expect(body.get("code")).toBe("fresh-code");
  });

  it("classifies Meta's misleading redirect response as app configuration", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error_type: "OAuthException",
          code: 400,
          error_message:
            "Error validating verification code. Please make sure your redirect_uri is identical.",
        }),
        { status: 400 }
      )
    );

    await expect(
      exchangeInstagramAuthorizationCode({
        code: "fresh-code",
        appId: "app-id",
        appSecret: "wrong-app-secret",
        redirectUrl: "https://tkaflowarts.com/api/share/meta/callback",
      })
    ).rejects.toMatchObject({
      code: "instagram/app-configuration-mismatch",
    });
  });
});
